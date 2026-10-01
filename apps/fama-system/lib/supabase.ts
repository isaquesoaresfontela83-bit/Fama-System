import { env } from "cloudflare:workers";

type RuntimeEnvironment = {
  DATA_BACKEND?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  FAMA_DATA_BRIDGE_SECRET?: string;
};

type Primitive = string | number | boolean | null;

export type SupabaseFilter = Record<string, Primitive>;

export class SupabaseRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function runtime() {
  return env as unknown as RuntimeEnvironment;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function usesSupabase() {
  return clean(runtime().DATA_BACKEND).toLocaleLowerCase("pt-BR") === "supabase";
}

export function supabaseStorageBucket() {
  return clean(runtime().SUPABASE_STORAGE_BUCKET) || "fama-documents";
}

function configuration() {
  const url = clean(runtime().SUPABASE_URL).replace(/\/+$/, "");
  const key = clean(runtime().SUPABASE_SECRET_KEY);
  const bridgeSecret = clean(runtime().FAMA_DATA_BRIDGE_SECRET);
  if (!url || (!key && !bridgeSecret)) {
    throw new SupabaseRequestError("O Supabase ainda não foi configurado.", 503, "SUPABASE_NOT_CONFIGURED");
  }
  return { url, key, bridgeSecret };
}

function authHeaders(key: string) {
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key, bridgeSecret } = configuration();
  const headers = new Headers({
    Accept: "application/json",
    ...(key ? authHeaders(key) : {}),
    ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
  });
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  if (!key) {
    headers.set("Authorization", `Bearer ${bridgeSecret}`);
    headers.set("x-fama-data-path", path);
    headers.set("x-fama-data-method", init.method ?? "GET");
  }
  const response = await fetch(key ? `${url}${path}` : "https://control.famasystem.online/api/internal/data", {
    ...init,
    ...(!key ? { method: "POST" } : {}),
    headers,
    signal: init.signal ?? AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string; code?: string };
    throw new SupabaseRequestError(payload.message || payload.error || `Supabase respondeu com status ${response.status}.`, response.status, payload.code);
  }

  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

function query(filters: SupabaseFilter, options?: { select?: string; order?: string; limit?: number }) {
  const params = new URLSearchParams();
  params.set("select", options?.select || "*");
  for (const [column, value] of Object.entries(filters)) {
    params.set(column, value === null ? "is.null" : `eq.${String(value)}`);
  }
  if (options?.order) params.set("order", options.order);
  if (options?.limit) params.set("limit", String(options.limit));
  return params.toString();
}

export async function selectRows<T extends Record<string, unknown>>(
  table: string,
  filters: SupabaseFilter = {},
  options?: { select?: string; order?: string; limit?: number },
) {
  return request<T[]>(`/rest/v1/${encodeURIComponent(table)}?${query(filters, options)}`);
}

export async function selectOne<T extends Record<string, unknown>>(
  table: string,
  filters: SupabaseFilter,
  options?: { select?: string },
) {
  const rows = await selectRows<T>(table, filters, { ...options, limit: 1 });
  return rows[0] ?? null;
}

export async function insertRow<T extends Record<string, unknown>>(table: string, values: Record<string, unknown>) {
  const rows = await request<T[]>(`/rest/v1/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(values),
  });
  return rows[0];
}

export async function updateRows<T extends Record<string, unknown>>(
  table: string,
  values: Record<string, unknown>,
  filters: SupabaseFilter,
) {
  return request<T[]>(`/rest/v1/${encodeURIComponent(table)}?${query(filters)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(values),
  });
}

export async function deleteRows<T extends Record<string, unknown>>(table: string, filters: SupabaseFilter) {
  return request<T[]>(`/rest/v1/${encodeURIComponent(table)}?${query(filters)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
}

export async function callRpc<T>(name: string, values: Record<string, unknown>) {
  return request<T>(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export async function uploadObject(path: string, file: Blob, contentType: string) {
  const bucket = supabaseStorageBucket();
  return request<Record<string, unknown>>(`/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "x-upsert": "false" },
    body: file,
  });
}

export async function removeObjects(paths: string[]) {
  if (!paths.length) return;
  return request<Record<string, unknown>>(`/storage/v1/object/${encodeURIComponent(supabaseStorageBucket())}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: paths }),
  });
}

export async function createSignedObjectUrl(path: string, expiresIn = 900) {
  const payload = await request<{ signedURL?: string; signedUrl?: string }>(`/storage/v1/object/sign/${encodeURIComponent(supabaseStorageBucket())}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn }),
  });
  const signed = payload.signedURL || payload.signedUrl || "";
  if (!signed) throw new SupabaseRequestError("Não foi possível gerar o acesso ao arquivo.", 503);
  if (/^https?:\/\//.test(signed)) return signed;
  return `${configuration().url}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

export function camelizeRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    value,
  ])) as T;
}

export function snakeRow(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    value,
  ]));
}
