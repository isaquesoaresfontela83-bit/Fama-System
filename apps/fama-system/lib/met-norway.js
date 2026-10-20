import { readLimitedBody } from './request-body';
import { RequestError } from './tenant';
import { assertRateLimit } from './security';
export function normalizeMetNorway(raw, latitude, longitude, label = 'Ponto selecionado', now = new Date()) {
    if (!Array.isArray(raw?.properties?.timeseries))
        throw new Error('Previsão inválida.');
    const slots = raw.properties.timeseries.filter((r) => Number.isFinite(Date.parse(r?.time)) && Date.parse(r.time) >= now.getTime() - 3600000).slice(0, 160).flatMap((r) => {
        const instant = r.data?.instant?.details;
        if (typeof instant?.air_temperature !== 'number' || !Number.isFinite(instant.air_temperature) || typeof instant.wind_speed !== 'number' || !Number.isFinite(instant.wind_speed))
            return [];
        const period = r.data.next_1_hours ?? r.data.next_6_hours ?? r.data.next_12_hours;
        const hours = r.data.next_1_hours ? 1 : r.data.next_6_hours ? 6 : 12, amount = period?.details?.precipitation_amount, code = String(period?.summary?.symbol_code ?? '');
        const mm = typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : undefined;
        return [{ at: new Date(r.time).toISOString(), date: new Date(r.time).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), temperature: instant.air_temperature, windKmh: Math.round(Math.max(0, instant.wind_speed) * 3.6), rainChance: 0, rainChanceKnown: false, ...(mm !== undefined ? { precipitationMm: mm } : {}), periodHours: hours, storm: code.includes('thunder'), description: code.includes('thunder') ? 'Trovoadas' : code.includes('rain') ? 'Chuva prevista' : code.includes('cloud') ? 'Nebulosidade' : code.includes('clearsky') ? 'Céu limpo' : 'Previsão meteorológica' }];
    });
    if (!slots.length)
        throw new Error('Sem previsão recente.');
    const days = [...new Set(slots.map(s => s.date))].slice(0, 9).map(date => { const rows = slots.filter(s => s.date === date); const amounts = rows.flatMap(s => typeof s.precipitationMm === 'number' ? [s.precipitationMm] : []); return { date, min: Math.min(...rows.map(s => s.temperature)), max: Math.max(...rows.map(s => s.temperature)), rainChance: 0, rainChanceKnown: false, ...(amounts.length ? { precipitationMm: Math.max(...amounts) } : {}), windKmh: Math.max(...rows.map(s => s.windKmh)), storm: rows.some(s => s.storm) }; });
    return { city: label, latitude, longitude, updatedAt: typeof raw.properties.meta?.updated_at === 'string' ? raw.properties.meta.updated_at : now.toISOString(), slots, days };
}
const memory = new Map(), pending = new Map();
let cooldown = 0;
export async function metNorwayForecast(latitude, longitude, label = 'Ponto selecionado') {
    const lat = Number(latitude.toFixed(4)), lon = Number(longitude.toFixed(4));
    const id = lat + ',' + lon;
    const cached = memory.get(id);
    if (cached && cached.expires > Date.now())
        return normalizeMetNorway(cached.raw, lat, lon, label);
    let operation = pending.get(id);
    if (!operation) {
        operation = (async () => {
            const storage = typeof caches === 'undefined' ? undefined : caches.default;
            const cacheKey = new Request('https://famasystem.online/__metno/v1/' + encodeURIComponent(id));
            let previous = cached;
            try {
                const stored = await storage?.match(cacheKey);
                if (stored)
                    previous = await stored.json();
            }
            catch { }
            if (previous && previous.expires > Date.now()) {
                memory.set(id, previous);
                return previous;
            }
            if (cooldown > Date.now())
                throw new RequestError('A previsão está ocupada. Tente novamente mais tarde.', 429);
            await assertRateLimit(new Request('https://famasystem.online/'), 'metno_upstream', 'fama-system', 8, 1);
            const endpoint = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
            endpoint.searchParams.set('lat', String(lat));
            endpoint.searchParams.set('lon', String(lon));
            const headers = { 'User-Agent': 'FamaSystem/1.0 (+https://famasystem.online)', Accept: 'application/json' };
            if (previous?.modified)
                headers['If-Modified-Since'] = previous.modified;
            let response;
            let target = endpoint;
            try {
                for (let attempt = 0;; attempt++) {
                    response = await fetch(target, { headers, redirect: 'manual', signal: AbortSignal.timeout(12000) });
                    if (![301, 302, 303, 307, 308].includes(response.status))
                        break;
                    const location = response.headers.get('Location');
                    if (!location || attempt >= 2)
                        throw new Error();
                    const next = new URL(location, target);
                    if (next.origin !== endpoint.origin || !next.pathname.startsWith('/weatherapi/locationforecast/'))
                        throw new Error();
                    await response.body?.cancel();
                    target = next;
                }
            }
            catch {
                throw new RequestError('MET Norway indisponível no momento.', 503);
            }
            if (response.status === 429) {
                cooldown = Date.now() + 60000;
                throw new RequestError('O serviço de previsão pediu uma pausa. Tente novamente mais tarde.', 429);
            }
            if (response.status !== 304 && !response.ok)
                throw new RequestError('Não foi possível consultar a previsão MET Norway.', 503);
            if (response.status === 203)
                console.warn('MET Norway forecast version needs review');
            const expiry = Date.parse(response.headers.get('Expires') || '');
            const expires = Number.isFinite(expiry) && expiry > Date.now() ? expiry : Date.now() + 3600000;
            const raw = response.status === 304 ? previous?.raw : JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 1000000)));
            normalizeMetNorway(raw, lat, lon, label);
            const entry = { raw, expires, modified: response.headers.get('Last-Modified') || previous?.modified || '' };
            if (memory.size >= 64)
                memory.delete(memory.keys().next().value);
            memory.set(id, entry);
            try {
                await storage?.put(cacheKey, Response.json(entry, { headers: { 'Cache-Control': 'public, max-age=604800' } }));
            }
            catch { }
            return entry;
        })();
        pending.set(id, operation);
    }
    try {
        const value = await operation;
        return normalizeMetNorway(value.raw, lat, lon, label);
    }
    finally {
        pending.delete(id);
    }
}
