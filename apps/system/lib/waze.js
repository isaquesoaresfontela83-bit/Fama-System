// Official integrations: https://developers.google.com/waze/deeplinks
// and https://developers.google.com/waze/iframe. No API key is required.
function coordinates(point) {
    if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number'
        || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
        || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180)
        return null;
    return { latitude: point.latitude, longitude: point.longitude };
}
function addressText(value) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000) : '';
}
export function wazeNavigationUrl(destination) {
    const address = addressText(typeof destination === 'string' ? destination : destination?.address);
    const point = coordinates(destination);
    // A CEP centroid is an area reference, never a confirmed customer entrance.
    const precise = point && destination.source !== 'cep' && destination.source !== 'reference';
    if (!precise && !address)
        return null;
    const url = new URL('https://waze.com/ul');
    if (precise)
        url.searchParams.set('ll', `${point.latitude},${point.longitude}`);
    else
        url.searchParams.set('q', address);
    url.searchParams.set('navigate', 'yes');
    url.searchParams.set('utm_source', 'fama_system');
    return url.toString();
}
export function wazeMapUrl(point, { overview = false } = {}) {
    const location = coordinates(point);
    if (!location && !overview)
        return null;
    const approximate = point?.source === 'cep' || point?.source === 'reference';
    const url = new URL('https://embed.waze.com/pt-BR/iframe');
    // The initial Brazil overview is a map extent, never a device position.
    url.searchParams.set('lat', String(location?.latitude ?? -14));
    url.searchParams.set('lon', String(location?.longitude ?? -54));
    url.searchParams.set('zoom', !location ? '4' : approximate ? '13' : '16');
    if (location)
        url.searchParams.set('pin', approximate ? '0' : '1');
    return url.toString();
}
