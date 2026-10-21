export const osmTiles = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' };
export function geoapifyTiles(key, dark = false) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
        return osmTiles;
    return { url: `https://maps.geoapify.com/v1/tile/${dark ? 'dark-matter' : 'positron'}/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`, attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> | <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> | ' + osmTiles.attribution };
}
// The dedicated browser map key is public by design; never use a server API secret here.
export function installMapTiles(L, map, organizationId, onError) {
    let disposed = false, current, failures = 0, geo = false;
    const controller = new AbortController();
    const apply = (config) => {
        current?.remove();
        failures = 0;
        geo = config.url.startsWith('https://maps.geoapify.com/');
        current = L.tileLayer(config.url, { maxZoom: 19, keepBuffer: 0, updateWhenIdle: true, attribution: config.attribution }).addTo(map)
            .on('tileerror', () => { if (disposed)
            return; if (geo && ++failures >= 3) {
            apply(osmTiles);
            onError('Mapa alternativo ativado.');
        }
        else if (!geo)
            onError('Algumas partes do mapa não carregaram. Confira sua conexão.'); })
            .on('load', () => { if (!disposed)
            onError(''); });
    };
    // Resolve the provider before loading tiles to avoid charging/downloading both maps.
    if (organizationId) {
        fetch('/api/map-config', { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
            .then(async (response) => { if (!response.ok)
            throw new Error('map-config'); const config = await response.json(); if (!disposed)
            apply(geoapifyTiles(config.publicKey, document.documentElement?.classList.contains('dark'))); })
            .catch(() => { if (!disposed)
            apply(osmTiles); });
    }
    else
        apply(osmTiles);
    return () => { disposed = true; controller.abort(); current?.remove(); };
}
