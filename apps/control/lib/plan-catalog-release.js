import { defaultPlanCatalog, refreshCatalogPresentation } from "./plan-catalog";
import { parsePlanPolicy, planPolicyKey } from "./plan-policy";
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
async function applyFinanceRelease(db) {
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

const presentationKey = "plan_catalog_presentation_2026_10_21";
async function applyPresentationRelease(db) {
    if (await db.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(presentationKey).first()) return;
    const keys = ["plan_catalog", planPolicyKey];
    const rows = await Promise.all(keys.map(key => db.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(key).first()));
    const catalog = rows[0] ? JSON.parse(rows[0].value) : defaultPlanCatalog;
    if (!Array.isArray(catalog)) throw new Error("O catálogo de planos precisa de revisão.");
    const policy = parsePlanPolicy(rows[1]?.value);
    if (rows[1] && !policy) throw new Error("A configuração de planos precisa de revisão.");
    const now = new Date().toISOString();
    const notice = "Descrições dos planos atualizadas com os recursos atuais. Preços, limites, acessos e cobranças foram preservados.";
    const nextPolicy = policy ? {
        ...policy, revision: policy.revision + 1,
        current: policy.current.map(refreshCatalogPresentation),
        pending: policy.pending ? { ...policy.pending, plans: policy.pending.plans.map(refreshCatalogPresentation) } : null,
        history: [...(policy.history ?? []), { revision: policy.revision + 1, savedAt: now, effectiveAt: now, notice }].slice(-100),
    } : null;
    const next = [JSON.stringify(catalog.map(refreshCatalogPresentation)), nextPolicy && JSON.stringify(nextPolicy)];
    const nonce = crypto.randomUUID();
    // Acquire the one-time release only if neither setting changed since our read.
    // Every write below shares this guard inside one atomic D1 batch.
    const comparisons = rows.map(row => row ? "EXISTS (SELECT 1 FROM platform_settings WHERE key = ? AND value = ?)" : "NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = ?)");
    const expected = rows.flatMap((row, index) => row ? [keys[index], row.value] : [keys[index]]);
    const batch = [db.prepare(`INSERT OR IGNORE INTO platform_settings (key,value,updated_at) SELECT ?,?,? WHERE ${comparisons.join(" AND ")}`).bind(presentationKey, nonce, now, ...expected)];
    for (let index = 0; index < keys.length; index++) {
        if (next[index] === null) continue;
        const key = keys[index];
        batch.push(db.prepare(`INSERT OR IGNORE INTO platform_settings (key,value,updated_at)
            SELECT ?,value,updated_at FROM platform_settings WHERE key = ? AND EXISTS (SELECT 1 FROM platform_settings WHERE key = ? AND value = ?)`)
            .bind(key + "_before_2026_10_21", key, presentationKey, nonce));
        batch.push(db.prepare(`INSERT INTO platform_settings (key,value,updated_at)
            SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM platform_settings WHERE key = ? AND value = ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
            .bind(key, next[index], now, presentationKey, nonce));
    }
    await db.batch(batch);
}

export async function applyPlanCatalogRelease(db) {
    await applyPriceRelease(db);
    await applyFinanceRelease(db);
    await applyPresentationRelease(db);
}
