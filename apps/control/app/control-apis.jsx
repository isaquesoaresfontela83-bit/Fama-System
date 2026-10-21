'use client';
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, RefreshCw, Search, Server, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiCategories, apiScopeLabels, apiStatusLabels } from '@/lib/api-catalog';
import { requestJson } from '@/lib/client-request';

const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const date = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Ainda não testada';
const matchesStatus = (item, status) => status === 'all' || item.instances.some(instance => status === 'attention' ? ['unconfigured','unknown','unavailable','paused'].includes(instance.status) : instance.status === status);
export function ControlApis({ onNavigate, initialData = null }) {
    const [data, setData] = useState(initialData), [error, setError] = useState('');
    const [revision, setRevision] = useState(0), [loading, setLoading] = useState(!initialData), [busy, setBusy] = useState('');
    const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [status, setStatus] = useState('all');
    useEffect(() => {
        if (initialData && revision === 0) return;
        const controller = new AbortController();
        setLoading(true); setError('');
        requestJson('/api/admin/apis', { cache: 'no-store', signal: controller.signal }, 25000)
            .then(value => { if (!controller.signal.aborted) setData(value); })
            .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [revision, initialData]);
    const rows = useMemo(() => (data?.apis || []).filter(item => (category === 'all' || item.category === category)
        && matchesStatus(item, status)
        && fold([item.name, item.usage, item.category, ...item.endpoints].join(' ')).includes(fold(search.trim()))), [data, category, status, search]);
    const connections = (data?.apis || []).flatMap(item => item.instances);
    async function probe(id, scope) {
        if (busy || loading) return;
        setBusy(id + ':' + scope); setError('');
        try {
            const result = await requestJson('/api/admin/apis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, scope }) }, 45000);
            if (result.id !== id || result.scope !== scope || !Object.hasOwn(apiStatusLabels, result.observation?.status)) throw new Error('O diagnóstico retornou uma resposta inválida.');
            setData(current => ({ ...current, apis: current.apis.map(item => {
                if (item.id !== id) return item;
                const instances = item.instances.map(instance => instance.scope === scope ? { scope, ...result.observation } : instance);
                return { ...item, instances, status: new Set(instances.map(instance => instance.status)).size === 1 ? instances[0].status : 'mixed' };
            }) }));
        } catch (cause) { setError(cause.message); }
        finally { setBusy(''); }
    }
    return <section className="control-panel control-api-panel" aria-labelledby="api-panel-title">
        <div className="control-panel-heading"><div><p className="control-kicker">TODAS AS CONEXÕES DO FAMA</p><h2 id="api-panel-title"><Server />Gerenciar APIs</h2></div><Button variant="outline" disabled={loading || Boolean(busy)} onClick={() => setRevision(value => value + 1)}><RefreshCw className={loading ? 'api-spin' : ''}/>{loading ? 'Conferindo…' : 'Atualizar status'}</Button></div>
        <p className="control-muted">Veja onde cada API é usada, a configuração e a última resposta verificada. As conexões das empresas e dos dispositivos são indicadas separadamente.</p>
        <div className="api-summary" aria-label="Resumo das APIs"><div><Server /><strong>{data?.apis.length ?? '—'}</strong><span>APIs no inventário</span></div><div><CheckCircle2 /><strong>{data ? connections.filter(item => item.status === 'verified').length : '—'}</strong><span>Conexões verificadas</span></div><div><Activity /><strong>{data ? connections.filter(item => item.status === 'unconfigured').length : '—'}</strong><span>Sem configuração</span></div><div><ShieldCheck /><strong>{data ? connections.filter(item => ['unknown','unavailable'].includes(item.status)).length : '—'}</strong><span>Sem confirmação</span></div></div>
        <div className="api-filters"><label className="api-search"><span>Buscar API</span><div><Search /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, função ou módulo" aria-label="Buscar API"/></div></label><label><span>Área</span><select aria-label="Filtrar por área" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas as áreas</option>{apiCategories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><span>Status</span><select aria-label="Filtrar por status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="attention">Precisam de atenção</option>{Object.entries(apiStatusLabels).filter(([id]) => id !== 'mixed').map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        {error && <p role="alert" className="control-error">{error}</p>}
        {loading && <p role="status" className="api-loading">Conferindo as configurações e a comunicação entre System e Control…</p>}
        {data && <>
            <div className="api-inventory-meta"><span aria-live="polite">{rows.length} de {data.apis.length} APIs · Configuração conferida em {date(data.checkedAt)}</span><span className={data.release?.synchronized ? 'api-sync-ok' : 'api-sync-pending'}>{data.release?.synchronized ? 'System e Control sincronizados' : 'Publicações precisam ser conferidas'} · Control {data.release?.control.version || '—'} / System {data.release?.system?.version || 'sem resposta'}</span></div>
            {data.notice && <p className="api-notice" role="status">{data.notice}</p>}
            <p className="api-legend">“Configurada” indica cadastro; “Conexão verificada” indica uma consulta confirmada na data exibida. Os testes desta tela fazem apenas consultas. Atualizar status refaz a conferência das configurações. Horários de Brasília.</p>
            <div className="api-inventory-grid">{rows.map(item => <article className="api-inventory-card" key={item.id} data-api-id={item.id}><header><span className="api-category">{item.category}</span><h3>{item.name}</h3></header><p className="api-usage">{item.usage}</p><div className="api-instances">{item.instances.map(instance => <div className="api-instance" key={instance.scope}><div><strong>{apiScopeLabels[instance.scope]}</strong><span className={`api-state api-state-${instance.status}`}>{apiStatusLabels[instance.status]}</span></div><p>{instance.detail}</p><small>{instance.checkedAt ? `Resposta conferida em ${date(instance.checkedAt)}` : 'Sem teste de resposta registrado nesta conferência'}</small>{item.probe && <Button size="sm" variant="outline" disabled={loading || Boolean(busy) || ['unconfigured','paused','standby'].includes(instance.status)} onClick={() => void probe(item.id, instance.scope)} aria-label={`Testar ${item.name} no ${apiScopeLabels[instance.scope]}`}><Activity />{busy === item.id + ':' + instance.scope ? 'Testando…' : 'Testar conexão'}</Button>}</div>)}</div><details><summary>Pontos de integração</summary><ul>{item.endpoints.map(endpoint => <li key={endpoint}><code>{endpoint}</code></li>)}</ul></details><footer><Button size="sm" variant="ghost" onClick={() => onNavigate?.(item.management)}>{item.management === 'integrations' ? 'Configurar integração' : item.management === 'companies' ? 'Gerenciar empresas' : item.management === 'ai-settings' ? 'Configurar IA' : item.management === 'finance' ? 'Abrir financeiro' : item.management === 'security' ? 'Abrir segurança' : 'Central de saúde'}<ArrowRight /></Button></footer></article>)}</div>
            {!rows.length && <p className="api-empty" role="status">Nenhuma API corresponde aos filtros escolhidos.</p>}
        </>}
    </section>;
}
