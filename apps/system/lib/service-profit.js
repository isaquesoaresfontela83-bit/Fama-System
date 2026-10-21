export function serviceNotes(value) {
    try {
        const parsed = JSON.parse(String(value ?? ""));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return { text: String(parsed.text ?? ""), details: parsed.details && typeof parsed.details === "object" && !Array.isArray(parsed.details) ? parsed.details : {} };
    }
    catch { /* Older records contain plain text. */ }
    return { text: String(value ?? ""), details: {} };
}
export const costFields = ["productCost", "laborCost", "travelCost"];
export function costCents(value) {
    if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "")
        return null;
    let raw = String(value).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
    if (raw.includes(",")) {
        if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw))
            return null;
        raw = raw.replace(/\./g, "").replace(",", ".");
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
        return null;
    const amount = Math.round(Number(raw) * 100);
    return Number.isSafeInteger(amount) && amount >= 0 && amount <= 10000000000 ? amount : null;
}
export function serviceProfit(order) {
    const details = serviceNotes(order.notes).details;
    const costs = costFields.map(key => costCents(details[key]));
    const complete = costs.every(value => value !== null);
    const cost = costs.reduce((total, value) => total + (value ?? 0), 0);
    const revenue = Number.isSafeInteger(order.amountCents) && order.amountCents >= 0 ? order.amountCents : 0;
    return { complete, revenueCents: revenue, knownCostCents: cost, costCents: complete ? cost : null, profitCents: complete ? revenue - cost : null, marginPercent: complete && revenue > 0 ? (revenue - cost) / revenue * 100 : null, missing: costFields.filter((_, index) => costs[index] === null) };
}
