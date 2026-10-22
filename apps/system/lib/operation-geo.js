export function osmEmbed(point) {
    const url = new URL('https://www.openstreetmap.org/export/embed.html');
    url.searchParams.set('layer', 'mapnik');
    if (!point)
        url.searchParams.set('bbox', '-74,-34,-34,6');
    else {
        const lat = Math.max(-85, Math.min(85, point.latitude)), span = point.source === 'device' || point.source === 'manual' ? Math.max(.0012, (point.accuracy ?? 100) / 111320 * 1.5) : .025, wide = span / Math.max(.1, Math.cos(lat * Math.PI / 180));
        url.searchParams.set('bbox', [Math.max(-180, point.longitude - wide), Math.max(-85, lat - span), Math.min(180, point.longitude + wide), Math.min(85, lat + span)].join(','));
        url.searchParams.set('marker', `${point.latitude},${point.longitude}`);
    }
    return url.toString();
}
export const osmSearch = (address) => 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(address);
export function osmDirections(to, from) { const url = new URL('https://www.openstreetmap.org/directions'); url.searchParams.set('engine', 'fossgis_osrm_car'); url.searchParams.set('route', `${from ? `${from.latitude},${from.longitude}` : ''};${to.latitude},${to.longitude}`); return url.toString(); }
export function addressCep(address) { return /(?:^|\D)(\d{5})-?(\d{3})(?!\d)/.exec(address)?.slice(1).join('') ?? ''; }
