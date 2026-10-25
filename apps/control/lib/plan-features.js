const basic = ["dashboard", "crm", "quotes", "agenda", "orders", "customers"];
const plus = [...basic, "finance", "contracts", "warranties", "inventory", "team", "mobile", "chat"];
export const PLAN_FEATURES = {
    inicial: basic,
    intermediario: plus,
    profissional: [...plus, "assistant", "freight", "invoices"],
};
export const planNames = { inicial: "Basic", intermediario: "Plus", profissional: "Pro" };
export function normalizePlanTier(value) {
    return value === "intermediario" || value === "profissional" ? value : "inicial";
}
export function planIncludesFeature(plan, feature, configuredFeatures) {
    return configuredFeatures === undefined
        ? PLAN_FEATURES[normalizePlanTier(plan)].includes(feature)
        : PLAN_FEATURES.profissional.includes(feature) && Array.isArray(configuredFeatures) && configuredFeatures.includes(feature);
}
export function minimumPlanForFeature(feature) {
    return planIncludesFeature("inicial", feature) ? "inicial" : planIncludesFeature("intermediario", feature) ? "intermediario" : "profissional";
}
