import { AuthRequestError, setSupabaseSession, signUpOwner } from "@/app/system-auth";
import { assertRateLimit, logAudit } from "@/lib/security";
import { RequestError, isPlatformAdmin } from "@/lib/tenant";
import { assertPasswordSafe, PasswordSecurityError, validatePasswordLength } from "@/lib/password-security";
export async function POST(request) {
    try {
        const body = await request.json();
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const candidate = { id: "", email, displayName: email, fullName: null, provider: "supabase", aal: null };
        const atIndex = email.indexOf("@");
        const validEmail = atIndex > 0
            && email.indexOf(".", atIndex + 2) > atIndex + 1
            && !email.includes(" ");
        if (!validEmail || !isPlatformAdmin(candidate)) {
            return Response.json({ error: "Este e-mail não está autorizado para o Fama Control." }, { status: 403 });
        }
        validatePasswordLength(password);
        await assertRateLimit(request, "control_auth_setup", email, 4, 60 * 60);
        await assertPasswordSafe(password);
        const result = await signUpOwner(email, password);
        await logAudit({ actorUserId: result.user?.id, eventType: "security", entityType: "control_auth", metadata: { result: "owner_signup" } }).catch(() => undefined);
        if (result.access_token && result.refresh_token) {
            await setSupabaseSession({ access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in, user: result.user });
            return Response.json({ authenticated: true });
        }
        return Response.json({ authenticated: false, requiresConfirmation: true });
    }
    catch (error) {
        if (error instanceof PasswordSecurityError)
            return Response.json({ error: error.message }, { status: error.status });
        console.error("control_auth_setup_failed", error);
        const status = error instanceof RequestError && error.status === 429 ? 429 : error instanceof AuthRequestError && error.status === 429 ? 429 : 400;
        const message = error instanceof AuthRequestError && (error.status === 400 || error.status === 422)
            ? "Não foi possível criar o acesso. Se a conta já existe, use a opção Entrar."
            : error instanceof Error ? error.message : "Não foi possível criar o acesso.";
        return Response.json({ error: message }, { status });
    }
}
