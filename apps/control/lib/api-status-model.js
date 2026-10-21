import { apiCatalog, apiStatusLabels } from './api-catalog';
export function observation(status, detail, checkedAt = null) {
    if (!Object.hasOwn(apiStatusLabels, status)) throw new Error('Status inválido.');
    return { status, detail, checkedAt };
}
// Only allowlisted public fields cross the companion boundary.
export function normalizeApiObservations(scope, input) {
    return Object.fromEntries(apiCatalog.filter(item => item.scopes.includes(scope)).map(item => {
        const value = input?.[item.id];
        const valid = value && Object.hasOwn(apiStatusLabels, value.status) && typeof value.detail === 'string' && value.detail.length <= 400
            && (value.checkedAt === null || typeof value.checkedAt === 'string' && Number.isFinite(Date.parse(value.checkedAt)));
        return [item.id, valid ? observation(value.status, value.detail, value.checkedAt) : observation('unknown', 'O serviço ainda não informou este status.')];
    }));
}
export function apiInventoryRows(snapshots) {
    return apiCatalog.map(item => {
        const instances = item.scopes.map(scope => ({ scope, ...(snapshots[scope]?.[item.id] ?? observation('unknown', 'Não foi possível conferir este serviço.')) }));
        const states = [...new Set(instances.map(instance => instance.status))];
        return { ...item, status: states.length === 1 ? states[0] : 'mixed', instances };
    });
}
