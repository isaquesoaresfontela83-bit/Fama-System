import { openRouteConfigured, openRouteDirections, OPENROUTE_ENDPOINT } from "./openroute-service";
import { env } from "cloudflare:workers";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { database } from "./database";
import { normalizeCompanySettings } from "./company-settings";
import { normalizeLookupValue } from "./registration-lookup";
import { hasFeaturePermission } from "./permissions";
import { RequestError, requireTenant } from "./tenant";
import { assertPlanFeature } from "./plan-feature-access";
import { readJsonObject, readLimitedBody } from "./request-body";
import { assertRateLimit } from "./security";
import { calculateFreight } from "./freight";
import { readFreightLocations } from "./freight-location";
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
async function authorize(request) {
    const tenant = await requireTenant(request);
    await assertPlanFeature(tenant.organization.plan, "freight");
    if (!hasFeaturePermission(tenant.organization.role, tenant.organization.permissions, "customers", tenant.organization.moduleAccess))
        throw new RequestError("Seu perfil não tem acesso às consultas.", 403);
    return tenant;
}
async function settingsFor(organizationId) {
    const row = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?").bind(organizationId).first();
    const settings = normalizeCompanySettings(row?.settingsJson ? JSON.parse(row.settingsJson) : {});
    return { originCep: settings.freightOriginCep, rateCentsPerKm: settings.freightRateCentsPerKm };
}
function routingService() {
    if (openRouteConfigured())
        return { kind: "openrouteservice", base: OPENROUTE_ENDPOINT };
    const configured = env.FAMA_ROUTING_BASE_URL;
    // Small interactive requests use BRouter's public car router. A company's
    // dedicated OSRM service, when configured, continues to take precedence.
    if (!configured)
        return { kind: "brouter", base: "https://brouter.de/brouter" };
    try {
        const url = new URL(configured);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))
            return null;
        // Public OSRM demos prohibit commercial use; require the company's own service.
        if (["router.project-osrm.org", "routing.openstreetmap.de"].includes(url.hostname))
            return null;
        return { kind: "osrm", base: url.toString().replace(/\/$/, "") };
    }
    catch {
        return null;
    }
}
function brouterMeters(data) {
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
        return null;
    // Waypoints are GeoJSON features too; only a complete road track is a route.
    const feature = data.features.find((item) => item?.geometry?.type === "LineString" && item?.properties?.["track-length"] !== undefined);
    const length = feature?.properties?.["track-length"], coordinates = feature?.geometry?.coordinates;
    if (!(typeof length === "number" || typeof length === "string" && /^\d+(\.\d+)?$/.test(length)) || !Array.isArray(coordinates) || coordinates.length < 2
        || !coordinates.every((point) => Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number" && validPoint(point[1], point[0])))
        return null;
    const meters = Number(length);
    return Number.isFinite(meters) && meters > 0 && meters <= 10_000_000 ? meters : null;
}
function cacheableProviderData(data, endpoint) {
    if (endpoint.hostname === "brouter.de")
        return brouterMeters(data) !== null;
    if (endpoint.hostname === "cep.awesomeapi.com.br" || endpoint.hostname === "brasilapi.com.br") {
        return data.cep === endpoint.pathname.split("/").at(-1) && typeof data.city === "string" && typeof data.state === "string" && /^[A-Z]{2}$/.test(data.state)
            && (endpoint.hostname === "cep.awesomeapi.com.br" ? validPoint(data.lat, data.lng) : validPoint(data.location?.coordinates?.latitude, data.location?.coordinates?.longitude));
    }
    const distance = data.routes?.[0]?.distance;
    return data.code === "Ok" && typeof distance === "number" && Number.isFinite(distance) && distance >= 0 && distance <= 10_000_000;
}
const providerCooldowns = new Map();
async function providerJson(url, maxBytes = 64_000, cacheSeconds = 86400, beforeFetch, timeoutMs = 10_000) {
    const cache = typeof caches === "undefined" ? undefined : caches.default;
    const endpoint = new URL(url);
    // Retire earlier entries, which could contain an empty or incomplete track.
    const cacheKey = new Request("https://famasystem.online/__freight-provider/v2/" + encodeURIComponent(url));
    if (cache) {
        try {
            const stored = await cache.match(cacheKey);
            if (stored) {
                const data = await stored.json();
                if (data && typeof data === "object" && !Array.isArray(data) && cacheableProviderData(data, endpoint))
                    return data;
                await cache.delete(cacheKey);
            }
        }
        catch { /* An invalid cache entry never prevents a fresh provider query. */ }
    }
    const cooldownKey = new Request("https://famasystem.online/__freight-provider/cooldown/" + endpoint.hostname);
    let until = providerCooldowns.get(endpoint.hostname) ?? 0;
    if (cache) {
        try {
            const stored = await cache.match(cooldownKey);
            if (stored)
                until = Math.max(until, Number(await stored.text()) || 0);
        }
        catch { /* Optional cache. */ }
    }
    if (until > Date.now())
        throw new RequestError("A consulta de CEP está ocupada. Aguarde um pouco e tente novamente.", 429);
    if (beforeFetch)
        await beforeFetch();
    let response;
    const isXml = endpoint.hostname === "cep.awesomeapi.com.br" && endpoint.pathname.startsWith("/xml/");
    const headers = { Accept: isXml ? "application/xml, text/xml" : "application/json", "User-Agent": "FamaSystem/1.0 (+https://famasystem.online)", Referer: "https://famasystem.online/" };
    try {
        response = await fetch(url, { headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    }
    catch {
        throw new RequestError("O serviço de CEP ou de rotas não respondeu. Tente novamente.", 502);
    }
    if (!response.ok) {
        if (response.status === 429) {
            const retry = response.headers.get("Retry-After") ?? "";
            const seconds = Math.max(30, Math.min(300, /^\d+$/.test(retry) ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000 || 60));
            const expires = Date.now() + seconds * 1000;
            providerCooldowns.set(endpoint.hostname, expires);
            if (cache) {
                try {
                    await cache.put(cooldownKey, new Response(String(expires), { headers: { "Cache-Control": `public, max-age=${Math.ceil(seconds)}` } }));
                }
                catch { /* Optional cache. */ }
            }
        }
        console.warn("Freight CEP or route provider failed", { provider: endpoint.hostname, format: isXml ? "xml" : "json", status: response.status });
        void response.body?.cancel().catch(() => { });
        throw new RequestError(response.status === 404 ? "CEP ou rota não encontrado." : response.status === 429 ? "A consulta de CEP está ocupada. Aguarde um pouco e tente novamente." : "Serviço de consulta indisponível.", response.status === 404 ? 404 : response.status === 429 ? 429 : 502);
    }
    try {
        const source = new TextDecoder("utf-8", { fatal: true }).decode(await readLimitedBody(response, maxBytes, 10_000));
        if (isXml && (/<!DOCTYPE|<!ENTITY/i.test(source) || XMLValidator.validate(source) !== true))
            throw new Error("Invalid XML");
        const data = isXml ? new XMLParser({ ignoreAttributes: true, parseTagValue: false, processEntities: false }).parse(source)?.xml : JSON.parse(source);
        if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error();
        if (cache && cacheableProviderData(data, endpoint)) {
            try {
                await cache.put(cacheKey, Response.json(data, { headers: { "Cache-Control": `public, max-age=${cacheSeconds}` } }));
            }
            catch { /* Caching is optional. */ }
        }
        return data;
    }
    catch {
        throw new RequestError("O serviço retornou dados inválidos.", 502);
    }
}
async function addressFor(cep, needCoordinates, alternate = false) {
    // JSON and XML share a quota; throttling uses a different provider.
    let raw;
    let coordinateSource = alternate ? "awesomeapi-xml" : "awesomeapi-json";
    try {
        let data;
        if (alternate)
            data = await providerJson("https://cep.awesomeapi.com.br/xml/" + cep);
        else {
            try {
                data = await providerJson("https://cep.awesomeapi.com.br/json/" + cep);
                if (data.cep !== cep || needCoordinates && !validPoint(data.lat, data.lng))
                    throw new Error("Invalid CEP coordinates");
            }
            catch (error) {
                if (error instanceof RequestError && error.status === 429)
                    throw error;
                coordinateSource = "awesomeapi-xml";
                data = await providerJson("https://cep.awesomeapi.com.br/xml/" + cep);
            }
        }
        raw = { cep: data.cep, street: data.address, neighborhood: data.district, city: data.city, state: data.state, location: { coordinates: { latitude: data.lat, longitude: data.lng } } };
        if (needCoordinates && !validPoint(data.lat, data.lng))
            throw new Error("No coordinates");
    }
    catch {
        coordinateSource = "brasilapi";
        raw = await providerJson("https://brasilapi.com.br/api/cep/v2/" + cep);
    }
    if (raw.cep !== cep || typeof raw.city !== "string" || typeof raw.state !== "string" || !/^[A-Z]{2}$/.test(raw.state))
        throw new RequestError("O serviço retornou um endereço inválido.", 502);
    const latitude = Number(raw.location?.coordinates?.latitude), longitude = Number(raw.location?.coordinates?.longitude);
    if (needCoordinates && !validPoint(raw.location?.coordinates?.latitude, raw.location?.coordinates?.longitude))
        throw new RequestError("Não foi possível localizar este CEP. Confira o CEP da rua e tente novamente.", 422);
    return { latitude, longitude, coordinateSource, address: [raw.street, raw.neighborhood, raw.city + "/" + raw.state].filter(value => typeof value === "string" && value).join(" · ").slice(0, 500) };
}
function validPoint(latitude, longitude) {
    return [latitude, longitude].every(value => value !== "" && value != null && (typeof value === "string" || typeof value === "number"))
        && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
        && Number(latitude) >= -34 && Number(latitude) <= 6 && Number(longitude) >= -74 && Number(longitude) <= -28;
}
async function freightAddresses(originCep, destinationCep, needCoordinates, locations) {
    if (locations !== undefined) {
        try {
            // Browser locations are input to this read-only estimate. They never
            // provide the billable distance or tariff, or create a financial record.
            const points = readFreightLocations(locations, originCep, destinationCep);
            return { origin: { ...points.origin, coordinateSource: "awesomeapi-browser" }, destination: { ...points.destination, coordinateSource: "awesomeapi-browser" } };
        }
        catch {
            throw new RequestError("Não foi possível validar a localização dos CEPs. Tente novamente.", 400);
        }
    }
    const originLookup = addressFor(originCep, needCoordinates);
    let [origin, destination] = await Promise.all([originLookup, originCep === destinationCep ? originLookup : addressFor(destinationCep, needCoordinates)]);
    const samePoint = () => Math.abs(origin.latitude - destination.latitude) < 0.000001 && Math.abs(origin.longitude - destination.longitude) < 0.000001;
    if (needCoordinates && originCep !== destinationCep && samePoint()) {
        const corrected = await Promise.allSettled([addressFor(originCep, true, true), addressFor(destinationCep, true, true)]);
        if (corrected[0].status === "fulfilled")
            origin = corrected[0].value;
        if (corrected[1].status === "fulfilled")
            destination = corrected[1].value;
        if (samePoint())
            throw new RequestError("Não foi possível localizar esses CEPs com precisão para calcular a rota.", 422);
    }
    return { origin, destination };
}
async function drivingRoute(service, origin, destination) {
    if (service.kind === "openrouteservice")
        return openRouteDirections(origin, destination);
    let meters;
    if (service.kind === "brouter") {
        const url = new URL(service.base);
        url.searchParams.set("lonlats", `${origin.longitude},${origin.latitude}|${destination.longitude},${destination.latitude}`);
        url.searchParams.set("profile", "car-fast");
        url.searchParams.set("alternativeidx", "0");
        url.searchParams.set("format", "geojson");
        const route = await providerJson(url.toString(), 2_000_000, 86400, async () => {
            // One shared bucket across every user and Worker; cached routes consume
            // no public-provider quota. No customer IP is sent to the route service.
            const shared = new Request("https://famasystem.online");
            await assertRateLimit(shared, "freight_brouter_shared", "fama-system", 1, 3);
            await assertRateLimit(shared, "freight_brouter_daily", "fama-system", 1000, 86400);
        }, 20_000);
        meters = brouterMeters(route);
        if (meters === null) {
            // Diagnostics deliberately omit CEPs, coordinates and company identifiers.
            const feature = Array.isArray(route.features) ? route.features[0] : null;
            console.warn("Freight road route rejected", { provider: "brouter", responseType: typeof route.type === "string" ? route.type.slice(0, 40) : null, featureCount: Array.isArray(route.features) ? route.features.length : 0, geometryType: feature?.geometry?.type, coordinateCount: feature?.geometry?.coordinates?.length, trackLength: feature?.properties?.["track-length"], sameEndpoints: origin.latitude === destination.latitude && origin.longitude === destination.longitude });
            throw new RequestError("O serviço não retornou uma rota completa. Tente calcular novamente.", 422);
        }
    }
    else {
        const route = await providerJson(`${service.base}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false&steps=false&alternatives=false&radiuses=3000;3000`);
        if (route.code !== "Ok")
            throw new RequestError("Não foi encontrada uma rota válida entre os CEPs.", 422);
        meters = route.routes?.[0]?.distance;
    }
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0 || meters > 10_000_000)
        throw new RequestError("O serviço retornou uma distância inválida.", 422);
    return { distanceKm: meters / 1000 };
}
function failure(error) {
    return error instanceof RequestError ? json({ error: error.message }, error.status) : json({ error: "Não foi possível calcular o frete." }, 503);
}
export async function freightGET(request) {
    try {
        const { organization } = await authorize(request);
        return json({ ...await settingsFor(organization.id), routingConfigured: Boolean(routingService()) });
    }
    catch (error) {
        return failure(error);
    }
}
export async function freightPATCH(request) {
    try {
        const { user, organization } = await authorize(request);
        if (!["owner", "admin"].includes(organization.role))
            throw new RequestError("Somente o administrador pode alterar a origem e a tarifa.", 403);
        const body = await readJsonObject(request, 2000);
        if (Object.keys(body).some(key => !["originCep", "rateCentsPerKm"].includes(key)))
            throw new RequestError("Configuração de frete inválida.", 400);
        let originCep;
        try {
            originCep = normalizeLookupValue("cep", body.originCep);
        }
        catch {
            throw new RequestError("Informe um CEP de origem com 8 dígitos.", 400);
        }
        const rate = body.rateCentsPerKm;
        if (typeof rate !== "number" || !Number.isSafeInteger(rate) || rate <= 0 || rate > 1_000_000)
            throw new RequestError("Informe um valor por km entre R$ 0,01 e R$ 10.000,00.", 400);
        await assertRateLimit(request, "freight_settings", user.id, 10, 60);
        const confirmed = await authorize(request);
        if (!["owner", "admin"].includes(confirmed.organization.role))
            throw new RequestError("Somente o administrador pode alterar a origem e a tarifa.", 403);
        // Update only freight fields, preserving company data and encrypted credentials.
        await database().prepare(`INSERT INTO organization_settings (organization_id, settings_json, updated_at)
      VALUES (?, json_object('freightOriginCep', ?, 'freightRateCentsPerKm', ?), ?)
      ON CONFLICT(organization_id) DO UPDATE SET
      settings_json = json_set(organization_settings.settings_json, '$.freightOriginCep', ?, '$.freightRateCentsPerKm', ?),
      updated_at = excluded.updated_at`)
            .bind(organization.id, originCep, rate, new Date().toISOString(), originCep, rate).run();
        return json({ ...await settingsFor(organization.id), routingConfigured: Boolean(routingService()) });
    }
    catch (error) {
        return failure(error);
    }
}
export async function freightPOST(request) {
    try {
        const { user, organization } = await authorize(request);
        const body = await readJsonObject(request, 4000);
        if (Object.keys(body).some(key => !["originCep", "destinationCep", "manualDistanceKm", "locations"].includes(key)))
            throw new RequestError("Cálculo de frete inválido.", 400);
        const settings = await settingsFor(organization.id);
        let originCep, destinationCep;
        try {
            originCep = normalizeLookupValue("cep", body.originCep === undefined ? settings.originCep : body.originCep);
            destinationCep = normalizeLookupValue("cep", body.destinationCep);
        }
        catch {
            throw new RequestError("Informe CEPs de origem e destino válidos.", 400);
        }
        const manual = body.manualDistanceKm !== undefined;
        if (manual && body.locations !== undefined)
            throw new RequestError("Cálculo de frete inválido.", 400);
        if (manual && (typeof body.manualDistanceKm !== "number" || !Number.isFinite(body.manualDistanceKm) || body.manualDistanceKm < 0 || body.manualDistanceKm > 10_000))
            throw new RequestError("Informe uma distância entre 0 e 10.000 km.", 400);
        if (settings.rateCentsPerKm <= 0)
            throw new RequestError("Defina o valor por km nas configurações da empresa.", 422);
        const service = routingService();
        if (!manual && !service)
            throw new RequestError("O serviço de rotas está indisponível. Tente novamente mais tarde.", 503);
        await assertRateLimit(request, "freight_estimate", user.id, 10, 60);
        const { origin, destination } = await freightAddresses(originCep, destinationCep, !manual, body.locations);
        const road = manual ? { distanceKm: body.manualDistanceKm } : originCep === destinationCep ? { distanceKm: 0 } : await drivingRoute(service, origin, destination);
        const { distanceKm } = road;
        const estimate = { originCep, destinationCep, originAddress: origin.address, destinationAddress: destination.address, ...road, ...calculateFreight(distanceKm, settings.rateCentsPerKm), rateCentsPerKm: settings.rateCentsPerKm, source: manual ? "manual" : service.kind, estimatedAt: new Date().toISOString() };
        await authorize(request);
        return json(estimate);
    }
    catch (error) {
        return failure(error);
    }
}
