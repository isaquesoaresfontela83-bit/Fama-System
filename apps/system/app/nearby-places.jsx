'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { osmDirections } from '@/lib/operation-geo';
const categories = { fuel: 'Postos', parking: 'Estacionamentos', pharmacy: 'Farmácias', supplies: 'Lojas de materiais' };
export function NearbyPlaces({ organizationId, point }) {
    const [category, setCategory] = useState('fuel'), [radius, setRadius] = useState(3000), [places, setPlaces] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const active = useRef(null);
    useEffect(() => { active.current?.abort(); setPlaces(null); setBusy(false); setError(''); return () => active.current?.abort(); }, [organizationId, point?.latitude, point?.longitude, category, radius]);
    async function search() { if (!point)
        return; active.current?.abort(); const controller = new AbortController(); active.current = controller; setBusy(true); setError(''); setPlaces(null); try {
        const r = await fetch('/api/nearby-places', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ latitude: point.latitude, longitude: point.longitude, category, radius }), signal: controller.signal });
        const v = await r.json();
        if (!r.ok)
            throw new Error(v.error || 'Busca indisponível.');
        if (!controller.signal.aborted)
            setPlaces(v.places);
    }
    catch (e) {
        if (!controller.signal.aborted)
            setError(e.message);
    }
    finally {
        if (!controller.signal.aborted)
            setBusy(false);
    } }
    return <section className="nearby-panel"><h3>Pontos de apoio próximos</h3><p>Use o ponto selecionado para encontrar uma parada durante o atendimento.</p><div className="integration-fields"><label>Tipo<select value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>Raio<select value={radius} onChange={e => setRadius(Number(e.target.value))}><option value="1000">1 km</option><option value="3000">3 km</option><option value="5000">5 km</option></select></label><Button disabled={!point || busy} onClick={() => void search()}>{busy ? 'Buscando…' : 'Buscar pontos'}</Button></div><small>{point ? 'A busca compartilha apenas o ponto aproximado com o OpenStreetMap, sem dados do cliente.' : 'Selecione um ponto no mapa para buscar.'}</small>{error && <p role="alert">{error}</p>}{places?.length === 0 && <p>Nenhum ponto cadastrado nessa categoria e região. Tente outro raio.</p>}<div className="nearby-results">{places?.map(p => <article key={p.id}><strong>{p.name}</strong><span>{(p.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km em linha reta</span>{p.address && <small>{p.address}</small>}{p.hours && <small>Horário cadastrado: {p.hours}</small>}<div><a href={osmDirections(p, point)} target="_blank" rel="noreferrer">Traçar rota</a><a href={p.url} target="_blank" rel="noreferrer">Ver no mapa</a></div></article>)}</div><small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Overpass. Dados colaborativos: confirme funcionamento e disponibilidade no local.</small></section>;
}
