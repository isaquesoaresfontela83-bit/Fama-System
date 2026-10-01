import { database } from "@/lib/database";
import { decryptRecordFields, encryptRecordFields } from "@/lib/crypto";
import { camelizeRow, selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { assertRateLimit } from "@/lib/security";
import { isTrustedMutation } from "@/lib/request-security";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { requireTenant, tenantError } from "@/lib/tenant";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedMutation(request)) return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
    const { user, organization } = await requireTenant(request);
    if (!hasFeaturePermission(organization.role, organization.permissions, entityPermissions.quotes)) {
      return Response.json({ error: "Seu perfil não possui acesso a orçamentos." }, { status: 403 });
    }
    await assertRateLimit(request, "quote_approval_link", user.id, 30, 60);
    const { id } = await context.params;
    const db = database();
    const row = usesSupabase()
      ? await selectOne<Record<string, unknown>>("quotes", { id, organization_id: organization.id })
      : await db.prepare("SELECT * FROM quotes WHERE id = ? AND organization_id = ?").bind(id, organization.id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
    const quote = usesSupabase() ? await decryptRecordFields(camelizeRow<Record<string, unknown>>(row), ["notes"]) : row;
    const status = String(quote.status ?? "rascunho");
    if (["recusado"].includes(status)) return Response.json({ error: "Um orçamento recusado não pode ser enviado para aprovação novamente." }, { status: 409 });
    let noteText = "";
    let details: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(String(quote.notes ?? "")) as { text?: string; details?: Record<string, unknown> };
      noteText = String(parsed.text ?? "");
      details = parsed.details ?? {};
    } catch { noteText = String(quote.notes ?? ""); }
    const approvalToken = typeof details.approvalToken === "string" && details.approvalToken.length >= 48
      ? details.approvalToken
      : Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const notes = JSON.stringify({ text: noteText, details: { ...details, approvalToken } });
    const nextStatus = status === "rascunho" ? "enviado" : status;
    const updatedAt = new Date().toISOString();
    if (usesSupabase()) {
      const protectedFields = await encryptRecordFields({ notes }, ["notes"]);
      const rows = await updateRows<Record<string, unknown>>("quotes", { notes: protectedFields.notes, status: nextStatus, updated_at: updatedAt }, { id, organization_id: organization.id });
      if (!rows.length) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
    } else {
      await db.prepare("UPDATE quotes SET notes = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(notes, nextStatus, updatedAt, id, organization.id).run();
    }
    return Response.json({ approvalToken, status: nextStatus });
  } catch (error) {
    return tenantError(error, "Não foi possível preparar a aprovação do orçamento.");
  }
}
