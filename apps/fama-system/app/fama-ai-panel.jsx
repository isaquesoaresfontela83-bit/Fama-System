'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Plus, Search, Sparkles, TriangleAlert, X, CalendarDays, ContactRound, CircleDollarSign, ClipboardList, FilePenLine, CircleCheck, MessageSquareText, Mic, Square, Volume2, Cpu, Settings2, History, Star, Trash2, BookOpen, PanelLeft } from 'lucide-react';
import { FamaAiOrb } from './fama-ai-orb';
import { useViewPreferences } from './view-customizer';
import { safePrompts, rememberPrompt } from '@/lib/assistant-prompts';
import { helpTopics } from '@/lib/internal-help';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAssistantConnection } from '@/hooks/use-assistant-connection';
import { assistantConnectionLabels, assistantCloudLabels } from '@/lib/fama-ai-connection';
import { useFamaLocalAi } from '@/hooks/use-fama-local-ai';
import { answerNative } from '@/lib/fama-ai-provider';
import { FamaAiLocalSettings } from './fama-ai-local-settings';
import { assistantDraftDefinitions, draftMissingFields, sanitizeAssistantDraft } from '@/lib/fama-ai-drafts';
import { Textarea } from '@/components/ui/textarea';
import { assistantSources, buildAssistantWorkspace } from '@/lib/fama-ai';
import { defaultAssistantSettings, restrictAssistantSettings } from '@/lib/fama-ai-settings';
import { aiModules, aiStarterSources } from './fama-ai-modules';
const allSources = Object.keys(assistantSources);
function Metrics({ metrics, compact = false }) {
    return <div className={`fama-ai-metrics ${compact ? 'fama-ai-metrics-compact' : ''}`}>
    {metrics.map(metric => <div key={metric.label} className="fama-ai-metric" data-tone={metric.tone ?? 'neutral'}>
      <span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail && <small>{metric.detail}</small>}
    </div>)}
  </div>;
}
function DraftCard({ draft, data, onAction }) {
    const [fields, setFields] = useState(draft.fields);
    const [error, setError] = useState('');
    const id = useId();
    const definition = assistantDraftDefinitions[draft.entity];
    function review(event) {
        event.preventDefault();
        const clean = sanitizeAssistantDraft({ entity: draft.entity, fields });
        if (!clean)
            return;
        const invalid = definition.fields.filter(field => fields[field.name]?.trim() && !clean.fields[field.name]);
        const missing = draftMissingFields(clean);
        if (invalid.length || missing.length)
            return setError(`Confira os campos: ${[...invalid.map(field => field.label), ...missing].join(', ')}.`);
        setError('');
        onAction?.({ label: 'Revisar cadastro', section: definition.source, create: clean.entity, draft: clean });
    }
    return <form className="fama-ai-draft" onSubmit={review}>
    <div className="fama-ai-block-heading"><FilePenLine size={18}/><div><strong>{definition.title}</strong><small>Os campos seguem para o formulário do sistema.</small></div><span>Rascunho</span></div>
    <div className="fama-ai-draft-fields">{definition.fields.map(field => {
            const inputId = `${id}-${field.name}`;
            const options = field.name === 'technician' && data.employees ? [['', 'Definir no formulário'], ...data.employees.filter(employee => employee.active).map(employee => [employee.name, employee.name])] : field.options;
            const change = (value) => { setFields(current => ({ ...current, [field.name]: value })); setError(''); };
            return <div key={field.name} className={field.type === 'textarea' ? 'fama-ai-field-wide' : ''}>
        <label htmlFor={inputId}>{field.label}{field.required ? ' *' : ''}</label>
        {options ? <select id={inputId} value={fields[field.name] ?? ''} required={field.required} onChange={event => change(event.target.value)}>{!options.some(([value]) => value === '') && <option value="">Selecione</option>}{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : field.type === 'textarea' ? <Textarea id={inputId} value={fields[field.name] ?? ''} rows={2} maxLength={1500} required={field.required} onChange={event => change(event.target.value)}/> : <Input id={inputId} type={field.type ?? 'text'} value={fields[field.name] ?? ''} maxLength={200} required={field.required} placeholder={field.placeholder} min={field.name === 'paymentDay' ? 1 : undefined} max={field.name === 'paymentDay' ? 31 : undefined} list={field.name === 'clientName' && data.customers ? `${id}-customers` : undefined} onChange={event => change(event.target.value)}/>}
      </div>;
        })}</div>
    {data.customers && <datalist id={`${id}-customers`}>{data.customers.map(customer => <option value={customer.name} key={customer.id}/>)}</datalist>}
    {error && <p role="alert" className="fama-ai-form-error">{error}</p>}
    <div className="fama-ai-draft-footer"><small>Revise os demais campos antes de salvar.</small>{onAction && <Button type="submit"><FilePenLine />Revisar no sistema</Button>}</div>
  </form>;
}
export function FamaAiResponse({ answer, name, data, onAction, onAsk, onRead }) {
    const [expanded, setExpanded] = useState(false);
    const [reviewed, setReviewed] = useState([]);
    const [copied, setCopied] = useState();
    const items = answer.items ?? [];
    const displayed = expanded ? items : items.slice(0, 6);
    const Icon = aiModules[answer.source].icon;
    async function copy(text, kind) {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(kind);
        }
        catch {
            setCopied('failed');
        }
    }
    const chartData = answer.chart?.series.map(item => ({ label: item.label, entradas: item.incomeCents / 100, saidas: item.expenseCents / 100 }));
    return <article className="fama-ai-response">
    <div className="fama-ai-response-heading"><span className="fama-ai-avatar"><Sparkles size={17}/></span><strong>{name}</strong><span className="fama-ai-source-tag"><Icon size={14}/>{aiModules[answer.source].label}</span>{answer.engine === 'local' && <span className="fama-ai-engine-label">Modelo local</span>}{answer.engine === 'cloudflare' && <span className="fama-ai-engine-label">Workers AI</span>}</div>
    <div className="fama-ai-response-body">
      {answer.title && <h3>{answer.title}</h3>}
      {answer.narrative && <p className="fama-ai-answer-text">{answer.narrative}</p>}
      {answer.metrics?.length ? <Metrics metrics={answer.metrics} compact/> : null}
      {answer.chart && chartData && <figure className="fama-ai-chart"><figcaption>{answer.chart.title}</figcaption><div className="fama-ai-chart-canvas" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: 4, right: 8, bottom: 4 }}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12}/><YAxis tickLine={false} axisLine={false} fontSize={12} width={65} tickFormatter={value => Number(value).toLocaleString('pt-BR', { notation: 'compact' })}/><Tooltip formatter={value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} contentStyle={{ borderRadius: 12, background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}/><Bar dataKey="entradas" name="Entradas" fill="#16a085" radius={[4, 4, 0, 0]}/><Bar dataKey="saidas" name="Saídas" fill="#e28a4c" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div><div className="fama-ai-chart-legend"><span><i />Entradas</span><span><i />Saídas</span><small>Valores em R$ · passe sobre as barras</small></div><table className="sr-only"><caption>{answer.chart.title}</caption><thead><tr><th>Período</th><th>Entradas</th><th>Saídas</th></tr></thead><tbody>{chartData.map(row => <tr key={row.label}><th>{row.label}</th><td>{row.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{row.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}</tbody></table></figure>}
      {answer.steps?.length ? <section className="fama-ai-plan"><div className="fama-ai-block-heading"><ClipboardList size={18}/><strong>Próximos passos</strong><small>{reviewed.length}/{answer.steps.length} conferidos nesta conversa</small></div>{answer.steps.map((step, index) => <div className="fama-ai-plan-step" key={step.id} data-reviewed={reviewed.includes(step.id)}><label><input type="checkbox" checked={reviewed.includes(step.id)} onChange={event => setReviewed(current => event.target.checked ? [...current, step.id] : current.filter(id => id !== step.id))} aria-label={`Marcar como conferido: ${step.title}`}/><span>{String(index + 1).padStart(2, '0')}</span></label><div><strong>{step.title}</strong><p>{step.description}</p></div>{step.question && <Button type="button" variant="outline" size="sm" onClick={() => onAsk({ label: step.title, question: step.question, source: step.source })}>Consultar</Button>}{step.priority === 'high' && <span className="fama-ai-priority-label">Prioridade</span>}</div>)}</section> : null}
      {answer.draft && <DraftCard draft={answer.draft} data={data} onAction={onAction}/>}
      {answer.communication && <section className="fama-ai-communication"><div className="fama-ai-block-heading"><MessageSquareText size={18}/><strong>{answer.communication.title}</strong><Button type="button" variant="outline" size="sm" onClick={() => void copy(answer.communication.text, 'message')}>{copied === 'message' ? <Check /> : <Copy />}{copied === 'message' ? 'Texto copiado' : 'Copiar texto'}</Button></div><p>{answer.communication.text}</p><small>Texto preparado para sua revisão.</small></section>}
      {answer.items ? <>
        {items.length ? <div className="fama-ai-records">{displayed.map((item, index) => <div className="fama-ai-record" key={`${item.id}-${index}`}>
          <div className="fama-ai-record-main"><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div>
          <div className="fama-ai-record-meta">{item.value && <strong>{item.value}</strong>}{item.status && <span className="fama-ai-status" data-tone={item.tone ?? 'neutral'}>{item.status}</span>}</div>
        </div>)}</div> : !answer.draft && !answer.communication && !answer.steps?.length && !answer.chart && <div className="fama-ai-no-results"><Search size={20}/><p>Nenhum registro encontrado para esta consulta.</p></div>}
        {items.length > 6 && <Button type="button" variant="ghost" size="sm" className="fama-ai-expand" onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? 'Mostrar menos' : `Ver mais ${items.length - 6} resultados`}</Button>}
        {(answer.totalItems ?? 0) > items.length && <p className="fama-ai-note">Exibindo {items.length} de {answer.totalItems} registros. Abra o módulo para consultar todos.</p>}
      </> : !answer.narrative && <p className="fama-ai-answer-text">{answer.text}</p>}
      {answer.note && <p className="fama-ai-note">{answer.note}</p>}
      {answer.sections?.length ? <div className="fama-ai-answer-sections">{answer.sections.map((section, index) => <FamaAiResponse key={`${section.source}-${index}`} answer={section} name={aiModules[section.source].label} data={data} onAction={onAction} onAsk={onAsk} onRead={onRead}/>)}</div> : null}
      {answer.cloudNarrative && <section className="fama-ai-local-narrative" aria-label="Sugestão do Workers AI"><div><Cpu size={16}/><strong>Sugestão do Workers AI</strong></div><p>{answer.cloudNarrative}</p><small>Texto gerado pelo Workers AI com os resultados autorizados. Confira as sugestões nos registros apresentados.</small></section>}
      {answer.cloudState && answer.cloudState !== 'ready' && <p className="fama-ai-note" role="status">A sugestão do Workers AI não ficou disponível nesta consulta. Os resultados do núcleo Fama continuam disponíveis.</p>}
      {answer.localNarrative && <section className="fama-ai-local-narrative"><div><Cpu size={16}/><strong>Sugestão do modelo local</strong></div><p>{answer.localNarrative}</p><small>Texto gerado neste dispositivo. Confira as sugestões nos registros apresentados.</small></section>}
      {onAction && answer.actions.length > 0 && <div className="fama-ai-actions">{answer.actions.map(action => <Button key={`${action.section}-${action.label}`} type="button" variant={action.create ? 'default' : 'outline'} size="sm" onClick={() => onAction(action)}>{action.create ? <Plus /> : action.record ? <Search /> : <FilePenLine />}{action.label}</Button>)}</div>}
      <div className="fama-ai-response-footer"><Button type="button" variant="ghost" size="sm" onClick={() => void copy([answer.text, answer.cloudNarrative, answer.localNarrative].filter(Boolean).join('\n\n'), 'answer')} aria-label="Copiar resposta">{copied === 'answer' ? <Check /> : <Copy />}{copied === 'answer' ? 'Copiado' : 'Copiar resposta'}</Button>{onRead && <Button type="button" variant="ghost" size="sm" onClick={() => onRead([answer.text, answer.cloudNarrative, answer.localNarrative].filter(Boolean).join('\n\n'))}><Volume2 />Ouvir resposta</Button>}<span>{copied === 'failed' ? 'Selecione o texto para copiar.' : 'Com base nos registros desta área'}</span></div>
      {copied && <span className="sr-only" role="status">{copied === 'failed' ? 'O navegador não permitiu copiar.' : 'Texto copiado.'}</span>}
    </div>
    {answer.suggestions?.length ? <div className="fama-ai-followups">{answer.suggestions.map(suggestion => <button type="button" key={suggestion.question} onClick={() => onAsk(suggestion)}>{suggestion.label}<Search size={14}/></button>)}</div> : null}
  </article>;
}
export function FamaAiPanel({ data, onAction, scopeLabel = 'Área atual', allowedSections, allowedSources = allSources, settings = defaultAssistantSettings, organizationId, platform = false, preview = false, conversationScope }) {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [source, setSource] = useState('overview');
    const [railOpen, setRailOpen] = useState(false);
    const [previousSource, setPreviousSource] = useState();
    const [customerName, setCustomerName] = useState();
    const [clientPicker, setClientPicker] = useState(false);
    const [draftPicker, setDraftPicker] = useState(false);
    const [draftEntity, setDraftEntity] = useState('appointments');
    const connection = useAssistantConnection({ organizationId, platform, preview });
    const localAi = useFamaLocalAi();
    const releaseLocalMemory = localAi.releaseMemory;
    useEffect(() => () => releaseLocalMemory(), [releaseLocalMemory]);
    const [localSetup, setLocalSetup] = useState(false);
    const { enabled: useLocalModel, setEnabled: setUseLocalModel } = localAi;
    const [queryBusy, setQueryBusy] = useState(false);
    const requestSequence = useRef(0);
    const pending = useRef(false);
    const [showHelp, setShowHelp] = useState(false);
    const [hasNewResponse, setHasNewResponse] = useState(false);
    const questionId = useId();
    const composerRef = useRef(null);
    const conversationRef = useRef(null);
    const nextId = useRef(0);
    useEffect(() => {
        const input = composerRef.current;
        if (!input?.style)
            return;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }, [message]);
    const scopedSettings = useMemo(() => restrictAssistantSettings(settings, allowedSources), [settings, allowedSources]);
    const availableSources = allSources.filter(id => scopedSettings.sources[id]);
    const canAsk = settings.enabled && availableSources.length > 0;
    const storageKey = 'fama-ai-prompts:' + (conversationScope || organizationId || (platform ? 'platform' : 'preview')) + ':' + availableSources.slice().sort().join(',');
    const [savedPrompts, setSavedPrompts] = useViewPreferences(storageKey, { recent: [], favorites: [] }, 'session');
    const recent = safePrompts(savedPrompts.recent, availableSources), favorites = safePrompts(savedPrompts.favorites, availableSources);
    const [showHistory, setShowHistory] = useState(false);
    const topicGuides = helpTopics.filter(topic => (allowedSections?.includes(topic.section) ?? true) && (['customers', 'quotes', 'agenda', 'chat', 'personalize'].includes(topic.id)));
    function favorite(question, focus) { const exists = favorites.some(item => item.question === question && item.source === focus); setSavedPrompts({ recent, favorites: exists ? favorites.filter(item => item.question !== question || item.source !== focus) : rememberPrompt(favorites, question, focus).slice(0, 8) }); }
    const responseData = { employees: scopedSettings.sources.team ? data.employees : undefined, customers: scopedSettings.sources.customers ? data.customers : undefined };
    const draftEntities = Object.keys(assistantDraftDefinitions).filter(entity => scopedSettings.sources[assistantDraftDefinitions[entity].source]);
    const selectedSource = availableSources.includes(source) ? source : availableSources[0] ?? 'overview';
    const workspace = useMemo(() => buildAssistantWorkspace(data, new Date(), scopedSettings), [data, scopedSettings]);
    const visibleInsights = workspace.insights;
    const sourceModule = aiModules[selectedSource];
    const ModuleIcon = sourceModule.icon;
    const starterCandidates = [
        { label: 'Organizar minha agenda', question: 'Agenda de hoje', source: 'agenda' },
        { label: 'Consultar pendências', question: 'Plano de ação da empresa', source: 'overview' },
        { label: scopedSettings.allowCreate ? 'Preparar um orçamento' : 'Consultar orçamentos', question: scopedSettings.allowCreate ? 'Preparar orçamento' : 'Orçamentos enviados', source: 'quotes' },
        ...aiStarterSources.filter(id => !['agenda', 'overview', 'quotes'].includes(id)).map(id => aiModules[id].prompts[0]),
    ];
    const starterPrompts = starterCandidates.filter(item => availableSources.includes(item.source)).slice(0, 3);
    const prompts = (selectedSource === 'overview' ? starterPrompts : sourceModule.prompts)
        .filter(item => canAsk && scopedSettings.sources[item.source] && (settings.detectConflicts || !/conflitos?/i.test(item.question)));
    const latestAnswer = [...messages].reverse().find(item => item.answer)?.answer;
    const busy = queryBusy || connection.busy;
    const displayName = settings.name === defaultAssistantSettings.name ? 'Fama IA' : settings.name;
    const activity = !canAsk ? 'paused' : localAi.voice === 'recording' ? 'listening' : localAi.speaking ? 'speaking' : busy || localAi.generating || localAi.voice !== 'idle' ? 'thinking' : 'idle';
    const activityLabel = !canAsk ? 'Assistente pausada' : activity === 'listening' ? 'Ouvindo você' : activity === 'speaking' ? 'Lendo sua resposta' : activity === 'thinking' ? 'Preparando sua resposta' : preview || (!organizationId && !platform) || connection.configured ? 'Pronta para ajudar' : connection.state === 'checking' ? 'Verificando acesso' : 'Consulta indisponível';
    const recentRail = recent.slice(0, 6);
    function scrollToLatest() {
        const container = conversationRef.current;
        if (container)
            container.scrollTop = container.scrollHeight;
        setHasNewResponse(false);
    }
    useEffect(() => {
        const container = conversationRef.current;
        if (!container || !messages.length)
            return;
        // Keep the answer in this pane; never move the containing page or steal focus.
        container.scrollTop = container.scrollHeight;
        setHasNewResponse(false);
    }, [messages]);
    async function send(text, selected = selectedSource) {
        if (!canAsk || pending.current || !text.trim())
            return;
        pending.current = true;
        setQueryBusy(true);
        const sequence = ++requestSequence.current;
        localAi.stopVoice(true);
        localAi.stopSpeaking();
        if (localAi.generating)
            localAi.terminate('language');
        const question = text.trim();
        const history = messages.filter(item => item.role === 'user').slice(-4).map(item => item.content);
        try {
            const answer = preview || (!organizationId && !platform) ? answerNative({ question, source: selected, history, customerName, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, data, scopedSettings, new Date()) : await connection.ask({ question, source: selected, history, customerName });
            if (!answer || sequence !== requestSequence.current)
                return;
            const filterActions = (response) => { response.actions = response.actions.filter(action => (!allowedSections || allowedSections.includes(action.section)) && (action.create ? scopedSettings.allowCreate : scopedSettings.allowNavigation)); response.sections?.forEach(filterActions); };
            filterActions(answer);
            const userId = nextId.current++;
            const answerId = nextId.current++;
            setMessages(previous => [...previous.slice(-38), { id: userId, role: 'user', content: question }, { id: answerId, role: 'assistant', content: answer.text, answer }]);
            setSavedPrompts(previous => ({ recent: rememberPrompt(safePrompts(previous.recent, availableSources), question, answer.source), favorites: safePrompts(previous.favorites, availableSources) }));
            setPreviousSource(answer.source);
            setCustomerName(answer.customerName ?? customerName);
            setMessage('');
            composerRef.current?.focus();
            if (useLocalModel && !answer.cloudNarrative)
                void localAi.generate(question, answer, history).then(narrative => {
                    if (sequence !== requestSequence.current || !narrative)
                        return;
                    setMessages(previous => previous.map(item => item.id === answerId ? { ...item, answer: { ...answer, localNarrative: narrative, engine: 'local' } } : item));
                }).catch(() => undefined);
        }
        finally {
            if (sequence === requestSequence.current) {
                pending.current = false;
                setQueryBusy(false);
            }
        }
    }
    function ask(suggestion) { setRailOpen(false); void send(suggestion.question, suggestion.source); }
    function cancelQuery() { requestSequence.current++; pending.current = false; setQueryBusy(false); connection.cancel(); if (localAi.generating)
        localAi.terminate('language'); }
    function newConversation() { setRailOpen(false); cancelQuery(); localAi.stopVoice(true); localAi.stopSpeaking(); setMessages([]); setMessage(''); setPreviousSource(undefined); setCustomerName(undefined); setSource(availableSources.includes('overview') ? 'overview' : availableSources[0] ?? 'overview'); composerRef.current?.focus(); }
    useEffect(() => () => { requestSequence.current++; pending.current = false; }, []);
    return <section className="fama-ai fama-ai-chat" data-activity={activity} data-rail-open={railOpen} aria-label="Central Fama IA">
    <header className="fama-ai-header">
      <div className="fama-ai-brand"><Button type="button" variant="ghost" size="icon" className="fama-ai-rail-toggle" aria-label="Ferramentas da Fama IA" aria-expanded={railOpen} aria-controls={`${questionId}-rail`} onClick={() => setRailOpen(value => !value)}><PanelLeft /></Button><FamaAiOrb activity={activity}/><div><h2>{displayName}</h2><span className="fama-ai-eyebrow">Sua assistente de gestão</span><span className="fama-ai-company-label">{scopeLabel}</span></div></div>
      <div className="fama-ai-header-actions"><span className="fama-ai-scope">{scopeLabel}</span><Button type="button" variant="ghost" className="fama-ai-history-toggle" aria-label="Consultas recentes" onClick={() => setShowHistory(value => !value)} aria-expanded={showHistory}><History /><span>Consultas recentes</span></Button><Button type="button" variant="ghost" className="fama-ai-settings-toggle" aria-label="Configurar voz e modelo local" onClick={() => setLocalSetup(true)}><Settings2 /><span>Voz e preferências</span></Button><Button type="button" variant="ghost" size="icon" className="fama-ai-mobile-new" aria-label="Nova conversa" onClick={newConversation}><Plus /></Button></div>
    </header>
    <div className="fama-ai-workspace">
      <aside id={`${questionId}-rail`} className="fama-ai-rail" aria-label="Módulos da assistente">
        <div className="fama-ai-rail-heading"><MessageSquareText size={17}/><span>Sua conversa</span></div>
        <Button type="button" className="fama-ai-new-chat" onClick={newConversation}><Plus />Nova conversa</Button>
        <section className="fama-ai-rail-recents" aria-label="Consultas recentes"><header><h3>Consultas recentes</h3><button type="button" onClick={() => { setShowHistory(value => !value); setRailOpen(false); }} aria-expanded={showHistory}>Ver todas</button></header>{recentRail.length ? recentRail.map(item => <button type="button" key={item.question + item.source} disabled={busy || !canAsk} onClick={() => ask({ label: item.question, question: item.question, source: item.source })}><MessageSquareText size={16}/><span><strong>{item.question}</strong><small>{aiModules[item.source].label}</small></span></button>) : <p>Suas perguntas aparecem aqui nesta sessão.</p>}</section>
        <details className="fama-ai-module-menu"><summary><ModuleIcon size={17}/><span>Funções disponíveis</span><ChevronDown size={15}/></summary><nav>{availableSources.map(id => { const Icon = aiModules[id].icon; return <button type="button" key={id} disabled={!canAsk} aria-pressed={selectedSource === id} onClick={() => { setSource(id); setRailOpen(false); composerRef.current?.focus(); }}><Icon size={18}/><span>{aiModules[id].label}</span>{canAsk && workspace.counts[id] !== undefined && id !== 'overview' && <small>{workspace.counts[id]}</small>}</button>; })}</nav></details>
        <details className="fama-ai-toolbox"><summary><ClipboardList size={17}/><span>Atalhos da assistente</span><ChevronDown size={15}/></summary><div className="fama-ai-workflows" aria-label="Ferramentas da assistente">
          {scopedSettings.sources.overview && <button type="button" disabled={!canAsk || busy} onClick={() => ask({ label: 'Plano do dia', question: 'Plano de ação da empresa', source: 'overview' })}><ClipboardList /><span>Plano do dia<small>Pendências e próximos passos</small></span></button>}
          {scopedSettings.sources.agenda && <button type="button" disabled={!canAsk || busy} onClick={() => ask({ label: 'Planejar equipe', question: 'Planejar agenda da semana', source: 'agenda' })}><CalendarDays /><span>Planejar equipe<small>Carga e horários sugeridos</small></span></button>}
          {scopedSettings.sources.customers && <button type="button" disabled={!canAsk || busy} onClick={() => { setRailOpen(false); setClientPicker(true); }}><ContactRound /><span>Cliente 360<small>Histórico entre os módulos</small></span></button>}
          {scopedSettings.sources.finance && <button type="button" disabled={!canAsk || busy} onClick={() => ask({ label: 'Projetar financeiro', question: 'Fluxo de caixa dos próximos 30 dias', source: 'finance' })}><CircleDollarSign /><span>Projetar financeiro<small>Entradas e saídas previstas</small></span></button>}
        </div></details>
        {favorites.length > 0 && <div className="fama-ai-favorites"><strong><Star size={15}/>Seus atalhos</strong>{favorites.map(item => <button type="button" key={item.question + item.source} disabled={busy || !canAsk} onClick={() => ask({ label: item.question, question: item.question, source: item.source })}>{item.question}</button>)}</div>}
        {canAsk && workspace.metrics.length > 0 && <details className="fama-ai-summary"><summary><CircleCheck size={17}/><span>Resumo desta área</span><ChevronDown size={15}/></summary><Metrics metrics={workspace.metrics} compact/></details>}
        <div className="fama-ai-rail-footer"><button type="button" className="fama-ai-help-button" onClick={() => { setShowHelp(value => !value); setRailOpen(false); }} aria-expanded={showHelp}>Dicas para perguntar<ArrowRight size={15}/></button><button type="button" className="fama-ai-rail-settings" onClick={() => setLocalSetup(true)}><Settings2 size={17}/>Voz e preferências</button></div>
      </aside>
      <div className="fama-ai-main">
        {showHistory && <section className="fama-ai-history"><header><div><History size={17}/><strong>Histórico de consultas</strong></div><Button type="button" size="sm" variant="ghost" onClick={() => setSavedPrompts({ recent: [], favorites })} disabled={!recent.length}><Trash2 />Limpar histórico</Button></header><p>Perguntas salvas nesta sessão por usuário e empresa. Ao retomar, os dados são consultados novamente.</p>{favorites.length > 0 && <div className="fama-ai-history-shortcuts">{favorites.map(item => <Button type="button" size="sm" variant="outline" key={item.question + item.source} disabled={busy || !canAsk} onClick={() => ask({ label: item.question, question: item.question, source: item.source })}><Star />{item.question}</Button>)}</div>}{recent.length ? recent.map(item => <div key={item.question + item.source}><button type="button" disabled={busy || !canAsk} onClick={() => ask({ label: item.question, question: item.question, source: item.source })}><span>{aiModules[item.source].label}</span><strong>{item.question}</strong></button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Favoritar consulta: ${item.question}`} aria-pressed={favorites.some(f => f.question === item.question && f.source === item.source)} onClick={() => favorite(item.question, item.source)}><Star /></Button></div>) : <p>Suas próximas consultas aparecem aqui.</p>}</section>}
        <div className="fama-ai-context-bar"><div><ModuleIcon size={17}/><strong>{selectedSource === 'overview' ? 'Conversa com sua empresa' : sourceModule.label}</strong></div><span className="fama-ai-activity" data-state={activity} role="status"><i aria-hidden="true"/>{activityLabel}</span></div>
        <div className="fama-ai-mobile-module"><label htmlFor={`${questionId}-module`}>Foco da consulta</label><select id={`${questionId}-module`} disabled={!canAsk} value={selectedSource} onChange={event => setSource(event.target.value)}>{availableSources.length ? availableSources.map(id => <option key={id} value={id}>{aiModules[id].label}</option>) : <option value="overview">Nenhuma função disponível</option>}</select></div>
        {showHelp && <div className="fama-ai-help"><div><strong>Perguntas que ajudam a decidir</strong><button type="button" aria-label="Fechar dicas" onClick={() => setShowHelp(false)}><X size={17}/></button></div><p>“Agenda de amanhã”, “orçamentos enviados”, “contratos a vencer em 30 dias” ou “financeiro de 01/10/2026 a 15/10/2026”. Para continuar no mesmo assunto, pergunte “e amanhã?” ou “somente os pendentes”.</p><p>Para preparar um registro, use “Agendar visita para João amanhã às 14h” ou “Criar despesa; descrição: material; valor: 450,00; vencimento: 10/10/2026”. Consulte “Cliente 360: nome”, “Comparar financeiro” ou “Mensagem para orçamento: ORC-001”.</p><small>Os rascunhos abrem formulários para revisão. Você confirma e salva no sistema.</small></div>}
        {!canAsk ? <div className="fama-ai-disabled" role="status"><Sparkles /><h3>{settings.enabled ? 'Nenhuma função disponível' : 'Assistente pausada'}</h3><p>{settings.enabled ? 'As funções disponíveis dependem das permissões desta área e da configuração do Fama Control.' : 'Ative a assistente nas configurações do Fama Control para retomar as consultas.'}</p></div> : <>
          <div className={`fama-ai-conversation ${!messages.length ? 'fama-ai-conversation-empty' : ''}`} ref={conversationRef} aria-busy={busy || localAi.generating} onScroll={event => { const target = event.currentTarget; setHasNewResponse(target.scrollHeight - target.scrollTop - target.clientHeight > 140); }}>
            {!messages.length ? <div className="fama-ai-welcome">
              <span className="fama-ai-welcome-symbol"><FamaAiOrb activity={activity} large/></span>
              <span className="fama-ai-eyebrow">{selectedSource === 'overview' ? 'Sua empresa, em uma conversa' : sourceModule.label}</span>
              <h3>{selectedSource === 'overview' ? 'Como posso ajudar hoje?' : `Vamos cuidar de ${sourceModule.label.toLocaleLowerCase('pt-BR')}?`}</h3>
              <p>{selectedSource === 'overview' ? settings.welcome === defaultAssistantSettings.welcome ? 'Organize sua rotina, consulte as informações disponíveis e prepare seu próximo passo.' : settings.welcome || 'Converse com a Fama IA para cuidar da sua gestão.' : sourceModule.description}</p>
              {topicGuides.length > 0 && <details className="fama-ai-chat-guides"><summary><BookOpen size={16}/>Aprender a usar<ChevronDown size={15}/></summary><div className="fama-ai-guide-shortcuts"><strong><BookOpen size={16}/>Aprender a usar</strong>{topicGuides.map(topic => <button type="button" key={topic.id} onClick={() => ask({ label: topic.title, question: topic.title, source: selectedSource })}>{topic.title.replace(/^Como /, '')}</button>)}</div></details>}<div className="fama-ai-prompts">{prompts.map(prompt => { const Icon = aiModules[prompt.source].icon; return <button type="button" key={prompt.question} aria-label={`${prompt.label}: ${prompt.question}`} onClick={() => ask(prompt)}><span className="fama-ai-prompt-icon"><Icon size={19}/></span><span><small>{aiModules[prompt.source].label}</small><strong>{prompt.label}</strong></span><ArrowUp size={17}/></button>; })}</div>
              {visibleInsights.length > 0 && <details className="fama-ai-chat-priorities"><summary><TriangleAlert size={16}/>Pendências desta área<span>{visibleInsights.length}</span><ChevronDown size={15}/></summary><div className="fama-ai-priorities"><div className="fama-ai-priorities-title"><TriangleAlert size={16}/><strong>Atenção agora</strong><span>{visibleInsights.length} ponto(s) para acompanhar</span></div>{visibleInsights.slice(0, 3).map(insight => <button type="button" key={insight.id} onClick={() => ask({ label: insight.title, question: insight.question, source: insight.source })}><span className="fama-ai-priority-dot" data-tone={insight.tone}/><span><strong>{insight.title}</strong><small>{insight.detail}</small></span><b>{insight.value}</b><ArrowRight size={16}/></button>)}</div></details>}
            </div> : <div role="log" aria-label="Conversa com Fama IA" aria-live="polite" aria-relevant="additions" className="fama-ai-messages">{messages.map(item => item.role === 'user' ? <div className="fama-ai-user-message" key={item.id}><span>Você</span><p>{item.content}</p><Button type="button" variant="ghost" size="sm" onClick={() => favorite(item.content, messages.find(next => next.id === item.id + 1)?.answer?.source ?? selectedSource)}><Star size={14}/>{favorites.some(f => f.question === item.content) ? 'Remover atalho' : 'Salvar atalho'}</Button></div> : item.answer && <FamaAiResponse key={item.id} answer={item.answer} name={displayName} data={responseData} onAction={onAction} onAsk={ask} onRead={localAi.speak}/>)}</div>}
          </div>
          {hasNewResponse && messages.length > 0 && <Button type="button" variant="outline" size="sm" className="fama-ai-jump" onClick={scrollToLatest}><ArrowDown />Ir para a última resposta</Button>}
        </>}
        <div className="fama-ai-composer-area">
          {messages.length > 0 && <div className="fama-ai-composer-context"><span className="fama-ai-context-dot"/>{customerName ? `Cliente: ${customerName} · ` : 'Contexto atual: '}<strong>{aiModules[latestAnswer?.source ?? selectedSource].label}</strong></div>}
          <div className="fama-ai-mode-bar"><span><Cpu size={15}/>{connection.cloud?.state === 'ready' ? 'Núcleo Fama + Workers AI' : useLocalModel && (localAi.models.language.saved || localAi.models.language.status === 'ready') ? 'Núcleo Fama + modelo local' : 'Núcleo Fama'}</span>{settings.allowCreate && draftEntities.length > 0 && <Button type="button" variant="ghost" size="sm" disabled={!canAsk || busy} onClick={() => setDraftPicker(true)}><FilePenLine />Preparar cadastro</Button>}<button type="button" onClick={() => setLocalSetup(true)}>Configurar voz</button></div>
          {!preview && connection.cloud && <details className="fama-ai-privacy-notice"><summary><Cpu size={14}/>Como a assistente usa os dados<ChevronDown size={14}/></summary><p className="fama-ai-connection-note">{assistantCloudLabels[connection.cloud.state].title} · {assistantCloudLabels[connection.cloud.state].description}</p></details>}
          {!preview && (organizationId || platform) && connection.state === 'unavailable' && <p className="fama-ai-connection-note" role="status">{assistantConnectionLabels[connection.state].title}<button type="button" onClick={() => void connection.refresh()}>Verificar novamente</button></p>}
          {connection.error && <p className="fama-ai-connection-error" role="alert">{connection.error}</p>}
          {localAi.error && <p className="fama-ai-connection-error" role="alert">{localAi.error}<button type="button" onClick={localAi.clearError}>Fechar aviso</button></p>}
          {(busy || localAi.generating) && <div role="status" className="fama-ai-thinking"><span className="fama-ai-thinking-dots" aria-hidden="true"><i /><i /><i /></span>{busy ? connection.cloud?.state === 'ready' ? 'Consultando os registros e preparando a sugestão do Workers AI…' : 'Consultando os registros da área atual…' : 'Os resultados estão prontos. Preparando uma sugestão local…'}<button type="button" onClick={cancelQuery}>Cancelar</button></div>}
          {localAi.voice !== 'idle' && <div role="status" className="fama-ai-voice-status" data-recording={localAi.voice === 'recording'}><FamaAiOrb activity={activity}/>{localAi.voice === 'recording' ? `Ouvindo · ${localAi.seconds}s / 20s` : localAi.voice === 'transcribing' ? 'Transcrevendo no dispositivo…' : 'Preparando a voz local…'}<Button type="button" variant="ghost" size="sm" onClick={() => localAi.voice === 'recording' ? localAi.stopVoice() : localAi.cancel()}>{localAi.voice === 'recording' ? 'Concluir gravação' : 'Cancelar'}</Button></div>}
          {localAi.speaking && <div className="fama-ai-voice-status" role="status"><FamaAiOrb activity={activity}/>Lendo a resposta<Button type="button" variant="ghost" size="sm" onClick={localAi.stopSpeaking}><Square />Parar fala</Button></div>}
          <form onSubmit={event => { event.preventDefault(); void send(message); }} className="fama-ai-composer">
            <label htmlFor={questionId} className="sr-only">Sua pergunta para a Fama IA</label>
            <Textarea ref={composerRef} id={questionId} disabled={!canAsk || busy} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} rows={1} placeholder={selectedSource === 'overview' ? 'Pergunte à Fama IA…' : `Pergunte sobre ${sourceModule.label.toLocaleLowerCase('pt-BR')} ou use “buscar: nome”…`} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void send(message);
    } }}/>
            <div className="fama-ai-composer-toolbar"><div className="fama-ai-input-tools"><Button type="button" variant="ghost" className="fama-ai-mic" disabled={!canAsk || busy || ['preparing', 'transcribing'].includes(localAi.voice)} aria-label={localAi.voice === 'recording' ? 'Concluir comando de voz' : 'Ditar comando de voz'} aria-pressed={localAi.voice === 'recording'} onClick={() => { if (localAi.voice === 'recording')
        localAi.stopVoice();
    else if (localAi.models.speech.status === 'error' || !localAi.models.speech.saved && localAi.models.speech.status !== 'ready')
        setLocalSetup(true);
    else
        void localAi.startVoice(text => { setMessage(text); composerRef.current?.focus(); }); }}>{localAi.voice === 'recording' ? <Square /> : <Mic />}<span>{localAi.voice === 'recording' ? 'Concluir' : 'Ditar'}</span></Button><span><Sparkles size={14}/>{selectedSource === 'overview' ? 'Identifica o módulo da pergunta' : sourceModule.label}</span></div><Button type="submit" disabled={!canAsk || busy || localAi.voice !== 'idle' || !message.trim()} className="fama-ai-send" aria-label="Enviar pergunta"><ArrowUp size={18}/><span>Enviar</span></Button></div>
          </form>
          <div className="fama-ai-composer-note"><span>Confira as informações e revise antes de salvar.</span><span>{message.length > 1200 ? `${message.length}/2.000` : 'Enter envia · Shift + Enter quebra a linha'}</span></div>
        </div>
      </div>
    </div>
    <Dialog open={localSetup} onOpenChange={setLocalSetup}><DialogContent className="fama-ai-local-dialog"><DialogHeader><DialogTitle>Voz e inteligência local</DialogTitle><DialogDescription>Prepare os recursos neste dispositivo. As consultas aos registros já funcionam com o núcleo Fama.</DialogDescription></DialogHeader><FamaAiLocalSettings local={localAi} enabled={useLocalModel} onEnable={setUseLocalModel}/>{localAi.error && <p role="alert" className="fama-ai-form-error">{localAi.error}</p>}</DialogContent></Dialog>
    <Dialog open={clientPicker} onOpenChange={setClientPicker}><DialogContent><DialogHeader><DialogTitle>Visão completa do cliente</DialogTitle><DialogDescription>Escolha um cliente da empresa selecionada para reunir seu histórico.</DialogDescription></DialogHeader><div className="fama-ai-client-picker">{responseData.customers?.length ? responseData.customers.map(customer => <button type="button" key={customer.id} onClick={() => { setClientPicker(false); ask({ label: customer.name, question: `Cliente 360: ${customer.name}`, source: 'customers' }); }}><ContactRound /><span><strong>{customer.name}</strong><small>{customer.poolType || 'Cliente cadastrado'}</small></span><Search /></button>) : <p>Nenhum cliente disponível nesta área. Confira o cadastro e as permissões.</p>}</div></DialogContent></Dialog>
    <Dialog open={draftPicker} onOpenChange={setDraftPicker}><DialogContent><DialogHeader><DialogTitle>Preparar cadastro</DialogTitle><DialogDescription>Escolha o registro. A assistente monta os campos para você revisar no formulário.</DialogDescription></DialogHeader><label htmlFor={`${questionId}-draft`}>Tipo de registro</label><select className="fama-ai-draft-selector" id={`${questionId}-draft`} value={draftEntities.includes(draftEntity) ? draftEntity : draftEntities[0] ?? ''} onChange={event => setDraftEntity(event.target.value)}>{draftEntities.map(entity => <option key={entity} value={entity}>{assistantDraftDefinitions[entity].title}</option>)}</select><Button type="button" disabled={!canAsk || !draftEntities.length} onClick={() => { const entity = draftEntities.includes(draftEntity) ? draftEntity : draftEntities[0]; if (!entity)
        return; setDraftPicker(false); ask({ label: 'Preparar cadastro', question: `Preparar ${entity === 'transactions' ? 'lançamento financeiro' : entity === 'appointments' ? 'agendamento' : entity === 'workOrders' ? 'ordem de serviço' : entity === 'leads' ? 'lead' : entity === 'quotes' ? 'orçamento' : entity === 'contracts' ? 'contrato' : 'cliente'}`, source: assistantDraftDefinitions[entity].source }); }}>Preparar campos</Button></DialogContent></Dialog>
    <footer className="fama-ai-footer"><span>Consultas nos dados disponíveis para seu usuário</span><button type="button" onClick={() => setShowHelp(value => !value)}>Como usar a Fama IA<ArrowRight size={14}/></button></footer>
  </section>;
}
