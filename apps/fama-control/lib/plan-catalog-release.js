import { defaultPlanCatalog } from "./plan-catalog";
const releaseKey = "plan_catalog_release_2026_10_10";
/** Apply this authorized catalog update once; later administrative edits win. */
async function applyPriceRelease(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run();
    const applied = await db.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(releaseKey).first();
    if (applied)
        return;
    const now = new Date().toISOString();
    // D1 batches are atomic. Only catalog settings change; issued payments,
    // organization plans, access rules and trial dates remain untouched.
    await db.batch([
        db.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, updated_at)
      SELECT 'plan_catalog_before_2026_10_10', value, updated_at FROM platform_settings WHERE key = 'plan_catalog'`),
        db.prepare(`INSERT INTO platform_settings (key, value, updated_at)
      SELECT 'plan_catalog', ?, ? WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
            .bind(JSON.stringify(defaultPlanCatalog), now, releaseKey),
        db.prepare("INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)").bind(releaseKey, "applied", now),
    ]);
}
export async function applyPlanCatalogRelease(db) {
    await applyPriceRelease(db);
    const featureKey = "plan_finance_plus_release_2026_10_10";
    if (await db.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(featureKey).first())
        return;
    const saved = await db.prepare("SELECT value FROM platform_settings WHERE key = 'plan_catalog'").first();
    let previous = [];
    try {
        const parsed = JSON.parse(saved?.value ?? "[]");
        if (Array.isArray(parsed))
            previous = parsed;
    }
    catch { /* Restore a valid catalog if the old value is malformed. */ }
    // Change resource descriptions once, preserving prices and capacity edited in Control.
    const catalog = defaultPlanCatalog.map(plan => ({ ...plan, ...previous.find(item => item?.id === plan.id), id: plan.id, description: plan.description, modules: plan.modules }));
    const now = new Date().toISOString();
    await db.batch([
        db.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, updated_at)
      SELECT 'plan_catalog_before_finance_plus_2026_10_10', value, updated_at FROM platform_settings WHERE key = 'plan_catalog'`),
        db.prepare(`INSERT INTO platform_settings (key, value, updated_at)
      SELECT 'plan_catalog', ?, ? WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
            .bind(JSON.stringify(catalog), now, featureKey),
        db.prepare("INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)").bind(featureKey, "applied", now),
    ]);
}
