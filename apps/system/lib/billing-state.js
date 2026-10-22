import { database } from "@/lib/database";
import { paidPlanExpiresAt } from "@/lib/billing";
import { isBillingCycle, isPlanCode } from "@/lib/plans";
import { updateRows, usesSupabase } from "@/lib/supabase";
export function confirmedBillingUpdate(current) {
    const pending = isPlanCode(current.pending_plan) ? current.pending_plan : "";
    const plan = pending || String(current.plan ?? "inicial");
    const selectedCycle = pending ? current.pending_billing_cycle : current.billing_cycle;
    const cycle = isBillingCycle(selectedCycle) ? selectedCycle : "monthly";
    // Only a new checkout may extend validity. Reconfirming the same payment
    // after a refund or transport retry restores its original entitlement.
    const expiry = !pending && current.plan_expires_at
        ? String(current.plan_expires_at)
        : paidPlanExpiresAt(cycle, String(current.plan ?? "inicial"), plan, String(current.plan_status), String(current.plan_expires_at ?? ""));
    return { plan, billing_cycle: cycle, plan_status: "active", plan_expires_at: expiry,
        pending_plan: "", pending_billing_cycle: "monthly", updated_at: new Date().toISOString() };
}
export async function applyBillingUpdate(current, values) {
    const filters = Object.fromEntries(["id", "billing_payment_id", "pending_plan", "plan_status", "plan_expires_at"]
        .map(key => [key, String(current[key] ?? "")]));
    if (usesSupabase())
        return (await updateRows("organizations", values, filters)).length > 0;
    const entries = Object.entries(values);
    const result = await database().prepare(`UPDATE organizations SET ${entries.map(([key]) => `${key} = ?`).join(", ")}
    WHERE id = ? AND billing_payment_id = ? AND pending_plan = ? AND plan_status = ? AND plan_expires_at = ?`)
        .bind(...entries.map(([, value]) => value), ...Object.values(filters)).run();
    return Number(result.meta?.changes ?? 0) > 0;
}
