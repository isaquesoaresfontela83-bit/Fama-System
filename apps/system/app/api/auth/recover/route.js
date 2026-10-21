import { requestPublicUrl } from "@/lib/request-security";
import { recordOperation } from "@/lib/operation-events";
import { AuthRequestError, requestPasswordRecovery } from "@/app/system-auth";
import { assertRateLimit } from "@/lib/security";
import { RequestError } from "@/lib/tenant";
export async function POST(request) {
    try {
        const body = await request.json();
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email))
            return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
        await assertRateLimit(request, "auth_recovery", email, 4, 60 * 60);
        await requestPasswordRecovery(email, `${requestPublicUrl(request).origin}/auth/recuperar`);
        await recordOperation("email", "ok", "recovery_requested");
        return Response.json({ sent: true });
    }
    catch (error) {
        console.error("auth_recovery_failed", error);
        const status = error instanceof RequestError || error instanceof AuthRequestError ? error.status : 503;
        if (error instanceof AuthRequestError || status >= 500)
            await recordOperation("email", "error", "recovery_provider_error");
        const message = error instanceof AuthRequestError && error.code === "email_address_not_authorized"
            ? "A recuperação por e-mail está temporariamente indisponível. Entre em contato com o suporte para recuperar o acesso."
            : error instanceof AuthRequestError && status === 429 ? "O limite de envio de e-mails foi atingido. Aguarde antes de solicitar outro link."
                : status >= 500 ? "Não foi possível enviar a recuperação agora. Tente novamente em instantes." : error instanceof Error ? error.message : "Não foi possível enviar a recuperação.";
        return Response.json({ error: message }, { status });
    }
}
