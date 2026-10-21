import { database, reference } from "@/lib/database";
import { decryptRecordFields, encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { camelizeRow, insertRow, selectOne, snakeRow, SupabaseRequestError, updateRows, usesSupabase } from "@/lib/supabase";
import { assertRateLimit, logAudit, sha256 } from "@/lib/security";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { requireTenant, tenantError } from "@/lib/tenant";
import { isTrustedMutation } from "@/lib/request-security";
// A stable primary key lets the database enforce one conversion per quote,
// including different Worker instances and retries after a partial failure.
async function conversionId(organizationId, quoteId) {
    const hash = await sha256(`fama:quote-conversion:${organizationId}:${quoteId}`);
    const variant = (8 | (parseInt(hash[16], 16) & 3)).toString(16);
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
async function clearWorkOrder(row) {
    const { organizationId: _organizationId, updatedAt: _updatedAt, ...record } = await decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity.workOrders ?? []);
    return record;
}
export async function POST(request, context) {
    try {
        if (!isTrustedMutation(request))
            return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
        const { user, organization } = await requireTenant(request);
        if (!hasFeaturePermission(organization.role, organization.permissions, entityPermissions.quotes, organization.moduleAccess) || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions.workOrders, organization.moduleAccess)) {
            return Response.json({ error: "Seu perfil precisa de acesso a orçamentos e ordens de serviço." }, { status: 403 });
        }
        await assertRateLimit(request, "quote_convert", user.id, 20, 60);
        const { id } = await context.params;
        const db = database();
        const raw = usesSupabase()
            ? await selectOne("quotes", { id, organization_id: organization.id })
            : await db.prepare("SELECT * FROM quotes WHERE id = ? AND organization_id = ?").bind(id, organization.id).first();
        if (!raw)
            return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
        const quote = usesSupabase() ? await decryptRecordFields(camelizeRow(raw), ["notes"]) : raw;
        let noteText = String(quote.notes ?? "");
        let details = {};
        try {
            const parsed = JSON.parse(noteText);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                noteText = typeof parsed.text === "string" ? parsed.text : "";
                if (parsed.details && typeof parsed.details === "object" && !Array.isArray(parsed.details))
                    details = parsed.details;
            }
        }
        catch { /* preserve legacy note */ }
        const findWorkOrder = async (workOrderId) => usesSupabase()
            ? await selectOne("work_orders", { id: workOrderId, organization_id: organization.id })
            : await db.prepare("SELECT * FROM work_orders WHERE id = ? AND organization_id = ?").bind(workOrderId, organization.id).first();
        const markConverted = async (workOrderId) => {
            const notes = JSON.stringify({ text: noteText, details: { ...details, convertedWorkOrderId: workOrderId } });
            const updatedAt = new Date().toISOString();
            if (usesSupabase()) {
                const protectedNotes = await encryptRecordFields({ notes }, ["notes"]);
                await updateRows("quotes", { notes: protectedNotes.notes, updated_at: updatedAt }, { id, organization_id: organization.id });
            }
            else {
                await db.prepare("UPDATE quotes SET notes = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(notes, updatedAt, id, organization.id).run();
            }
        };
        const existingId = typeof details.convertedWorkOrderId === "string" ? details.convertedWorkOrderId : "";
        if (existingId) {
            const existing = await findWorkOrder(existingId);
            if (existing)
                return Response.json({ workOrder: await clearWorkOrder(existing), alreadyConverted: true });
        }
        if (quote.status !== "aprovado")
            return Response.json({ error: "Apenas orçamentos aprovados podem virar ordem de serviço." }, { status: 409 });
        const workOrderId = await conversionId(organization.id, id);
        const recovered = await findWorkOrder(workOrderId);
        if (recovered) {
            await markConverted(workOrderId);
            return Response.json({ workOrder: await clearWorkOrder(recovered), alreadyConverted: true });
        }
        const createdAt = new Date().toISOString();
        const workOrder = {
            id: workOrderId, osNumber: reference("OS"), clientName: String(quote.clientName ?? quote.client_name ?? ""),
            service: String(quote.service ?? ""), scheduledAt: "", technician: "", status: "aberta", ph: null, chlorine: null,
            alkalinity: null, productsUsed: String(details.poolItems ?? details.products ?? ""),
            notes: JSON.stringify({ text: [`Criada do orçamento ${String(quote.quoteNumber ?? quote.quote_number ?? "")}`, noteText].filter(Boolean).join("\n\n"), details: { sourceQuoteId: id, sourceQuoteNumber: String(quote.quoteNumber ?? quote.quote_number ?? ""), paymentTerms: details.paymentTerms ?? "" } }),
            amountCents: Number(quote.totalCents ?? quote.total_cents ?? 0), createdAt,
        };
        if (usesSupabase()) {
            const protectedRecord = await encryptRecordFields(workOrder, encryptedFieldsByEntity.workOrders ?? []);
            try {
                await insertRow("work_orders", { ...snakeRow(protectedRecord), organization_id: organization.id, updated_at: createdAt });
            }
            catch (error) {
                if (!(error instanceof SupabaseRequestError) || error.code !== "23505")
                    throw error;
                const concurrent = await findWorkOrder(workOrderId);
                if (!concurrent)
                    throw error;
                await markConverted(workOrderId);
                return Response.json({ workOrder: await clearWorkOrder(concurrent), alreadyConverted: true });
            }
        }
        else {
            const inserted = await db.prepare(`INSERT OR IGNORE INTO work_orders (id, organization_id, os_number, client_name, service, scheduled_at, technician, status, ph, chlorine, alkalinity, products_used, notes, amount_cents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(workOrder.id, organization.id, workOrder.osNumber, workOrder.clientName, workOrder.service, workOrder.scheduledAt, workOrder.technician, workOrder.status, null, null, null, workOrder.productsUsed, workOrder.notes, workOrder.amountCents, createdAt, createdAt).run();
            if (!inserted.meta.changes) {
                const concurrent = await findWorkOrder(workOrderId);
                if (!concurrent)
                    throw new Error("A conversão não foi confirmada.");
                await markConverted(workOrderId);
                return Response.json({ workOrder: await clearWorkOrder(concurrent), alreadyConverted: true });
            }
        }
        await markConverted(workOrderId);
        await logAudit({ organizationId: organization.id, actorUserId: user.id, eventType: "security", entityType: "quote_conversion", recordId: id, metadata: { workOrderId: workOrder.id } });
        return Response.json({ workOrder }, { status: 201 });
    }
    catch (error) {
        return tenantError(error, "Não foi possível criar a ordem de serviço.");
    }
}
