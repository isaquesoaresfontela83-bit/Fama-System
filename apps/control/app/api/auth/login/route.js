import { AuthRequestError, clearSupabaseSession, setSupabaseSession, signInWithPassword, supabaseAuthRequest } from "@/app/system-auth";
import { assertRateLimit, logAudit } from "@/lib/security";
import { RequestError, isPlatformAdmin } from "@/lib/tenant";
function errorMessage(error) {
    if (error instanceof AuthRequestError) {
        if (error.status === 400 || error.status === 401)
            return "E-mail ou senha inválidos.";
        if (error.status === 429)
            return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    }
    if (error instanceof RequestError && error.status === 429)
        return error.message;
    return "Não foi possível entrar agora.";
}
export async function POST(request) {
    try {
        const body = await request.json();
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        if (!/^\S+@\S+\.\S+$/.test(email) || !password)
            return Response.json({ error: "Informe um e-mail válido e sua senha." }, { status: 400 });
        await assertRateLimit(request, "control_auth_login", email, 8, 15 * 60);
        const session = await signInWithPassword(email, password);
        const user = session.user ?? await supabaseAuthRequest("/auth/v1/user", { method: "GET" }, session.access_token);
        const normalizedUser = { id: user.id, email: String(user.email ?? "").toLowerCase(), fullName: null, displayName: String(user.email ?? "").toLowerCase(), provider: "supabase", aal: null };
        if (!isPlatformAdmin(normalizedUser)) {
            await supabaseAuthRequest("/auth/v1/logout", { method: "POST" }, session.access_token).catch(() => undefined);
            await clearSupabaseSession();
            await logAudit({ actorUserId: user.id, eventType: "security", entityType: "control_auth", metadata: { result: "denied" } }).catch(() => undefined);
            return Response.json({ error: "Esta conta não está autorizada a acessar o Fama Control." }, { status: 403 });
        }
        const factors = session.user?.factors ?? user.factors ?? [];
        const verified = factors.find((factor) => factor.status === "verified" && factor.factor_type === "totp");
        await setSupabaseSession(session, Boolean(verified));
        await logAudit({ actorUserId: user.id, eventType: "login", entityType: "control_auth", metadata: { mfa_required: Boolean(verified) } });
        return Response.json({ authenticated: !verified, requiresMfa: Boolean(verified), factorId: verified?.id ?? null });
    }
    catch (error) {
        console.error("control_auth_login_failed", error);
        const status = error instanceof RequestError ? error.status : error instanceof AuthRequestError ? (error.status === 429 ? 429 : error.status >= 500 ? 503 : 401) : 503;
        return Response.json({ error: errorMessage(error) }, { status });
    }
}
