import { database } from "@/lib/database";
import { camelizeRow, selectRows, selectOne, callRpc, usesSupabase } from "@/lib/supabase";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";
import { accountInput, companyNameKey, companyPlans, createAccount, removeCreatedAccount } from "@/lib/admin-accounts";
import { defaultFeaturePermissions } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { isTrustedMutation } from "@/lib/request-security";

async function ensureBillingColumns() {
  if (usesSupabase()) return;
  const db = database();
  const info = await db.prepare("PRAGMA table_info(organizations)").all<{ name: string }>();
  const columns = new Set(info.results.map((entry) => entry.name));
  if (!columns.has("plan")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'inicial'").run();
  if (!columns.has("plan_status")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'").run();
  if (!columns.has("plan_expires_at")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_expires_at TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_provider")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_provider TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_payment_id")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_payment_id TEXT NOT NULL DEFAULT ''").run();
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureBillingColumns();
    if (usesSupabase()) {
      const [organizations, members] = await Promise.all([
        selectRows<Record<string, unknown>>("organizations", {}, { order: "created_at.desc" }),
        selectRows<Record<string, unknown>>("organization_members", {}, { select: "id,organization_id" }),
      ]);
      return Response.json({ organizations: organizations.map((row) => {
        const organization = camelizeRow<Record<string, unknown>>(row);
        return {
          ...organization,
          memberCount: members.filter((member) => member.organization_id === row.id).length,
        };
      }) });
    }
    const db = database();
    const result = await db.prepare(`SELECT o.id, o.name, o.slug, o.status, o.plan, o.plan_status AS planStatus,
        o.plan_expires_at AS planExpiresAt, o.billing_provider AS billingProvider, o.billing_payment_id AS billingPaymentId,
        o.created_at AS createdAt,
        COUNT(m.id) AS memberCount
      FROM organizations o
      LEFT JOIN organization_members m ON m.organization_id = o.id
      GROUP BY o.id, o.name, o.slug, o.status, o.plan, o.plan_status, o.plan_expires_at, o.billing_provider, o.billing_payment_id, o.created_at
      ORDER BY o.created_at DESC`).all();
    return Response.json({ organizations: result.results });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar as empresas da plataforma.");
  }
}

export async function POST(request: Request) {
  let createdUserId = "";
  let createdOrganizationId = "";
  let rpcAttempted = false;
  let committed = false;
  try {
    const admin = await requirePlatformAdmin();
    if (!isTrustedMutation(request)) throw new RequestError("Origem da solicitação inválida.", 403);
    if (!usesSupabase()) throw new RequestError("Configure o serviço de contas antes de cadastrar empresas pelo Control.", 503);
    await assertRateLimit(request, "admin_company_create", admin.id, 10, 60);
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const nameKey = companyNameKey(name);
    if (name.length < 2 || name.length > 80 || nameKey.length < 2) throw new RequestError("O nome da empresa deve ter entre 2 e 80 caracteres.", 400);
    const account = accountInput({ ...body, displayName: String(body.displayName ?? "").trim() || name });
    const plan = String(body.plan ?? "profissional");
    if (!companyPlans.includes(plan as typeof companyPlans[number])) throw new RequestError("Escolha um plano válido.", 400);
    const existing = await selectRows<Record<string, unknown>>("organizations", { name_key: nameKey }, { select: "id,status" });
    if (existing.some(organization => organization.status !== "deleted")) throw new RequestError("Já existe uma empresa com esse nome.", 409);
    if (await selectOne("organization_members", { user_email: account.email })) throw new RequestError("Este e-mail já está cadastrado. Use um novo e-mail para a conta da empresa.", 409);
    const user = await createAccount(account);
    createdUserId = user.id;
    const id = crypto.randomUUID();
    const slug = `${nameKey.replace(/ /g, "-").slice(0, 42)}-${crypto.randomUUID().slice(0, 8)}`;
    createdOrganizationId = id;
    const memberId = crypto.randomUUID();
    rpcAttempted = true;
    await callRpc("fama_admin_create_company", {
      p_id: id, p_name: name, p_name_key: nameKey, p_slug: slug, p_plan: plan,
      p_member_id: memberId, p_user_id: user.id, p_email: user.email,
      p_display_name: user.displayName, p_permissions: defaultFeaturePermissions(), p_actor_id: admin.id,
    });
    committed = true;
    const [organization, member] = await Promise.all([
      selectOne<Record<string, unknown>>("organizations", { id }),
      selectOne<Record<string, unknown>>("organization_members", { id: memberId, organization_id: id, user_id: user.id, status: "active" }),
    ]);
    if (!member) throw new RequestError("O vínculo da conta com a empresa não foi confirmado.", 502);
    if (!organization || organization.billing_enabled !== false || organization.block_on_expiry !== false) throw new RequestError("O banco não confirmou a isenção da mensalidade. Atualize a lista antes de tentar novamente.", 502);
    return Response.json({ created: true, verified: true, organization: { ...camelizeRow<Record<string, unknown>>(organization), memberCount: 1 }, account: user }, { status: 201 });
  } catch (error) {
    // The RPC commits the company and membership together. Never delete an identity
    // linked to a committed company after a response/transport failure.
    if (createdUserId && !committed) {
      const safeToRemove = !rpcAttempted || await selectOne("organizations", { id: createdOrganizationId }).then(row => !row).catch(() => false);
      if (safeToRemove) await removeCreatedAccount(createdUserId).catch(() => console.warn("admin_company_account_cleanup_failed"));
    }
    return tenantError(error, "Não foi possível cadastrar a empresa.");
  }
}
