'use client';
import { PushPreferences } from './push-preferences';
import { useEffect, useRef, useState } from 'react';
import { Bell, Search, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { customerHistory, normalizeSearch, searchWorkspace, workspaceAlerts, workspaceRecords } from '@/lib/workspace-insights';
import { useViewPreferences } from './view-customizer';
const labels = { customers: 'Cliente', crm: 'CRM', quotes: 'Orçamento', agenda: 'Agenda', orders: 'Ordem de serviço', finance: 'Financeiro', inventory: 'Estoque', contracts: 'Contrato', warranties: 'Garantia', team: 'Equipe' };
const date = (value) => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('pt-BR') : 'Data não informada';
export function WorkspaceTools({ data, allowed, scope, organizationId, lowStock, onSelect }) {
    const alertMenu = useRef(null);
    const [panel, setPanel] = useState(null), [query, setQuery] = useState(''), [onlyUnread, setOnlyUnread] = useState(false);
    const [prefs, setPrefs] = useViewPreferences('fama-alerts:' + scope, { read: [] });
    const read = Array.isArray(prefs.read) ? prefs.read : [];
    const alerts = workspaceAlerts(data, allowed, lowStock), unread = alerts.filter(alert => !read.includes(alert.id));
    const results = searchWorkspace(workspaceRecords(data, allowed), query);
    useEffect(() => { function key(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPanel('search');
    } } window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
    function closeAlerts() { if (alertMenu.current)
        alertMenu.current.open = false; }
    useEffect(() => { function escape(event) { if (event.key === 'Escape' && alertMenu.current?.open) {
        closeAlerts();
        alertMenu.current.querySelector('summary')?.focus();
    } } document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, []);
    function select(item) { setPanel(null); closeAlerts(); onSelect(item); }
    return <div className="workspace-utilities">
  <Button type="button" variant="outline" size="sm" className="workspace-search-trigger" onClick={() => { closeAlerts(); setPanel('search'); }} aria-label="Buscar em todo o sistema"><Search /><span>Buscar tudo</span><kbd>Ctrl K</kbd></Button>
  <details ref={alertMenu} className="workspace-alert-menu">
   <summary className="workspace-alert-trigger" title="Abrir ou fechar central de alertas" aria-label={`Central de alertas, ${unread.length} não lidos`}><Bell className="workspace-alert-open-icon" aria-hidden="true"/><X className="workspace-alert-close-icon" aria-hidden="true"/>{unread.length > 0 && <b aria-hidden="true">{unread.length > 99 ? '99+' : unread.length}</b>}</summary>
   <div className="workspace-alert-surface">
    <button type="button" className="workspace-alert-backdrop" aria-label="Fechar central de alertas" onClick={closeAlerts}/>
    <section className="workspace-alert-panel" aria-label="Central de alertas">
     <header><div><h2>Central de alertas</h2><p>Pendências da operação. Marcar como lido não resolve a pendência.</p></div></header>
     <PushPreferences key={organizationId} organizationId={organizationId}/>
     <div className="workspace-alert-actions"><label><input type="checkbox" checked={onlyUnread} onChange={event => setOnlyUnread(event.target.checked)}/>Somente não lidos</label><Button type="button" size="sm" variant="ghost" disabled={!unread.length} onClick={() => setPrefs({ read: alerts.map(alert => alert.id) })}><CheckCheck />Marcar todos como lidos</Button></div>
     <div className="workspace-result-list">{alerts.filter(alert => !onlyUnread || !read.includes(alert.id)).map(alert => <article key={alert.id} className={`workspace-alert ${alert.severity} ${read.includes(alert.id) ? 'read' : ''}`}><button type="button" onClick={() => { setPrefs({ read: [...new Set([...read, alert.id])].slice(-500) }); select(alert.item); }}><small>{alert.title}</small><strong>{alert.item.title}</strong><span>{alert.detail}</span></button><Button type="button" size="sm" variant="ghost" onClick={() => setPrefs({ read: read.includes(alert.id) ? read.filter(id => id !== alert.id) : [...read, alert.id].slice(-500) })}>{read.includes(alert.id) ? 'Marcar não lido' : 'Marcar como lido'}</Button></article>)}{!(onlyUnread ? unread : alerts).length && <p>Nenhum alerta {onlyUnread ? 'não lido' : 'pendente'} agora.</p>}</div>
    </section>
   </div>
  </details>
  <Sheet open={panel !== null} onOpenChange={open => !open && setPanel(null)}><SheetContent className="workspace-tools-sheet"><SheetHeader><SheetTitle>Busca global</SheetTitle><SheetDescription>Pesquise os registros que você pode acessar na empresa atual.</SheetDescription></SheetHeader><Input autoFocus placeholder="Cliente, orçamento, OS, produto…" value={query} onChange={event => setQuery(event.target.value)} aria-label="Pesquisar registros"/><div className="workspace-result-list">{results.map(item => <button type="button" key={item.entity + item.record.id} onClick={() => select(item)}><small>{labels[item.section]}</small><strong>{item.title}</strong><span>{item.detail}</span></button>)}<p role="status">{!query.trim() ? 'Digite para pesquisar.' : !results.length ? 'Nenhum resultado encontrado.' : `${results.length} resultado(s)${results.length === 60 ? ' · refine a busca para encontrar outros registros' : ''}`}</p></div></SheetContent></Sheet>
 </div>;
}
export function CustomerTimeline({ data, customer, allowed, onSelect }) {
    const history = customerHistory(data, customer, allowed);
    const ambiguous = data.customers.filter(c => normalizeSearch(c.name) === normalizeSearch(customer.name)).length > 1;
    return <section className="customer-history"><h3>Histórico do cliente</h3><p>{ambiguous ? 'Há clientes com o mesmo nome. Os registros não foram associados automaticamente.' : 'Registros associados pelo nome do cliente, do mais recente ao mais antigo.'}</p><div className="workspace-result-list">{history.map(item => <button key={item.entity + item.record.id} onClick={() => onSelect(item)}><small>{labels[item.section]} · {date(item.date || '')}</small><strong>{item.title}</strong><span>{item.detail} · {item.record.status}</span></button>)}{!history.length && !ambiguous && <p>Nenhum registro relacionado nas áreas que você pode acessar.</p>}</div></section>;
}
