'use client';
import { ViewCustomizer, useViewPreferences } from './view-customizer';
import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, ArrowRight, CalendarDays, Table2, RotateCcw, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { chartModels, dateKey } from '@/lib/general-management';
import { analyticsSections, moduleCharts } from '@/lib/module-analytics';
import { useModuleAnalytics } from '@/hooks/use-module-analytics';
const colors = ['#3297e4', '#edb23e', '#24b99a', '#9270e8', '#f27872', '#30bdd4', '#dd79bb', '#78b942', '#f29148', '#5572c4'];
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
const number = (value) => new Intl.NumberFormat('pt-BR').format(value);
function Plot({ chart, model }) {
    if (chart.state === 'loading') return <div className="management-chart-state" role="status">Carregando os dados do gráfico…</div>;
    if (chart.state === 'error') return <div className="management-chart-state" role="status">{chart.error}</div>;
    if (chart.points.some(point => point.value < 0) && ['pie', 'donut', 'radar'].includes(model)) model = 'columns';
    const format = (value) => chart.unit === 'money' ? money(value) : number(value);
    const tooltip = <Tooltip formatter={value => [format(Number(value) || 0), chart.unit === 'money' ? 'Valor' : 'Quantidade']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--foreground)' }} labelStyle={{ color: 'var(--foreground)' }} itemStyle={{ color: 'var(--foreground)' }}/>;
    const cells = chart.points.map((point, index) => <Cell key={point.name} fill={colors[index % colors.length]}/>);
    const grid = <CartesianGrid stroke="var(--border)" vertical={false}/>;
    const x = <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>;
    const y = <YAxis allowDecimals={chart.unit === 'money'} tickFormatter={value => chart.unit === 'money' ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) / 100) : number(Number(value))} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={55} tickLine={false} axisLine={false}/>;
    if (!chart.points.some(point => point.value !== 0))
        return <div className="management-empty">Nenhum valor disponível para este recorte.</div>;
    let view;
    if (model === 'pie' || model === 'donut')
        view = <PieChart>{tooltip}<Pie data={chart.points} dataKey="value" nameKey="name" outerRadius="82%" innerRadius={model === 'donut' ? '52%' : 0} paddingAngle={3} stroke="var(--card)" isAnimationActive={false}>{cells}</Pie></PieChart>;
    else if (model === 'radar')
        view = <RadarChart data={chart.points} outerRadius="70%"><PolarGrid stroke="var(--border)"/><PolarAngleAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}/>{tooltip}<Radar dataKey="value" stroke="#9270e8" fill="#9270e8" fillOpacity={.3} isAnimationActive={false}/></RadarChart>;
    else if (model === 'bars')
        view = <BarChart data={chart.points} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}><CartesianGrid stroke="var(--border)" horizontal={false}/><XAxis type="number" allowDecimals={chart.unit === 'money'} tickFormatter={value => chart.unit === 'money' ? new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(Number(value) / 100) : number(Number(value))} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}/><YAxis type="category" dataKey="name" width={115} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false}/>{tooltip}<Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive={false}>{cells}</Bar></BarChart>;
    else if (model === 'line')
        view = <LineChart data={chart.points} margin={{ right: 12, top: 12 }}>{grid}{x}{y}{tooltip}<Line type="linear" dataKey="value" stroke="#3297e4" strokeWidth={3} dot={{ fill: '#edb23e', stroke: '#fff', r: 4 }} isAnimationActive={false}/></LineChart>;
    else if (model === 'area')
        view = <AreaChart data={chart.points} margin={{ right: 12, top: 12 }}>{grid}{x}{y}{tooltip}<Area type="linear" dataKey="value" stroke="#24b99a" fill="#24b99a" fillOpacity={.18} strokeWidth={3} isAnimationActive={false}/></AreaChart>;
    else
        view = <BarChart data={chart.points} margin={{ right: 12, top: 12 }}>{grid}{x}{y}{tooltip}<Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42} isAnimationActive={false}>{cells}</Bar></BarChart>;
    return <div className="management-plot"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 400, height: 300 }}>{view}</ResponsiveContainer></div>;
}
export function ChartCard({ chart, model, onModel, onNavigate }) {
    const [table, setTable] = useState(false);
    return <section className="surface management-chart-card"><header><div><span className="management-chart-kicker">{chart.unit === 'money' ? 'Valores em reais' : 'Quantidades'}</span><h2>{chart.title}</h2></div><NativeSelect value={model} onChange={event => onModel(event.target.value)} aria-label={`Modelo de gráfico: ${chart.title}`}>{chartModels.map(option => <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>)}</NativeSelect></header><Plot chart={chart} model={model}/><div className="management-legend">{chart.points.map((point, index) => <span key={point.name}><i style={{ background: colors[index % colors.length] }}/>{point.name}<strong>{chart.unit === 'money' ? money(point.value) : number(point.value)}</strong></span>)}</div><p className="management-chart-note">{chart.note}</p><footer><Button variant="ghost" size="sm" onClick={() => setTable(!table)} aria-expanded={table}><Table2 />{table ? 'Ocultar dados' : 'Ver dados'}</Button><Button variant="ghost" size="sm" onClick={onNavigate}>Abrir módulo<ArrowRight /></Button></footer>{table && <div className="management-data"><table><caption className="sr-only">Dados de {chart.title}</caption><thead><tr><th scope="col">Categoria</th><th scope="col">{chart.unit === 'money' ? 'Valor' : 'Quantidade'}</th></tr></thead><tbody>{chart.points.map(point => <tr key={point.name}><th scope="row">{point.name}</th><td>{chart.unit === 'money' ? money(point.value) : number(point.value)}</td></tr>)}</tbody></table></div>}</section>;
}
export function GeneralManagement({ data, scope, organizationId, allowed, onNavigate, lowStockAlert, section = 'management' }) {
    const { context, refresh, loading } = useModuleAnalytics({ organizationId, scope, section, allowed });
    const [search, setSearch] = useState('');
    const today = dateKey(new Date().toISOString());
    const [from, setFrom] = useState(today.slice(0, 7) + '-01'), [to, setTo] = useState(today), [period, setPeriod] = useState('month');
    const [models, setModels] = useState({}), [ready, setReady] = useState(false), [group, setGroup] = useState('all');
    useEffect(() => { try {
        const raw = JSON.parse(localStorage.getItem('fama-management:' + scope) || '{}');
        if (raw && typeof raw === 'object' && !Array.isArray(raw))
            setModels(Object.fromEntries(Object.entries(raw).filter(([key, value]) => /^[a-z-]{1,40}$/.test(key) && chartModels.some(model => model.id === value))));
    }
    catch { } setReady(true); }, [scope]);
    useEffect(() => { if (ready)
        try {
            localStorage.setItem('fama-management:' + scope, JSON.stringify(models));
        }
        catch { } }, [models, ready, scope]);
    const [favorites, setFavorites] = useViewPreferences('fama-filter:' + scope, {});
    const invalid = Boolean(from && to && from > to);
    const allCharts = invalid ? [] : moduleCharts(data, from, to, allowed, lowStockAlert, context);
    const matches = chart => (group === 'all' || chart.section === group) && (chart.title + ' ' + analyticsSections[chart.section]).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim());
    const charts = allCharts.filter(matches);
    function changePeriod(value) { setPeriod(value); if (value === 'all') {
        setFrom('');
        setTo('');
    }
    else if (value === 'year') {
        setFrom(today.slice(0, 4) + '-01-01');
        setTo(today);
    }
    else if (value === 'month') {
        setFrom(today.slice(0, 7) + '-01');
        setTo(today);
    }
    else if (value === '30') {
        const end = new Date(today + 'T12:00:00Z');
        end.setUTCDate(end.getUTCDate() - 29);
        setFrom(end.toISOString().slice(0, 10));
        setTo(today);
    } }
    const groupLabels = analyticsSections;
    return <div className="management-workspace">
        <section className="surface management-toolbar">
            <div className="management-toolbar-title"><BarChart3 /><div><strong>{section === 'charts' ? 'Todos os gráficos da empresa' : 'Seu painel, seu estilo'}</strong><p>Filtre por área e período, escolha o formato e confira os valores em tabela.</p></div></div>
            <div className="management-filters management-primary-filters">
                <label className="management-search">Buscar gráfico<Input type="search" aria-label="Buscar gráfico" placeholder="Ex.: serviços, estoque, receitas" value={search} onChange={event => setSearch(event.target.value)}/></label>
                <label>Período<NativeSelect aria-label="Período dos gráficos" value={period} onChange={event => changePeriod(event.target.value)}><NativeSelectOption value="month">Este mês até hoje</NativeSelectOption><NativeSelectOption value="30">Últimos 30 dias</NativeSelectOption><NativeSelectOption value="year">Este ano</NativeSelectOption><NativeSelectOption value="all">Todo o histórico</NativeSelectOption><NativeSelectOption value="custom">Personalizado</NativeSelectOption></NativeSelect></label>
                <label>Área<NativeSelect aria-label="Área dos gráficos" value={group} onChange={event => setGroup(event.target.value)}><NativeSelectOption value="all">Todas as áreas</NativeSelectOption>{Object.entries(groupLabels).filter(([target]) => allowed.includes(target)).map(([target, label]) => <NativeSelectOption key={target} value={target}>{label}</NativeSelectOption>)}</NativeSelect></label>
            </div>
            <details className="management-advanced" open={period === 'custom' ? true : undefined}><summary>Ajustar datas e modelos</summary>
                <div className="management-filters">
                    <label>De<Input type="date" aria-label="Data inicial dos gráficos" value={from} onChange={event => { setPeriod('custom'); setFrom(event.target.value); }}/></label>
                    <label>Até<Input type="date" aria-label="Data final dos gráficos" value={to} onChange={event => { setPeriod('custom'); setTo(event.target.value); }}/></label>
                    <label>Aplicar modelo a todos<NativeSelect aria-label="Aplicar modelo a todos os gráficos" value="" onChange={event => { if (chartModels.some(model => model.id === event.target.value)) setModels(Object.fromEntries(allCharts.map(chart => [chart.id, event.target.value]))); }}><NativeSelectOption value="" disabled>Escolher modelo</NativeSelectOption>{chartModels.map(option => <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>)}</NativeSelect></label>
                    <Button variant="outline" size="sm" disabled={invalid} onClick={() => setFavorites({ filter: { from, to, period, group } })}>Salvar filtro favorito</Button>
                    {favorites.filter && <Button variant="outline" size="sm" onClick={() => { const f = favorites.filter; if (typeof f.from !== 'string' || typeof f.to !== 'string' || (!/^\d{4}-\d{2}-\d{2}$/.test(f.from) && f.from !== '') || (!/^\d{4}-\d{2}-\d{2}$/.test(f.to) && f.to !== '')) return; setFrom(f.from); setTo(f.to); setPeriod('custom'); setGroup(allowed.includes(f.group) ? f.group : 'all'); }}>Carregar filtro favorito</Button>}
                    <Button variant="outline" size="sm" onClick={() => setModels({})}><RotateCcw />Restaurar modelos</Button>
                </div>
            </details>
            {invalid && <p role="alert">A data inicial deve ser anterior ou igual à data final.</p>}
        </section>
        <div className="management-context"><span><CalendarDays />Dados e permissões da empresa atual.</span><span>{charts.length} gráficos disponíveis</span><Button variant="outline" size="sm" disabled={loading} onClick={refresh}><RefreshCw />Atualizar gráficos</Button></div>
        <ViewCustomizer scope={scope + ':' + section} itemIds={allCharts.map(chart => chart.id)} labels={allCharts.map(chart => chart.title)} enabled={allCharts.map(matches)} className="management-chart-grid">{allCharts.map(chart => <ChartCard key={chart.id} chart={chart} model={models[chart.id] ?? chart.model} onModel={model => setModels(current => ({ ...current, [chart.id]: model }))} onNavigate={() => onNavigate(chart.section)}/>)}</ViewCustomizer>
        {!charts.length && !invalid && <div className="surface management-empty">Nenhum gráfico corresponde aos filtros ou às permissões atuais.</div>}
    </div>;
}
