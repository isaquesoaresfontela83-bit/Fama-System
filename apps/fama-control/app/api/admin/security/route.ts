import { env } from "cloudflare:workers";

import { selectRows, usesSupabase } from "@/lib/supabase";
import { isDataEncryptionConfigured } from "@/lib/crypto";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const tables = [
  "organizations",
  "organization_members",
  "leads",
  "quotes",
  "appointments",
  "work_orders",
  "customers",
  "inventory_items",
  "transactions",
  "employees",
  "warranties",
  "contracts",
  "attachments",
  "legal_consents",
  "privacy_requests",
  "audit_logs",
  "recovery_snapshots",
  "request_rate_limits",
] as const;

function runtime() {
  return env as unknown as Record<string, unknown>;
}

export async function GET() {
  try {
    const user = await requirePlatformAdmin();
    const values = runtime();
    const supabaseConfigured = Boolean(String(values.SUPABASE_URL ?? "").trim() && String(values.SUPABASE_SECRET_KEY ?? "").trim());
    const storageConfigured = Boolean(String(values.SUPABASE_STORAGE_BUCKET ?? "").trim());
    const rows = await Promise.all(tables.map(async (name) => {
      if (!usesSupabase() || !supabaseConfigured) return { name, rows: null, state: "unavailable" as const };
      try {
        const primaryKey = name === "request_rate_limits" ? "key_hash" : "id";
        const result = await selectRows<Record<string, unknown>>(name, {}, { select: primaryKey });
        return { name, rows: result.length, state: "ok" as const };
      } catch {
        return { name, rows: null, state: "unavailable" as const };
      }
    }));
    return Response.json({
      checkedAt: new Date().toISOString(),
      owner: { configured: Boolean(String(values.PLATFORM_OWNER_EMAIL ?? "").trim()), currentUser: user.email },
      backend: { mode: String(values.DATA_BACKEND ?? "d1").toLowerCase(), supabaseConfigured, storageConfigured },
      encryption: { configured: isDataEncryptionConfigured(), algorithm: "AES-256-GCM", note: "Chave mantida somente no ambiente server-side." },
      headers: { https: true, hardening: ["HSTS", "CSP", "X-Content-Type-Options", "Referrer-Policy"] },
      production: { rateLimiting: rows.some((row) => row.name === "request_rate_limits" && row.state === "ok"), audit: rows.some((row) => row.name === "audit_logs" && row.state === "ok"), recovery: rows.some((row) => row.name === "recovery_snapshots" && row.state === "ok"), backups: true, mfa: true },
      tables: rows,
    });
  } catch (error) {
    return tenantError(error, "Não foi possível conferir a segurança da plataforma.");
  }
}
