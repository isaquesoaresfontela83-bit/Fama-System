import { RequestError } from './request-error';
import { readLimitedBody } from './request-body';
export const placeCategories = { fuel: 'Postos', parking: 'Estacionamentos', pharmacy: 'Farmácias', supplies: 'Lojas de materiais' };
export function nearbyInput(value) {
    const { latitude, longitude, category, radius } = value;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 85 || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || typeof category !== 'string' || !Object.hasOwn(placeCategories, category) || ![1000, 3000, 5000].includes(Number(radius)))
        throw new RequestError('Selecione um ponto, categoria e raio de até 5 km.', 400);
    return { latitude: Number(latitude.toFixed(3)), longitude: Number(longitude.toFixed(3)), category: category, radius: Number(radius) };
}
export function distanceMeters(a, b) {
    const rad = Math.PI / 180, dlat = (b.latitude - a.latitude) * rad, dlon = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2;
    return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
export function normalizePlaces(raw, point) {
    if (!Array.isArray(raw?.elements) || raw.remark)
        throw new RequestError('A busca de pontos de apoio está ocupada. Tente novamente mais tarde.', 503);
    const result = [], seen = new Set();
    for (const e of raw.elements) {
        const latitude = e.lat ?? e.center?.lat, longitude = e.lon ?? e.center?.lon;
        if (!['node', 'way', 'relation'].includes(e.type) || !Number.isSafeInteger(e.id) || !Number.isFinite(latitude) || Math.abs(latitude) > 85 || !Number.isFinite(longitude) || Math.abs(longitude) > 180)
            continue;
        const id = e.type + '/' + e.id;
        if (seen.has(id))
            continue;
        seen.add(id);
        const tags = e.tags ?? {};
        const text = (k) => typeof tags[k] === 'string' ? tags[k].slice(0, 200) : '';
        const item = { id, name: text('name') || text('brand') || placeCategories[point.category], latitude, longitude, distanceMeters: distanceMeters(point, { latitude, longitude }), address: [text('addr:street'), text('addr:housenumber'), text('addr:suburb')].filter(Boolean).join(', '), hours: text('opening_hours'), url: 'https://www.openstreetmap.org/' + id };
        if (item.distanceMeters <= point.radius + 100)
            result.push(item);
    }
    return result.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 20);
}
const pending = new Map();
export async function nearbyPlaces(point) {
    const key = JSON.stringify(point), existing = pending.get(key);
    if (existing)
        return existing;
    const task = (async () => {
        const cache = typeof caches === 'undefined' ? undefined : caches.default;
        const cacheKey = new Request('https://famasystem.online/__nearby/v1/' + encodeURIComponent(key));
        const saved = await cache?.match(cacheKey);
        if (saved)
            return await saved.json();
        const filter = point.category === 'supplies' ? '[shop~"^(hardware|doityourself|swimming_pool)$"]' : `[amenity=${point.category}]`;
        const query = `[out:json][timeout:10];nwr${filter}(around:${point.radius},${point.latitude},${point.longitude});out center 100;`;
        let response;
        try {
            response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(14000) });
        }
        catch {
            throw new RequestError('O OpenStreetMap não respondeu. Tente mais tarde.', 503);
        }
        if (!response.ok)
            throw new RequestError('Busca temporariamente indisponível. Aguarde antes de repetir.', response.status === 429 ? 429 : 503);
        const bytes = await readLimitedBody(response, 512000);
        let raw;
        try {
            raw = JSON.parse(new TextDecoder().decode(bytes));
        }
        catch {
            throw new RequestError('Resposta inválida do mapa. Tente mais tarde.', 503);
        }
        const places = normalizePlaces(raw, point);
        try {
            await cache?.put(cacheKey, Response.json(places, { headers: { 'Cache-Control': 'public,max-age=3600' } }));
        }
        catch { }
        return places;
    })();
    pending.set(key, task);
    try {
        return await task;
    }
    finally {
        pending.delete(key);
    }
}
