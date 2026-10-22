import { database, dateTime, numberValue, optionalText } from "@/lib/database";
import { readJsonObject } from "@/lib/request-body";
import { camelizeRow, deleteRows, selectOne, snakeRow, updateRows, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { decryptRecordFields, encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { archiveForRecovery, assertRateLimit } from "@/lib/security";
import { adjustInventoryStock } from "@/lib/inventory";
import { costCents, costFields } from "@/lib/service-profit";
import { editedRecord } from "@/lib/record-edit";
import { recordNotes } from "@/lib/record-edit-fields";
const configs = {
    leads: {
        table: "leads",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["novo", "contato", "visita", "proposta", "negociacao", "ganho", "perdido"]),
        select: `SELECT id, name, phone, source, interest, status, estimated_value_cents AS estimatedValueCents, next_action AS nextAction, created_at AS createdAt FROM leads WHERE id = ? AND organization_id = ?`,
    },
    quotes: {
        table: "quotes",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["rascunho", "enviado", "aprovado", "recusado"]),
        select: `SELECT id, quote_number AS quoteNumber, client_name AS clientName, service, materials_cents AS materialsCents, labor_cents AS laborCents, discount_cents AS discountCents, total_cents AS totalCents, status, valid_until AS validUntil, notes, created_at AS createdAt FROM quotes WHERE id = ? AND organization_id = ?`,
    },
    appointments: {
        table: "appointments",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["agendado", "em_rota", "concluido", "remarcado", "cancelado"]),
        select: `SELECT id, title, client_name AS clientName, start_at AS startAt, address, technician, kind, status, notes FROM appointments WHERE id = ? AND organization_id = ?`,
    },
    workOrders: {
        table: "work_orders",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["aberta", "em_execucao", "concluida"]),
        select: `SELECT id, os_number AS osNumber, client_name AS clientName, service, scheduled_at AS scheduledAt, technician, status, ph, chlorine, alkalinity, products_used AS productsUsed, notes, amount_cents AS amountCents FROM work_orders WHERE id = ? AND organization_id = ?`,
    },
    transactions: {
        table: "transactions",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["pendente", "pago", "atrasado"]),
        select: `SELECT id, description, type, category, amount_cents AS amountCents, due_date AS dueDate, status FROM transactions WHERE id = ? AND organization_id = ?`,
    },
    inventory: {
        table: "inventory_items",
        updateColumn: "quantity",
        inputKey: "quantity",
        select: `SELECT id, name, sku, unit, quantity, minimum_quantity AS minimumQuantity, cost_cents AS costCents FROM inventory_items WHERE id = ? AND organization_id = ?`,
    },
    warranties: {
        table: "warranties",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["ativa", "agendada", "concluida", "expirada"]),
        select: `SELECT id, warranty_number AS warrantyNumber, client_name AS clientName, item, origin_reference AS originReference, purchase_date AS purchaseDate, expires_at AS expiresAt, scheduled_at AS scheduledAt, appointment_id AS appointmentId, technician, status, notes, created_at AS createdAt FROM warranties WHERE id = ? AND organization_id = ?`,
    },
    contracts: {
        table: "contracts",
        updateColumn: "status",
        inputKey: "status",
        allowed: new Set(["rascunho", "ativo", "suspenso", "encerrado"]),
        select: `SELECT id, contract_number AS contractNumber, client_name AS clientName, client_document AS clientDocument, client_address AS clientAddress, service, start_date AS startDate, end_date AS endDate, frequency, monthly_cents AS monthlyCents, payment_day AS paymentDay, status, terms, created_at AS createdAt FROM contracts WHERE id = ? AND organization_id = ?`,
    },
};
const deleteTables = {
    leads: "leads",
    quotes: "quotes",
    appointments: "appointments",
    workOrders: "work_orders",
    customers: "customers",
    inventory: "inventory_items",
    transactions: "transactions",
    employees: "employees",
    warranties: "warranties",
    contracts: "contracts",
};
export async function PATCH(request, context) {
    try {
        const { user, organization } = await requireTenant(request);
        await assertRateLimit(request, "record_update", user.id, 90, 60);
        const { id } = await context.params;
        const body = await readJsonObject(request);
        const entity = optionalText(body.entity);
        if (!Object.hasOwn(entityPermissions, entity) || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions[entity], organization.moduleAccess)) {
            return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
        }
        if (entity === "workOrders" && body.status === "em_execucao" && !body.action) body.action = "start";
        if (body.action === "edit" || (entity === "workOrders" && body.action === "start")) {
            const table = deleteTables[entity];
            if (!table) return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
            const db = database();
            const stored = usesSupabase()
                ? await selectOne(table, { id, organization_id: organization.id })
                : await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND organization_id = ?`).bind(id, organization.id).first();
            if (!stored) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
            const existing = await decryptRecordFields(camelizeRow(stored), encryptedFieldsByEntity[entity] ?? []);
            if (entity === "employees") existing.active = Boolean(existing.active);
            let patch;
            if (body.action === "start") {
                if (existing.status === "concluida") return Response.json({ error: "O serviço já foi concluído." }, { status: 409 });
                if (existing.status === "em_execucao") return Response.json({ record: existing });
                const notes = recordNotes(existing.notes);
                notes.details.executionStartedAt = new Date().toISOString();
                notes.details.executionStartedBy = user.id;
                patch = { status: "em_execucao", notes: JSON.stringify(notes) };
            } else {
                if (!body.expected || typeof body.expected !== "object" || Array.isArray(body.expected) || body.expected.id !== id)
                    return Response.json({ error: "Reabra o registro antes de editar." }, { status: 400 });
                for (const [key, value] of Object.entries(body.expected)) {
                    if (key in existing && JSON.stringify(existing[key]) !== JSON.stringify(value))
                        return Response.json({ error: "Este registro mudou durante a edição. Atualize e reabra para conferir os dados." }, { status: 409 });
                }
                patch = await editedRecord(entity, body, existing, { organizationId: organization.id, canManageCosts: hasFeaturePermission(organization.role, organization.permissions, "finance", organization.moduleAccess) });
            }
            const updatedAt = new Date().toISOString();
            const values = { ...snakeRow(patch), updated_at: updatedAt };
            const filters = { id, organization_id: organization.id, ...(stored.updated_at ? { updated_at: stored.updated_at } : {}) };
            if (usesSupabase()) {
                const protectedValues = await encryptRecordFields(values, (encryptedFieldsByEntity[entity] ?? []).map(key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)));
                const rows = await updateRows(table, protectedValues, filters);
                if (!rows.length) return Response.json({ error: "O registro mudou. Atualize antes de salvar novamente." }, { status: 409 });
                return Response.json({ record: await decryptRecordFields(camelizeRow(rows[0]), encryptedFieldsByEntity[entity] ?? []) });
            }
            const columns = Object.keys(values);
            const result = await db.prepare(`UPDATE ${table} SET ${columns.map(column => `${column} = ?`).join(", ")} WHERE id = ? AND organization_id = ?${stored.updated_at ? " AND updated_at = ?" : ""}`)
                .bind(...columns.map(column => typeof values[column] === "boolean" ? Number(values[column]) : values[column]), id, organization.id, ...(stored.updated_at ? [stored.updated_at] : [])).run();
            if (!result.meta.changes) return Response.json({ error: "O registro mudou. Atualize antes de salvar novamente." }, { status: 409 });
            const record = camelizeRow(await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND organization_id = ?`).bind(id, organization.id).first());
            if (entity === "employees") record.active = Boolean(record.active);
            return Response.json({ record });
        }
        const config = configs[entity];
        if (!config)
            return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
        const db = database();
        if (entity === "inventory" && body.action === "adjustStock") {
            return Response.json({ record: await adjustInventoryStock(id, organization.id, body.delta) });
        }
        if (entity === "appointments" && optionalText(body.action) === "reschedule") {
            const startAt = dateTime(body.startAt);
            if (!startAt)
                return Response.json({ error: "Informe a nova data e hora." }, { status: 400 });
            const updatedAt = new Date().toISOString();
            if (usesSupabase()) {
                const rows = await updateRows("appointments", { start_at: startAt, status: "remarcado", updated_at: updatedAt }, { id, organization_id: organization.id });
                if (!rows.length)
                    return Response.json({ error: "Agendamento não encontrado." }, { status: 404 });
                return Response.json({ record: await decryptRecordFields(camelizeRow(rows[0]), encryptedFieldsByEntity.appointments ?? []) });
            }
            const result = await db.batch([
                db.prepare("UPDATE appointments SET start_at = ?, status = 'remarcado', updated_at = ? WHERE id = ? AND organization_id = ?").bind(startAt, updatedAt, id, organization.id),
                db.prepare(config.select).bind(id, organization.id),
            ]);
            const record = result[1].results[0];
            if (!record)
                return Response.json({ error: "Agendamento não encontrado." }, { status: 404 });
            return Response.json({ record });
        }
        if (entity === "workOrders" && optionalText(body.action) === "complete") {
            const report = body.completionReport && typeof body.completionReport === "object" ? body.completionReport : {};
            const summary = optionalText(report.summary);
            const customerName = optionalText(report.customerName);
            if (summary.length < 5 || !customerName || report.confirmed !== true) {
                return Response.json({ error: "Informe o relatório, o nome do cliente e confirme a validação com ele." }, { status: 400 });
            }
            const existing = usesSupabase()
                ? await selectOne("work_orders", { id, organization_id: organization.id })
                : await db.prepare(config.select).bind(id, organization.id).first();
            if (!existing)
                return Response.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
            const clear = usesSupabase()
                ? await decryptRecordFields(camelizeRow(existing), ["notes"])
                : existing;
            if (clear.status === "concluida") return Response.json({ error: "O serviço já foi concluído e seu relatório foi preservado." }, { status: 409 });
            let noteText = "";
            let details = {};
            try {
                const parsed = JSON.parse(String(clear.notes ?? ""));
                noteText = String(parsed.text ?? "");
                details = parsed.details ?? {};
            }
            catch {
                noteText = optionalText(clear.notes);
            }
            const completedAt = new Date().toISOString();
            const signature = optionalText(report.signature);
            if (signature && (signature.length > 100000 || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(signature)))
                return Response.json({ error: "Assinatura inválida." }, { status: 400 });
            const readings = {};
            for (const [key, maximum] of [["ph", 14], ["chlorine", 100], ["alkalinity", 2000]]) {
                if (report[key] === undefined)
                    continue;
                const value = report[key] === "" ? null : Number(String(report[key]).replace(",", "."));
                if (value !== null && (!Number.isFinite(value) || value < 0 || value > maximum))
                    return Response.json({ error: "Leitura da água inválida." }, { status: 400 });
                readings[key] = value;
            }
            for (const key of costFields) {
                if (report[key] === undefined || report[key] === "")
                    continue;
                if (!hasFeaturePermission(organization.role, organization.permissions, "finance", organization.moduleAccess))
                    return Response.json({ error: "Seu perfil não pode alterar custos financeiros." }, { status: 403 });
                const value = costCents(report[key]);
                if (value === null)
                    return Response.json({ error: "Informe custos válidos." }, { status: 400 });
                details[key] = (value / 100).toFixed(2);
            }
            const products = report.productsUsed === undefined ? undefined : optionalText(report.productsUsed).slice(0, 4000);
            if (report.checklist !== undefined && (!report.checklist || typeof report.checklist !== "object" || Array.isArray(report.checklist))) {
                return Response.json({ error: "Checklist inválido." }, { status: 400 });
            }
            const checklist = clear.checklist && typeof clear.checklist === "object" && !Array.isArray(clear.checklist) ? { ...clear.checklist } : {};
            const submitted = report.checklist;
            for (const key of ["medir_ph", "medir_cloro", "escovar_bordas", "limpar_pre_filtro", "aspirar_fundo", "aplicar_produto", "tirar_foto_final", "cliente_confirmou"]) {
                if (submitted?.[key] !== undefined && typeof submitted[key] !== "boolean")
                    return Response.json({ error: "Checklist inválido." }, { status: 400 });
                if (submitted?.[key] !== undefined)
                    checklist[key] = submitted[key];
            }
            const notes = JSON.stringify({ text: noteText, details: { ...details, completionReport: JSON.stringify({ summary, customerName, checklist, signature, confirmedAt: completedAt, confirmedBy: user.id }) } });
            const updatedAt = completedAt;
            if (usesSupabase()) {
                const protectedNotes = await encryptRecordFields({ notes, ...(products === undefined ? {} : { products_used: products }) }, ["notes", "products_used"]);
                const rows = await updateRows("work_orders", { status: "concluida", ...protectedNotes, ...readings, checklist, completed_at: completedAt, updated_at: updatedAt }, { id, organization_id: organization.id });
                if (!rows.length)
                    return Response.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
                return Response.json({ record: await decryptRecordFields(camelizeRow(rows[0]), ["notes", "productsUsed"]) });
            }
            await db.prepare("UPDATE work_orders SET status = 'concluida', notes = ?, ph = ?, chlorine = ?, alkalinity = ?, products_used = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(notes, readings.ph === undefined ? clear.ph : readings.ph, readings.chlorine === undefined ? clear.chlorine : readings.chlorine, readings.alkalinity === undefined ? clear.alkalinity : readings.alkalinity, products ?? clear.productsUsed ?? "", updatedAt, id, organization.id).run();
            const result = await db.prepare(config.select).bind(id, organization.id).first();
            return Response.json({ record: result });
        }
        if (entity === "workOrders" && optionalText(body.status) === "concluida") {
            return Response.json({ error: "Conclua a ordem pelo relatório técnico para registrar a confirmação do cliente." }, { status: 400 });
        }
        if (entity === "workOrders") {
            const existing = usesSupabase() ? await selectOne("work_orders", { id, organization_id: organization.id }) : await db.prepare(config.select).bind(id, organization.id).first();
            if (!existing) return Response.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
            if (existing.status === "concluida") return Response.json({ error: "O serviço foi concluído e seu relatório foi preservado." }, { status: 409 });
        }
        const raw = body[config.inputKey];
        const value = entity === "inventory" ? Math.max(0, numberValue(raw)) : optionalText(raw);
        if (config.allowed && !config.allowed.has(String(value))) {
            return Response.json({ error: "Status inválido." }, { status: 400 });
        }
        const updatedAt = new Date().toISOString();
        if (usesSupabase()) {
            const rows = await updateRows(config.table, {
                [config.updateColumn]: value,
                updated_at: updatedAt,
            }, { id, organization_id: organization.id });
            if (!rows.length)
                return Response.json({ error: "Registro não encontrado." }, { status: 404 });
            const clearRecord = camelizeRow(rows[0]);
            return Response.json({ record: await decryptRecordFields(clearRecord, encryptedFieldsByEntity[entity] ?? []) });
        }
        const result = await db.batch([
            db.prepare(`UPDATE ${config.table} SET ${config.updateColumn} = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).bind(value, updatedAt, id, organization.id),
            db.prepare(config.select).bind(id, organization.id),
        ]);
        const record = result[1].results[0];
        if (!record)
            return Response.json({ error: "Registro não encontrado." }, { status: 404 });
        return Response.json({ record });
    }
    catch (error) {
        console.error("record_update_failed", error);
        return tenantError(error, "Não foi possível atualizar o registro.");
    }
}
export async function DELETE(request, context) {
    try {
        const { id } = await context.params;
        const { user, organization } = await requireTenant(request, ["owner", "admin"]);
        await assertRateLimit(request, "record_delete", user.id, 30, 60);
        const url = new URL(request.url);
        const entity = optionalText(url.searchParams.get("entity"));
        if (!Object.hasOwn(entityPermissions, entity) || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions[entity], organization.moduleAccess)) {
            return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
        }
        const table = deleteTables[entity];
        if (!table)
            return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
        const db = database();
        if (usesSupabase()) {
            if (entity === "warranties") {
                const warranty = await selectOne("warranties", { id, organization_id: organization.id });
                if (!warranty)
                    return Response.json({ error: "Registro não encontrado." }, { status: 404 });
                const appointmentId = String(warranty.appointment_id ?? "");
                await archiveForRecovery({ organizationId: organization.id, entityType: entity, recordId: id, record: warranty, deletedByUserId: user.id });
                if (appointmentId) {
                    const appointment = await selectOne("appointments", { id: appointmentId, organization_id: organization.id });
                    if (appointment)
                        await archiveForRecovery({ organizationId: organization.id, entityType: "appointments", recordId: appointmentId, record: appointment, deletedByUserId: user.id });
                    await deleteRows("appointments", { id: appointmentId, organization_id: organization.id });
                }
                await deleteRows("warranties", { id, organization_id: organization.id });
                return Response.json({ deleted: true, id, relatedAppointmentId: appointmentId || null });
            }
            const record = await selectOne(table, { id, organization_id: organization.id });
            if (!record)
                return Response.json({ error: "Registro não encontrado." }, { status: 404 });
            await archiveForRecovery({ organizationId: organization.id, entityType: entity, recordId: id, record, deletedByUserId: user.id });
            await deleteRows(table, { id, organization_id: organization.id });
            return Response.json({ deleted: true, id });
        }
        if (entity === "warranties") {
            const warranty = await db.prepare(`SELECT appointment_id AS appointmentId FROM warranties WHERE id = ? AND organization_id = ?`)
                .bind(id, organization.id)
                .first();
            if (!warranty)
                return Response.json({ error: "Registro não encontrado." }, { status: 404 });
            const statements = [db.prepare(`DELETE FROM warranties WHERE id = ? AND organization_id = ?`).bind(id, organization.id)];
            if (warranty.appointmentId) {
                statements.unshift(db.prepare(`DELETE FROM appointments WHERE id = ? AND organization_id = ?`).bind(warranty.appointmentId, organization.id));
            }
            await db.batch(statements);
            return Response.json({ deleted: true, id, relatedAppointmentId: warranty.appointmentId || null });
        }
        const result = await db.prepare(`DELETE FROM ${table} WHERE id = ? AND organization_id = ?`).bind(id, organization.id).run();
        if (!result.meta.changes)
            return Response.json({ error: "Registro não encontrado." }, { status: 404 });
        return Response.json({ deleted: true, id });
    }
    catch (error) {
        console.error("record_delete_failed", error);
        return tenantError(error, "Não foi possível excluir o registro.");
    }
}
