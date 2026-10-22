import { recordOperation } from "@/lib/operation-events";
import { database } from "@/lib/database";
import { billingWebhookToken, getAsaasPayment, getPlatformBillingConfig, isPaidAsaasStatus } from "@/lib/billing";
import { applyBillingUpdate, confirmedBillingUpdate } from "@/lib/billing-state";
import { selectOne, usesSupabase } from "@/lib/supabase";
import { tenantError } from "@/lib/tenant";
import { assertCheckoutPayment } from "@/lib/subscription-checkout";
const paidEvents = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_CREDITED"]);
const attentionEvents = new Set(["PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"]);
const attentionStatuses = new Set(["OVERDUE", "DELETED", "REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"]);
async function findOrganization(filters) {
    if (usesSupabase())
        return selectOne("organizations", filters);
    const [key, value] = Object.entries(filters)[0];
    return database().prepare(`SELECT * FROM organizations WHERE ${key} = ?`).bind(value).first();
}
export async function POST(request) {
    const expected = billingWebhookToken();
    if (!expected)
        return Response.json({ error: "Webhook indisponível." }, { status: 503 });
    const actual = request.headers.get("asaas-access-token") ?? request.headers.get("access_token") ?? request.headers.get("x-asaas-token") ?? "";
    if (actual !== expected)
        return Response.json({ error: "Webhook não autorizado." }, { status: 401 });
    try {
        const body = await request.json();
        const event = String(body.event ?? "");
        const incoming = (body.payment ?? {});
        const paymentId = String(incoming.id ?? "");
        if (!/^pay_[a-zA-Z0-9_-]{1,120}$/.test(paymentId) || (!paidEvents.has(event) && !attentionEvents.has(event)))
            return Response.json({ ok: true, ignored: true });
        const db = database();
        await db.prepare(`CREATE TABLE IF NOT EXISTS billing_webhook_events (
      id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, event TEXT NOT NULL, processed_at TEXT NOT NULL
    )`).run();
        const eventId = String(body.id ?? "").slice(0, 200);
        if (eventId && await db.prepare("SELECT id FROM billing_webhook_events WHERE id = ?").bind(eventId).first())
            return Response.json({ ok: true, ignored: "duplicate_event" });
        const config = await getPlatformBillingConfig();
        if (!config)
            return Response.json({ error: "Consulta de pagamento indisponível; o evento poderá ser reenviado." }, { status: 503 });
        // Read the provider, never the event's historical payment status.
        const payment = await getAsaasPayment(paymentId, config);
        if (payment.id !== paymentId)
            throw new Error("Referência de pagamento divergente.");
        const paid = payment.deleted !== true && isPaidAsaasStatus(payment.status);
        const attention = attentionStatuses.has(String(payment.status)) || payment.deleted === true;
        if ((paidEvents.has(event) && !paid) || (attentionEvents.has(event) && !attention))
            return Response.json({ ok: true, ignored: "stale_event" });
        let organization = await findOrganization({ billing_payment_id: paymentId });
        if (!organization && payment.installment && payment.customer && payment.externalReference) {
            const organizationId = String(payment.externalReference).split(":")[0];
            const candidate = await findOrganization({ id: organizationId });
            if (candidate?.billing_provider === "asaas" && candidate.billing_customer_id === payment.customer && candidate.billing_payment_id) {
                const first = await getAsaasPayment(String(candidate.billing_payment_id), config);
                if (first.installment === payment.installment && first.customer === payment.customer && first.externalReference === payment.externalReference)
                    organization = candidate;
            }
        }
        const now = new Date().toISOString();
        const checkout = await db.prepare("SELECT * FROM subscription_checkouts WHERE payment_id = ?").bind(paymentId).first();
        if (checkout)
            assertCheckoutPayment(checkout, payment);
        if (organization) {
            if (organization.billing_provider !== "asaas" || organization.billing_customer_id !== payment.customer)
                throw new Error("O pagamento não pertence à empresa.");
            if (paid && !organization.pending_plan && organization.plan_status === "active")
                return Response.json({ ok: true, ignored: "already_active" });
            const preserve = !paid && Boolean(organization.pending_plan) && ["active", "trial"].includes(String(organization.plan_status));
            const values = paid ? confirmedBillingUpdate(organization) : { plan_status: preserve ? String(organization.plan_status) : "payment_attention", updated_at: now };
            if (!await applyBillingUpdate(organization, values))
                return Response.json({ error: "O pagamento está sendo atualizado. Reenvie este evento." }, { status: 409 });
        }
        // A retry after a failed checkout write cannot extend company validity.
        await db.prepare("UPDATE subscription_checkouts SET status = ?, updated_at = ? WHERE payment_id = ?")
            .bind(paid ? "paid" : "payment_attention", now, paymentId).run();
        if (eventId)
            await db.prepare("INSERT OR IGNORE INTO billing_webhook_events (id, payment_id, event, processed_at) VALUES (?, ?, ?, ?)").bind(eventId, paymentId, event, now).run();
        await recordOperation("payments", "ok", "subscription_event_processed");
        return Response.json({ ok: true, ...(!organization ? { ignored: "organization_not_found" } : {}) });
    }
    catch (error) {
        await recordOperation("payments", "error", "subscription_event_error");
        return tenantError(error, "Não foi possível registrar o pagamento. A Asaas poderá reenviar a confirmação.");
    }
}
