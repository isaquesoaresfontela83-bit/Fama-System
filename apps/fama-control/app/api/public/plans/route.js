import { parsePlanPolicy, effectivePlans, planPolicyKey } from "@/lib/plan-policy";
import { database } from "@/lib/database";
import { selectOne, usesSupabase } from "@/lib/supabase";
import { defaultPlanCatalog as fallbackPlans } from "@/lib/plan-catalog";
import { applyPlanCatalogRelease } from "@/lib/plan-catalog-release";
const settingKey = "plan_catalog";
function parsePlans(value) {
    if (Array.isArray(value))
        return clarifyFiscalFeature(value);
    if (typeof value !== "string" || !value)
        return fallbackPlans;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length ? clarifyFiscalFeature(parsed) : fallbackPlans;
    }
    catch {
        return fallbackPlans;
    }
}
function clarifyFiscalFeature(plans) {
    return plans.map(plan => {
        if (!plan || typeof plan !== "object")
            return plan;
        const item = plan;
        if (typeof item.modules !== "string")
            return item;
        return { ...item, modules: item.modules.replace("Notas fiscais e emissão de NFS-e pela Asaas", "Preparação e arquivo de notas fiscais; emissão de NFS-e pela Asaas com configuração fiscal") };
    });
}
export async function GET() {
    try {
        const policyRow = usesSupabase() ? await selectOne("platform_settings", { key: planPolicyKey }) : await database().prepare("SELECT value FROM platform_settings WHERE key = ?").bind(planPolicyKey).first().catch(() => null);
        const policy = parsePlanPolicy(policyRow?.value);
        if (policy)
            return Response.json({ plans: effectivePlans(policy), revision: policy.revision, notice: policy.pending ? { text: policy.pending.notice, effectiveAt: policy.pending.effectiveAt } : policy.history.length ? { text: policy.history.at(-1)?.notice, effectiveAt: policy.history.at(-1)?.effectiveAt } : null }, { headers: { "Cache-Control": "no-store" } });
        await applyPlanCatalogRelease(database()).catch(() => null);
        const internal = await database().prepare("SELECT value FROM platform_settings WHERE key = ?").bind(settingKey).first().catch(() => null);
        if (internal?.value)
            return Response.json({ plans: parsePlans(internal.value) }, { headers: { "Cache-Control": "no-store" } });
        if (usesSupabase()) {
            const row = await selectOne("platform_settings", { key: settingKey }, { select: "value" });
            return Response.json({ plans: parsePlans(row?.value) }, { headers: { "Cache-Control": "no-store" } });
        }
        await database().prepare(`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run();
        const row = await database().prepare("SELECT value FROM platform_settings WHERE key = ?").bind(settingKey).first();
        return Response.json({ plans: parsePlans(row?.value) }, { headers: { "Cache-Control": "no-store" } });
    }
    catch {
        return Response.json({ plans: fallbackPlans }, { headers: { "Cache-Control": "no-store" } });
    }
}
