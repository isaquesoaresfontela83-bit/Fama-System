"use client";
import { useEffect, useRef, useState } from 'react';
import { brasilCatalog } from '@/lib/brasil-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const label = (key) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
function Value({ value, depth = 0 }) { if (value == null || value === '')
    return <span>Não informado</span>; if (typeof value === 'boolean')
    return <span>{value ? 'Sim' : 'Não'}</span>; if (typeof value !== 'object')
    return <span>{String(value)}</span>; if (depth > 4)
    return <span>Consulte o detalhamento na fonte.</span>; return <dl className="brasil-data-values">{Object.entries(value).slice(0, 100).map(([key, item]) => <div key={key}><dt>{Array.isArray(value) ? Number(key) + 1 : label(key)}</dt><dd>{typeof item === 'object' && item !== null ? <details><summary>Ver detalhes</summary><Value value={item} depth={depth + 1}/></details> : <Value value={item} depth={depth + 1}/>}</dd></div>)}</dl>; }
export function BrasilDataExplorer({ organizationId }) {
    const [group, setGroup] = useState(''), [id, setId] = useState(''), [parameters, setParameters] = useState({}), [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [page, setPage] = useState(0);
    const controller = useRef(null);
    useEffect(() => () => controller.current?.abort(), []);
    const groups = [...new Set(brasilCatalog.map(e => e.group))].sort(), entries = brasilCatalog.filter(e => !group || e.group === group), entry = brasilCatalog.find(e => e.id === id);
    function clear() { controller.current?.abort(); setResult(null); setError(''); setBusy(false); setPage(0); }
    async function submit(event) { event.preventDefault(); controller.current?.abort(); const abort = new AbortController(); controller.current = abort; setBusy(true); setError(''); setResult(null); try {
        const response = await fetch('/api/brasil-data', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ id, parameters }), signal: abort.signal });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || 'Consulta indisponível.');
        if (!abort.signal.aborted) {
            setResult(data);
            setPage(0);
        }
    }
    catch (error) {
        if (!abort.signal.aborted)
            setError(error.message);
    }
    finally {
        if (!abort.signal.aborted)
            setBusy(false);
    } }
    const rows = result ? (Array.isArray(result.data) ? result.data : [result.data]) : [];
    return <details className="brasil-data-explorer"><summary>Mais consultas gratuitas · BrasilAPI</summary><p>Todos os {brasilCatalog.length} recursos de consulta da documentação atual, organizados por assunto. Consulte apenas os dados de que precisa; nenhuma consulta altera seus cadastros.</p><form onSubmit={submit}><label>Assunto<select value={group} onChange={event => { clear(); setGroup(event.target.value); setId(''); setParameters({}); }}><option value="">Todos os assuntos</option>{groups.map(g => <option key={g}>{g}</option>)}</select></label><label>Consulta<select required value={id} onChange={event => { clear(); setId(event.target.value); setParameters({}); }}><option value="">Escolha uma consulta</option>{entries.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>{entry?.parameters.map(p => <label key={p.name}>{label(p.name)}{p.required ? ' *' : ' (opcional)'}{p.options.length ? <select required={p.required} value={parameters[p.name] || ''} onChange={event => setParameters(values => ({ ...values, [p.name]: event.target.value }))}><option value="">Selecione</option>{p.options.map(option => <option key={String(option)}>{String(option)}</option>)}</select> : <Input required={p.required} type={p.format === 'date' ? 'date' : 'text'} value={parameters[p.name] || ''} maxLength={180} placeholder={p.example} onChange={event => setParameters(values => ({ ...values, [p.name]: event.target.value }))}/>}<small>{p.description}</small></label>)}<Button disabled={busy || !entry}>{busy ? 'Consultando…' : 'Consultar'}</Button></form>{error && <p role="alert">{error}</p>}{result && <div className="brasil-data-results"><p>{rows.length} resultado(s){result.truncated ? ' · exibindo os primeiros 500; refine os filtros' : ''} · BrasilAPI · {new Date(result.consultedAt).toLocaleString('pt-BR')}</p>{rows.slice(page * 20, (page + 1) * 20).map((row, i) => <article key={i}><Value value={row}/></article>)}{!rows.length && <p>Nenhum resultado.</p>}{rows.length > 20 && <div><Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</Button><span> Página {page + 1} de {Math.ceil(rows.length / 20)} </span><Button variant="outline" disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(page + 1)}>Próxima</Button></div>}</div>}<p><a href="https://brasilapi.com.br/docs" target="_blank" rel="noreferrer">Documentação e fontes da BrasilAPI</a> · Dados públicos podem estar desatualizados. Não são confirmação de pagamento nem orientação médica ou fiscal.</p></details>;
}
