import { encryptText } from "@/lib/crypto";
import { assertRateLimit, sha256 } from "@/lib/security";
import { insertRow } from "@/lib/supabase";

const requestTypes = new Set(["access", "correction", "export", "deletion", "revocation"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const requestType = String(body.requestType ?? "");
    const details = String(body.details ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (!requestTypes.has(requestType)) return Response.json({ error: "Escolha um tipo de solicitação." }, { status: 400 });
    if (details.length < 10 || details.length > 3000) return Response.json({ error: "Descreva o pedido entre 10 e 3.000 caracteres." }, { status: 400 });
    await assertRateLimit(request, "privacy_public", email, 3, 60 * 60);
    const id = crypto.randomUUID();
    await insertRow("privacy_requests", {
      id,
      organization_id: null,
      requester_user_id: "public",
      requester_email_hash: await sha256(email),
      contact_encrypted: await encryptText(email),
      request_type: requestType,
      status: "open",
      details: await encryptText(details),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return Response.json({ protocol: id.split("-")[0].toUpperCase() }, { status: 201 });
  } catch (error) {
    console.error("privacy_public_request_failed", error);
    return Response.json({ error: "Não foi possível enviar a solicitação agora." }, { status: 503 });
  }
}
