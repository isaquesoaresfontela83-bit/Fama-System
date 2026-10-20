import { AuthRequestError, prepareAccountSignIn, setSupabaseSession, signInWithPassword, } from "@/app/system-auth";
import { AccountSessionError } from '@/lib/account-sessions';
import { assertRateLimit, logAudit } from "@/lib/security";
import { normalizeCompanyName } from "@/lib/plans";
import { database } from "@/lib/database";
import { selectOne, usesSupabase } from "@/lib/supabase";
import { RequestError } from "@/lib/tenant";
function message(error) {
    if (error instanceof AuthRequestError) {
        if (error.status === 400 || error.status === 401)
            return "E-mail ou senha inválidos.";
        if (error.status === 429)
            return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    }
    return error instanceof Error ? error.message : "Não foi possível entrar agora.";
}
export async function POST(request) {
    try {
        const body = await request.json();
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
                ? await selectOne("organizations", { name_key: key, status: "active" })
                : await database().prepare("SELECT id FROM organizations WHERE name_key = ? AND status = 'active' LIMIT 1").bind(key).first();
            if (!organization)
                return Response.json({ error: "Empresa, e-mail ou senha inválidos." }, { status: 401 });
            const member = usesSupabase()
                ? (await selectOne("organization_members", { organization_id: String(organization.id), user_email: email, status: "active" })
                    ?? await selectOne("organization_members", { organization_id: String(organization.id), user_email: email, status: "invited" }))
                : await database().prepare("SELECT id FROM organization_members WHERE organization_id = ? AND user_email = ? AND status IN ('active', 'invited') LIMIT 1").bind(String(organization.id), email).first();
            if (!member)
                return Response.json({ error: "Empresa, e-mail ou senha inválidos." }, { status: 401 });
        }
        await prepareAccountSignIn(email);
        const session = await signInWithPassword(email, password);
        const factors = session.user?.factors ?? [];
        const verified = factors.find((factor) => factor.status === "verified" && factor.factor_type === "totp");
        await setSupabaseSession(session, Boolean(verified));
        await logAudit({ actorUserId: session.user?.id, eventType: "login", entityType: "auth", metadata: { mfa_required: Boolean(verified) } });
        return Response.json({ authenticated: !verified, requiresMfa: Boolean(verified), factorId: verified?.id ?? null });
    }
    catch (error) {
        console.error("auth_login_failed", error);
        const status = error instanceof RequestError || error instanceof AccountSessionError ? error.status : error instanceof AuthRequestError ? (error.status === 429 ? 429 : error.status === 409 ? 409 : error.status >= 500 ? 503 : 401) : 503;
        return Response.json({ error: message(error) }, { status });
    }
}
