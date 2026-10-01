import { database, optionalText } from "@/lib/database";
import { AsaasError } from "@/lib/asaas";
import { createAsaasPixCheckout, paidPlanExpiresAt, getAsaasPayment, getPlatformBillingConfig, billingEnvironment, isPaidAsaasStatus } from "@/lib/billing";
import { MANUAL_PIX } from "@/lib/manual-pix";
import { BILLING_CYCLES, isBillingCycle, getPlanCatalog, getPlanSnapshot, isPlanCode } from "@/lib/plans";
import { selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { isPlanAccessBlocked, requireTenant, tenantError } from "@/lib/tenant";
import { assertRateLimit } from "@/lib/security";

async function ensureBillingColumns() {
  if (usesSupabase()) return;
  const db = database();
  const info = await db.prepare("PRAGMA table_info(organizations)").all<{ name: string }>();
  const columns = new Set(info.results.map((entry) => entry.name));
  if (!columns.has("plan")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'inicial'").run();
  if (!columns.has("plan_status")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'").run();
  if (!columns.has("plan_expires_at")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_expires_at TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_customer_id")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_customer_id TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_payment_id")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_payment_id TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_provider")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_provider TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_cycle")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly'").run();
}

async function billingState(organizationId: string) {
  await ensureBillingColumns();
  if (usesSupabase()) {
    const organization = await selectOne<Record<string, unknown>>("organizations", { id: organizationId });
    return {
      plan: String(organization?.plan ?? "inicial"),
      planStatus: String(organization?.plan_status ?? "trial"),
      planExpiresAt: String(organization?.plan_expires_at ?? ""),
      billingEnabled: organization?.billing_enabled !== false,
      blockOnExpiry: organization?.block_on_expiry !== false,
      billingPaymentId: String(organization?.billing_payment_id ?? ""),
      billingCycle: isBillingCycle(organization?.billing_cycle) ? organization.billing_cycle : "monthly",
      billingProvider: String(organization?.billing_provider ?? ""),
      pendingPlan: isPlanCode(organization?.pending_plan) ? organization.pending_plan : "",
      pendingBillingCycle: isBillingCycle(organization?.pending_billing_cycle) ? organization.pending_billing_cycle : "monthly",
    };
  }
  const row = await database().prepare(`SELECT plan, plan_status AS planStatus, plan_expires_at AS planExpiresAt, billing_enabled AS billingEnabled, block_on_expiry AS blockOnExpiry,
    billing_payment_id AS billingPaymentId, billing_cycle AS billingCycle, billing_provider AS billingProvider,
    pending_plan AS pendingPlan, pending_billing_cycle AS pendingBillingCycle FROM organizations WHERE id = ?`).bind(organizationId).first<Record<string, unknown>>();
  return {
    plan: String(row?.plan ?? "inicial"),
    planStatus: String(row?.planStatus ?? "trial"),
    planExpiresAt: String(row?.planExpiresAt ?? ""),
    billingEnabled: Boolean(row?.billingEnabled),
    blockOnExpiry: Boolean(row?.blockOnExpiry),
    billingPaymentId: String(row?.billingPaymentId ?? ""),
    billingCycle: isBillingCycle(row?.billingCycle) ? row.billingCycle : "monthly",
    billingProvider: String(row?.billingProvider ?? ""),
    pendingPlan: isPlanCode(row?.pendingPlan) ? row.pendingPlan : "",
    pendingBillingCycle: isBillingCycle(row?.pendingBillingCycle) ? row.pendingBillingCycle : "monthly",
  };
}

function requiresAsaasRefresh(status: string, paymentId: string) {
  return Boolean(paymentId) && ["pending_payment", "payment_attention"].includes(status);
}

function attentionAsaasStatus(status: unknown) {
  return ["OVERDUE", "REFUNDED", "DELETED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(String(status ?? ""));
}

function createManualCheckout() {
  return {
    paymentId: `manual_${crypto.randomUUID()}`,
    customerId: "",
    invoiceUrl: "",
    pixQrCode: "",
    pixCopyPaste: MANUAL_PIX.copyPaste,
    dueDate: new Date().toISOString().slice(0, 10),
    provider: "manual_pix",
    qrImagePath: MANUAL_PIX.qrImagePath,
    installments: 1,
  };
}


async function refreshBillingPayment(organizationId: string, current: Awaited<ReturnType<typeof billingState>>) {
  if (!current.billingEnabled) return current;
  if ((!current.pendingPlan && !requiresAsaasRefresh(current.planStatus, current.billingPaymentId)) || current.billingProvider !== "asaas") return current;
  const billingConfig = await getPlatformBillingConfig();
  if (!billingConfig) return current;
  const payment = await getAsaasPayment(current.billingPaymentId, billingConfig);
  const asaasStatus = String(payment.status ?? "");
  const now = new Date().toISOString();
  if (isPaidAsaasStatus(asaasStatus)) {
    const plan = current.pendingPlan || current.plan;
    const billingCycle = current.pendingPlan ? current.pendingBillingCycle : current.billingCycle;
    const planExpiresAt = paidPlanExpiresAt(billingCycle, current.plan, plan, current.planStatus, current.planExpiresAt);
    const update = { plan, billing_cycle: billingCycle, pending_plan: "", pending_billing_cycle: "monthly", plan_status: "active", plan_expires_at: planExpiresAt, updated_at: now };
    if (usesSupabase()) {
      await updateRows("organizations", update, { id: organizationId });
    } else {
      await database().prepare("UPDATE organizations SET plan = ?, billing_cycle = ?, pending_plan = '', pending_billing_cycle = 'monthly', plan_status = 'active', plan_expires_at = ?, updated_at = ? WHERE id = ?")
        .bind(plan, billingCycle, planExpiresAt, now, organizationId).run();
    }
    return { ...current, plan, billingCycle, pendingPlan: "", pendingBillingCycle: "monthly", planStatus: "active", planExpiresAt };
  }
  if (attentionAsaasStatus(asaasStatus)) {
    if (current.pendingPlan && ["active", "trial"].includes(current.planStatus) && !isPlanAccessBlocked(current.planStatus, current.planExpiresAt)) return current;
    const update = { plan_status: "payment_attention", updated_at: now };
    if (usesSupabase()) {
      await updateRows("organizations", update, { id: organizationId });
    } else {
      await database().prepare("UPDATE organizations SET plan_status = 'payment_attention', updated_at = ? WHERE id = ?")
        .bind(now, organizationId).run();
    }
    return { ...current, planStatus: "payment_attention" };
  }
  return current;
}

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    const billing = await refreshBillingPayment(organization.id, await billingState(organization.id));
    const billingConfig = await getPlatformBillingConfig();
    return Response.json({
      billing,
      plans: Object.values(await getPlanCatalog()),
      billingCycles: BILLING_CYCLES,
      provider: {
        name: "Asaas Pix",
        environment: billingConfig?.environment ?? billingEnvironment(),
        configured: Boolean(billingConfig),
      },
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    return tenantError(error, "Não foi possível carregar os planos.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    await ensureBillingColumns();
    const body = await request.json() as Record<string, unknown>;
    const action = optionalText(body.action);
    if (action === "check") {
      const billing = await refreshBillingPayment(organization.id, await billingState(organization.id));
      return Response.json({ billing });
    }
    if (organization.billingEnabled === false) return Response.json({ error: "Esta empresa está isenta. Somente o Fama Control pode habilitar a cobrança." }, { status: 409 });
    const plan = optionalText(body.plan);
    if (!isPlanCode(plan)) return Response.json({ error: "Escolha um plano válido." }, { status: 400 });
    await assertRateLimit(request, "billing_checkout", user.id, 8, 15 * 60);
    const billingCycle = isBillingCycle(body.billingCycle) ? body.billingCycle : "monthly";
    const installments = Math.min(12, Math.max(1, Math.round(Number(body.installments ?? 1))));
    if (!Number.isInteger(Number(body.installments ?? 1)) || Number(body.installments ?? 1) < 1 || Number(body.installments ?? 1) > 12) return Response.json({ error: "Informe de 1 a 12 parcelas." }, { status: 400 });
    const requiresAsaasLink = installments > 1;
    const buyerName = optionalText(body.buyerName) || organization.name;
    const buyerEmail = optionalText(body.buyerEmail) || user.email;
    const billingConfig = await getPlatformBillingConfig();
    const useManual = action === "manual" || !billingConfig;
    if (useManual && requiresAsaasLink) {
      return Response.json({ error: "Parcelamento por link exige a Asaas configurada. Use Pix à vista ou configure a Asaas primeiro." }, { status: 503 });
    }
    const checkout = useManual
      ? createManualCheckout()
      : await createAsaasPixCheckout({
          organizationId: organization.id,
          organizationName: organization.name,
          plan,
          buyerName,
          buyerEmail,
          buyerDocument: optionalText(body.buyerDocument),
          buyerPhone: optionalText(body.buyerPhone),
          billingCycle,
          installments,
          billingConfig: billingConfig ?? undefined,
        });
    const billingProvider = "provider" in checkout && checkout.provider === "manual_pix" ? "manual_pix" : "asaas";
    const current = await billingState(organization.id);
    const nextStatus = isPlanAccessBlocked(current.planStatus, current.planExpiresAt) ? "pending_payment" : current.planStatus;
    const update = {
      pending_plan: plan,
      pending_billing_cycle: billingCycle,
      plan_status: nextStatus,
      billing_customer_id: checkout.customerId,
      billing_payment_id: checkout.paymentId,
      billing_provider: billingProvider,
      updated_at: new Date().toISOString(),
    };
    if (usesSupabase()) {
      await updateRows("organizations", update, { id: organization.id });
    } else {
      await database().prepare(`UPDATE organizations SET pending_plan = ?, pending_billing_cycle = ?, plan_status = ?,
        billing_customer_id = ?, billing_payment_id = ?, billing_provider = ?, updated_at = ? WHERE id = ?`)
        .bind(plan, billingCycle, nextStatus, checkout.customerId, checkout.paymentId, billingProvider, update.updated_at, organization.id).run();
    }
    return Response.json({
      billing: { ...current, pendingPlan: plan, pendingBillingCycle: billingCycle, planStatus: nextStatus, billingPaymentId: checkout.paymentId, billingProvider },
      checkout,
      plan: await getPlanSnapshot(plan),
    });
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    return tenantError(error, "Não foi possível gerar a cobrança Pix.");
  }
}
