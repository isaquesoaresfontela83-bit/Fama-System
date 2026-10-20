'use client';
import { useEffect, useRef, useState } from 'react';
import { Expand, LocateFixed, MapPin, Minimize, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { installMapTiles } from '@/lib/map-tiles';
export function OperationalMapView({ point, origin, markers, onSelect, organizationId }) {
    const host = useRef(null), map = useRef(null), library = useRef(null), layer = useRef(null), select = useRef(onSelect);
    const [ready, setReady] = useState(false), [error, setError] = useState(''), [expanded, setExpanded] = useState(false);
    select.current = onSelect;
    useEffect(() => {
        if (!host.current)
            return;
        let disposed = false, resize, disposeTiles;
        import('leaflet').then(L => {
            if (disposed || !host.current)
                return;
            library.current = L;
            const instance = L.map(host.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: true }).setView(point ? [point.latitude, point.longitude] : [-14, -54], point ? (point.source === 'manual' || point.source === 'device' ? 16 : 14) : 4);
            map.current = instance;
            L.control.zoom({ position: 'topright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(instance);
            L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instance);
            disposeTiles = installMapTiles(L, instance, organizationId, message => { if (!disposed)
                setError(message); });
            layer.current = L.layerGroup().addTo(instance);
            if (typeof ResizeObserver !== 'undefined') {
                resize = new ResizeObserver(() => instance.invalidateSize());
                resize.observe(host.current);
            }
            setReady(true);
        }).catch((cause) => { console.warn('operational_map_load_failed', cause); if (!disposed)
            setError('Não foi possível carregar o mapa interativo. Use Traçar rota para abrir o mapa externo.'); });
        return () => { disposed = true; disposeTiles?.(); resize?.disconnect(); map.current?.remove(); map.current = null; layer.current = null; library.current = null; };
    }, [organizationId]);
    const markerKey = JSON.stringify(markers), pointKey = JSON.stringify(point), originKey = JSON.stringify(origin);
    useEffect(() => {
        const L = library.current, group = layer.current;
        if (!ready || !L || !group)
            return;
        group.clearLayers();
        const draw = (p, label, kind, number) => {
            const icon = L.divIcon({ className: 'fama-map-marker ' + kind, html: `<span><b>${number ?? '●'}</b></span>`, iconSize: [32, 40], iconAnchor: [16, 38] });
            const marker = L.marker([p.latitude, p.longitude], { icon, title: label, keyboard: true, riseOnHover: true }).addTo(group);
            const tooltip = document.createElement('span');
            tooltip.textContent = label;
            marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -32] });
            if (p.appointmentId)
                marker.on('click', () => select.current(p.appointmentId));
        };
        markers.filter(m => m.appointmentId !== point?.appointmentId).forEach((p, i) => draw(p, p.label, p.source === 'manual' ? 'confirmed' : 'approximate', i + 1));
        if (origin && (!point || origin.latitude !== point.latitude || origin.longitude !== point.longitude))
            draw(origin, 'Sua origem', 'device');
        if (point) {
            draw(point, point.source === 'device' ? 'Sua localização' : point.source === 'manual' ? 'Ponto confirmado' : 'Local aproximado do CEP', point.source === 'device' ? 'device' : point.source === 'manual' ? 'confirmed' : 'approximate');
            if (point.source === 'device' && typeof point.accuracy === 'number' && point.accuracy > 0)
                L.circle([point.latitude, point.longitude], { radius: point.accuracy, color: '#168afa', weight: 1, fillOpacity: .1 }).addTo(group);
        }
    }, [ready, markerKey, pointKey, originKey]);
    useEffect(() => { if (ready && map.current && point)
        map.current.setView([point.latitude, point.longitude], point.source === 'device' || point.source === 'manual' ? 16 : 14, { animate: false }); }, [ready, point?.latitude, point?.longitude]);
    function center() { if (point)
        map.current?.setView([point.latitude, point.longitude], point.source === 'device' || point.source === 'manual' ? 16 : 14, { animate: false }); }
    function overview() { const L = library.current, m = map.current; if (!L || !m)
        return; const points = [...markers, ...(point ? [point] : []), ...(origin ? [origin] : [])]; if (points.length)
        m.fitBounds(L.latLngBounds(points.map(p => [p.latitude, p.longitude])), { padding: [38, 38], maxZoom: 16, animate: false }); }
    return <div className={`operational-map-view${expanded ? ' expanded' : ''}`}><div className="operational-map-toolbar"><span><MapPin />Mapa interativo</span><div><Button variant="ghost" size="sm" disabled={!ready || !point} onClick={center} aria-label="Centralizar no ponto selecionado"><LocateFixed />Centralizar</Button><Button variant="ghost" size="sm" disabled={!ready || (!markers.length && !point)} onClick={overview}><Layers />Ver pontos</Button><Button variant="ghost" size="icon-sm" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Reduzir mapa' : 'Ampliar mapa'} aria-pressed={expanded}>{expanded ? <Minimize /> : <Expand />}</Button></div></div><div className="operational-map-canvas" ref={host} role="region" aria-label="Mapa interativo dos atendimentos. Arraste para navegar, use os controles para aproximar e selecione um pino."/>{!ready && !error && <p className="operational-map-loading" role="status">Carregando mapa…</p>}{error && <p className="field-message" role="alert">{error}</p>}<div className="operational-map-legend"><span><i className="device"/>GPS / origem</span><span><i className="confirmed"/>Ponto confirmado</span><span><i className="approximate"/>CEP aproximado</span></div><p className="operational-map-hint">{markers.length ? `${markers.length} atendimento(s) localizado(s). Selecione os pinos ou use a lista abaixo.` : 'Selecione um atendimento ou localize um CEP para marcar o mapa.'} Arrastar o mapa não altera o ponto salvo.</p></div>;
}
