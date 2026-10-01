import { database, requiredText } from "@/lib/database";
import { deleteRows, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { getUserOrganizations, isPlatformAdmin, requireUser, tenantError } from "@/lib/tenant";
import { assertRateLimit, recordLegalConsent } from "@/lib/security";
import { cycleExpiresAt } from "@/lib/billing";
import { isBillingCycle, isPlanCode, normalizeCompanyName } from "@/lib/plans";

const tenantTables = [
  "leads",
  "quotes",
  "appointments",
  "work_orders",
  "customers",
  "inventory_items",
  "transactions",
  "employees",
  "warranties",
  "contracts",
] as const;

function slugPart(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "empresa";
}

async function ensureOrganizationColumns() {
  if (usesSupabase()) return;
  const db = database();
  const info = await db.prepare("PRAGMA table_info(organizations)").all<{ name: string }>();
  const columns = new Set(info.results.map((entry) => entry.name));
  if (!columns.has("name_key")) await db.prepare("ALTER TABLE organizations ADD COLUMN name_key TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("plan")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'inicial'").run();
  if (!columns.has("plan_status")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'").run();
  if (!columns.has("plan_expires_at")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_expires_at TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_customer_id")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_customer_id TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_payment_id")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_payment_id TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_provider")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_provider TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_cycle")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly'").run();
  const rows = await db.prepare("SELECT id, name FROM organizations WHERE name_key = '' AND status <> 'deleted'").all<{ id: string; name: string }>();
  for (const row of rows.results) {
    await db.prepare("UPDATE organizations SET name_key = ? WHERE id = ?").bind(normalizeCompanyName(row.name), row.id).run();
  }
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_key ON organizations(name_key) WHERE status <> 'deleted'").run();
}

async function ensureCheckoutTable() {
  await database().prepare(`CREATE TABLE IF NOT EXISTS subscription_checkouts (
    id TEXT PRIMARY KEY,
    plan TEXT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_document TEXT NOT NULL DEFAULT '',
    buyer_phone TEXT NOT NULL DEFAULT '',
    payment_id TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_payment',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  const info = await database().prepare("PRAGMA table_info(subscription_checkouts)").all<{ name: string }>();
  if (!info.results.some((entry) => entry.name === "billing_cycle")) {
    await database().prepare("ALTER TABLE subscription_checkouts ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly'").run();
  }
}

async function validatePaidCheckout(checkoutId: string, plan: string, email: string) {
  await ensureCheckoutTable();
  const checkout = await database().prepare("SELECT * FROM subscription_checkouts WHERE id = ?").bind(checkoutId).first<Record<string, unknown>>();
  if (!checkout) return "Pagamento não encontrado. Gere um novo Pix na página de planos.";
  if (String(checkout.status) !== "paid") return "Pagamento ainda não foi confirmado.";
  if (String(checkout.plan) !== plan) return "O plano pago não corresponde ao plano selecionado.";
  if (String(checkout.buyer_email ?? "").toLocaleLowerCase("pt-BR") !== email.toLocaleLowerCase("pt-BR")) {
    return "Entre com o mesmo e-mail usado no pagamento.";
  }
  const used = usesSupabase()
    ? await selectOne<Record<string, unknown>>("organizations", { billing_payment_id: String(checkout.payment_id) })
    : await database().prepare("SELECT id FROM organizations WHERE billing_payment_id = ?").bind(checkout.payment_id).first();
  if (used) return "Este pagamento já foi usado para cadastrar uma empresa.";
  return "";
}

async function checkoutCycle(checkoutId: string) {
  if (!checkoutId) return "monthly";
  const checkout = await database().prepare("SELECT billing_cycle AS billingCycle FROM subscription_checkouts WHERE id = ?")
    .bind(checkoutId).first<Record<string, unknown>>();
  return isBillingCycle(checkout?.billingCycle) ? checkout.billingCycle : "monthly";
}

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ organizations: await getUserOrganizations(user), isPlatformAdmin: isPlatformAdmin(user) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar suas empresas.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await assertRateLimit(request, "organization_create", user.id, 5, 60 * 60);
    const body = await request.json() as Record<string, unknown>;
    const name = requiredText(body.name, "Nome da empresa");
    const existingOrganizations = await getUserOrganizations(user);
    const ownedOrganizations = usesSupabase()
      ? await selectRows<Record<string, unknown>>("organizations", { created_by_user_id: user.id }, { select: "id,status" })
      : (await database().prepare("SELECT id, status FROM organizations WHERE created_by_user_id = ?").bind(user.id).all<Record<string, unknown>>()).results;
    if ((existingOrganizations.length || ownedOrganizations.some(row => row.status !== "deleted")) && !isPlatformAdmin(user)) {
      return Response.json({ error: "Este e-mail já possui uma empresa cadastrada. Use a empresa atual ou peça acesso como usuário da equipe." }, { status: 409 });
    }
    if (body.legalAccepted !== true) {
      return Response.json({ error: "Aceite os Termos de Uso e a Política de Privacidade para criar a empresa." }, { status: 400 });
    }
    const checkoutId = typeof body.checkoutId === "string" ? body.checkoutId.trim() : "";
    const selectedPlan = isPlanCode(body.plan) ? body.plan : "inicial";
    if (checkoutId) {
      const checkoutError = await validatePaidCheckout(checkoutId, selectedPlan, user.email);
      if (checkoutError) return Response.json({ error: checkoutError }, { status: 402 });
    }
    if (name.length < 2 || name.length > 80) {
      return Response.json({ error: "O nome da empresa deve ter entre 2 e 80 caracteres." }, { status: 400 });
    }

    const db = database();
    await ensureOrganizationColumns();
    const nameKey = normalizeCompanyName(name);
    if (nameKey.length < 2) return Response.json({ error: "Informe um nome de empresa mais específico." }, { status: 400 });
    const organizationId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();
    const paidCycle = await checkoutCycle(checkoutId);
    const paidCheckout = checkoutId ? await database().prepare("SELECT payment_id, customer_id, provider FROM subscription_checkouts WHERE id = ?").bind(checkoutId).first<Record<string, unknown>>() : null;
    const activeUntil = cycleExpiresAt(paidCycle);
    const trialUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const slug = `${slugPart(name)}-${crypto.randomUUID().slice(0, 6)}`;
    const mayClaimLegacyRecords = isPlatformAdmin(user);

    if (usesSupabase()) {
      const existing = await (await import("@/lib/supabase")).selectOne<Record<string, unknown>>("organizations", { name_key: nameKey });
      if (existing && String(existing.status) !== "deleted") return Response.json({ error: "Já existe uma empresa com esse nome. Escolha outro." }, { status: 409 });
      await insertRow("organizations", {
        id: organizationId,
        name,
        slug,
        status: "active",
        created_by_user_id: user.id,
        created_at: now,
        updated_at: now,
        name_key: nameKey,
        plan: selectedPlan,
        plan_status: checkoutId ? "active" : "trial",
        plan_expires_at: checkoutId ? activeUntil : trialUntil,
        billing_cycle: paidCycle,
        billing_payment_id: String(paidCheckout?.payment_id ?? ""),
        billing_customer_id: String(paidCheckout?.customer_id ?? ""),
        billing_provider: String(paidCheckout?.provider ?? ""),
      });
      try {
        await insertRow("organization_members", {
          id: memberId,
          organization_id: organizationId,
          user_id: user.id,
          user_email: user.email.toLocaleLowerCase("pt-BR"),
          display_name: user.displayName,
          role: "owner",
          status: "active",
          created_at: now,
          updated_at: now,
        });
        if (mayClaimLegacyRecords) {
          await Promise.all(tenantTables.map((table) =>
            updateRows(table, { organization_id: organizationId, updated_at: now }, { organization_id: "" })));
        }
      } catch (error) {
        await deleteRows("organizations", { id: organizationId }).catch(() => undefined);
        throw error;
      }
      await recordLegalConsent(user, request, "organization_create");
      return Response.json({ organization: { id: organizationId, name, slug, role: "owner" } }, { status: 201 });
    }

    const statements = [
      db.prepare(`INSERT INTO organizations (id, name, slug, name_key, status, plan, plan_status, plan_expires_at, billing_cycle, billing_payment_id, billing_customer_id, billing_provider, created_by_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        organizationId,
        name,
        slug,
        nameKey,
        selectedPlan,
        checkoutId ? "active" : "trial",
        checkoutId ? activeUntil : trialUntil,
        paidCycle,
        String(paidCheckout?.payment_id ?? ""),
        String(paidCheckout?.customer_id ?? ""),
        String(paidCheckout?.provider ?? ""),
        user.id,
        now,
        now,
      ),
      db.prepare(`INSERT INTO organization_members (id, organization_id, user_id, user_email, display_name, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`).bind(memberId, organizationId, user.id, user.email.toLocaleLowerCase("pt-BR"), user.displayName, now, now),
    ];

    if (mayClaimLegacyRecords) {
      for (const table of tenantTables) {
        statements.push(db.prepare(`UPDATE ${table} SET organization_id = ? WHERE organization_id = ''`).bind(organizationId));
      }
    }

    await db.batch(statements);
    await recordLegalConsent(user, request, "organization_create");
    return Response.json({ organization: { id: organizationId, name, slug, role: "owner" } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a empresa.";
    if (message.includes("obrigatório")) return Response.json({ error: message }, { status: 400 });
    if (String(error).includes("UNIQUE constraint failed") || String(error).includes("duplicate key")) return Response.json({ error: "Já existe uma empresa com esse nome. Escolha outro." }, { status: 409 });
    return tenantError(error, "Não foi possível criar a empresa.");
  }
}
