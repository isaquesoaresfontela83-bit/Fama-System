export const PLANS = {
  inicial: {
    name: "Inicial",
    priceCents: 4990,
    description: "Para começar a organizar a operação com controle comercial e financeiro essencial.",
    limits: { users: 2, customers: 200 },
    highlights: ["2 usuários", "200 clientes", "CRM, agenda, financeiro e manual"],
  },
  intermediario: {
    name: "Intermediário",
    priceCents: 9990,
    description: "Para equipes em crescimento que precisam de automação, contratos e multiusuário.",
    limits: { users: 6, customers: 1000 },
    highlights: ["6 usuários", "1.000 clientes", "Contratos, garantias e integrações financeiras"],
  },
  profissional: {
    name: "Profissional",
    priceCents: 19990,
    description: "Para operação completa, com mais capacidade, equipe ampliada e recursos avançados.",
    limits: { users: 20, customers: 5000 },
    highlights: ["20 usuários", "5.000 clientes", "IA, conciliação e operação completa"],
  },
} as const;

export type PlanCode = keyof typeof PLANS;
export type BillingCycle = "monthly" | "quarterly" | "semiannual" | "annual";
export type PlanSnapshot = {
  code: PlanCode;
  name: string;
  priceCents: number;
  description: string;
  limits: { users: number; customers: number };
  highlights: string[];
};

export const BILLING_CYCLES: Record<BillingCycle, { label: string; shortLabel: string; months: number; discountPercent: number }> = {
  monthly: { label: "Mensal", shortLabel: "mês", months: 1, discountPercent: 0 },
  quarterly: { label: "Trimestral", shortLabel: "trimestre", months: 3, discountPercent: 5 },
  semiannual: { label: "Semestral", shortLabel: "semestre", months: 6, discountPercent: 10 },
  annual: { label: "Anual", shortLabel: "ano", months: 12, discountPercent: 15 },
};

const controlPlansUrl = "https://control.famasystem.online/api/public/plans";

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === "string" && Object.hasOwn(BILLING_CYCLES, value);
}

export function normalizeCompanyName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function planSnapshot(plan: PlanCode = "inicial"): PlanSnapshot {
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

export function planPrice(plan: PlanCode) {
  return PLANS[plan].priceCents / 100;
}

export function cyclePriceCents(monthlyPriceCents: number, cycle: BillingCycle) {
  const item = BILLING_CYCLES[cycle];
  return Math.round(monthlyPriceCents * item.months * (100 - item.discountPercent) / 100);
}

export function cyclePrice(monthlyPriceCents: number, cycle: BillingCycle) {
  return cyclePriceCents(monthlyPriceCents, cycle) / 100;
}

function normalizeRemotePlans(value: unknown): Partial<Record<PlanCode, PlanSnapshot>> {
  if (!Array.isArray(value)) return {};
  const mapped: Partial<Record<PlanCode, PlanSnapshot>> = {};
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const plan = item as Record<string, unknown>;
    const code = String(plan.id ?? "");
    if (!isPlanCode(code)) continue;
    const fallback = planSnapshot(code);
    const modules = String(plan.modules ?? "").trim();
    mapped[code] = {
      code,
      name: String(plan.name ?? fallback.name).trim() || fallback.name,
      priceCents: Number.isFinite(Number(plan.price)) && Number(plan.price) > 0 ? Math.round(Number(plan.price)) : fallback.priceCents,
      description: fallback.description,
      limits: { users: remoteLimit(plan.users, fallback.limits.users), customers: remoteLimit(plan.clients, fallback.limits.customers) },
      highlights: [
        String(plan.users ?? "").trim() || fallback.highlights[0],
        String(plan.clients ?? "").trim() || fallback.highlights[1],
        modules || fallback.highlights[2],
      ],
    };
  }
  return mapped;
}

function remoteLimit(value: unknown, fallback: number) {
  const numeric = Number(String(value ?? "").match(/[\d.]+/)?.[0]?.replace(/\./g, ""));
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export async function getPlanCatalog(): Promise<Record<PlanCode, PlanSnapshot>> {
  const fallback = Object.fromEntries((Object.keys(PLANS) as PlanCode[]).map((plan) => [plan, planSnapshot(plan)])) as Record<PlanCode, PlanSnapshot>;
  try {
    const response = await fetch(controlPlansUrl, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return fallback;
    const payload = await response.json() as { plans?: unknown };
    return { ...fallback, ...normalizeRemotePlans(payload.plans) };
  } catch {
    return fallback;
  }
}

export async function getPlanSnapshot(plan: PlanCode) {
  const catalog = await getPlanCatalog();
  return catalog[plan] ?? planSnapshot(plan);
}

export async function getPlanPrice(plan: PlanCode) {
  return (await getPlanSnapshot(plan)).priceCents / 100;
}
