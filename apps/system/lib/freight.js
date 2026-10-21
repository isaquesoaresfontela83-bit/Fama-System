export function calculateFreight(distanceKm, rateCentsPerKm) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 10_000)
        throw new Error("Invalid distance");
    if (!Number.isSafeInteger(rateCentsPerKm) || rateCentsPerKm <= 0 || rateCentsPerKm > 1_000_000)
        throw new Error("Invalid rate");
    const billableKm = Math.round(distanceKm * 100) / 100;
    return { distanceKm: billableKm, totalCents: Math.round(billableKm * rateCentsPerKm) };
}
export function parseDistanceKm(value) {
    let text = value.trim().replace(/\s*km\s*$/i, '').trim();
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text))
        text = text.replace(/\./g, '');
    if (!/^\d+([.,]\d+)?$/.test(text))
        return null;
    const km = Number(text.replace(',', '.'));
    return Number.isFinite(km) && km >= 0 && km <= 10_000 ? km : null;
}
export function freightDirectionsUrl(originCep, destinationCep) {
    const origin = originCep.replace(/\D/g, ''), destination = destinationCep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(origin) || !/^\d{8}$/.test(destination))
        return null;
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', `${origin.slice(0, 5)}-${origin.slice(5)}, Brasil`);
    url.searchParams.set('destination', `${destination.slice(0, 5)}-${destination.slice(5)}, Brasil`);
    url.searchParams.set('travelmode', 'driving');
    return url.toString();
}
