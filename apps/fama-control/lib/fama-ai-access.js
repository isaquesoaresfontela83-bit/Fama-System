import { entityPermissions, hasFeaturePermission } from './permissions';
export function systemAssistantSources(role, permissions) {
    return ['overview', ...Object.values(entityPermissions).filter(permission => hasFeaturePermission(role, permissions, permission))];
}
/** Omit denied collections so the assistant cannot disclose them or report false zero counts. */
export function systemAssistantData(data, role, permissions) {
    return Object.fromEntries(Object.entries(data).filter(([entity]) => {
        const permission = entityPermissions[entity];
        return permission && hasFeaturePermission(role, permissions, permission);
    }));
}
