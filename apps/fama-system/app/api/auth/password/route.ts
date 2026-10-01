import { getSupabaseAccessToken, updateSupabasePassword } from "@/app/system-auth";
import { assertRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const password = String((await request.json() as Record<string, unknown>).password ?? "");
    if (password.length < 8) return Response.json({ error: "Use uma senha com pelo menos 8 caracteres." }, { status: 400 });
    await assertRateLimit(request, "auth_password_change", "session", 5, 60 * 60);
    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) return Response.json({ error: "Sessão de recuperação ausente." }, { status: 401 });
    await updateSupabasePassword(accessToken, password);
    return Response.json({ updated: true });
  } catch (error) {
    console.error("auth_password_update_failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível alterar a senha." }, { status: 400 });
  }
}
