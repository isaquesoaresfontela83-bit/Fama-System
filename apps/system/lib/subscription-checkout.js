import { database } from "@/lib/database";
import { getAsaasPayment, getPlatformBillingConfig, isPaidAsaasStatus } from "@/lib/billing";
import { RequestError } from "@/lib/tenant";
export async function ensureSubscriptionCheckoutTable() {
    const db = database();
    await db.prepare(`CREATE TABLE IF NOT EXISTS subscription_checkouts (
    id TEXT PRIMARY KEY, plan TEXT NOT NULL, billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    installments INTEGER NOT NULL DEFAULT 1, buyer_name TEXT NOT NULL, buyer_email TEXT NOT NULL,
    buyer_document TEXT NOT NULL DEFAULT '', buyer_phone TEXT NOT NULL DEFAULT '',
    payment_id TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'manual_pix', proof_text TEXT NOT NULL DEFAULT '',
    proof_submitted_at TEXT NOT NULL DEFAULT '', reviewed_at TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT NOT NULL DEFAULT '', admin_notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_payment', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run();
    const info = await db.prepare("PRAGMA table_info(subscription_checkouts)").all();
    const columns = new Set(info.results.map(entry => entry.name));
    for (const [column, definition] of [
        ["provider", "TEXT NOT NULL DEFAULT 'manual_pix'"], ["billing_cycle", "TEXT NOT NULL DEFAULT 'monthly'"],
        ["installments", "INTEGER NOT NULL DEFAULT 1"], ["proof_text", "TEXT NOT NULL DEFAULT ''"],
        ["proof_submitted_at", "TEXT NOT NULL DEFAULT ''"], ["reviewed_at", "TEXT NOT NULL DEFAULT ''"],
        ["reviewed_by", "TEXT NOT NULL DEFAULT ''"], ["admin_notes", "TEXT NOT NULL DEFAULT ''"],
    ]) {
        if (!columns.has(column))
            await db.prepare(`ALTER TABLE subscription_checkouts ADD COLUMN ${column} ${definition}`).run();
    }
}
export function assertCheckoutPayment(checkout, payment) {
    const reference = `checkout:${checkout.id}:${checkout.plan}:${checkout.billing_cycle ?? "monthly"}:${Number(checkout.installments ?? 1)}`;
    if (checkout.provider !== "asaas" || payment.id !== checkout.payment_id || payment.customer !== checkout.customer_id || payment.externalReference !== reference) {
        throw new RequestError("O pagamento não corresponde a esta contratação.", 409);
    }
}
export async function refreshSubscriptionCheckout(checkout) {
    if (checkout.provider === "manual_pix")
        return checkout;
    if (checkout.provider !== "asaas")
        throw new RequestError("A cobrança precisa ser conferida pelo suporte.", 503);
    const config = await getPlatformBillingConfig();
    if (!config)
        throw new RequestError("Não foi possível conferir o pagamento. Tente novamente em instantes.", 503);
    const payment = await getAsaasPayment(String(checkout.payment_id), config);
    assertCheckoutPayment(checkout, payment);
    const paid = payment.deleted !== true && isPaidAsaasStatus(payment.status);
    const attention = payment.deleted === true || ["OVERDUE", "DELETED", "REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(String(payment.status));
    const status = paid ? "paid" : attention ? "payment_attention" : "pending_payment";
    if (status !== checkout.status) {
        await database().prepare("UPDATE subscription_checkouts SET status = ?, updated_at = ? WHERE id = ? AND payment_id = ?")
            .bind(status, new Date().toISOString(), checkout.id, checkout.payment_id).run();
    }
    return { ...checkout, status };
}
