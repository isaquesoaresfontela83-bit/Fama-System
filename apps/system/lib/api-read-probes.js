import { readLimitedBody } from './request-body';
import { observation } from './api-status-model';
export async function readApiJson(url, init = {}, send = fetch) {
    const response = await send(url, { ...init, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) { await response.body?.cancel(); throw new Error('API unavailable'); }
    return JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 128000, 8000)));
}
export async function publicApiProbe(id) {
    let valid = false;
    if (id === 'brasilapi') {
        const data = await readApiJson('https://brasilapi.com.br/api/banks/v1/1');
        valid = data.code === 1 && typeof data.name === 'string';
    } else if (id === 'met-norway') {
        // Fixed public coordinates; no customer location is transmitted by a health check.
        const data = await readApiJson('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-15.79&lon=-47.88', { headers: { 'User-Agent': 'FamaSystem/1.0 (+https://famasystem.online)', Accept: 'application/json' } });
        valid = Array.isArray(data.properties?.timeseries) && data.properties.timeseries.length > 0;
    } else throw new Error('Unsupported public check');
    if (!valid) throw new Error('Invalid provider response');
    return observation('verified', 'Consulta de diagnóstico confirmada pelo provedor. As operações continuam sujeitas aos limites do serviço.', new Date().toISOString());
}
