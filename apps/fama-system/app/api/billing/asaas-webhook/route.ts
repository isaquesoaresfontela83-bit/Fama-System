import { database } from "@/lib/database";
import { billingWebhookToken, paidPlanExpiresAt } from "@/lib/billing";
import { isBillingCycle, isPlanCode, type BillingCycle } from "@/lib/plans";
import { selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { tenantError } from "@/lib/tenant";

const paidEvents = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_CREDITED"]);
const attentionEvents = new Set(["PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"]);

export async function POST(request: Request) {
  const expected = billingWebhookToken();
  if (!expected) return Response.json({ error: "Webhook indisponível." }, { status: 503 });
  const actual = request.headers.get("asaas-access-token") ?? request.headers.get("access_token") ?? request.headers.get("x-asaas-token") ?? "";
  if (actual !== expected) return Response.json({ error: "Webhook não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const event = String(body.event ?? "");
    const payment = (body.payment ?? {}) as Record<string, unknown>;
    const paymentId = String(payment.id ?? "");
    if (!paymentId || (!paidEvents.has(event) && !attentionEvents.has(event))) return Response.json({ ok: true, ignored: true });
    const paid = paidEvents.has(event);
    const now = new Date().toISOString();
    await database().prepare("UPDATE subscription_checkouts SET status = ?, updated_at = ? WHERE payment_id = ? AND status <> ?")
      .bind(paid ? "paid" : "payment_attention", now, paymentId, paid ? "paid" : "payment_attention").run();
    let organization = usesSupabase()
      ? await selectOne<Record<string, unknown>>("organizations", { billing_payment_id: paymentId })
      : await database().prepare("SELECT * FROM organizations WHERE billing_payment_id = ?").bind(paymentId).first<Record<string, unknown>>();
    if (!organization) {
      const [organizationId, plan, cycle, installments] = String(payment.externalReference ?? "").split(":");
      if (organizationId && isPlanCode(plan) && isBillingCycle(cycle) && Number(installments) > 1) {
        const candidate = usesSupabase()
          ? await selectOne<Record<string, unknown>>("organizations", { id: organizationId })
          : await database().prepare("SELECT * FROM organizations WHERE id = ?").bind(organizationId).first<Record<string, unknown>>();
        if (candidate?.billing_provider === "asaas" && candidate.billing_customer_id === payment.customer) organization = candidate;
      }
    }
    if (!organization) return Response.json({ ok: true, ignored: "organization_not_found" });
    const pending = isPlanCode(organization.pending_plan) ? organization.pending_plan : "";
    if (paid && !pending && organization.plan_status === "active") return Response.json({ ok: true, ignored: "already_active" });
    const selectedCycle = pending ? organization.pending_billing_cycle : organization.billing_cycle;
    const cycle: BillingCycle = isBillingCycle(selectedCycle) ? selectedCycle : "monthly";
    const preserveCurrentAccess = !paid && Boolean(pending) && ["active", "trial"].includes(String(organization.plan_status));
    const nextStatus = paid ? "active" : preserveCurrentAccess ? String(organization.plan_status) : "payment_attention";
    const update = {
      plan_status: nextStatus,
      ...(paid ? { pending_plan: "", pending_billing_cycle: "monthly", plan: pending || String(organization.plan ?? "inicial"), billing_cycle: cycle, plan_expires_at: paidPlanExpiresAt(cycle, String(organization.plan ?? "inicial"), pending || String(organization.plan ?? "inicial"), String(organization.plan_status), String(organization.plan_expires_at ?? "")) } : {}),
      updated_at: now,
    };
    if (usesSupabase()) await updateRows("organizations", update, { id: String(organization.id) });
    else if (paid) await database().prepare("UPDATE organizations SET plan = ?, billing_cycle = ?, plan_status = 'active', plan_expires_at = ?, pending_plan = '', pending_billing_cycle = 'monthly', updated_at = ? WHERE id = ?")
      .bind(update.plan, cycle, update.plan_expires_at, now, organization.id).run();
    else await database().prepare("UPDATE organizations SET plan_status = ?, updated_at = ? WHERE id = ?")
      .bind(nextStatus, now, organization.id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error, "Não foi possível registrar o pagamento. A Asaas poderá reenviar a confirmação.");
  }
}
