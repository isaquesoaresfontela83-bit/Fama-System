import { RequestError } from './request-error';
import { readLimitedBody } from './request-body';
import { brasilEndpoint } from './brasil-data';
const cache = new Map(), pending = new Map();
export async function queryBrasilData(id, parameters) {
    let endpoint;
    try {
        endpoint = brasilEndpoint(id, parameters);
    }
    catch (error) {
        throw new RequestError(error.message, 400);
    }
    const key = endpoint.url.href, stored = cache.get(key);
    if (stored && stored.until > Date.now())
        return stored.data;
    const existing = pending.get(key);
    if (existing)
        return existing;
    if (pending.size >= 20)
        throw new RequestError('Muitas consultas em andamento. Tente novamente.', 429);
    const request = (async () => {
        let response;
        try {
            response = await fetch(endpoint.url, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
        }
        catch {
            throw new RequestError('A BrasilAPI não respondeu. Tente novamente.', 503);
        }
        if (!response.ok)
            throw new RequestError(response.status === 404 ? 'Não foram encontrados dados para esta consulta.' : response.status === 429 ? 'O serviço está ocupado. Aguarde para consultar novamente.' : 'Esta consulta está indisponível no momento.', response.status === 404 ? 404 : 503);
        let data;
        try {
            data = JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 2 * 1024 * 1024, 12000)));
        }
        catch {
            throw new RequestError('A consulta retornou dados inválidos ou extensos demais. Refine os filtros.', 502);
        }
        const result = { data: Array.isArray(data) ? data.slice(0, 500) : data, truncated: Array.isArray(data) && data.length > 500, source: 'BrasilAPI', consultedAt: new Date().toISOString() };
        if (cache.size >= 128)
            cache.delete(cache.keys().next().value);
        cache.set(key, { until: Date.now() + 15 * 60 * 1000, data: result });
        return result;
    })();
    pending.set(key, request);
    try {
        return await request;
    }
    finally {
        pending.delete(key);
    }
}
