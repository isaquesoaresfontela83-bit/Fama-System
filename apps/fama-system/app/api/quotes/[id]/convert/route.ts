import { database, reference } from "@/lib/database";
import { decryptRecordFields, encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { camelizeRow, insertRow, selectOne, snakeRow, updateRows, usesSupabase } from "@/lib/supabase";
import { assertRateLimit, logAudit } from "@/lib/security";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { requireTenant, tenantError } from "@/lib/tenant";
import { isTrustedMutation } from "@/lib/request-security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedMutation(request)) return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
    const { user, organization } = await requireTenant(request);
    if (!hasFeaturePermission(organization.role, organization.permissions, entityPermissions.quotes) || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions.workOrders)) {
      return Response.json({ error: "Seu perfil precisa de acesso a orçamentos e ordens de serviço." }, { status: 403 });
    }
    await assertRateLimit(request, "quote_convert", user.id, 20, 60);
    const { id } = await context.params;
    const db = database();
    const raw = usesSupabase()
      ? await selectOne<Record<string, unknown>>("quotes", { id, organization_id: organization.id })
      : await db.prepare("SELECT * FROM quotes WHERE id = ? AND organization_id = ?").bind(id, organization.id).first<Record<string, unknown>>();
    if (!raw) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
    const quote = usesSupabase() ? await decryptRecordFields(camelizeRow<Record<string, unknown>>(raw), ["notes"]) : raw;
    let details: Record<string, unknown> = {};
    try { details = (JSON.parse(String(quote.notes ?? "")) as { details?: Record<string, unknown> }).details ?? {}; } catch { /* legacy note */ }
    const existingId = typeof details.convertedWorkOrderId === "string" ? details.convertedWorkOrderId : "";
    if (existingId) {
      const existing = usesSupabase()
        ? await selectOne<Record<string, unknown>>("work_orders", { id: existingId, organization_id: organization.id })
        : await db.prepare("SELECT * FROM work_orders WHERE id = ? AND organization_id = ?").bind(existingId, organization.id).first<Record<string, unknown>>();
      if (existing) return Response.json({ workOrder: usesSupabase() ? camelizeRow(existing) : existing, alreadyConverted: true });
    }
    if (quote.status !== "aprovado") return Response.json({ error: "Apenas orçamentos aprovados podem virar ordem de serviço." }, { status: 409 });
    const createdAt = new Date().toISOString();
    const workOrder = {
      id: crypto.randomUUID(), osNumber: reference("OS"), clientName: String(quote.clientName ?? quote.client_name ?? ""),
      service: String(quote.service ?? ""), scheduledAt: "", technician: "", status: "aberta", ph: null, chlorine: null,
      alkalinity: null, productsUsed: String(details.poolItems ?? details.products ?? ""),
      notes: JSON.stringify({ text: `Criada do orçamento ${String(quote.quoteNumber ?? quote.quote_number ?? "")}`, details: { sourceQuoteId: id, paymentTerms: details.paymentTerms ?? "" } }),
      amountCents: Number(quote.totalCents ?? quote.total_cents ?? 0), createdAt,
    };
    if (usesSupabase()) {
      const protectedRecord = await encryptRecordFields(workOrder, encryptedFieldsByEntity.workOrders ?? []);
      await insertRow("work_orders", { ...snakeRow(protectedRecord), organization_id: organization.id, updated_at: createdAt });
      const notes = JSON.stringify({ text: "", details: { ...details, convertedWorkOrderId: workOrder.id } });
      const protectedNotes = await encryptRecordFields({ notes }, ["notes"]);
      await updateRows("quotes", { notes: protectedNotes.notes, updated_at: createdAt }, { id, organization_id: organization.id });
    } else {
      await db.prepare(`INSERT INTO work_orders (id, organization_id, os_number, client_name, service, scheduled_at, technician, status, ph, chlorine, alkalinity, products_used, notes, amount_cents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(workOrder.id, organization.id, workOrder.osNumber, workOrder.clientName, workOrder.service, workOrder.scheduledAt, workOrder.technician, workOrder.status, null, null, null, workOrder.productsUsed, workOrder.notes, workOrder.amountCents, createdAt, createdAt).run();
      await db.prepare("UPDATE quotes SET notes = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(JSON.stringify({ text: "", details: { ...details, convertedWorkOrderId: workOrder.id } }), createdAt, id, organization.id).run();
    }
    await logAudit({ organizationId: organization.id, actorUserId: user.id, eventType: "security", entityType: "quote_conversion", recordId: id, metadata: { workOrderId: workOrder.id } });
    return Response.json({ workOrder }, { status: 201 });
  } catch (error) {
    return tenantError(error, "Não foi possível criar a ordem de serviço.");
  }
}
