import { getSupabaseFactors, setSupabaseSession, supabaseAuthRequest, type SupabaseAuthUser, type SupabaseSession } from "@/app/system-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const session: SupabaseSession = {
      access_token: String(body.accessToken ?? ""),
      refresh_token: String(body.refreshToken ?? ""),
      expires_in: Number(body.expiresIn ?? 3600),
    };
    if (!session.access_token || !session.refresh_token) return Response.json({ error: "Sessão inválida." }, { status: 400 });
    const user = await supabaseAuthRequest<SupabaseAuthUser>("/auth/v1/user", { method: "GET" }, session.access_token);
    session.user = user;
    const factors = await getSupabaseFactors(session.access_token);
    const verified = factors.find((factor) => factor.status === "verified" && factor.factor_type === "totp");
    await setSupabaseSession(session, Boolean(verified));
    return Response.json({ authenticated: !verified, requiresMfa: Boolean(verified), factorId: verified?.id ?? null });
  } catch (error) {
    console.error("auth_session_failed", error);
    return Response.json({ error: "O link de acesso é inválido ou expirou." }, { status: 401 });
  }
}
