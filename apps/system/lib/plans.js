import { defaultPlanCatalog } from "./plan-catalog";
export { PLAN_PRICE_NOTICE } from "./plan-catalog";
export const PLAN_CONSULTATION_PHONE = "(61) 99138-8546";
export const PLAN_CONSULTATION_URL = "https://wa.me/5561991388546?text=" + encodeURIComponent("Olá! Quero uma consultoria para entender qual plano do Fama System é mais adequado para minha empresa.");
export const PLANS = Object.fromEntries(defaultPlanCatalog.map(plan => [plan.id, {
    name: plan.name,
    priceCents: plan.price,
    description: plan.description,
    limits: { users: remoteLimit(plan.users, 1), customers: remoteLimit(plan.clients, 1) },
    highlights: [plan.users, plan.clients, ...plan.modules.split("\n")],
}]));
export const BILLING_CYCLES = {
    monthly: { label: "Mensal", shortLabel: "mês", months: 1, discountPercent: 0 },
    quarterly: { label: "Trimestral", shortLabel: "trimestre", months: 3, discountPercent: 5 },
    semiannual: { label: "Semestral", shortLabel: "semestre", months: 6, discountPercent: 10 },
    annual: { label: "Anual", shortLabel: "ano", months: 12, discountPercent: 15 },
};
const controlPlansUrl = "https://control.famasystem.online/api/public/plans";
export function isPlanCode(value) {
    return typeof value === "string" && Object.hasOwn(PLANS, value);
}
export function isBillingCycle(value) {
    return typeof value === "string" && Object.hasOwn(BILLING_CYCLES, value);
}
export function normalizeCompanyName(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function planSnapshot(plan = "inicial") {
    const item = PLANS[plan];
    return {
        code: plan,
        name: item.name,
        priceCents: item.priceCents,
        description: item.description,
        limits: item.limits,
        highlights: [...item.highlights],
    };
}
export function planPrice(plan) {
    return PLANS[plan].priceCents / 100;
}
export function cyclePriceCents(monthlyPriceCents, cycle) {
    const item = BILLING_CYCLES[cycle];
    return Math.round(monthlyPriceCents * item.months * (100 - item.discountPercent) / 100);
}
export function cyclePrice(monthlyPriceCents, cycle) {
    return cyclePriceCents(monthlyPriceCents, cycle) / 100;
}
function normalizeRemotePlans(value) {
    if (!Array.isArray(value))
        return {};
    const mapped = {};
    for (const item of value) {
        if (!item || typeof item !== "object")
            continue;
        const plan = item;
        const code = String(plan.id ?? "");
        if (!isPlanCode(code))
            continue;
        const fallback = planSnapshot(code);
        const modules = String(plan.modules ?? "").trim();
        const features = modules ? modules.split(/\r?\n/).map(item => item.trim()).filter(Boolean) : fallback.highlights.slice(2);
        mapped[code] = {
            code,
            name: String(plan.name ?? fallback.name).trim() || fallback.name,
            priceCents: Number.isFinite(Number(plan.price)) && Number(plan.price) > 0 ? Math.round(Number(plan.price)) : fallback.priceCents,
            description: String(plan.description ?? "").trim() || fallback.description,
            limits: { users: remoteLimit(plan.users, fallback.limits.users), customers: remoteLimit(plan.clients, fallback.limits.customers) },
            highlights: [
                String(plan.users ?? "").trim() || fallback.highlights[0],
                String(plan.clients ?? "").trim() || fallback.highlights[1],
                ...features,
            ],
        };
    }
    return mapped;
}
function remoteLimit(value, fallback) {
    const numeric = Number(String(value ?? "").match(/[\d.]+/)?.[0]?.replace(/\./g, ""));
    return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}
export async function getPlanCatalog() {
    const fallback = Object.fromEntries(Object.keys(PLANS).map((plan) => [plan, planSnapshot(plan)]));
    try {
        const response = await fetch(controlPlansUrl, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return fallback;
        const payload = await response.json();
        return { ...fallback, ...normalizeRemotePlans(payload.plans) };
    }
    catch {
        return fallback;
    }
}
export async function getPlanSnapshot(plan) {
    const catalog = await getPlanCatalog();
    return catalog[plan] ?? planSnapshot(plan);
}
export async function getPlanPrice(plan) {
    return (await getPlanSnapshot(plan)).priceCents / 100;
}
