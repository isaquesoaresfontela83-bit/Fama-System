import { defaultPlanCatalog } from "./plan-catalog";
import { PLAN_FEATURES, normalizePlanTier, planIncludesFeature } from "./plan-features";
export const planPolicyKey = "fama_plan_policy";
export function catalogFeatures(plan) { return plan.featureIds ?? [...PLAN_FEATURES[normalizePlanTier(plan.id)]]; }
export function defaultPlanPolicy(plans = defaultPlanCatalog) { return { revision: 0, current: plans.map(plan => ({ ...plan, featureIds: catalogFeatures(plan) })), pending: null, history: [] }; }
export function effectivePlans(policy, now = Date.now()) { return policy.pending && Date.parse(policy.pending.effectiveAt) <= now ? policy.pending.plans : policy.current; }
export function parsePlanPolicy(value) {
    try {
        const object = typeof value === "string" ? JSON.parse(value) : value;
        if (!object || !Number.isSafeInteger(object.revision) || object.revision < 0 || !Array.isArray(object.current) || object.current.length !== 3)
            return null;
        return object;
    }
    catch {
        return null;
    }
}
export function normalizePolicyPlans(value) {
    if (!Array.isArray(value) || value.length !== 3)
        throw new Error("Informe os três planos.");
    const seen = new Set();
    return value.map(raw => {
        if (!raw || typeof raw !== "object" || !["inicial", "intermediario", "profissional"].includes(raw.id) || seen.has(raw.id))
            throw new Error("Os planos precisam ter identificadores únicos.");
        seen.add(raw.id);
        if (!Number.isSafeInteger(raw.price) || raw.price <= 0 || raw.price > 100000000)
            throw new Error("Informe um preço mensal válido.");
        const limit = (numeric, label, max) => { const value = numeric ?? Number(String(label ?? "").match(/[\d.]+/)?.[0]?.replace(/\./g, "")); if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > max)
            throw new Error("Informe limites válidos de usuários e clientes."); return Number(value); };
        const userLimit = limit(raw.userLimit, raw.users, 1000), customerLimit = limit(raw.customerLimit, raw.clients, 1000000);
        const featureIds = raw.featureIds ?? [...PLAN_FEATURES[normalizePlanTier(raw.id)]];
        if (!Array.isArray(featureIds) || featureIds.some(feature => typeof feature !== "string" || !planIncludesFeature(raw.id, feature)) || new Set(featureIds).size !== featureIds.length || !featureIds.includes("dashboard"))
            throw new Error("Escolha recursos compatíveis com o plano. A visão geral é obrigatória.");
        const name = String(raw.name ?? "").trim().slice(0, 80);
        if (!name)
            throw new Error("Informe o nome de cada plano.");
        return { id: raw.id, name, price: raw.price, description: String(raw.description ?? "").trim().slice(0, 1500), users: "Até " + userLimit.toLocaleString("pt-BR") + " usuários", clients: "Até " + customerLimit.toLocaleString("pt-BR") + " clientes", userLimit, customerLimit, featureIds, modules: String(raw.modules ?? "").trim().slice(0, 6000) };
    });
}
