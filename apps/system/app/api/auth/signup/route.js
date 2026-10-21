import { requestPublicUrl } from "@/lib/request-security";
import { AuthRequestError, prepareAccountSignIn, setSupabaseSession, signUpWithPassword } from "@/app/system-auth";
import { AccountSessionError } from '@/lib/account-sessions';
import { assertRateLimit, recordLegalConsent } from "@/lib/security";
import { assertPasswordSafe, PasswordSecurityError, validatePasswordLength } from "@/lib/password-security";
import { RequestError } from "@/lib/tenant";
import { onboardingPath } from "@/lib/onboarding-intent";
export async function POST(request) {
    try {
        const body = await request.json();
        const fullName = String(body.fullName ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const accepted = body.accepted === true;
        if (fullName.length < 2 || fullName.length > 80)
            return Response.json({ error: "Informe seu nome." }, { status: 400 });
        if (!/^\S+@\S+\.\S+$/.test(email))
            return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
        validatePasswordLength(password);
        if (!accepted)
            return Response.json({ error: "Aceite os Termos de Uso e a Política de Privacidade." }, { status: 400 });
        await assertRateLimit(request, "auth_signup", email, 4, 60 * 60);
        await prepareAccountSignIn(email);
        await assertPasswordSafe(password);
        const intent = onboardingPath(body);
        const redirectTo = `${requestPublicUrl(request).origin}/auth/confirmar${intent.includes("?") ? intent.slice(intent.indexOf("?")) : ""}`;
        const result = await signUpWithPassword(email, password, fullName, redirectTo);
        if (!result.user?.id)
            throw new Error("O cadastro não retornou uma conta válida.");
        await recordLegalConsent({ id: result.user.id, email }, request, "signup");
        if (result.access_token && result.refresh_token)
            await setSupabaseSession(result);
        return Response.json({ authenticated: Boolean(result.access_token), requiresConfirmation: !result.access_token });
    }
    catch (error) {
        if (error instanceof PasswordSecurityError || error instanceof RequestError || error instanceof AccountSessionError)
            return Response.json({ error: error.message }, { status: error.status });
        console.error("auth_signup_failed", error);
        let output = error instanceof Error ? error.message : "Não foi possível criar a conta.";
        if (error instanceof AuthRequestError && (error.code.includes("already") || /registered|exists/i.test(error.message))) {
            output = "Este e-mail já possui uma conta. Use Entrar ou recupere a senha.";
        }
        return Response.json({ error: output }, { status: error instanceof AuthRequestError ? Math.min(499, error.status) : 503 });
    }
}
