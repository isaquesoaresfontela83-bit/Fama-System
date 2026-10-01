import { env } from "cloudflare:workers";
import { isInternalRequest } from "@/lib/internal-auth";

const tables = new Set([
  "organizations", "organization_members", "leads", "quotes", "appointments", "work_orders",
  "customers", "inventory_items", "transactions", "employees", "warranties", "contracts",
  "attachments", "legal_consents", "audit_logs", "recovery_snapshots", "privacy_requests",
  "request_rate_limits", "fama_quote_config", "suppliers", "purchases", "bank_accounts",
  "bank_movements", "bank_connections", "platform_settings", "support_tickets",
]);
const procedures = new Set(["fama_consume_rate_limit", "schedule_warranty"]);
const methods = new Set(["GET", "POST", "PATCH", "DELETE"]);

export function allowedDataPath(path: string) {
  if (!path.startsWith("/") || path.includes("\\") || /[\r\n]/.test(path)) return false;
  const url = new URL(path, "https://backend.invalid");
  if (url.origin !== "https://backend.invalid" || url.hash) return false;
  const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  if (table) return tables.has(table);
  const procedure = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
  if (procedure) return procedures.has(procedure);
  return /^\/storage\/v1\/object\/(?:sign\/)?fama-documents(?:\/[a-zA-Z0-9_%.-]+)+$/.test(url.pathname)
    || url.pathname === "/storage/v1/object/fama-documents";
}

export async function POST(request: Request) {
  const runtime = env as unknown as { FAMA_DATA_BRIDGE_SECRET?: string; SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string };
  if (!await isInternalRequest(request)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const path = request.headers.get("x-fama-data-path") ?? "";
  const method = request.headers.get("x-fama-data-method") ?? "GET";
  if (!methods.has(method) || !allowedDataPath(path)) {
    return Response.json({ error: "Operação não permitida." }, { status: 400 });
  }
  const baseUrl = String(runtime.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = String(runtime.SUPABASE_SECRET_KEY ?? "");
  if (!baseUrl || !key) return Response.json({ error: "Serviço de dados indisponível." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 12 * 1024 * 1024) return new Response(null, { status: 413 });
  const body = method === "GET" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > 12 * 1024 * 1024) return new Response(null, { status: 413 });
  const headers = new Headers({ apikey: key, Accept: "application/json" });
  if (key.startsWith("eyJ")) headers.set("Authorization", `Bearer ${key}`);
  for (const name of ["content-type", "prefer", "x-upsert"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(`${baseUrl}${path}`, { method, headers, ...(body?.byteLength ? { body } : {}), signal: AbortSignal.timeout(20000), redirect: "manual" });
    if (response.status >= 300 && response.status < 400) return Response.json({ error: "O serviço de dados retornou um redirecionamento inesperado." }, { status: 502 });
    return new Response(response.body, { status: response.status, headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return Response.json({ error: "Serviço de dados temporariamente indisponível." }, { status: 503 });
  }
}
