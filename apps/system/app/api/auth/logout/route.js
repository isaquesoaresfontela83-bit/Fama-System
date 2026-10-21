import { requestPublicUrl } from "@/lib/request-security";
import { getFamaUser, clearSupabaseSession, getSupabaseAccessToken, supabaseAuthRequest } from "@/app/system-auth";
import { logAudit } from "@/lib/security";
import { safeReturnPath } from "@/lib/request-security";
export async function GET(request) {
    try {
        const user = await getFamaUser();
        if (user) {
            const { removePushDevice, deviceCookie } = await import('@/lib/firebase-push');
            await removePushDevice(user.id, deviceCookie(request));
        }
    }
    catch { /* Logout must remain available. */ }
    const token = await getSupabaseAccessToken();
    if (token)
        await supabaseAuthRequest("/auth/v1/logout?scope=local", { method: "POST" }, token).catch(() => undefined);
    await clearSupabaseSession();
    await logAudit({ eventType: "logout", entityType: "auth" }).catch(() => undefined);
    const requested = new URL(request.url).searchParams.get("return_to") ?? "/";
    const destination = safeReturnPath(requested);
    return Response.redirect(new URL(destination, requestPublicUrl(request)), 303);
}
