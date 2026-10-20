function object(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
export function validCepPoint(latitude, longitude) {
    return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= -34 && latitude <= 6 && longitude >= -74 && longitude <= -28;
}
export function readFreightLocations(value, originCep, destinationCep) {
    if (!object(value) || Object.keys(value).length !== 2 || !object(value.origin) || !object(value.destination))
        throw new Error('Invalid locations');
    const point = (raw, cep) => {
        if (Object.keys(raw).some(key => !['cep', 'latitude', 'longitude', 'address'].includes(key)) || raw.cep !== cep || !/^\d{8}$/.test(cep)
            || !validCepPoint(raw.latitude, raw.longitude) || typeof raw.address !== 'string' || !raw.address.trim() || raw.address.length > 300 || /[\u0000-\u001f\u007f]/.test(raw.address))
            throw new Error('Invalid CEP location');
        return { cep, latitude: raw.latitude, longitude: raw.longitude, address: raw.address };
    };
    const origin = point(value.origin, originCep), destination = point(value.destination, destinationCep);
    if (originCep !== destinationCep && Math.abs(origin.latitude - destination.latitude) < 0.000001 && Math.abs(origin.longitude - destination.longitude) < 0.000001)
        throw new Error('Coincident locations');
    return { origin, destination: originCep === destinationCep ? origin : destination };
}
