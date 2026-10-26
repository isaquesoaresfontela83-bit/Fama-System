import { env } from "cloudflare:workers";

export type EconodataLevel = "basic" | "commercial" | "contacts" | "advanced";

export type CompanyLookupResult = {
  source: "econodata" | "brasilapi";
  enriched: boolean;
  level: EconodataLevel;
  cnpj: string;
  data: unknown;
  warning?: string;
};

type RuntimeEnv = {
  ECONODATA_API_KEY?: string;
  ECONODATA_BASE_URL?: string;
};

const ECONODATA_BUCKETS: Record<Exclude<EconodataLevel, "basic">, string[]> = {
  commercial: ["cadastro", "estrategico"],
  contacts: ["cadastro", "estrategico", "contatosBasicos"],
  advanced: ["cadastro", "estrategico", "perfilNegocio", "contatosBasicos", "contatosAvancados"],
};

export function normalizeCnpj(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCnpjShape(value: string) {
  return /^\d{14}$/.test(normalizeCnpj(value));
}

function runtimeConfig() {
  const runtime = env as unknown as RuntimeEnv;
  return {
    apiKey: String(runtime.ECONODATA_API_KEY ?? "").trim(),
    baseUrl: String(runtime.ECONODATA_BASE_URL ?? "https://api.econodata.com.br")
      .trim()
      .replace(/\/$/, ""),
  };
}

export function econodataConfigured() {
  return Boolean(runtimeConfig().apiKey);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function queryBrasilApi(cnpj: string) {
  const response = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`BrasilAPI indisponível (${response.status}).`);
  }
  return payload;
}

async function queryEconodata(cnpj: string, level: Exclude<EconodataLevel, "basic">) {
  const { apiKey, baseUrl } = runtimeConfig();
  if (!apiKey) throw new Error("ECONODATA_API_KEY não configurada.");

  const response = await fetchWithTimeout(`${baseUrl}/v4/companies/search`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      criterios: { cnpj },
      incluir: ECONODATA_BUCKETS[level],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message ?? "")
      : "";
    throw new Error(providerMessage || `Econodata respondeu HTTP ${response.status}.`);
  }

  return payload;
}

export async function lookupCompany(cnpjInput: string, level: EconodataLevel = "commercial"): Promise<CompanyLookupResult> {
  const cnpj = normalizeCnpj(cnpjInput);
  if (!isValidCnpjShape(cnpj)) throw new Error("CNPJ inválido. Informe 14 dígitos.");

  if (level === "basic") {
    return {
      source: "brasilapi",
      enriched: false,
      level,
      cnpj,
      data: await queryBrasilApi(cnpj),
    };
  }

  if (econodataConfigured()) {
    try {
      return {
        source: "econodata",
        enriched: true,
        level,
        cnpj,
        data: await queryEconodata(cnpj, level),
      };
    } catch (error) {
      const fallback = await queryBrasilApi(cnpj);
      return {
        source: "brasilapi",
        enriched: false,
        level,
        cnpj,
        data: fallback,
        warning: error instanceof Error ? `Econodata indisponível; consulta básica usada. ${error.message}` : "Econodata indisponível; consulta básica usada.",
      };
    }
  }

  return {
    source: "brasilapi",
    enriched: false,
    level,
    cnpj,
    data: await queryBrasilApi(cnpj),
    warning: "Econodata ainda não possui chave configurada; consulta básica usada.",
  };
}
