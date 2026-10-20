import { featurePermissions, hasFeaturePermission } from './permissions';
import { planIncludesFeature } from './plan-features';
export const famaBlocks = [...featurePermissions, { id: 'assistant', label: 'Fama IA', group: 'Assistente', description: 'Consultas, voz e assistente no WhatsApp.' }];
export const emptyBlockRule = () => ({ overrides: {}, revision: 0, updatedAt: null });
export function parseBlockOverrides(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Regras de blocos inválidas.');
    const entries = Object.entries(value);
    if (entries.some(([key, setting]) => !famaBlocks.some(block => block.id === key) || typeof setting !== 'boolean'))
        throw new Error('Escolha apenas blocos disponíveis e opções válidas.');
    return Object.fromEntries(entries);
}
export function parseBlockRules(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Não foi possível conferir os blocos.');
    return Object.fromEntries(['global', 'organization', 'member'].map(scope => {
        const row = value[scope];
        if (!row || !Number.isSafeInteger(row.revision) || Number(row.revision) < 0 || (row.updatedAt !== null && (typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt)))))
            throw new Error('Revisão dos blocos inválida.');
        return [scope, { overrides: parseBlockOverrides(row.overrides), revision: row.revision, updatedAt: row.updatedAt }];
    }));
}
/** Only platform administrators write overrides. The more specific rule wins. */
export function resolveBlockAccess(role, permissions, rules, plan, features) {
    return famaBlocks.filter(block => {
        if (plan !== undefined && !planIncludesFeature(plan, block.id))
            return false;
        if (features !== undefined && !features.includes(block.id))
            return false;
        let allowed = block.id === 'assistant' || hasFeaturePermission(role, permissions, block.id);
        for (const scope of ['global', 'organization', 'member']) {
            const setting = rules[scope].overrides[block.id];
            if (setting !== undefined)
                allowed = setting;
        }
        return allowed;
    }).map(block => block.id);
}
export function planBlockAccess(role, permissions, plan) {
    return resolveBlockAccess(role, permissions, { global: emptyBlockRule(), organization: emptyBlockRule(), member: emptyBlockRule() }, plan ?? "inicial");
}
export function hasBlockAccess(access, block) {
    return access === undefined || access.includes(block);
}
