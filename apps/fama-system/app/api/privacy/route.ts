import { decryptText, encryptText } from "@/lib/crypto";
import { assertRateLimit, sha256 } from "@/lib/security";
import { insertRow, selectRows } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";

const requestTypes = new Set(["access", "correction", "export", "deletion", "revocation"]);

export async function GET(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    const rows = await selectRows<Record<string, unknown>>("privacy_requests", {
      organization_id: organization.id,
      requester_user_id: user.id,
    }, { order: "created_at.desc", limit: 50 });
    return Response.json({ requests: await Promise.all(rows.map(async (row) => ({
      id: String(row.id),
      requestType: String(row.request_type),
      status: String(row.status),
      details: await decryptText(String(row.details ?? "")),
      resolution: await decryptText(String(row.resolution ?? "")),
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
    }))) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar suas solicitações.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    const body = await request.json() as Record<string, unknown>;
    const requestType = String(body.requestType ?? "");
    const details = String(body.details ?? "").trim();
    if (!requestTypes.has(requestType)) return Response.json({ error: "Escolha um tipo de solicitação." }, { status: 400 });
    if (details.length < 10 || details.length > 3000) return Response.json({ error: "Descreva o pedido entre 10 e 3.000 caracteres." }, { status: 400 });
    await assertRateLimit(request, "privacy_authenticated", user.id, 5, 60 * 60);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await insertRow("privacy_requests", {
      id,
      organization_id: organization.id,
      requester_user_id: user.id,
      requester_email_hash: await sha256(user.email),
      contact_encrypted: await encryptText(user.email),
      request_type: requestType,
      status: "open",
      details: await encryptText(details),
      created_at: now,
      updated_at: now,
    });
    return Response.json({ request: { id, requestType, details, status: "open", createdAt: now, completedAt: null, resolution: "" } }, { status: 201 });
  } catch (error) {
    return tenantError(error, "Não foi possível enviar sua solicitação.");
  }
}
