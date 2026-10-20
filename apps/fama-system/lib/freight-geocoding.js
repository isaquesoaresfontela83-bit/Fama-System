import { ClientRequestError, requestJson } from './client-request';
import { readFreightLocations, validCepPoint } from './freight-location';
const cache = new Map();
let awesomeRetryAt = 0;
async function locateCep(cep, signal) {
    if (!/^\d{8}$/.test(cep))
        throw new Error('Informe um CEP válido.');
    if (signal.aborted)
        throw new Error('Solicitação cancelada.');
    const stored = cache.get(cep);
    if (stored && stored.expires > Date.now())
        return stored.point;
    // This public, CORS-enabled lookup runs on the user's browser. No system
    // session, company identifier or routing credential goes to the CEP service.
    const options = { signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } };
    let raw;
    try {
        if (awesomeRetryAt > Date.now())
            throw new Error('Serviço ocupado.');
        raw = await requestJson('https://cep.awesomeapi.com.br/json/' + cep, options, 10000);
        if (raw.cep !== cep || raw.lat === '' || raw.lng === '' || !validCepPoint(Number(raw.lat), Number(raw.lng)))
            throw new Error('Localização inválida.');
    }
    catch (error) {
        if (signal.aborted || error instanceof ClientRequestError && error.kind === 'aborted')
            throw error;
        if (error instanceof ClientRequestError && error.status === 429)
            awesomeRetryAt = Date.now() + 60000;
        const fallback = await requestJson('https://brasilapi.com.br/api/cep/v2/' + cep, options, 10000);
        raw = { ...fallback, address: fallback.street, district: fallback.neighborhood, lat: fallback.location?.coordinates?.latitude, lng: fallback.location?.coordinates?.longitude };
    }
    const latitude = Number(raw.lat), longitude = Number(raw.lng);
    if (raw.cep !== cep || typeof raw.city !== 'string' || !raw.city.trim() || typeof raw.state !== 'string' || !/^[A-Z]{2}$/.test(raw.state)
        || ![raw.lat, raw.lng].every(value => value !== '' && value != null && ['number', 'string'].includes(typeof value)) || !validCepPoint(latitude, longitude))
        throw new Error('Não foi possível localizar esse CEP.');
    const address = [raw.address, raw.district, raw.city + '/' + raw.state].filter(value => typeof value === 'string' && value).join(' · ').slice(0, 300);
    const point = { cep, latitude, longitude, address };
    if (signal.aborted)
        throw new Error('Solicitação cancelada.');
    if (cache.size >= 64)
        cache.delete(cache.keys().next().value);
    cache.set(cep, { point, expires: Date.now() + 86400000 });
    return point;
}
export async function locateFreightCeps(originValue, destinationValue, signal) {
    const originCep = originValue.replace(/\D/g, ''), destinationCep = destinationValue.replace(/\D/g, '');
    const originLookup = locateCep(originCep, signal);
    const [origin, destination] = await Promise.all([originLookup, originCep === destinationCep ? originLookup : locateCep(destinationCep, signal)]);
    return readFreightLocations({ origin, destination }, originCep, destinationCep);
}
