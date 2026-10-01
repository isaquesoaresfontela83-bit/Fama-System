import { database } from "@/lib/database";
import { defaultPoolQuoteConfig, isPoolQuoteConfig, type PoolQuoteConfig } from "@/lib/pool-quote-catalog";
import { insertRow, selectOne, updateRows, usesSupabase } from "@/lib/supabase";

export async function readQuoteConfig(organizationId: string): Promise<PoolQuoteConfig> {
  const id = `${organizationId}:pool-catalog`;
  if (usesSupabase()) {
    const row = await selectOne<{ config: unknown }>("fama_quote_config", { id }, { select: "config" })
      ?? await selectOne<{ config: unknown }>("fama_quote_config", { id: "pool-catalog" }, { select: "config" });
    return isPoolQuoteConfig(row?.config) ? row.config : structuredClone(defaultPoolQuoteConfig);
  }
  const row = await database().prepare("SELECT config_json FROM quote_catalogs WHERE organization_id = ?")
    .bind(organizationId).first<{ config_json: string }>();
  if (row) {
    try {
      const config: unknown = JSON.parse(row.config_json);
      if (isPoolQuoteConfig(config)) return config;
    } catch { /* Existing malformed settings use the default catalog. */ }
  }
  return structuredClone(defaultPoolQuoteConfig);
}

export async function writeQuoteConfig(organizationId: string, config: PoolQuoteConfig) {
  const now = new Date().toISOString();
  if (usesSupabase()) {
    const id = `${organizationId}:pool-catalog`;
    const existing = await selectOne<{ id: string }>("fama_quote_config", { id }, { select: "id" });
    if (existing) await updateRows("fama_quote_config", { config, updated_at: now }, { id });
    else await insertRow("fama_quote_config", { id, config, updated_at: now });
  } else {
    await database().prepare(`INSERT INTO quote_catalogs (organization_id, config_json, updated_at)
      VALUES (?, ?, ?) ON CONFLICT(organization_id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`)
      .bind(organizationId, JSON.stringify(config), now).run();
  }
}
