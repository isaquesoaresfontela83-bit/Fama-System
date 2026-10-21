"use client";
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CloudRain, CloudSun, ExternalLink, LocateFixed, MapPin, Navigation, RefreshCw, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locateFreightCeps } from '@/lib/freight-geocoding';
import { NearbyPlaces } from './nearby-places';
import { OperationalMapView } from './operational-map-view';
import { LocationPointPicker } from './location-point-picker';
import { readConfirmedPoint, saveConfirmedPoint } from '@/lib/confirmed-map-point';
import { searchDeviceLocation } from '@/lib/device-location';
import { osmSearch, osmDirections, addressCep } from '@/lib/operation-geo';
import { appointmentWeatherRisk } from '@/lib/operation-weather-model';
import { WazeLink, WazeNavigation } from './waze-navigation';
const date = (value) => new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
export function FieldConditions({ organizationId, appointments, onSelect, weatherAnchor, mapRequest, onReferenceChange, onDestinationCep }) {
    const [point, setPoint] = useState(null), [origin, setOrigin] = useState(null), [cep, setCep] = useState(''), [selected, setSelected] = useState(''), [configured, setConfigured] = useState(false), [loading, setLoading] = useState(true), [forecast, setForecast] = useState(null), [weatherBusy, setWeatherBusy] = useState(false), [geoBusy, setGeoBusy] = useState(false), [error, setError] = useState(''), [weatherError, setWeatherError] = useState(''), [reload, setReload] = useState(0);
    const [editing, setEditing] = useState(false), [estimate, setEstimate] = useState(null);
    const [known, setKnown] = useState({});
    const [provider, setProvider] = useState('Open-Meteo');
    const automatic = useRef(false), stopDevice = useRef(null), deviceRevision = useRef(0);
    const alive = useRef(true), lookup = useRef(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; lookup.current?.abort(); deviceRevision.current++; stopDevice.current?.(); }; }, []);
    useEffect(() => { const controller = new AbortController(); fetch('/api/operation-weather', { headers: { 'x-organization-id': organizationId }, signal: controller.signal, cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok)
        throw new Error(data.error || 'Não foi possível consultar o clima.'); if (!controller.signal.aborted) {
        setProvider(data.provider === 'met-norway' ? 'MET Norway' : data.provider === 'open-meteo' ? 'Open-Meteo' : 'OpenWeather');
        setConfigured(data.configured);
        setPoint(current => deviceRevision.current ? current : current ?? readConfirmedPoint(globalThis.localStorage, organizationId) ?? (data.location ? { ...data.location, source: 'reference' } : null));
    } }).catch(error => { if (!controller.signal.aborted)
        setWeatherError(error.message); }).finally(() => { if (!controller.signal.aborted)
        setLoading(false); }); return () => controller.abort(); }, [organizationId]);
    useEffect(() => { setForecast(null); if (!configured || !point) {
        setWeatherBusy(false);
        return;
    } const controller = new AbortController(); setWeatherBusy(true); setWeatherError(''); fetch(`/api/operation-weather?forecast=1&lat=${point.latitude}&lon=${point.longitude}`, { headers: { 'x-organization-id': organizationId }, signal: controller.signal, cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok)
        throw new Error(data.error || 'Previsão indisponível.'); if (!controller.signal.aborted)
        setForecast(data.forecast); }).catch(error => { if (!controller.signal.aborted)
        setWeatherError(error.message); }).finally(() => { if (!controller.signal.aborted)
        setWeatherBusy(false); }); return () => controller.abort(); }, [organizationId, configured, point?.latitude, point?.longitude, reload]);
    async function locateCep(value, appointmentId) { deviceRevision.current++; stopDevice.current?.(); lookup.current?.abort(); const controller = new AbortController(); lookup.current = controller; setGeoBusy(true); setError(''); const saved = appointmentId ? readConfirmedPoint(globalThis.localStorage, organizationId, appointmentId) : null; if (saved) {
        setPoint(saved);
        setGeoBusy(false);
        return;
    } try {
        const result = await locateFreightCeps(value, value, controller.signal);
        if (!controller.signal.aborted && alive.current)
            setPoint({ ...result.origin, appointmentId, source: 'cep' });
    }
    catch (error) {
        if (!controller.signal.aborted && alive.current)
            setError(error instanceof Error ? error.message : 'Não foi possível localizar o CEP.');
    }
    finally {
        if (!controller.signal.aborted && alive.current)
            setGeoBusy(false);
    } }
    function locateDevice() {
        automatic.current = true;
        lookup.current?.abort();
        stopDevice.current?.();
        const revision = ++deviceRevision.current;
        if (!navigator.geolocation) {
            setError('A localização não está disponível neste navegador.');
            setGeoBusy(false);
            return;
        }
        setPoint(null);
        setOrigin(null);
        setEstimate(null);
        setSelected('');
        setGeoBusy(true);
        setError('Buscando GPS preciso. Aguarde até 45 segundos…');
        stopDevice.current = searchDeviceLocation(navigator.geolocation, {
            onPosition(position) { if (!alive.current || revision !== deviceRevision.current)
                return; const location = { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy ?? undefined, source: 'device', address: `Sua posição · margem informada pelo aparelho: ±${Math.ceil(position.accuracy ?? 0)} m` }; setOrigin(location); setPoint(location); setError('Refinando GPS…'); },
            onApproximate(position) { if (alive.current && revision === deviceRevision.current)
                setEstimate({ latitude: position.latitude, longitude: position.longitude, address: 'Estimativa do aparelho, ajuste antes de confirmar' }); },
            onComplete() { if (alive.current && revision === deviceRevision.current) {
                setGeoBusy(false);
                setError('');
            } },
            onError(message) { if (alive.current && revision === deviceRevision.current) {
                setGeoBusy(false);
                setError(message + ' Você também pode usar Ajustar ponto no mapa.');
            } },
        });
    }
    function submit(event) { event.preventDefault(); void locateCep(cep, selected || undefined); }
    const visits = [...appointments].filter(item => !['concluido', 'cancelado'].includes(item.status) && new Date(item.startAt).getTime() > Date.now() - 3 * 3600000).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 8);
    const automaticVisit = visits.find(item => addressCep(item.address));
    useEffect(() => { if (automatic.current || !automaticVisit)
        return; automatic.current = true; const code = addressCep(automaticVisit.address); setSelected(automaticVisit.id); setCep(code); void locateCep(code, automaticVisit.id); }, [automaticVisit?.id, automaticVisit?.address]);
    useEffect(() => { onReferenceChange?.(point); }, [point, onReferenceChange]);
    useEffect(() => { if (!point || point.source === 'device')
        onDestinationCep?.('');
    else if (/^\d{5}-?\d{3}$/.test(cep))
        onDestinationCep?.(cep); }, [point, selected, onDestinationCep]);
    useEffect(() => { if (mapRequest) {
        setSelected('');
        setCep(mapRequest.cep);
        automatic.current = true;
        void locateCep(mapRequest.cep);
    } }, [mapRequest?.revision]);
    const selectedVisit = visits.find(item => item.id === selected);
    useEffect(() => { if (point?.appointmentId)
        setKnown(v => ({ ...v, [point.appointmentId]: point })); }, [point]);
    const mapMarkers = visits.flatMap(visit => { const location = point?.appointmentId === visit.id ? point : known[visit.id] ?? readConfirmedPoint(globalThis.localStorage, organizationId, visit.id); return location ? [{ ...location, appointmentId: visit.id, label: visit.clientName + ' · ' + visit.title }] : []; });
    function selectVisit(id) { const item = visits.find(v => v.id === id); if (!item)
        return; automatic.current = true; setSelected(id); const code = addressCep(item.address); setCep(code); const location = known[id] ?? readConfirmedPoint(globalThis.localStorage, organizationId, id); if (location) {
        lookup.current?.abort();
        stopDevice.current?.();
        deviceRevision.current++;
        setGeoBusy(false);
        setPoint(location);
        setError('');
    }
    else if (code)
        void locateCep(code, id);
    else {
        lookup.current?.abort();
        stopDevice.current?.();
        deviceRevision.current++;
        setGeoBusy(false);
        setPoint(null);
        setError('Informe o CEP ou ajuste o ponto deste atendimento no mapa.');
    } }
    const risk = selectedVisit && point?.appointmentId === selected && forecast ? appointmentWeatherRisk(selectedVisit.startAt, forecast) : null;
    const wazePoint = !editing && !geoBusy && (!selected || point?.appointmentId === selected) ? point : null;
    return <div className={`field-conditions ${configured ? '' : 'field-map-only'}`}><section className="ops-panel field-map-panel"><header className="ops-panel-heading"><h2><MapPin />Mapa dos atendimentos</h2><Button variant="outline" size="sm" disabled={geoBusy || editing} onClick={locateDevice}><LocateFixed />Minha localização</Button><Button variant="outline" size="sm" disabled={editing} onClick={() => { lookup.current?.abort(); stopDevice.current?.(); deviceRevision.current++; automatic.current = true; setGeoBusy(false); setEditing(true); }}>Ajustar ponto</Button></header><form className="field-cep-form" onSubmit={submit}><Input disabled={editing} aria-label="CEP para localizar no mapa" inputMode="numeric" value={cep} maxLength={9} onChange={event => setCep(event.target.value)} placeholder={selectedVisit ? 'CEP deste atendimento' : 'Localizar um CEP'}/><Button type="submit" disabled={editing || geoBusy || !cep.trim()}>{geoBusy ? 'Localizando…' : 'Localizar'}</Button></form>{editing ? <LocationPointPicker organizationId={organizationId} initial={point || estimate} onCancel={() => setEditing(false)} onConfirm={confirmed => { const location = { ...confirmed, ...(selected ? { appointmentId: selected } : {}) }; setPoint(location); if (!selected)
        setOrigin(location); saveConfirmedPoint(globalThis.localStorage, organizationId, location); setEditing(false); setError('Local confirmado. Este ponto foi ajustado por você, não medido pelo GPS.'); }}/> : <OperationalMapView organizationId={organizationId} point={point} origin={origin} markers={mapMarkers} onSelect={selectVisit}/>}<div className="field-map-caption"><span>{point ? point.source === 'device' || point.source === 'manual' ? point.address : `${point.source === 'reference' ? 'Referência da empresa' : 'Atendimento / CEP'} · ${point.address} · posição aproximada, não é seu GPS` : 'Toque em Minha localização para usar o GPS ou selecione um atendimento.'}</span>{point && <a href={osmDirections(point, origin)} target="_blank" rel="noreferrer"><Navigation />Traçar rota</a>}</div><a className="field-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a><details className="planning-support"><summary>Pontos de apoio · postos, farmácias e lojas</summary><NearbyPlaces organizationId={organizationId} point={editing ? null : point}/></details>{error && <p className="field-message" role="alert">{error}</p>}{selectedVisit && !addressCep(selectedVisit.address) && <p className="field-message">Este atendimento não tem CEP no endereço. Informe o CEP acima ou use a busca no OpenStreetMap.</p>}</section>
 {configured && <section id={weatherAnchor} className="ops-panel field-weather-panel planning-anchor"><header className="ops-panel-heading"><h2><CloudSun />Clima para o trabalho</h2>{configured && point && <button type="button" disabled={weatherBusy} onClick={() => setReload(value => value + 1)} aria-label="Atualizar previsão"><RefreshCw />Atualizar</button>}</header>{loading || weatherBusy ? <p className="ops-empty">Consultando condições do tempo…</p> : !point ? <p className="ops-empty">Selecione uma localização no mapa para consultar a previsão.</p> : forecast ? <><div className="field-weather-now"><span><CloudSun /></span><div><small>PRÓXIMO HORÁRIO DA PREVISÃO</small><strong>{Math.round(forecast.slots[0].temperature)}°C</strong><p>{forecast.city} · {forecast.slots[0].description}</p></div></div><div className="field-weather-days">{forecast.days.map(day => <article key={day.date}><span>{date(day.date)}</span>{day.storm || day.rainChance >= 60 || (day.precipitationMm ?? 0) >= .5 ? <CloudRain /> : <CloudSun />}<strong>{Math.round(day.max)}° <small>{Math.round(day.min)}°</small></strong><span>{day.rainChanceKnown === false ? (day.precipitationMm === undefined ? 'Chuva sem dados' : `${day.precipitationMm} mm/intervalo`) : `${day.rainChance}% chuva`}</span><small><Wind />{day.windKmh} km/h</small></article>)}</div><p className="field-weather-advice"><AlertTriangle />{forecast.days[0].storm ? 'Trovoadas previstas: revise as atividades externas com a equipe.' : (forecast.days[0].rainChance >= 60 || (forecast.days[0].precipitationMm ?? 0) >= .5) ? forecast.days[0].rainChanceKnown === false ? 'Chuva prevista: revise os horários dos serviços externos.' : 'Chance elevada de chuva: revise os horários dos serviços externos.' : 'Confira a previsão antes de iniciar cada serviço externo.'}</p>{risk && <div className={`field-appointment-risk ${risk.risk}`}><CalendarDays /><span>Horário de {selectedVisit?.clientName}: {risk.rainChanceKnown === false ? (risk.precipitationMm === undefined ? 'chuva sem dados' : `${risk.precipitationMm} mm previstos`) : `${risk.rainChance}% de chance de chuva`} · vento {risk.windKmh} km/h.{risk.storm ? ' Trovoadas previstas.' : ''}</span></div>}<p className="field-weather-source"><a href={provider === 'MET Norway' ? 'https://api.met.no/' : provider === 'Open-Meteo' ? 'https://open-meteo.com/' : 'https://openweathermap.org/'} target="_blank" rel="noreferrer">{provider}</a>{provider === 'MET Norway' && <> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · dados resumidos; chuva pelo maior intervalo previsto</>} · atualizado às {new Date(forecast.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Previsão para o ponto selecionado; nenhuma visita é reagendada automaticamente.</p></> : null}{weatherError && <p className="field-message" role="alert">{weatherError}</p>}</section>}
 <WazeNavigation key={organizationId} point={wazePoint} address={selectedVisit?.address} label={selectedVisit?.clientName}/>
 <section className="ops-panel field-visits-panel"><header className="ops-panel-heading"><h2><CalendarDays />Atendimentos para planejar</h2></header>{visits.map(item => <div className={`field-visit ${selected === item.id ? 'selected' : ''}`} key={item.id}><button type="button" disabled={editing} onClick={() => selectVisit(item.id)}><time>{new Date(item.startAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><strong>{item.clientName}</strong><small>{item.address || 'Endereço não informado'}</small></button><div><Button size="sm" variant="ghost" onClick={() => onSelect(item)}>Abrir atendimento</Button><WazeLink compact destination={known[item.id]?.source === 'manual' ? known[item.id] : { address: item.address }}/>{item.address && <a href={osmSearch(item.address)} target="_blank" rel="noreferrer"><ExternalLink />Buscar no mapa</a>}</div></div>)}{!visits.length && <p className="ops-empty">Os próximos atendimentos cadastrados aparecerão aqui.</p>}</section></div>;
}
