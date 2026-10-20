import { getSupabaseAccessToken, updateSupabasePassword } from "@/app/system-auth";
import { assertRateLimit } from "@/lib/security";
import { assertPasswordSafe, PasswordSecurityError, validatePasswordLength } from "@/lib/password-security";
import { AuthRequestError } from "@/app/system-auth";
import { RequestError } from "@/lib/tenant";
export async function POST(request) {
    try {
        const password = String((await request.json()).password ?? "");
        validatePasswordLength(password);
        await assertRateLimit(request, "auth_password_change", "session", 5, 60 * 60);
        const accessToken = await getSupabaseAccessToken();
        if (!accessToken)
            return Response.json({ error: "Sessão de recuperação ausente." }, { status: 401 });
        await assertPasswordSafe(password);
        await updateSupabasePassword(accessToken, password);
        return Response.json({ updated: true });
    }
    catch (error) {
        if (error instanceof PasswordSecurityError || error instanceof RequestError || error instanceof AuthRequestError)
            return Response.json({ error: error.message }, { status: error.status });
        console.error("auth_password_update_failed", error);
        return Response.json({ error: error instanceof Error ? error.message : "Não foi possível alterar a senha." }, { status: 400 });
    }
}
