'use client';
import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Clock3, Play, Wrench } from 'lucide-react';
import { dailyWork } from '@/lib/daily-work';

const dateLabel = value => {
    if (!Number.isFinite(new Date(value).getTime())) return 'Sem horário';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
};
const groups = [{ id: 'pending', label: 'Pendentes', icon: Clock3 }, { id: 'active', label: 'Em andamento', icon: Play }, { id: 'next', label: 'Próximos', icon: CalendarDays }];
export function DailyWorkPanel({ data, allowed, onNavigate, onSelect }) {
    const [filter, setFilter] = useState('priority');
    const view = dailyWork(data, allowed);
    const rows = view[filter].slice(0, 4);
    const target = allowed.includes('agenda') ? 'agenda' : 'orders';
    const percent = view.totalToday ? Math.round(view.completedToday / view.totalToday * 100) : 0;
    return <section className="ops-panel daily-work-panel" aria-label="Seu dia de trabalho">
        <header className="daily-work-heading"><div><span className="daily-work-eyebrow"><ClipboardList />FOCO NA OPERAÇÃO</span><h2>Seu dia de trabalho</h2><p>O que está pendente, em andamento e vem a seguir.</p></div><button type="button" className="daily-work-open" onClick={() => onNavigate(target)}>{target === 'agenda' ? 'Abrir agenda' : 'Ver serviços'}<ArrowRight /></button></header>
        <div className="daily-work-counts" aria-label="Filtrar prioridades">{groups.map(({ id, label, icon: Icon }) => <button type="button" key={id} data-kind={id} aria-pressed={filter === id} onClick={() => setFilter(current => current === id ? 'priority' : id)}><span><Icon />{label}</span><strong>{view[id].length}</strong><small>{id === 'pending' ? 'Horário previsto já passou' : id === 'active' ? 'Serviços em execução e visitas em rota' : 'Registros aguardando início'}</small></button>)}</div>
        <div className="daily-work-content"><div className="daily-work-queue"><div className="daily-work-list-heading"><h3>{filter === 'priority' ? 'Próximas ações' : groups.find(group => group.id === filter).label}</h3>{filter !== 'priority' && <button type="button" onClick={() => setFilter('priority')}>Ver todas</button>}</div>{rows.length ? rows.map(item => <button type="button" className="daily-work-row" data-kind={item.group} key={`${item.entity}-${item.record.id}`} onClick={() => onSelect({ entity: item.entity, record: item.record })}><span className="daily-work-icon">{item.entity === 'workOrders' ? <Wrench /> : <CalendarDays />}</span><span className="daily-work-person"><strong>{item.record.clientName || 'Cliente não informado'}</strong><small>{item.title}</small><span>{item.record.technician || 'Técnico não atribuído'} · {dateLabel(item.date)}</span></span><span className="daily-work-state">{item.group === 'active' ? item.entity === 'workOrders' ? 'Em execução' : 'Em rota' : item.group === 'pending' ? 'Pendente' : 'Agendado'}</span><ChevronRight /></button>) : <div className="daily-work-empty"><CheckCircle2 /><strong>{filter === 'priority' ? 'Tudo em dia por aqui' : 'Nenhum registro nesta categoria'}</strong><p>{filter === 'priority' ? 'Novos atendimentos e serviços aparecerão aqui assim que forem cadastrados.' : 'Selecione outra categoria para acompanhar os demais registros.'}</p></div>}</div>
        {allowed.includes('agenda') && <aside className="daily-work-progress"><span><CheckCircle2 />AGENDA DE HOJE</span><strong>{view.completedToday}<small> / {view.totalToday}</small></strong><p>visitas concluídas</p><div role="progressbar" aria-label="Visitas concluídas hoje" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }}/></div><small>{view.totalToday ? `${percent}% da agenda concluída` : 'Nenhuma visita marcada para hoje'}</small><button type="button" onClick={() => onNavigate('agenda')}>Organizar agenda<ArrowRight /></button></aside>}</div>
    </section>;
}
