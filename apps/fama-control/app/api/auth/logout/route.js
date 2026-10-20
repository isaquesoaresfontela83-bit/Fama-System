import { clearSupabaseSession, getSupabaseAccessToken, supabaseAuthRequest } from "@/app/system-auth";
import { logAudit } from "@/lib/security";
import { safeReturnPath } from "@/lib/request-security";
export async function GET(request) {
    const token = await getSupabaseAccessToken();
    if (token)
        await supabaseAuthRequest("/auth/v1/logout", { method: "POST" }, token).catch(() => undefined);
    await clearSupabaseSession();
    await logAudit({ eventType: "logout", entityType: "control_auth" }).catch(() => undefined);
    const requested = new URL(request.url).searchParams.get("return_to") ?? "/";
    const destination = safeReturnPath(requested);
    return Response.redirect(new URL(destination, request.url), 303);
}
