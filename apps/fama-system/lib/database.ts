import { env } from "cloudflare:workers";

export function database(): D1Database {
  if (!env.DB) throw new Error("Banco de dados indisponível.");
  return env.DB;
}

export function requiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} é obrigatório.`);
  return text;
}

export function optionalText(value: unknown): string {
  return String(value ?? "").trim();
}

export function numberValue(value: unknown, fallback = 0): number {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function cents(value: unknown): number {
  let normalized = String(value ?? "").trim().replace(/[^0-9,.-]/g, "");
  if (!normalized) return 0;
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if ((normalized.match(/\./g) ?? []).length > 1) normalized = normalized.replace(/\./g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function dateTime(value: unknown): string {
  const raw = optionalText(value);
  if (!raw) return "";
  const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00-03:00` : raw;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

export function reference(prefix: "ORC" | "OS" | "GAR" | "CTR"): string {
  const year = new Date().getUTCFullYear().toString().slice(-2);
  return `${prefix}-${year}${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
}
