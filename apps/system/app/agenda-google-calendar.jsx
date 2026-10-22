'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { appointmentEvent, calendarEventId, calendarIcs, calendarWeek, GOOGLE_CALENDAR_SCOPES, readGoogleBusy } from '@/lib/google-calendar';
let scriptLoading = null;
function loadGoogle() { if (window.google?.accounts.oauth2)
    return Promise.resolve(); return scriptLoading ??= new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = () => resolve(); script.onerror = () => { script.remove(); scriptLoading = null; reject(new Error('Não foi possível carregar a conexão Google.')); }; document.head.appendChild(script); }); }
export function AgendaGoogleCalendar({ organizationId, week, appointments, employees, onBusy }) {
    const [clientId, setClientId] = useState(''), [configured, setConfigured] = useState(null), [scriptReady, setScriptReady] = useState(false), [connected, setConnected] = useState(false), [working, setWorking] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [technician, setTechnician] = useState(''), [selected, setSelected] = useState([]), [duration, setDuration] = useState(60);
    const token = useRef({ value: '', expires: 0 }), alive = useRef(true), revision = useRef(0), timer = useRef(null);
    useEffect(() => {
        alive.current = true;
        const rev = ++revision.current, abort = new AbortController();
        setConfigured(null);
        setClientId('');
        setConnected(false);
        setNotice('');
        setError('');
        token.current = { value: '', expires: 0 };
        fetch('/api/agenda/google-calendar', { headers: { 'x-organization-id': organizationId }, signal: abort.signal }).then(async (r) => { const v = await r.json(); if (!r.ok)
            throw new Error(v.error || 'Integração indisponível.'); if (abort.signal.aborted)
            return; setConfigured(v.configured); setClientId(v.clientId || ''); if (v.configured) {
            await loadGoogle();
            if (!abort.signal.aborted)
                setScriptReady(true);
        } }).catch(e => { if (!abort.signal.aborted)
            setError(e.message); });
        return () => { alive.current = false; revision.current++; abort.abort(); if (timer.current)
            clearTimeout(timer.current); token.current = { value: '', expires: 0 }; };
    }, [organizationId]);
    useEffect(() => { revision.current++; setWorking(false); onBusy(null); setNotice(''); setSelected([]); }, [organizationId, week, technician]);
    const candidates = appointments.filter(a => !['cancelado', 'concluido'].includes(a.status) && (!technician || a.technician === technician) && Date.parse(appointmentStart(a.startAt)) >= Date.parse(calendarWeek(week).timeMin) && Date.parse(appointmentStart(a.startAt)) < Date.parse(calendarWeek(week).timeMax));
    function access() { if (!token.current.value || Date.now() >= token.current.expires) {
        setConnected(false);
        onBusy(null);
        throw new Error('Conecte sua conta Google novamente.');
    } return token.current.value; }
    function connect() { if (timer.current)
        clearTimeout(timer.current); onBusy(null); token.current = { value: '', expires: 0 }; setConnected(false); setError(''); const rev = revision.current; const api = window.google?.accounts.oauth2; if (!api || !clientId)
        return; api.initTokenClient({ client_id: clientId, scope: GOOGLE_CALENDAR_SCOPES, include_granted_scopes: false, callback: (v) => { if (!alive.current || rev !== revision.current)
            return; if (v.error || !v.access_token) {
            setError('A conexão não foi autorizada no Google.');
            return;
        } const granted = String(v.scope || '').split(' '); if (!GOOGLE_CALENDAR_SCOPES.split(' ').every(s => granted.includes(s))) {
            setError('Autorize a consulta de disponibilidade e os eventos da sua agenda para continuar.');
            return;
        } token.current = { value: v.access_token, expires: Date.now() + Math.max(0, Number(v.expires_in || 0) - 60) * 1000 }; setConnected(true); setNotice('Conta conectada nesta sessão. Selecione o técnico correspondente a essa conta Google.'); }, error_callback: () => { if (alive.current && rev === revision.current)
            setError('A janela Google foi fechada ou bloqueada. Tente novamente.'); } }).requestAccessToken({ prompt: 'select_account' }); }
    async function google(path, body, method = 'POST') { const r = await fetch('https://www.googleapis.com/calendar/v3/' + path, { method, headers: { Authorization: 'Bearer ' + access(), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }); if (r.status === 401) {
        token.current = { value: '', expires: 0 };
        setConnected(false);
        onBusy(null);
    } return r; }
    async function readBusy() { const rev = revision.current; setWorking(true); setError(''); setNotice(''); onBusy(null); try {
        if (!technician)
            throw new Error('Selecione o técnico dono desta conta Google.');
        const r = await google('freeBusy', { ...calendarWeek(week), items: [{ id: 'primary' }] });
        if (!r.ok)
            throw new Error('O Google não liberou a disponibilidade. Reconecte a conta ou tente mais tarde.');
        const v = readGoogleBusy(await r.json(), week, technician);
        if (!alive.current || rev !== revision.current)
            return;
        onBusy(v);
        setNotice(`${v.intervals.length} período(s) ocupado(s) consultado(s). Serão respeitados apenas para ${technician}; consulta válida por 5 minutos.`);
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => { onBusy(null); setNotice('Consulte novamente os horários do Google antes de gerar outra proposta.'); }, 300000);
    }
    catch (e) {
        if (alive.current && rev === revision.current)
            setError(e.message);
    }
    finally {
        if (alive.current && rev === revision.current)
            setWorking(false);
    } }
    async function send() { const rev = revision.current; setWorking(true); setError(''); setNotice(''); let sent = 0; try {
        const items = candidates.filter(a => selected.includes(a.id));
        if (!items.length || items.length > 20)
            throw new Error('Selecione de 1 a 20 atendimentos.');
        for (const a of items) {
            if (!alive.current || rev !== revision.current)
                return;
            const id = await calendarEventId(organizationId, a.id), event = appointmentEvent(a, duration);
            if (!alive.current || rev !== revision.current)
                return;
            let r = await google('calendars/primary/events?sendUpdates=none', { id, ...event });
            if (r.status === 409)
                r = await google('calendars/primary/events/' + id + '?sendUpdates=none', event, 'PATCH');
            if (!r.ok)
                throw new Error('Não foi possível enviar o próximo atendimento. Confira o Google antes de repetir.');
            sent++;
        }
        if (alive.current && rev === revision.current)
            setNotice(`${sent} atendimento(s) enviado(s)/atualizado(s) na agenda principal da conta conectada. Não foram enviados convites.`);
    }
    catch (e) {
        if (alive.current && rev === revision.current)
            setError(`${sent} enviado(s). ${e.message}`);
    }
    finally {
        if (alive.current && rev === revision.current) {
            onBusy(null);
            setWorking(false);
        }
    } }
    function download() { try {
        const items = candidates.filter(a => selected.includes(a.id));
        if (!items.length)
            throw new Error('Selecione os atendimentos para exportar.');
        const url = URL.createObjectURL(new Blob([calendarIcs(items, organizationId, duration)], { type: 'text/calendar;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fama-agenda-' + week + '.ics';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    catch (e) {
        setError(e.message);
    } }
    return <details className="agenda-planner calendar-integration"><summary><span>Google Calendar</span><small>Disponibilidade e envio de atendimentos</small></summary><div className="agenda-planner-body"><p>Conecte sua conta para consultar os horários ocupados e enviar os atendimentos selecionados à sua agenda principal. A conexão vale somente nesta sessão.</p>{configured === false && <p role="status">A conexão direta aguarda a configuração Google pelo administrador do Fama. Você já pode baixar os atendimentos em .ics e importá-los no Google Calendar.</p>}<div className="integration-fields"><label>Conta Google corresponde ao técnico<select disabled={working} value={technician} onChange={e => { revision.current++; setWorking(false); setTechnician(e.target.value); }}><option value="">Selecione o técnico</option>{employees.filter(e => e.active).map(e => <option key={e.id} value={e.name}>{e.name}</option>)}</select></label><Button disabled={!configured || !scriptReady || working} onClick={connect}>{connected ? 'Trocar conta Google' : 'Conectar Google'}</Button>{connected && <Button variant="outline" disabled={working} onClick={() => { revision.current++; if (timer.current)
        clearTimeout(timer.current); token.current = { value: '', expires: 0 }; setConnected(false); onBusy(null); setNotice('Conexão encerrada neste dispositivo.'); }}>Desconectar</Button>}<Button disabled={!connected || !technician || working} variant="outline" onClick={() => void readBusy()}>{working ? 'Aguarde…' : 'Consultar horários ocupados'}</Button></div><p>Selecione apenas os atendimentos que deseja compartilhar com o Google. Nome do cliente, título, endereço e técnico serão incluídos. Enviar novamente atualiza o mesmo evento. Cancelamentos e exclusões no Fama precisam ser conferidos no Google.</p><div className="calendar-choices">{candidates.map(a => <label key={a.id}><input disabled={working || (!selected.includes(a.id) && selected.length >= 20)} type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(v => e.target.checked ? [...v, a.id] : v.filter(id => id !== a.id))}/><span><strong>{a.title} · {a.clientName}</strong><small>{new Date(appointmentStart(a.startAt)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {a.technician}</small></span></label>)}{!candidates.length && <p>Nenhum atendimento disponível nesta semana e filtro.</p>}</div><div className="integration-fields"><label>Duração de cada evento (min)<input disabled={working} type="number" min="15" max="480" value={duration} onChange={e => setDuration(Number(e.target.value))}/></label><Button disabled={!connected || working || !selected.length} onClick={() => void send()}>Enviar/atualizar {selected.length || ''} no Google</Button><Button disabled={working || !selected.length} variant="outline" onClick={download}>Baixar .ics</Button></div>{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}<small>A disponibilidade consultada é apenas da agenda principal da conta escolhida. Não representa a agenda de toda a equipe. Tokens não são salvos no navegador nem no servidor.</small></div></details>;
}
function appointmentStart(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ? s + '-03:00' : s; }
