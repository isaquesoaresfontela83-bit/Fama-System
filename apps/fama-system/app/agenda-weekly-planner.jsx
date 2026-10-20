'use client';
import { useEffect, useRef, useState } from 'react';
import { AgendaGoogleCalendar } from './agenda-google-calendar';
import { readConfirmedPoint } from '@/lib/confirmed-map-point';
import { Button } from '@/components/ui/button';
const minutes = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
const clock = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
const date = (v) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export function AgendaWeeklyPlanner({ organizationId, week, appointments, employees, onOpen, weatherPoint: currentWeatherPoint }) {
    const [googleBusy, setGoogleBusy] = useState(null);
    const [jobs, setJobs] = useState({}), [rules, setRules] = useState({ start: 480, end: 1080, lunchStart: 720, lunchEnd: 780, buffer: 15, fixedDuration: 60, fixedTravel: 30 }), [proposal, setProposal] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const controller = useRef(null);
    const signature = appointments.map(a => `${a.id}:${a.startAt}:${a.status}:${a.technician}`).sort().join('|');
    useEffect(() => { setProposal(null); setError(''); setBusy(false); controller.current?.abort(); return () => controller.current?.abort(); }, [organizationId, week, signature, googleBusy, currentWeatherPoint?.latitude, currentWeatherPoint?.longitude]);
    const eligible = appointments.filter(a => ['agendado', 'remarcado'].includes(a.status) && employees.some(e => e.active && e.name === a.technician));
    function changeRule(key, value) { setRules(v => ({ ...v, [key]: value })); setProposal(null); }
    function changeJob(id, key, value) { setJobs(v => ({ ...v, [id]: { ...v[id], [key]: value } })); setProposal(null); }
    async function generate() {
        controller.current?.abort();
        const abort = new AbortController();
        controller.current = abort;
        setBusy(true);
        setError('');
        setProposal(null);
        try {
            const selected = Object.values(jobs).filter(j => eligible.some(a => a.id === j.id));
            if (!selected.length)
                throw new Error('Selecione pelo menos um atendimento que pode mudar de horário.');
            const point = currentWeatherPoint ?? readConfirmedPoint(globalThis.localStorage, organizationId);
            const weatherPoint = point ? { latitude: point.latitude, longitude: point.longitude } : undefined;
            const response = await fetch('/api/agenda/weekly-plan', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ ...rules, week, jobs: selected, ...(weatherPoint ? { weatherPoint } : {}), ...(googleBusy && googleBusy.week === week && Date.now() - googleBusy.checkedAt < 300000 ? { googleBusy } : {}) }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60000)]) });
            const value = await response.json();
            if (!response.ok)
                throw new Error(value.error || 'Não foi possível gerar a proposta.');
            if (!abort.signal.aborted)
                setProposal(value);
        }
        catch (e) {
            if (!abort.signal.aborted)
                setError(e.message);
        }
        finally {
            if (!abort.signal.aborted)
                setBusy(false);
        }
    }
    return <><AgendaGoogleCalendar organizationId={organizationId} week={week} appointments={appointments} employees={employees} onBusy={setGoogleBusy}/><details className="agenda-planner"><summary><span>Planejar semana com IA</span><small>Proposta revisável · duração, deslocamento e clima</small></summary><div className="agenda-planner-body">
  <p>Semana de {week.split('-').reverse().join('/')} · segunda a sexta · horário de Brasília. Selecione apenas os atendimentos autorizados a mudar. Nenhum horário é alterado ao gerar a proposta.</p>
  <fieldset disabled={busy}><legend>Jornada e margens desta proposta</legend><div className="agenda-planner-fields">
   {[['start', 'Início da jornada'], ['end', 'Fim da jornada'], ['lunchStart', 'Início do almoço'], ['lunchEnd', 'Fim do almoço']].map(([key, label]) => <label key={key}>{label}<input type="time" value={clock(rules[key])} onChange={e => changeRule(key, minutes(e.target.value))}/></label>)}
   {[['buffer', 'Margem após cada serviço (min)', 0, 120], ['fixedDuration', 'Duração dos compromissos fixos (min)', 15, 480], ['fixedTravel', 'Deslocamento antes dos fixos (min)', 0, 180]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={rules[key]} onChange={e => changeRule(key, Number(e.target.value))}/></label>)}
  </div><p className="agenda-planner-note">Por enquanto, deslocamentos são informados manualmente. A IA explica a proposta quando disponível; as regras conferem os horários. Previsão indisponível ou fora do período fica sinalizada.</p></fieldset>
  <fieldset disabled={busy}><legend>Atendimentos que podem mudar · até 25</legend><div className="agenda-planner-jobs">{eligible.map(a => <article key={a.id}><label className="agenda-planner-select"><input type="checkbox" checked={!!jobs[a.id]} disabled={!jobs[a.id] && Object.keys(jobs).length >= 25} onChange={e => { setProposal(null); setJobs(v => { const next = { ...v }; if (e.target.checked)
        next[a.id] = { id: a.id, duration: 60, travel: 30, outdoor: true, earliest: 480, latest: 1080, priority: 2 };
    else
        delete next[a.id]; return next; }); }}/><span><strong>{a.title}</strong><small>{a.clientName} · {a.technician} · atual: {date(a.startAt)}</small></span></label>{jobs[a.id] && <div className="agenda-planner-fields"><label>Execução (min)<input type="number" min="15" max="480" value={jobs[a.id].duration} onChange={e => changeJob(a.id, 'duration', Number(e.target.value))}/></label><label>Deslocamento anterior (min)<input type="number" min="0" max="180" value={jobs[a.id].travel} onChange={e => changeJob(a.id, 'travel', Number(e.target.value))}/></label><label>Cliente disponível a partir de<input type="time" value={clock(jobs[a.id].earliest)} onChange={e => changeJob(a.id, 'earliest', minutes(e.target.value))}/></label><label>Cliente disponível até<input type="time" value={clock(jobs[a.id].latest)} onChange={e => changeJob(a.id, 'latest', minutes(e.target.value))}/></label><label>Prioridade<select value={jobs[a.id].priority} onChange={e => changeJob(a.id, 'priority', Number(e.target.value))}><option value="1">Normal</option><option value="2">Preferencial</option><option value="3">Urgente</option></select></label><label>Ambiente<select value={jobs[a.id].outdoor ? 'external' : 'internal'} onChange={e => changeJob(a.id, 'outdoor', e.target.value === 'external')}><option value="external">Externo · evitar risco climático</option><option value="internal">Interno</option></select></label></div>}</article>)}{!eligible.length && <p>Cadastre atendimentos com técnico definido para começar.</p>}</div></fieldset>
  <Button type="button" disabled={busy || !Object.keys(jobs).length} onClick={() => void generate()}>{busy ? 'Analisando os horários…' : 'Gerar proposta da semana'}</Button>{error && <p role="alert">{error}</p>}
  {proposal && <section className="agenda-planner-proposal" aria-live="polite"><h3>{proposal.suggestions.length} sugestão(ões) · {proposal.unplaced.length} sem encaixe</h3><small>{proposal.engine === 'cloudflare' ? 'Análise com IA Cloudflare' : 'Planejamento por regras · IA generativa indisponível ou não habilitada neste plano'}</small>{proposal.narrative && <p>{proposal.narrative}</p>}<ul>{proposal.warnings.map(w => <li key={w}>{w}</li>)}</ul>{proposal.weatherReference && <p>Referência climática: {proposal.weatherReference}</p>}{proposal.suggestions.map(s => { const a = appointments.find(a => a.id === s.id); return <article key={s.id}><strong>{a?.title} · {a?.clientName}</strong><b>{date(s.startAt)} → {new Date(s.endAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</b><span>{s.technician} · {s.duration} min de serviço · {s.travel} min de deslocamento</span>{s.reasons.map(r => <small key={r}>{r}</small>)}{a && <Button type="button" size="sm" variant="outline" onClick={() => onOpen(a)}>Abrir atendimento para revisar</Button>}</article>; })}{proposal.unplaced.map(s => <article key={s.id}><strong>{appointments.find(a => a.id === s.id)?.title || 'Atendimento indisponível'}</strong><span>{s.reason}</span></article>)}<p>Nesta primeira versão, confira a sugestão e reagende no atendimento. A proposta não aplica mudanças em lote.</p></section>}
 </div></details></>;
}
