import {
  AuthRequestError,
  setSupabaseSession,
  signInWithPassword,
} from "@/app/system-auth";
import { assertRateLimit, logAudit } from "@/lib/security";
import { normalizeCompanyName } from "@/lib/plans";
import { database } from "@/lib/database";
import { selectOne, usesSupabase } from "@/lib/supabase";

function message(error: unknown) {
  if (error instanceof AuthRequestError) {
    if (error.status === 400 || error.status === 401) return "E-mail ou senha inválidos.";
    if (error.status === 429) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }
  return error instanceof Error ? error.message : "Não foi possível entrar agora.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const company = String(body.company ?? "").trim();
    const password = String(body.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      return Response.json({ error: "Informe um e-mail válido e sua senha." }, { status: 400 });
    }
    await assertRateLimit(request, "auth_login", email, 8, 15 * 60);
    if (company) {
      const key = normalizeCompanyName(company);
      const organization = usesSupabase()
        ? await selectOne<Record<string, unknown>>("organizations", { name_key: key, status: "active" })
        : await database().prepare("SELECT id FROM organizations WHERE name_key = ? AND status = 'active' LIMIT 1").bind(key).first<Record<string, unknown>>();
      if (!organization) return Response.json({ error: "Empresa, e-mail ou senha inválidos." }, { status: 401 });
      const member = usesSupabase()
        ? await selectOne<Record<string, unknown>>("organization_members", { organization_id: String(organization.id), user_email: email, status: "active" })
        : await database().prepare("SELECT id FROM organization_members WHERE organization_id = ? AND user_email = ? AND status = 'active' LIMIT 1").bind(String(organization.id), email).first<Record<string, unknown>>();
      if (!member) return Response.json({ error: "Empresa, e-mail ou senha inválidos." }, { status: 401 });
    }
    const session = await signInWithPassword(email, password);
    const factors = session.user?.factors ?? [];
    const verified = factors.find((factor) => factor.status === "verified" && factor.factor_type === "totp");
    await setSupabaseSession(session, Boolean(verified));
    await logAudit({ actorUserId: session.user?.id, eventType: "login", entityType: "auth", metadata: { mfa_required: Boolean(verified) } });
    return Response.json({ authenticated: !verified, requiresMfa: Boolean(verified), factorId: verified?.id ?? null });
  } catch (error) {
    console.error("auth_login_failed", error);
    const status = error instanceof AuthRequestError && error.status === 429 ? 429 : 401;
    return Response.json({ error: message(error) }, { status });
  }
}
