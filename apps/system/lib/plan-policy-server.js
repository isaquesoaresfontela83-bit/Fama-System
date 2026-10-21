import { selectOne, usesSupabase } from "./supabase";
import { database } from "./database";
import { parsePlanPolicy, planPolicyKey } from "./plan-policy";
export async function readPlanPolicyRecord() {
    if (usesSupabase())
        return selectOne("platform_settings", { key: planPolicyKey });
    const row = await database().prepare("SELECT value, updated_at FROM platform_settings WHERE key = ?").bind(planPolicyKey).first();
    return row;
}
export async function readActivePlanFeatures(plan) {
    if (!usesSupabase())
        return undefined;
    const row = await readPlanPolicyRecord();
    const policy = parsePlanPolicy(row?.value);
    if (!policy) {
        if (row)
            throw new Error("A configuração de planos precisa de revisão.");
        return undefined;
    }
    const { effectivePlans, catalogFeatures } = await import("./plan-policy");
    return catalogFeatures(effectivePlans(policy).find(item => item.id === plan) ?? effectivePlans(policy)[0]);
}
