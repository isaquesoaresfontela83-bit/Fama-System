'use client';
import { BrasilDataExplorer } from './brasil-data-explorer';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, ExternalLink, MapPin, Pencil, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestJson } from '@/lib/client-request';
import { lookupProviders } from '@/lib/registration-lookup';
import { freightDirectionsUrl } from '@/lib/freight';
import { locateFreightCeps } from '@/lib/freight-geocoding';
import { formatCurrency as money } from '@/lib/utils';
import { planIncludesFeature } from '@/lib/plan-features';
const formatCep = (value) => value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
export function ConsultationWorkspace({ organizationId, plan, planFeatures, compact = false, onOpen, onConfigure, onUpgrade, style, mode = 'all', presetDestinationCep, onLocateDestination }) {
    const id = useId();
    const freightEnabled = planIncludesFeature(plan, 'freight', planFeatures);
    const [type, setType] = useState(mode === 'travel' ? 'freight' : 'cnpj');
    const [value, setValue] = useState('');
    const [result, setResult] = useState(null);
    const [freight, setFreight] = useState(null);
    const [settings, setSettings] = useState(null);
    const [originCep, setOriginCep] = useState(''), [destinationCep, setDestinationCep] = useState('');
    const [editingDefaults, setEditingDefaults] = useState(false), [rate, setRate] = useState('');
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const controller = useRef(null), version = useRef(0), locked = useRef(false);
    const currentSettings = settings?.organizationId === organizationId ? settings.value : null;
    const canConfigure = Boolean(onConfigure);
    const originValid = /^\d{5}-?\d{3}$/.test(originCep);
    const destinationValid = /^\d{5}-?\d{3}$/.test(destinationCep);
    const defaultsReady = currentSettings && /^\d{8}$/.test(currentSettings.originCep) && currentSettings.rateCentsPerKm > 0;
    const directions = freight ? freightDirectionsUrl(freight.originCep, freight.destinationCep) : null;
    function clear() {
        version.current++;
        controller.current?.abort();
        locked.current = false;
        setBusy(false);
        setResult(null);
        setFreight(null);
        setError('');
    }
    useEffect(() => {
        clear();
        setSettings(null);
        setOriginCep('');
        setDestinationCep('');
        setRate('');
        setEditingDefaults(false);
        return () => { controller.current?.abort(); version.current++; };
    }, [organizationId, freightEnabled]);
    useEffect(() => {
        if (type !== 'freight' || !freightEnabled)
            return;
        const abort = new AbortController();
        setSettingsLoading(true);
        requestJson('/api/freight', { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: abort.signal }, 20000)
            .then(next => {
            if (!abort.signal.aborted) {
                setSettings({ organizationId, value: next });
                setOriginCep(formatCep(next.originCep));
                setRate((next.rateCentsPerKm / 100).toFixed(2).replace('.', ','));
                setEditingDefaults(canConfigure && (!next.originCep || next.rateCentsPerKm <= 0));
            }
        })
            .catch(reason => { if (!abort.signal.aborted)
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a tarifa.'); })
            .finally(() => { if (!abort.signal.aborted)
            setSettingsLoading(false); });
        return () => abort.abort();
    }, [organizationId, type, canConfigure, freightEnabled]);
    useEffect(() => { if (mode === 'travel' && presetDestinationCep !== undefined) {
        clear();
        setDestinationCep(formatCep(presetDestinationCep));
    } }, [presetDestinationCep, mode, organizationId]);
    async function saveDefaults(event) {
        event.preventDefault();
        if (locked.current || !onConfigure || !freightEnabled)
            return;
        const numericRate = /^\d+([.,]\d{1,2})?$/.test(rate.trim()) ? Math.round(Number(rate.replace(',', '.')) * 100) : NaN;
        if (!/^\d{5}-?\d{3}$/.test(originCep) || !Number.isSafeInteger(numericRate) || numericRate <= 0 || numericRate > 1_000_000) {
            setError('Informe o CEP de saída e um valor por km válido.');
            return;
        }
        locked.current = true;
        const revision = ++version.current, abort = new AbortController();
        controller.current?.abort();
        controller.current = abort;
        setBusy(true);
        setError('');
        setFreight(null);
        try {
            const next = await requestJson('/api/freight', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, signal: abort.signal, body: JSON.stringify({ originCep, rateCentsPerKm: numericRate }) });
            if (revision === version.current && !abort.signal.aborted) {
                setSettings({ organizationId, value: next });
                setOriginCep(formatCep(next.originCep));
                setRate((next.rateCentsPerKm / 100).toFixed(2).replace('.', ','));
                setEditingDefaults(false);
            }
        }
        catch (reason) {
            if (revision === version.current && !abort.signal.aborted)
                setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
        }
        finally {
            if (revision === version.current) {
                setBusy(false);
                locked.current = false;
            }
        }
    }
    async function consult(event) {
        event.preventDefault();
        if (locked.current || (type === 'freight' && !freightEnabled))
            return;
        locked.current = true;
        const revision = ++version.current, abort = new AbortController();
        controller.current?.abort();
        controller.current = abort;
        setBusy(true);
        setError('');
        setResult(null);
        setFreight(null);
        try {
            const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, signal: abort.signal };
            if (type === 'freight') {
                if (!originValid || !destinationValid)
                    throw new Error('Informe os CEPs de origem e destino.');
                if (!currentSettings || currentSettings.rateCentsPerKm <= 0)
                    throw new Error('Defina o valor por km em Ajustes.');
                let locations;
                try {
                    locations = await locateFreightCeps(originCep, destinationCep, abort.signal);
                }
                catch (reason) {
                    if (abort.signal.aborted)
                        throw reason; /* Server lookup remains available when browser geocoding fails. */
                }
                const next = await requestJson('/api/freight', { ...options, body: JSON.stringify({ originCep, destinationCep, ...(locations ? { locations } : {}) }) }, 55000);
                if (revision === version.current && !abort.signal.aborted)
                    setFreight(next);
            }
            else {
                const next = await requestJson('/api/registration-lookup', { ...options, body: JSON.stringify({ type, value }) }, 25000);
                if (revision === version.current && !abort.signal.aborted)
                    setResult(next);
            }
        }
        catch (reason) {
            if (revision === version.current && !abort.signal.aborted)
                setError(reason instanceof Error ? reason.message : 'Não foi possível consultar.');
        }
        finally {
            if (revision === version.current) {
                setBusy(false);
                locked.current = false;
            }
        }
    }
    return <section className={'surface consultation-workspace' + (compact ? ' consultation-compact' : '')} style={style}>
    <header className="panel-heading"><h2>{mode === 'travel' ? <><Truck />Deslocamento e frete</> : <><Search />Consulta</>}</h2>{onOpen && <Button type="button" variant="ghost" size="icon-sm" onClick={onOpen} title="Abrir Consulta" aria-label="Abrir Consulta"><ArrowUpRight /></Button>}</header>
    {mode !== 'travel' && <div className="consultation-types" role="group" aria-label="Tipo de consulta">
      {['cnpj', 'cep', 'freight'].filter(item => item !== 'freight' || (mode !== 'lookup' && (planFeatures === undefined || planFeatures.includes('freight')))).map(item => <Button type="button" key={item} variant={type === item ? 'default' : 'outline'} aria-pressed={type === item} onClick={() => { clear(); setType(item); setValue(''); }}>{item === 'freight' ? 'Frete' : item.toUpperCase()}</Button>)}
    </div>}
    {mode === 'travel' && <p className="planning-travel-hint">O CEP selecionado no mapa preenche o destino. Informe a origem para calcular a distância de carro, o tempo estimado e o custo pela tarifa da empresa.</p>}
    {type === 'freight' && !freightEnabled ? <div className="freight-result"><strong>Frete automático no Pro</strong><p>Calcule a distância de carro entre dois CEPs e o frete pela tarifa por km da empresa.</p>{onUpgrade ? <Button type="button" onClick={onUpgrade}>Conhecer o Pro</Button> : <a href="/planos" target="_blank" rel="noopener noreferrer">Conhecer os planos</a>}</div> : <form className={'consultation-form' + (type === 'freight' ? ' freight-form' : '')} onSubmit={type === 'freight' && editingDefaults ? saveDefaults : consult}>
      {type === 'freight' ? <>
        {settingsLoading ? <small role="status">Carregando origem e tarifa…</small> : editingDefaults ? <div className="freight-defaults-editor">
          <strong>Origem e tarifa da empresa</strong><small>Salve uma vez para usar nos próximos fretes.</small>
          <div className="freight-fields"><div className="form-field"><Label htmlFor={id + '-origin'}>CEP de saída</Label><Input id={id + '-origin'} value={originCep} disabled={busy} onChange={event => { clear(); setOriginCep(formatCep(event.target.value)); }} inputMode="numeric" maxLength={9} required placeholder="00000-000"/></div><div className="form-field"><Label htmlFor={id + '-rate'}>Valor por km (R$)</Label><Input id={id + '-rate'} value={rate} disabled={busy} onChange={event => { clear(); setRate(event.target.value); }} inputMode="decimal" required placeholder="10,00"/></div></div>
          <div><Button type="submit" disabled={busy}> {busy ? 'Salvando…' : 'Salvar origem e tarifa'}</Button>{defaultsReady && <Button type="button" variant="ghost" disabled={busy} onClick={() => { clear(); setOriginCep(formatCep(currentSettings.originCep)); setRate((currentSettings.rateCentsPerKm / 100).toFixed(2).replace('.', ',')); setEditingDefaults(false); }}>Cancelar</Button>}</div>
        </div> : <>
          <div className="freight-entry-fields">
            <div className="form-field"><Label htmlFor={id + '-origin'}>CEP de origem</Label><Input id={id + '-origin'} value={originCep} onChange={event => { clear(); setOriginCep(formatCep(event.target.value)); }} inputMode="numeric" autoComplete="section-freight-origin postal-code" maxLength={9} required placeholder="00000-000"/></div>
            <div className="form-field"><Label htmlFor={id + '-destination'}>CEP de destino</Label><Input id={id + '-destination'} value={destinationCep} onChange={event => { clear(); setDestinationCep(formatCep(event.target.value)); }} inputMode="numeric" autoComplete="section-freight-destination postal-code" maxLength={9} required placeholder="00000-000"/></div>
          </div>
          <div className="consultation-actions"><Button type="submit" disabled={busy || settingsLoading || !currentSettings || currentSettings.rateCentsPerKm <= 0 || !originValid || !destinationValid}><Truck />{busy ? 'Calculando rota…' : 'Calcular frete'}</Button></div>
          <div className="freight-result" role="status" aria-live="polite">
            <small>Frete estimado</small><strong>{freight ? money(freight.totalCents) : '—'}</strong>
            {freight && <span>{freight.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km de carro × {money(freight.rateCentsPerKm)}/km</span>}
            {freight?.durationMinutes !== undefined && <span>Tempo estimado: {freight.durationMinutes < 60 ? `${freight.durationMinutes} min` : `${Math.floor(freight.durationMinutes / 60)} h ${freight.durationMinutes % 60} min`} · sem trânsito em tempo real</span>}
            {freight && !compact && <dl><div><dt>Origem</dt><dd>{freight.originAddress}</dd></div><div><dt>Destino</dt><dd>{freight.destinationAddress}</dd></div></dl>}
            {freight && onLocateDestination && <Button type="button" variant="outline" size="sm" onClick={() => onLocateDestination(freight.destinationCep)}>Ver destino no mapa</Button>}
            {directions && <a className="freight-map-link" href={directions} target="_blank" rel="noopener noreferrer">Ver no Maps<ExternalLink aria-hidden="true"/></a>}
            {freight && freight.source !== 'manual' && <small className="freight-attribution">{freight.source === 'openrouteservice' ? <><a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer">openrouteservice · HeiGIT</a> · </> : freight.source === 'brouter' ? <><a href="https://brouter.de/" target="_blank" rel="noopener noreferrer">BRouter</a> · </> : null}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></small>}
          </div>
          <details className="freight-adjustments">
            <summary>Ajustes</summary>
            <div className="freight-saved-defaults"><MapPin /><span>{defaultsReady ? <>Saída <b>{formatCep(currentSettings.originCep)}</b><small>{money(currentSettings.rateCentsPerKm)}/km</small></> : 'Peça ao administrador para definir a origem e a tarifa.'}</span>{onConfigure && <Button type="button" variant="ghost" size="sm" aria-label="Alterar origem e tarifa" onClick={() => { clear(); setEditingDefaults(true); }}><Pencil />Alterar</Button>}</div>
          </details>
        </>}
      </> : <div className="form-field"><Label htmlFor={id + '-value'}>{type.toUpperCase()}</Label><Input id={id + '-value'} value={value} onChange={event => { clear(); setValue(event.target.value); }} maxLength={type === 'cep' ? 9 : 18} autoCapitalize="characters" inputMode={type === 'cnpj' ? 'text' : 'numeric'} required placeholder={type === 'cep' ? '00000-000' : '00.000.000/0000-00'}/></div>}
      {type !== 'freight' && <div className="consultation-actions">
        <Button disabled={busy}><Search />{busy ? 'Consultando…' : 'Consultar'}</Button>
        {!compact && <Button type="button" variant="outline" onClick={() => { clear(); setValue(''); setDestinationCep(''); }}>Limpar</Button>}
      </div>}
    </form>}
    {error && <p role="alert" className="registration-lookup-error">{error}</p>}
    {result && <div className="registration-lookup-result" role="status">
      <h3>{result.name || 'Endereço encontrado'}</h3>
      <dl>{[['Documento / CEP', result.value], ['Nome fantasia', result.tradeName], ['Situação cadastral', result.situation], ['Endereço', result.address], ['Telefone', result.phone], ['E-mail', result.email]].filter(([, text]) => text).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
      {!compact && <small>Fonte: {lookupProviders.find(provider => provider.id === result.provider)?.label} · {new Date(result.consultedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>}
    </div>}
    {!compact && mode !== 'travel' && <BrasilDataExplorer key={organizationId} organizationId={organizationId}/>}
  </section>;
}
