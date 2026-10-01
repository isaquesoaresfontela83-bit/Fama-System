import { getSupabaseAccessToken, getSupabaseFactors, sessionAal, setSupabaseSession, supabaseAuthRequest, type SupabaseSession } from "@/app/system-auth";
import { assertRateLimit, logAudit } from "@/lib/security";
import { requireUser, tenantError } from "@/lib/tenant";

function safeId(value: unknown) {
  const id = String(value ?? "");
  return /^[a-zA-Z0-9-]{8,80}$/.test(id) ? id : "";
}

export async function GET() {
  try {
    await requireUser();
    const token = await getSupabaseAccessToken();
    const factors = await getSupabaseFactors(token);
    return Response.json({
      available: true,
      aal: sessionAal(token),
      factors: factors.map((factor) => ({ id: factor.id, type: factor.factor_type, status: factor.status, name: factor.friendly_name ?? "Autenticador" })),
    });
  } catch (error) {
    return tenantError(error, "Não foi possível consultar a verificação em duas etapas.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const token = await getSupabaseAccessToken();
    await assertRateLimit(request, "auth_mfa_manage", user.id, 12, 15 * 60);
    if (action === "enroll") {
      const enrolled = await supabaseAuthRequest<{ id: string; type?: string; totp?: { qr_code?: string; secret?: string; uri?: string } }>("/auth/v1/factors", {
        method: "POST",
        body: JSON.stringify({ factor_type: "totp", friendly_name: "Fama System" }),
      }, token);
      await logAudit({ actorUserId: user.id, eventType: "security", entityType: "mfa", recordId: enrolled.id, metadata: { action: "enroll_started" } });
      return Response.json({ factorId: enrolled.id, qrCode: enrolled.totp?.qr_code ?? "", secret: enrolled.totp?.secret ?? "", uri: enrolled.totp?.uri ?? "" });
    }
    const factorId = safeId(body.factorId);
    if (!factorId) return Response.json({ error: "Fator inválido." }, { status: 400 });
    if (action === "challenge") {
      const challenge = await supabaseAuthRequest<{ id: string }>(`/auth/v1/factors/${factorId}/challenge`, { method: "POST", body: JSON.stringify({}) }, token);
      return Response.json({ challengeId: challenge.id });
    }
    if (action === "verify") {
      const challengeId = safeId(body.challengeId);
      const code = String(body.code ?? "").replace(/\s/g, "");
      if (!challengeId || !/^\d{6,10}$/.test(code)) return Response.json({ error: "Informe o código do autenticador." }, { status: 400 });
      const session = await supabaseAuthRequest<SupabaseSession>(`/auth/v1/factors/${factorId}/verify`, {
        method: "POST",
        body: JSON.stringify({ challenge_id: challengeId, code }),
      }, token);
      await setSupabaseSession(session);
      await logAudit({ actorUserId: user.id, eventType: "security", entityType: "mfa", recordId: factorId, metadata: { action: "enabled" } });
      return Response.json({ verified: true });
    }
    if (action === "unenroll") {
      await supabaseAuthRequest(`/auth/v1/factors/${factorId}`, { method: "DELETE" }, token);
      await logAudit({ actorUserId: user.id, eventType: "security", entityType: "mfa", recordId: factorId, metadata: { action: "disabled" } });
      return Response.json({ removed: true });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("auth_mfa_manage_failed", error);
    return tenantError(error, error instanceof Error ? error.message : "Não foi possível alterar a segurança da conta.");
  }
}
