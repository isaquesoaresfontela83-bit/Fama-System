"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Building2, UsersRound, CircleDollarSign, Headphones, TrendingUp, ChartPie, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
const colors = ["#2498ff", "#f6c75f", "#a86bff", "#10d5a0", "#7899c5", "#ff748d"];
const currency = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const shortDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR"); };
const statusLabel = (status) => status === "resolvido" ? "Resolvido" : status === "em_analise" ? "Em análise" : "Aberto";
export function ControlOverview({ companies, tickets, plans, projection, loading, membersAvailable, supportAvailable, plansAvailable, onNavigate }) {
    const [range, setRange] = useState(12);
    const current = companies.filter(company => company.status !== "deleted");
    const active = current.filter(company => company.status === "active");
    const open = tickets.filter(ticket => ticket.status !== "resolvido");
    const recent = [...current].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
    const latestTickets = [...tickets].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)).slice(0, 5);
    const distribution = useMemo(() => {
        const counts = new Map();
        for (const company of companies.filter(item => item.status === "active"))
            counts.set(company.plan || "inicial", (counts.get(company.plan || "inicial") || 0) + 1);
        return [...counts].map(([id, value]) => ({ id, name: plans.find(plan => plan.id === id)?.name || id, value }));
    }, [companies, plans]);
    const evolution = useMemo(() => {
        const now = new Date();
        return Array.from({ length: range }, (_, index) => {
            const start = new Date(now.getFullYear(), now.getMonth() - range + index + 1, 1);
            const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            const visible = companies.filter(company => company.status !== "deleted" && Number.isFinite(Date.parse(company.createdAt)));
            return { month: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: visible.filter(company => Date.parse(company.createdAt) < end.getTime()).length, new: visible.filter(company => Date.parse(company.createdAt) >= start.getTime() && Date.parse(company.createdAt) < end.getTime()).length };
        });
    }, [companies, range]);
    const metrics = [
        { label: "Empresas ativas", value: active.length, detail: `${current.length} empresas cadastradas`, icon: Building2, destination: "companies" },
        { label: "Usuários cadastrados", value: membersAvailable ? current.reduce((sum, company) => sum + company.memberCount, 0) : "—", detail: membersAvailable ? "Equipe das empresas" : "Dados indisponíveis", icon: UsersRound, destination: "companies" },
        { label: "MRR estimado", value: plansAvailable ? currency(projection) : "—", detail: plansAvailable ? "Projeção dos planos atuais" : "Planos indisponíveis", icon: CircleDollarSign, destination: "finance" },
        { label: "Chamados abertos", value: supportAvailable ? open.length : "—", detail: supportAvailable ? `${tickets.length} chamados recebidos` : "Suporte indisponível", icon: Headphones, destination: "support" },
    ];
    return <div className="premium-overview">
    <section className="control-grid premium-metrics" aria-label="Indicadores da plataforma">{metrics.map((metric, index) => <button type="button" key={metric.label} className={`control-metric premium-metric metric-${index}`} onClick={() => onNavigate(metric.destination)}><span><metric.icon /></span><div><small>{metric.label}</small><strong>{loading ? "—" : metric.value}</strong><p>{metric.detail}</p></div></button>)}</section>
    <div className="premium-chart-grid">
      <section className="control-panel premium-evolution"><div className="control-panel-heading"><h2><TrendingUp /> Evolução das empresas</h2><div className="premium-range" aria-label="Período do gráfico">{[3, 6, 12].map(months => <button type="button" key={months} aria-pressed={range === months} onClick={() => setRange(months)}>{months}M</button>)}</div></div>
        {loading ? <div className="premium-chart-empty">Carregando indicadores…</div> : !current.length ? <div className="premium-chart-empty">O gráfico aparecerá quando houver empresas cadastradas.</div> : <><div className="premium-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={evolution} margin={{ top: 16, right: 10, bottom: 8, left: -20 }}><defs><linearGradient id="control-growth-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#21baff" stopOpacity={.28}/><stop offset="100%" stopColor="#21baff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#183751" vertical={false}/><XAxis dataKey="month" tick={{ fill: "#aec9e5", fontSize: 12 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: "#aec9e5", fontSize: 12 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "#0b2442", border: "1px solid #247cba", borderRadius: 10, color: "#edf7ff" }}/><Area type="monotone" dataKey="total" name="Total cadastrado" stroke="#20bfff" strokeWidth={2.5} fill="url(#control-growth-blue)" dot={{ r: 3, fill: "#20bfff" }}/><Area type="monotone" dataKey="new" name="Novas no mês" stroke="#f5cc62" strokeWidth={2} fill="transparent" dot={{ r: 3, fill: "#f5cc62" }}/></AreaChart></ResponsiveContainer></div><div className="premium-legend"><span><i style={{ background: colors[0] }}/>Total cadastrado</span><span><i style={{ background: colors[1] }}/>Novas no mês</span></div></>}
        <p className="premium-chart-note">Evolução por data de cadastro das empresas atuais.</p>
      </section>
      <section className="control-panel premium-plans"><div className="control-panel-heading"><h2><ChartPie /> Distribuição dos planos</h2></div>{loading ? <div className="premium-chart-empty">Carregando planos…</div> : !active.length ? <div className="premium-chart-empty">Nenhuma empresa ativa no momento.</div> : <div className="premium-donut-layout"><div className="premium-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="90%" paddingAngle={2} stroke="#08213a">{distribution.map((item, index) => <Cell key={item.id} fill={colors[index % colors.length]}/>)}</Pie><Tooltip contentStyle={{ background: "#0b2442", border: "1px solid #247cba", borderRadius: 10, color: "#edf7ff" }}/></PieChart></ResponsiveContainer><div className="premium-donut-total"><strong>{active.length}</strong><small>empresas</small></div></div><div className="premium-plan-legend">{distribution.map((item, index) => <div key={item.id}><i style={{ background: colors[index % colors.length] }}/><span>{item.name}</span><strong>{item.value}</strong><small>{Math.round(item.value / active.length * 100)}%</small></div>)}</div></div>}</section>
    </div>
    <div className="premium-chart-grid premium-bottom-grid">
      <section className="control-panel"><div className="control-panel-heading"><h2><Building2 /> Empresas recentes</h2><Button size="sm" variant="outline" onClick={() => onNavigate("companies")}>Ver todas</Button></div><div className="control-table-wrap"><table className="premium-company-table"><thead><tr><th>Empresa</th><th>Plano</th><th>Usuários</th><th>Status</th><th>Cadastro</th></tr></thead><tbody>{recent.map((company, index) => <tr key={company.id}><td><span className={`premium-company-icon company-color-${index % 4}`}>{company.name.slice(0, 1).toUpperCase()}</span><strong>{company.name}</strong></td><td><span className={`premium-plan-badge company-color-${index % 4}`}>{plans.find(plan => plan.id === company.plan)?.name || company.plan || "Inicial"}</span></td><td>{company.memberCount}</td><td><span className={`premium-status ${company.status === "active" ? "is-active" : "is-blocked"}`}>{company.status === "active" ? "Ativa" : "Bloqueada"}</span></td><td>{shortDate(company.createdAt)}</td></tr>)}</tbody></table></div>{!recent.length && <p className="control-empty">{loading ? "Carregando empresas…" : "Nenhuma empresa cadastrada ainda."}</p>}</section>
      <section className="control-panel"><div className="control-panel-heading"><h2><Headphones /> Atividade de suporte</h2><Button size="sm" variant="outline" onClick={() => onNavigate("support")}>Ver todos</Button></div><div className="premium-support-timeline">{latestTickets.map(ticket => <button type="button" key={ticket.id} onClick={() => onNavigate("support")} className={`premium-support-item ticket-${ticket.status}`}><span className="premium-support-icon"><MessageCircle /></span><div><strong>{ticket.title}</strong><small>{ticket.organizationName || "Empresa"}</small></div><span className="premium-ticket-status">{statusLabel(ticket.status)}</span><time>{shortDate(ticket.updatedAt || ticket.createdAt)}</time></button>)}</div>{!latestTickets.length && <p className="control-empty">{loading ? "Carregando suporte…" : supportAvailable ? "Nenhum chamado recebido ainda." : "Não foi possível carregar o suporte."}</p>}</section>
    </div>
  </div>;
}
