import { metNorwayForecast } from '@/lib/met-norway';
import { env } from 'cloudflare:workers';
import { database } from '@/lib/database';
import { encryptText, decryptText, isDataEncryptionConfigured } from '@/lib/crypto';
import { RequestError, requireTenant, tenantError } from '@/lib/tenant';
import { normalizeOperationForecast } from '@/lib/operation-weather-model';
import { normalizeOpenMeteo } from '@/lib/open-meteo';
const headers = { 'Cache-Control': 'private, no-store' };
const cache = new Map();
async function settings(organizationId) {
    await database().prepare('CREATE TABLE IF NOT EXISTS operation_weather_settings (organization_id TEXT PRIMARY KEY, token TEXT NOT NULL DEFAULT \'\', latitude REAL, longitude REAL, label TEXT NOT NULL DEFAULT \'\', updated_at TEXT NOT NULL)').run();
    await database().prepare("CREATE TABLE IF NOT EXISTS operation_weather_provider (organization_id TEXT PRIMARY KEY, provider TEXT NOT NULL, mode TEXT NOT NULL, meteo_token TEXT NOT NULL DEFAULT '')").run();
    const provider = await database().prepare('SELECT provider,mode,meteo_token FROM operation_weather_provider WHERE organization_id=?').bind(organizationId).first();
    const config = await database().prepare('SELECT token,latitude,longitude,label FROM operation_weather_settings WHERE organization_id=?').bind(organizationId).first() ?? { token: '', latitude: null, longitude: null, label: '' };
    const selected = meteoKey() ? 'open-meteo' : globalKey() ? 'openweather' : provider?.provider ?? (config.token ? 'openweather' : 'met-norway');
    const mode = meteoKey() || globalKey() ? 'commercial' : provider?.mode ?? 'commercial';
    const missing = selected === 'openweather' && !config.token && !globalKey() || selected === 'open-meteo' && mode === 'commercial' && !provider?.meteo_token && !meteoKey();
    return { ...config, provider: missing ? 'met-norway' : selected, mode, meteo_token: provider?.meteo_token ?? '' };
}
function globalKey() { const runtime = env; return String(runtime.OPENWEATHER_API_KEY ?? runtime.OPENWEATHERMAP_API_KEY ?? '').trim(); }
function meteoKey() { return String(env.OPEN_METEO_API_KEY ?? '').trim(); }
function publicSettings(value) { return { configured: value.provider === 'met-norway' ? true : value.provider === 'open-meteo' ? !!(value.mode === 'evaluation' || value.meteo_token || meteoKey()) : !!(value.token || globalKey()), provider: value.provider, mode: value.mode, hasMeteoKey: !!value.meteo_token, hasCompanyKey: !!value.token, location: value.latitude === null || value.longitude === null ? null : { latitude: value.latitude, longitude: value.longitude, address: value.label } }; }
function coordinates(lat, lon) {
    if (lat === null || lon === null || lat === '' || lon === '')
        throw new RequestError('Selecione uma localização para a previsão.', 400);
    const latitude = Number(lat), longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
        throw new RequestError('Coordenadas inválidas.', 400);
    return { latitude, longitude };
}
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request);
        const config = await settings(organization.id);
        const url = new URL(request.url);
        if (url.searchParams.get('forecast') !== '1')
            return Response.json(publicSettings(config), { headers });
        if (config.provider === 'met-norway') {
            const point = coordinates(url.searchParams.get('lat') ?? config.latitude, url.searchParams.get('lon') ?? config.longitude);
            const label = config.latitude !== null && config.longitude !== null && Math.abs(config.latitude - point.latitude) < .0001 && Math.abs(config.longitude - point.longitude) < .0001 ? config.label || 'Local da empresa' : 'Ponto selecionado';
            const forecast = await metNorwayForecast(point.latitude, point.longitude, label);
            return Response.json({ ...publicSettings(config), forecast }, { headers });
        }
        const isMeteo = config.provider === 'open-meteo';
        const key = isMeteo ? (meteoKey() || (config.meteo_token ? await decryptText(config.meteo_token) : '')) : (globalKey() || (config.token ? await decryptText(config.token) : ''));
        if (!publicSettings(config).configured)
            return Response.json({ ...publicSettings(config), forecast: null }, { headers });
        const point = coordinates(url.searchParams.get('lat') ?? config.latitude, url.searchParams.get('lon') ?? config.longitude);
        const keyHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))).map(value => value.toString(16).padStart(2, '0')).join('');
        const cacheKey = `${organization.id}:${config.provider}:${config.mode}:${keyHash}:${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
        const stored = cache.get(cacheKey);
        if (stored && stored.expires > Date.now())
            return Response.json({ ...publicSettings(config), forecast: stored.forecast }, { headers });
        const endpoint = new URL(isMeteo ? (key ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast') : 'https://api.openweathermap.org/data/2.5/forecast');
        const providerName = isMeteo ? 'Open-Meteo' : 'OpenWeather';
        if (isMeteo) {
            endpoint.searchParams.set('latitude', String(point.latitude));
            endpoint.searchParams.set('longitude', String(point.longitude));
            endpoint.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m');
            endpoint.searchParams.set('timezone', 'auto');
            endpoint.searchParams.set('timeformat', 'unixtime');
            endpoint.searchParams.set('forecast_days', '5');
            endpoint.searchParams.set('wind_speed_unit', 'kmh');
            if (key)
                endpoint.searchParams.set('apikey', key);
        }
        else {
            endpoint.searchParams.set('lat', String(point.latitude));
            endpoint.searchParams.set('lon', String(point.longitude));
            endpoint.searchParams.set('appid', key);
            endpoint.searchParams.set('units', 'metric');
            endpoint.searchParams.set('lang', 'pt_br');
        }
        let response;
        try {
            response = await fetch(endpoint, { signal: AbortSignal.timeout(12000), redirect: 'manual', headers: { Accept: 'application/json' } });
        }
        catch {
            throw new RequestError(`${providerName} indisponível no momento. Tente novamente.`, 503);
        }
        if (!response.ok)
            throw new RequestError(response.status === 401 ? `A chave ${providerName} não está ativa ou não foi aceita. Confira em Configurações.` : response.status === 429 ? `O limite da ${providerName} foi atingido. Aguarde para consultar novamente.` : `Não foi possível consultar a ${providerName}.`, response.status === 401 ? 422 : 503);
        let forecast;
        try {
            const raw = await response.json();
            forecast = isMeteo ? normalizeOpenMeteo(raw, config.latitude !== null && config.longitude !== null && Math.abs(config.latitude - point.latitude) < .0001 && Math.abs(config.longitude - point.longitude) < .0001 ? config.label || 'Local da empresa' : 'Ponto selecionado') : normalizeOperationForecast(raw);
        }
        catch {
            throw new RequestError(`${providerName} não retornou uma previsão válida.`, 502);
        }
        if (cache.size >= 64)
            cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { expires: Date.now() + 15 * 60 * 1000, forecast });
        return Response.json({ ...publicSettings(config), forecast }, { headers });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível consultar as condições do tempo.');
    }
}
export async function POST(request) {
    try {
        const { organization } = await requireTenant(request, ['owner', 'admin']);
        const text = await request.text();
        if (text.length > 4096)
            throw new RequestError('Configuração muito extensa.', 400);
        let input;
        try {
            input = JSON.parse(text);
        }
        catch {
            throw new RequestError('Configuração inválida.', 400);
        }
        if (!input || typeof input !== 'object')
            throw new RequestError('Configuração inválida.', 400);
        const current = await settings(organization.id);
        let token = current.token;
        if (input.clearKey === true)
            token = '';
        else if (input.apiKey !== undefined && input.apiKey !== '') {
            if (typeof input.apiKey !== 'string' || !/^[A-Za-z0-9]{16,128}$/.test(input.apiKey.trim()))
                throw new RequestError('Informe uma chave OpenWeather válida.', 400);
            if (!isDataEncryptionConfigured())
                throw new RequestError('A criptografia do servidor precisa estar configurada antes de salvar a chave.', 503);
            token = await encryptText(input.apiKey.trim());
        }
        const provider = input.provider ?? (input.apiKey ? 'openweather' : current.provider), mode = input.mode ?? current.mode;
        if (!['openweather', 'open-meteo', 'met-norway'].includes(provider) || !['commercial', 'evaluation'].includes(mode))
            throw new RequestError('Selecione um provedor e modo válidos.', 400);
        let meteo_token = current.meteo_token;
        if (input.clearMeteoKey === true)
            meteo_token = '';
        else if (input.meteoApiKey !== undefined && input.meteoApiKey !== '') {
            if (typeof input.meteoApiKey !== 'string' || !/^[A-Za-z0-9_-]{8,256}$/.test(input.meteoApiKey.trim()))
                throw new RequestError('Informe uma chave Open-Meteo válida.', 400);
            if (!isDataEncryptionConfigured())
                throw new RequestError('Configure a criptografia do servidor antes de salvar a chave.', 503);
            meteo_token = await encryptText(input.meteoApiKey.trim());
        }
        let { latitude, longitude, label } = current;
        if (input.location) {
            const point = coordinates(input.location.latitude, input.location.longitude);
            latitude = point.latitude;
            longitude = point.longitude;
            label = typeof input.location.address === 'string' ? input.location.address.slice(0, 300) : 'Local da empresa';
        }
        await database().prepare('INSERT INTO operation_weather_settings (organization_id,token,latitude,longitude,label,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET token=excluded.token,latitude=excluded.latitude,longitude=excluded.longitude,label=excluded.label,updated_at=excluded.updated_at').bind(organization.id, token, latitude, longitude, label, new Date().toISOString()).run();
        await database().prepare('INSERT INTO operation_weather_provider (organization_id,provider,mode,meteo_token) VALUES (?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET provider=excluded.provider,mode=excluded.mode,meteo_token=excluded.meteo_token').bind(organization.id, provider, mode, meteo_token).run();
        for (const key of cache.keys())
            if (key.startsWith(organization.id + ':'))
                cache.delete(key);
        return Response.json(publicSettings({ token, latitude, longitude, label, provider, mode, meteo_token }), { headers });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível salvar a integração de clima.');
    }
}
