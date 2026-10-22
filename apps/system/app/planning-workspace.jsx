'use client';
import { useState } from 'react';
import { CalendarDays, CloudSun, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldConditions } from './field-conditions';
import { ConsultationWorkspace } from './consultation-workspace';
import { AgendaWeeklyPlanner } from './agenda-weekly-planner';
import { OperationHolidays } from './operation-holidays';
function monday(day) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
export function PlanningWorkspace({ organizationId, appointments, employees, plan, planFeatures, canConsult, canConfigure, onConfigure, onUpgrade, onOpen, onAgenda }) {
    const [destination, setDestination] = useState(''), [point, setPoint] = useState(null), [mapRequest, setMapRequest] = useState(null);
    const [week, setWeek] = useState(() => monday(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())));
    const shift = (days) => { const d = new Date(week + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); setWeek(d.toISOString().slice(0, 10)); };
    return <div className="planning-workspace">
  <section className="planning-welcome"><div><span>PREPARE A SEMANA</span><h2>Do endereço ao melhor horário</h2><p>Escolha um atendimento ou CEP. Confira o clima, calcule o deslocamento e revise os horários da equipe.</p></div><Button variant="outline" onClick={onAgenda}><CalendarDays />Abrir agenda</Button></section>
  <nav className="planning-shortcuts" aria-label="Ferramentas do planejamento"><a href="#planning-location"><MapPin /><span>Mapas e Waze<small>Endereço, trânsito e apoio</small></span></a><a href="#planning-weather"><CloudSun /><span>Previsão<small>Chuva, vento e temperatura</small></span></a>{canConsult && <a href="#planning-travel"><Navigation /><span>Deslocamento<small>Distância, tempo e frete</small></span></a>}<a href="#planning-week"><CalendarDays /><span>Semana com IA<small>Jornada e disponibilidade</small></span></a></nav>
  <div id="planning-location" className="planning-anchor"><FieldConditions organizationId={organizationId} appointments={appointments} canConfigure={canConfigure} onConfigure={onConfigure || (() => { })} onSelect={onOpen} weatherAnchor="planning-weather" mapRequest={mapRequest} onReferenceChange={setPoint} onDestinationCep={setDestination}/></div>
  <section id="planning-travel" className="planning-anchor">{canConsult ? <ConsultationWorkspace key={organizationId} organizationId={organizationId} plan={plan} planFeatures={planFeatures} mode="travel" presetDestinationCep={destination} onLocateDestination={cep => { setMapRequest(v => ({ cep, revision: (v?.revision ?? 0) + 1 })); document.getElementById('planning-location')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} onConfigure={onConfigure} onUpgrade={onUpgrade}/> : <p className="planning-access-note">O cálculo de deslocamento segue as permissões de consulta da empresa. Peça acesso ao administrador.</p>}</section>
  <section id="planning-week" className="planning-anchor"><header className="planning-week-heading"><div><h2>Organizar a semana</h2><p>O planejamento usa o ponto de referência selecionado acima.</p></div><div><Button variant="outline" size="sm" onClick={() => shift(-7)} aria-label="Semana anterior">←</Button><label>Semana de<input type="date" value={week} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && Number.isFinite(Date.parse(e.target.value + 'T12:00:00Z')))
        setWeek(monday(e.target.value)); }}/></label><Button variant="outline" size="sm" onClick={() => shift(7)} aria-label="Próxima semana">→</Button></div></header><OperationHolidays organizationId={organizationId}/><AgendaWeeklyPlanner organizationId={organizationId} week={week} appointments={appointments} employees={employees} weatherPoint={point ?? undefined} onOpen={onOpen}/></section>
 </div>;
}
