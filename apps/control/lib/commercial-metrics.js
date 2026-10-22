export function commercialMetrics(companies, prices, events, now = Date.now(), days = 30) {
    const live = companies.filter(company => company.status !== "deleted");
    const free = (company) => company.billingEnabled === false || company.billingProvider === "courtesy";
    const inTerm = (company) => !company.planExpiresAt || Number.isFinite(Date.parse(company.planExpiresAt)) && Date.parse(company.planExpiresAt) > now;
    const paid = live.filter(company => company.status === "active" && !free(company) && company.planStatus === "active" && Boolean(company.billingPaymentId) && inTerm(company));
    const trials = live.filter(company => company.status === "active" && !free(company) && company.planStatus === "trial" && inTerm(company));
    const ends = trials.filter(company => company.planExpiresAt && Date.parse(company.planExpiresAt) <= now + 7 * 86400000);
    const projection = paid.reduce((sum, company) => { const price = prices.find(plan => plan.id === company.plan)?.price ?? 0; const discount = { monthly: 0, quarterly: 5, semiannual: 10, annual: 15 }; return sum + Math.round(price * (100 - (discount[company.billingCycle ?? "monthly"] ?? 0)) / 100); }, 0);
    const since = now - days * 86400000;
    const monitored = events.filter(event => event.source !== "baseline" && event.billing_enabled && event.billing_provider !== "courtesy");
    const starts = new Map();
    for (const event of monitored)
        if (event.new_plan_status === "trial" && event.old_plan_status !== "trial" && Date.parse(event.occurred_at) >= since)
            starts.set(event.organization_id, Math.min(starts.get(event.organization_id) ?? Infinity, Date.parse(event.occurred_at)));
    const converted = new Set(monitored.filter(event => event.new_plan_status === "active" && Boolean(event.billing_payment_id) && starts.has(event.organization_id) && Date.parse(event.occurred_at) >= starts.get(event.organization_id)).map(event => event.organization_id));
    const cancelled = new Set(monitored.filter(event => event.new_plan_status === "cancelled" && event.old_plan_status !== "cancelled" && Date.parse(event.occurred_at) >= since).map(event => event.organization_id));
    return { total: live.length, free: live.filter(free).length, paid: paid.length, trials: trials.length, ending: ends, pending: live.filter(company => !free(company) && company.planStatus === "pending_payment").length, monthlyEstimateCents: projection, cohortTrials: starts.size, converted: converted.size, conversionPercent: starts.size ? converted.size / starts.size * 100 : null, cancellations: cancelled.size, distribution: prices.map(plan => ({ id: plan.id, paid: paid.filter(company => company.plan === plan.id).length, trials: trials.filter(company => company.plan === plan.id).length })) };
}
