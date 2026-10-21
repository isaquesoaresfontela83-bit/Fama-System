import { env } from 'cloudflare:workers';
import { assertRateLimit, sha256 } from './security';
import { RequestError } from './tenant';
import { readLimitedBody } from './request-body';
export const OPENROUTE_ENDPOINT = 'https://api.heigit.org/openrouteservice/v2/directions/driving-car/json';
const pending = new Map();
export function openRouteConfigured() { const key = String(env.FAMA_OPENROUTESERVICE_API_KEY || ''); return key.length >= 10 && key.length <= 4096 && !/[\r\n]/.test(key); }
export async function openRouteDirections(origin, destination) {
    if (!openRouteConfigured())
        throw new RequestError('O serviço de rotas ainda não está configurado.', 503);
    if (![origin, destination].every(p => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180))
        throw new RequestError('Coordenadas de rota inválidas.', 400);
    const key = String(env.FAMA_OPENROUTESERVICE_API_KEY);
    const body = JSON.stringify({ coordinates: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]], instructions: false, geometry: false });
    const hash = await sha256(key + '|' + body);
    const existing = pending.get(hash);
    if (existing)
        return existing;
    const operation = (async () => {
        const cache = typeof caches === 'undefined' ? undefined : caches.default;
        const cacheKey = new Request('https://famasystem.online/__ors-route/v1/' + hash);
        const valid = (v) => v && Number.isFinite(v.distanceKm) && v.distanceKm > 0 && v.distanceKm <= 10000 && Number.isFinite(v.durationMinutes) && v.durationMinutes >= 0 && v.durationMinutes <= 10080;
        try {
            const stored = await cache?.match(cacheKey);
            if (stored) {
                const value = await stored.json();
                if (valid(value))
                    return value;
            }
        }
        catch { }
        const shared = new Request('https://famasystem.online/');
        await assertRateLimit(shared, 'ors_routes_minute', 'fama-system', 35, 60);
        await assertRateLimit(shared, 'ors_routes_daily', 'fama-system', 1800, 86400);
        let response;
        try {
            response = await fetch(OPENROUTE_ENDPOINT, { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json' }, body, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        }
        catch {
            throw new RequestError('O serviço de rotas não respondeu. Tente novamente.', 502);
        }
        if (response.status === 429)
            throw new RequestError('O limite gratuito de rotas foi atingido. Tente novamente mais tarde.', 429);
        if (response.status === 401 || response.status === 403)
            throw new RequestError('A conexão central de rotas precisa ser revisada pela administração do Fama.', 503);
        if (!response.ok)
            throw new RequestError('Não foi possível obter uma rota de carro entre os pontos informados.', 502);
        let raw;
        try {
            raw = JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 64000)));
        }
        catch {
            throw new RequestError('O serviço de rotas retornou dados inválidos.', 502);
        }
        const summary = raw.routes?.[0]?.summary;
        if (typeof summary?.distance !== 'number' || typeof summary?.duration !== 'number')
            throw new RequestError('O serviço não retornou uma rota completa.', 422);
        const result = { distanceKm: summary.distance / 1000, durationMinutes: Math.round(summary.duration / 60) };
        if (!valid(result))
            throw new RequestError('O serviço retornou uma rota inválida.', 422);
        try {
            await cache?.put(cacheKey, Response.json(result, { headers: { 'Cache-Control': 'public, max-age=86400' } }));
        }
        catch { }
        return result;
    })();
    pending.set(hash, operation);
    try {
        return await operation;
    }
    finally {
        pending.delete(hash);
    }
}
