"use client";
import { useEffect, useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locateFreightCeps } from '@/lib/freight-geocoding';
export function CompanyWeatherSettings({ organizationId }) {
    const [cep, setCep] = useState(''), [point, setPoint] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    useEffect(() => { const controller = new AbortController(); fetch('/api/operation-weather', { headers: { 'x-organization-id': organizationId }, signal: controller.signal, cache: 'no-store' }).then(async (response) => { if (!response.ok)
        throw new Error('Não foi possível consultar o local salvo.'); const data = await response.json(); if (!controller.signal.aborted)
        setPoint(data.location); }).catch(error => { if (!controller.signal.aborted)
        setMessage(error.message); }); return () => controller.abort(); }, [organizationId]);
    async function save(event) { event.preventDefault(); setBusy(true); setMessage(''); try {
        const result = await locateFreightCeps(cep, cep, new AbortController().signal);
        const response = await fetch('/api/operation-weather', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ location: result.origin }) });
        if (!response.ok)
            throw new Error('Não foi possível salvar o local.');
        setPoint((await response.json()).location);
        setCep('');
        setMessage('Local de referência salvo.');
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível localizar o CEP.');
    }
    finally {
        setBusy(false);
    } }
    return <form className="surface settings-section weather-settings" onSubmit={save}><div className="panel-heading"><div><small>MAPA OPERACIONAL</small><h2><MapPin />Local de referência</h2></div><span className="ops-status">Opcional</span></div><p>O mapa usa automaticamente o CEP do próximo atendimento. Se quiser, salve também um local de referência para sua empresa.</p><label className="form-field">CEP da empresa<Input value={cep} onChange={event => setCep(event.target.value)} placeholder="00000-000" inputMode="numeric" maxLength={9}/></label>{point && <p className="weather-config-location">Local salvo: {point.address}</p>}<div className="weather-settings-footer"><Button type="submit" disabled={busy || !cep.trim()}><Save />{busy ? 'Salvando…' : 'Salvar local'}</Button></div>{message && <p role="status">{message}</p>}</form>;
}
