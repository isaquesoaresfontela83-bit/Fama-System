import { ClientRequestError, requestJson } from './client-request';
export const controlResources = ['organizations', 'security', 'members', 'audit', 'privacy', 'plans', 'support'];
const fields = { organizations: 'organizations', members: 'members', audit: 'audit', privacy: 'requests', plans: 'plans', support: 'tickets' };
/** A failed module cannot discard successfully loaded modules. */
export async function readControlWorkspace(signal) {
    const results = await Promise.allSettled(controlResources.map(async (key) => {
        const data = await requestJson(`/api/admin/${key}`, { cache: 'no-store', signal }, 20_000);
        if (!data || typeof data !== 'object' || Array.isArray(data))
            throw new ClientRequestError('Resposta inválida do módulo.', 'invalid');
        if (key === 'security') {
            if (!['owner', 'backend', 'encryption', 'production', 'headers'].every(field => data[field] && typeof data[field] === 'object'))
                throw new ClientRequestError('Não foi possível conferir a segurança.', 'invalid');
        }
        else if (!Array.isArray(data[fields[key]]))
            throw new ClientRequestError('Não foi possível conferir os registros do módulo.', 'invalid');
        return data;
    }));
    return Object.fromEntries(controlResources.map((key, index) => [key, results[index]]));
}
