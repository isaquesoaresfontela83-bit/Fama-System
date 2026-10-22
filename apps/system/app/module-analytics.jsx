'use client';
import { useState } from 'react';
import { ArrowRight, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { dateKey } from '@/lib/general-management';
import { chartsForSection, moduleCharts } from '@/lib/module-analytics';
import { useModuleAnalytics } from '@/hooks/use-module-analytics';
import { ChartCard } from './general-management';

export function ModuleAnalytics({ section, financeTab, data, allowed, organizationId, scope, lowStockAlert, onNavigate }) {
    const [period, setPeriod] = useState('month');
    const [models, setModels] = useState({});
    const { context, refresh, loading } = useModuleAnalytics({ section, allowed, organizationId, scope });
    const today = dateKey(new Date().toISOString());
    const from = period === 'month' ? today.slice(0, 7) + '-01' : '';
    const charts = chartsForSection(moduleCharts(data, from, period === 'month' ? today : '', allowed, lowStockAlert, context), section, financeTab);
    if (!charts.length) return null;
    return <section className={`module-analytics ${section === 'dashboard' ? 'home-analytics' : ''}`} aria-label="Gráficos do módulo">
        <header className="module-analytics-heading"><div><span className="management-chart-kicker"><BarChart3 />Indicadores da empresa</span><h2>{section === 'dashboard' ? 'Sua operação em gráficos' : 'Acompanhe os números'}</h2><p>Dados da empresa atual, conforme as suas permissões.</p></div><div className="module-analytics-actions"><NativeSelect aria-label="Período dos gráficos do módulo" value={period} onChange={event => setPeriod(event.target.value)}><NativeSelectOption value="month">Este mês até hoje</NativeSelectOption><NativeSelectOption value="all">Todo o histórico</NativeSelectOption></NativeSelect>{Object.keys(context).length > 0 && <Button variant="outline" size="sm" disabled={loading} onClick={refresh}><RefreshCw />Atualizar gráficos</Button>}{allowed.includes('charts') && <Button variant="outline" size="sm" onClick={() => onNavigate('charts')}>Todos os gráficos<ArrowRight /></Button>}</div></header>
        <div className="management-chart-grid">{charts.map(chart => <ChartCard key={chart.id} chart={chart} model={models[chart.id] || chart.model} onModel={model => setModels(current => ({ ...current, [chart.id]: model }))} onNavigate={() => onNavigate(chart.section)}/>)}</div>
    </section>;
}
