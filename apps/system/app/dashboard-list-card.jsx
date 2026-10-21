import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function DashboardListCard({ title, icon: Icon, summary, rows, empty, onOpen, style }) {
    return <section className="surface dashboard-list-card" style={style}>
    <div className="panel-heading"><h2><Icon />{title}</h2><Button variant="ghost" size="icon-sm" onClick={onOpen} title={'Abrir ' + title} aria-label={'Abrir ' + title}><ArrowUpRight /></Button></div>
    {summary && <strong className="dashboard-list-total">{summary}</strong>}
    <div className="dashboard-list-rows">{rows.slice(0, 5).map(row => <button type="button" key={row.id} onClick={row.onSelect || onOpen}><span><strong>{row.label}</strong>{row.detail && <small>{row.detail}</small>}</span><b className={row.warning ? 'dashboard-row-warning' : ''}>{row.value}</b></button>)}</div>
    {!rows.length && <p className="dashboard-card-empty">{empty}</p>}
  </section>;
}
