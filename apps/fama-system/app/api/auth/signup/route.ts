import { AuthRequestError, setSupabaseSession, signUpWithPassword } from "@/app/system-auth";
import { assertRateLimit, recordLegalConsent } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const accepted = body.accepted === true;
    if (fullName.length < 2 || fullName.length > 80) return Response.json({ error: "Informe seu nome." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Use uma senha com pelo menos 8 caracteres." }, { status: 400 });
    if (!accepted) return Response.json({ error: "Aceite os Termos de Uso e a Política de Privacidade." }, { status: 400 });
    await assertRateLimit(request, "auth_signup", email, 4, 60 * 60);
    const redirectTo = `${new URL(request.url).origin}/auth/confirmar`;
    const result = await signUpWithPassword(email, password, fullName, redirectTo);
    if (!result.user?.id) throw new Error("O cadastro não retornou uma conta válida.");
    await recordLegalConsent({ id: result.user.id, email }, request, "signup");
    if (result.access_token && result.refresh_token) await setSupabaseSession(result);
    return Response.json({ authenticated: Boolean(result.access_token), requiresConfirmation: !result.access_token });
  } catch (error) {
    console.error("auth_signup_failed", error);
    let output = error instanceof Error ? error.message : "Não foi possível criar a conta.";
    if (error instanceof AuthRequestError && (error.code.includes("already") || /registered|exists/i.test(error.message))) {
      output = "Este e-mail já possui uma conta. Use Entrar ou recupere a senha.";
    }
    return Response.json({ error: output }, { status: error instanceof AuthRequestError ? Math.min(499, error.status) : 503 });
  }
}
