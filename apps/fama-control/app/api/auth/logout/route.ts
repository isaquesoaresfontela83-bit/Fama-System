import { clearSupabaseSession, getSupabaseAccessToken, supabaseAuthRequest } from "@/app/chatgpt-auth";
import { logAudit } from "@/lib/security";

export async function GET(request: Request) {
  const token = await getSupabaseAccessToken();
  if (token) await supabaseAuthRequest("/auth/v1/logout", { method: "POST" }, token).catch(() => undefined);
  await clearSupabaseSession();
  await logAudit({ eventType: "logout", entityType: "control_auth" }).catch(() => undefined);
  const requested = new URL(request.url).searchParams.get("return_to") ?? "/";
  const destination = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return Response.redirect(new URL(destination, request.url), 303);
}
