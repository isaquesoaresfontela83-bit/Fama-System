export type AsaasEnvironment = "sandbox" | "production";

export class AsaasError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asaasBaseUrl(environment: AsaasEnvironment) {
  return environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

export function parseAsaasEnvironment(value: unknown): AsaasEnvironment {
  return String(value ?? "sandbox") === "production" ? "production" : "sandbox";
}

export function validateAsaasKey(apiKey: string, environment: AsaasEnvironment) {
  const expected = environment === "production" ? "$aact_prod_" : "$aact_hmlg_";
  if (!apiKey.startsWith(expected) || apiKey.length < expected.length + 20 || apiKey.length > 500) {
    throw new AsaasError(400, `A chave não corresponde ao ambiente ${environment === "production" ? "de produção" : "Sandbox"}.`);
  }
}

function errorMessage(payload: Record<string, unknown>) {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const first = errors[0] as Record<string, unknown> | undefined;
  return String(first?.description ?? payload.message ?? "").trim();
}

export async function asaasRequest(apiKey: string, environment: AsaasEnvironment, path: string, init: RequestInit = {}) {
  const response = await fetch(`${asaasBaseUrl(environment)}${path}`, {
    ...init,
    redirect: "manual",
    signal: init.signal ?? AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Fama-System/1.0",
      access_token: apiKey,
      ...(init.headers ?? {}),
    },
  });
  if (response.status >= 300 && response.status < 400) throw new AsaasError(502, "A Asaas retornou um redirecionamento inesperado.");
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const providerMessage = errorMessage(payload);
    if (response.status === 401) throw new AsaasError(401, "A chave da Asaas é inválida, foi revogada ou pertence a outro ambiente.");
    if (response.status === 429) throw new AsaasError(503, "A Asaas limitou temporariamente as consultas. Tente novamente em alguns minutos.");
    throw new AsaasError(response.status >= 500 ? 502 : response.status, providerMessage || "A Asaas não respondeu corretamente.");
  }
  return payload;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function asaasMovement(transaction: Record<string, unknown>) {
  const id = String(transaction.id ?? "").trim();
  if (!id) return null;
  const value = Number(transaction.value ?? 0);
  if (!Number.isFinite(value) || value === 0) return null;
  const postedAt = String(transaction.date ?? transaction.createdAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return null;
  const description = String(transaction.description ?? transaction.type ?? "Movimentação Asaas").trim().slice(0, 300) || "Movimentação Asaas";
  return { providerTransactionId: id, postedAt, description, amountCents: Math.round(value * 100) };
}
