"use client";
import { useEffect, useRef, useState } from 'react';
import { MapPin, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { installMapTiles } from '@/lib/map-tiles';
export function LocationPointPicker({ initial, onConfirm, onCancel, organizationId }) {
    const host = useRef(null), candidate = useRef(null), [ready, setReady] = useState(false), [error, setError] = useState(''), [coordinates, setCoordinates] = useState('');
    useEffect(() => {
        let disposed = false, map, observer, disposeTiles;
        import('leaflet').then(L => {
            if (disposed || !host.current)
                return;
            map = L.map(host.current, { scrollWheelZoom: false, zoomControl: true }).setView(initial ? [initial.latitude, initial.longitude] : [-14, -54], initial ? 16 : 4);
            disposeTiles = installMapTiles(L, map, organizationId, message => { if (!disposed)
                setError(message); });
            const update = () => { const center = map.getCenter(); candidate.current = { latitude: center.lat, longitude: center.wrap().lng }; setCoordinates(`${center.lat.toFixed(6)}, ${center.wrap().lng.toFixed(6)}`); setReady(map.getZoom() >= 16); };
            map.on('moveend zoomend', update);
            update();
            observer = new ResizeObserver(() => map?.invalidateSize());
            observer.observe(host.current);
        }).catch(() => { if (!disposed)
            setError('Não foi possível abrir o ajuste do mapa. Tente novamente.'); });
        return () => { disposed = true; disposeTiles?.(); observer?.disconnect(); map?.remove(); candidate.current = null; };
    }, [organizationId]);
    return <div className="location-picker"><p>Arraste o mapa até o pino ficar sobre o local correto. Use + para aproximar.</p><div className="location-picker-map"><div ref={host} className="location-picker-canvas" role="region" aria-label="Mapa para ajustar o ponto; arraste e use os controles de zoom"/><MapPin className="location-picker-pin" aria-hidden="true"/></div><small aria-live="polite">{coordinates}{coordinates && !ready ? ' · Aproxime mais para confirmar o local.' : ''}</small>{error && <p role="alert">{error}</p>}<div className="location-picker-actions"><Button variant="outline" onClick={onCancel}><X />Cancelar</Button><Button disabled={!ready || !!error} onClick={() => { if (candidate.current)
        onConfirm({ ...candidate.current, address: 'Ponto confirmado por você no mapa', source: 'manual' }); }}><Check />Confirmar local</Button></div></div>;
}
