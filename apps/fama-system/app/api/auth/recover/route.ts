import { requestPasswordRecovery } from "@/app/system-auth";
import { assertRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    await assertRateLimit(request, "auth_recovery", email, 4, 60 * 60);
    await requestPasswordRecovery(email, `${new URL(request.url).origin}/auth/recuperar`);
    return Response.json({ sent: true });
  } catch (error) {
    console.error("auth_recovery_failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar a recuperação." }, { status: 429 });
  }
}
