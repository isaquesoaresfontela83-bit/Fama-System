import { getSupabaseAccessToken, setSupabaseSession, supabaseAuthRequest, type SupabaseSession } from "@/app/system-auth";
import { assertRateLimit } from "@/lib/security";

function safeId(value: unknown) {
  const id = String(value ?? "");
  return /^[a-zA-Z0-9-]{8,80}$/.test(id) ? id : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const factorId = safeId(body.factorId);
    const accessToken = await getSupabaseAccessToken(true);
    if (!factorId || !accessToken) return Response.json({ error: "Desafio de segurança inválido." }, { status: 401 });
    await assertRateLimit(request, "auth_mfa_login", factorId, 10, 15 * 60);
    if (action === "challenge") {
      const challenge = await supabaseAuthRequest<{ id: string; expires_at?: number }>(`/auth/v1/factors/${factorId}/challenge`, {
        method: "POST",
        body: JSON.stringify({}),
      }, accessToken);
      return Response.json({ challengeId: challenge.id });
    }
    if (action === "verify") {
      const challengeId = safeId(body.challengeId);
      const code = String(body.code ?? "").replace(/\s/g, "");
      if (!challengeId || !/^\d{6,10}$/.test(code)) return Response.json({ error: "Informe o código do autenticador." }, { status: 400 });
      const session = await supabaseAuthRequest<SupabaseSession>(`/auth/v1/factors/${factorId}/verify`, {
        method: "POST",
        body: JSON.stringify({ challenge_id: challengeId, code }),
      }, accessToken);
      await setSupabaseSession(session);
      return Response.json({ authenticated: true });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("auth_mfa_login_failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível validar o código." }, { status: 400 });
  }
}
