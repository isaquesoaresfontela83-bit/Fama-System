import { database, dateTime, numberValue, optionalText } from "@/lib/database";
import { camelizeRow, deleteRows, selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { decryptRecordFields, encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { archiveForRecovery, assertRateLimit } from "@/lib/security";
import { adjustInventoryStock } from "@/lib/inventory";

type Config = {
  table: string;
  updateColumn: string;
  inputKey: string;
  allowed?: Set<string>;
  select: string;
};

const configs: Record<string, Config> = {
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

const deleteTables: Record<string, string> = {
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, organization } = await requireTenant(request);
    await assertRateLimit(request, "record_update", user.id, 90, 60);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const entity = optionalText(body.entity);
    if (!entityPermissions[entity] || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions[entity])) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    const config = configs[entity];
    if (!config) return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
    const db = database();

    if (entity === "inventory" && body.action === "adjustStock") {
      return Response.json({ record: await adjustInventoryStock(id, organization.id, body.delta) });
    }

    if (entity === "appointments" && optionalText(body.action) === "reschedule") {
      const startAt = dateTime(body.startAt);
      if (!startAt) return Response.json({ error: "Informe a nova data e hora." }, { status: 400 });
      const updatedAt = new Date().toISOString();
      if (usesSupabase()) {
        const rows = await updateRows<Record<string, unknown>>("appointments", { start_at: startAt, status: "remarcado", updated_at: updatedAt }, { id, organization_id: organization.id });
        if (!rows.length) return Response.json({ error: "Agendamento não encontrado." }, { status: 404 });
        return Response.json({ record: camelizeRow<Record<string, unknown>>(rows[0]) });
      }
      const result = await db.batch([
        db.prepare("UPDATE appointments SET start_at = ?, status = 'remarcado', updated_at = ? WHERE id = ? AND organization_id = ?").bind(startAt, updatedAt, id, organization.id),
        db.prepare(config.select).bind(id, organization.id),
      ]);
      const record = result[1].results[0];
      if (!record) return Response.json({ error: "Agendamento não encontrado." }, { status: 404 });
      return Response.json({ record });
    }

    if (entity === "workOrders" && optionalText(body.action) === "complete") {
      const report = body.completionReport && typeof body.completionReport === "object" ? body.completionReport as Record<string, unknown> : {};
      const summary = optionalText(report.summary);
      const customerName = optionalText(report.customerName);
      if (summary.length < 5 || !customerName || report.confirmed !== true) {
        return Response.json({ error: "Informe o relatório, o nome do cliente e confirme a validação com ele." }, { status: 400 });
      }
      const existing = usesSupabase()
        ? await selectOne<Record<string, unknown>>("work_orders", { id, organization_id: organization.id })
        : await db.prepare(config.select).bind(id, organization.id).first<Record<string, unknown>>();
      if (!existing) return Response.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
      const clear = usesSupabase()
        ? await decryptRecordFields(camelizeRow<Record<string, unknown>>(existing), ["notes"])
        : existing;
      let noteText = "";
      let details: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(String(clear.notes ?? "")) as { text?: string; details?: Record<string, unknown> };
        noteText = String(parsed.text ?? "");
        details = parsed.details ?? {};
      } catch { noteText = optionalText(clear.notes); }
      const completedAt = new Date().toISOString();
      const notes = JSON.stringify({ text: noteText, details: { ...details, completionReport: JSON.stringify({ summary, customerName, confirmedAt: completedAt, confirmedBy: user.id }) } });
      const updatedAt = completedAt;
      if (usesSupabase()) {
        const protectedNotes = await encryptRecordFields({ notes }, ["notes"]);
        const rows = await updateRows<Record<string, unknown>>("work_orders", { status: "concluida", notes: protectedNotes.notes, updated_at: updatedAt }, { id, organization_id: organization.id });
        if (!rows.length) return Response.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
        return Response.json({ record: await decryptRecordFields(camelizeRow<Record<string, unknown>>(rows[0]), ["notes", "productsUsed"]) });
      }
      await db.prepare("UPDATE work_orders SET status = 'concluida', notes = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(notes, updatedAt, id, organization.id).run();
      const result = await db.prepare(config.select).bind(id, organization.id).first<Record<string, unknown>>();
      return Response.json({ record: result });
    }

    if (entity === "workOrders" && optionalText(body.status) === "concluida") {
      return Response.json({ error: "Conclua a ordem pelo relatório técnico para registrar a confirmação do cliente." }, { status: 400 });
    }

    const raw = body[config.inputKey];
    const value = entity === "inventory" ? Math.max(0, numberValue(raw)) : optionalText(raw);
    if (config.allowed && !config.allowed.has(String(value))) {
      return Response.json({ error: "Status inválido." }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    if (usesSupabase()) {
      const rows = await updateRows<Record<string, unknown>>(config.table, {
        [config.updateColumn]: value,
        updated_at: updatedAt,
      }, { id, organization_id: organization.id });
      if (!rows.length) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
      const clearRecord = camelizeRow<Record<string, unknown>>(rows[0]);
      return Response.json({ record: await decryptRecordFields(clearRecord, encryptedFieldsByEntity[entity] ?? []) });
    }
    const result = await db.batch([
      db.prepare(`UPDATE ${config.table} SET ${config.updateColumn} = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).bind(value, updatedAt, id, organization.id),
      db.prepare(config.select).bind(id, organization.id),
    ]);
    const record = result[1].results[0];
    if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    return Response.json({ record });
  } catch (error) {
    console.error("record_update_failed", error);
    return tenantError(error, "Não foi possível atualizar o registro.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    await assertRateLimit(request, "record_delete", user.id, 30, 60);
    const url = new URL(request.url);
    const entity = optionalText(url.searchParams.get("entity"));
    if (!entityPermissions[entity] || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions[entity])) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    const table = deleteTables[entity];
    if (!table) return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });

    const db = database();
    if (usesSupabase()) {
      if (entity === "warranties") {
        const warranty = await selectOne<Record<string, unknown>>("warranties", { id, organization_id: organization.id });
        if (!warranty) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
        const appointmentId = String(warranty.appointment_id ?? "");
        await archiveForRecovery({ organizationId: organization.id, entityType: entity, recordId: id, record: warranty, deletedByUserId: user.id });
        if (appointmentId) {
          const appointment = await selectOne<Record<string, unknown>>("appointments", { id: appointmentId, organization_id: organization.id });
          if (appointment) await archiveForRecovery({ organizationId: organization.id, entityType: "appointments", recordId: appointmentId, record: appointment, deletedByUserId: user.id });
          await deleteRows("appointments", { id: appointmentId, organization_id: organization.id });
        }
        await deleteRows("warranties", { id, organization_id: organization.id });
        return Response.json({ deleted: true, id, relatedAppointmentId: appointmentId || null });
      }
      const record = await selectOne<Record<string, unknown>>(table, { id, organization_id: organization.id });
      if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
      await archiveForRecovery({ organizationId: organization.id, entityType: entity, recordId: id, record, deletedByUserId: user.id });
      await deleteRows<Record<string, unknown>>(table, { id, organization_id: organization.id });
      return Response.json({ deleted: true, id });
    }
    if (entity === "warranties") {
      const warranty = await db.prepare(`SELECT appointment_id AS appointmentId FROM warranties WHERE id = ? AND organization_id = ?`)
        .bind(id, organization.id)
        .first<{ appointmentId: string }>();
      if (!warranty) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
      const statements = [db.prepare(`DELETE FROM warranties WHERE id = ? AND organization_id = ?`).bind(id, organization.id)];
      if (warranty.appointmentId) {
        statements.unshift(db.prepare(`DELETE FROM appointments WHERE id = ? AND organization_id = ?`).bind(warranty.appointmentId, organization.id));
      }
      await db.batch(statements);
      return Response.json({ deleted: true, id, relatedAppointmentId: warranty.appointmentId || null });
    }

    const result = await db.prepare(`DELETE FROM ${table} WHERE id = ? AND organization_id = ?`).bind(id, organization.id).run();
    if (!result.meta.changes) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (error) {
    console.error("record_delete_failed", error);
    return tenantError(error, "Não foi possível excluir o registro.");
  }
}
