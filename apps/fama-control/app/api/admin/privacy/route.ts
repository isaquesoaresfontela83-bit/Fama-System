import { decryptText, encryptText } from "@/lib/crypto";
import { selectRows, updateRows } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const statuses = new Set(["open", "in_progress", "completed", "rejected"]);

export async function GET() {
  try {
    await requirePlatformAdmin();
    const rows = await selectRows<Record<string, unknown>>("privacy_requests", {}, { order: "created_at.desc", limit: 200 });
    return Response.json({ requests: await Promise.all(rows.map(async (row) => ({
      id: String(row.id),
      organizationId: row.organization_id ? String(row.organization_id) : null,
      requesterUserId: String(row.requester_user_id),
      contact: await decryptText(String(row.contact_encrypted ?? "")),
      requestType: String(row.request_type),
      status: String(row.status),
      details: await decryptText(String(row.details ?? "")),
      resolution: await decryptText(String(row.resolution ?? "")),
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
    }))) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar as solicitações de privacidade.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePlatformAdmin();
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    const resolution = String(body.resolution ?? "").trim();
    if (!id || !statuses.has(status)) return Response.json({ error: "Solicitação ou status inválido." }, { status: 400 });
    if (resolution.length > 3000) return Response.json({ error: "A resposta deve ter no máximo 3.000 caracteres." }, { status: 400 });
    const updated = await updateRows("privacy_requests", {
      status,
      resolution: await encryptText(resolution),
      completed_at: ["completed", "rejected"].includes(status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { id });
    if (!updated.length) return Response.json({ error: "Solicitação não encontrada." }, { status: 404 });
    return Response.json({ updated: true, id, status, updatedBy: user.email });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar a solicitação.");
  }
}
