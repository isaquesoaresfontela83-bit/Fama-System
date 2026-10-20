const basicFeatures = [
    "CRM, clientes e piscinas",
    "Agenda, mapa operacional e ordens de serviço",
    "Orçamentos em PDF",
    "Consulta de CNPJ e CEP",
    "Painel personalizável e gestão geral",
    "Manual e chamados de suporte",
];
const plusFeatures = ["Tudo do Basic", "Financeiro, contas a pagar e receber, Asaas e Pix", "Contratos e garantias", "Estoque e controle de produtos", "Gestão da equipe e modo técnico", "Chat interno"];
const proFeatures = ["Tudo do Plus", "Fama IA para consultar e planejar a operação", "Frete automático: distância entre CEPs × tarifa por km", "Preparação e arquivo de notas fiscais; emissão de NFS-e pela Asaas com configuração fiscal"];
export const PLAN_PRICE_NOTICE = "Os valores, limites e recursos dos planos estão sujeitos a alterações, sempre com aviso prévio.";
export const PLAN_CONSULTATION_PHONE = "(61) 99138-8546";
export const PLAN_CONSULTATION_URL = "https://wa.me/5561991388546?text=" + encodeURIComponent("Olá! Quero uma consultoria para entender qual plano do Fama System é mais adequado para minha empresa.");
export const PLANS = {
    inicial: {
        name: "Basic",
        priceCents: 9900,
        description: "Para profissionais autônomos e pequenas equipes organizarem clientes, agenda, orçamentos e serviços em um só lugar.",
        limits: { users: 3, customers: 200 },
        highlights: ["Até 3 usuários", "Até 200 clientes", ...basicFeatures],
    },
    intermediario: {
        name: "Plus",
        priceCents: 19900,
        description: "Para empresas em crescimento controlarem o financeiro e coordenarem equipe, estoque, contratos e garantias, com comunicação interna.",
        limits: { users: 6, customers: 1000 },
        highlights: ["Até 6 usuários", "Até 1.000 clientes", ...plusFeatures],
    },
    profissional: {
        name: "Pro",
        priceCents: 35000,
        description: "A operação completa, com Fama IA, frete automático entre CEPs e notas fiscais para empresas com maior volume de serviços.",
        limits: { users: 10, customers: 5000 },
        highlights: ["Até 10 usuários", "Até 5.000 clientes", ...proFeatures],
    },
};
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
        const features = modules ? modules.split(/\r?\n|\s*;\s*/).map(item => item.trim()).filter(Boolean) : fallback.highlights.slice(2);
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
