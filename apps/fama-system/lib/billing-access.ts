/** Shared by the server gate and browser; missing flags preserve existing subscriptions. */
export function isPlanAccessBlocked(planStatus?: string, planExpiresAt?: string, billingEnabled = true, blockOnExpiry = true, now = Date.now()) {
  if (!billingEnabled || !blockOnExpiry) return false;
  const status = String(planStatus ?? "trial");
  if (["expired", "cancelled", "suspended", "payment_attention"].includes(status)) return true;
  if (!["trial", "active", "pending_payment"].includes(status) || !planExpiresAt) return false;
  const expiresAt = Date.parse(planExpiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
