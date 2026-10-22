import { readActivePlanFeatures } from "./plan-policy-server";
import { callRpc, selectOne } from './supabase';
import { parseBlockRules, resolveBlockAccess } from './fama-blocks';
export async function readBlockRules(organizationId = '', memberId = '') {
    return parseBlockRules(await callRpc('fama_get_block_rules', { p_organization_id: organizationId, p_member_id: memberId }));
}
export async function memberBlockAccess(member, plan) {
    const tier = plan ?? (await selectOne('organizations', { id: String(member.organization_id) }, { select: 'plan' }))?.plan ?? 'inicial';
    const rules = await readBlockRules(String(member.organization_id), String(member.id));
    return resolveBlockAccess(String(member.role), member.permissions, rules, tier, await readActivePlanFeatures(tier));
}
