'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Plus, Search, Sparkles, TriangleAlert, X, CalendarDays, ContactRound, CircleDollarSign, ClipboardList, FilePenLine, LoaderCircle, CircleCheck, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAssistantConnection } from '@/hooks/use-assistant-connection';
import { assistantDraftDefinitions, draftMissingFields, sanitizeAssistantDraft, type AssistantDraft, type AssistantDraftEntity } from '@/lib/fama-ai-drafts';
import { Textarea } from '@/components/ui/textarea';
import { answerInternal, assistantSources, buildAssistantWorkspace, type AssistantAction, type AssistantAnswer, type AssistantData, type AssistantMetric, type AssistantSource, type AssistantSuggestion } from '@/lib/fama-ai';
import { defaultAssistantSettings, restrictAssistantSettings, type AssistantSettings } from '@/lib/fama-ai-settings';
import { aiModules, aiStarterSources } from './fama-ai-modules';

const allSources = Object.keys(assistantSources) as AssistantSource[];
type Message = { id: number; role: 'user' | 'assistant'; content: string; answer?: AssistantAnswer };
type Props = { data: AssistantData; onAction?: (action: AssistantAction) => void; scopeLabel?: string; allowedSections?: readonly string[]; allowedSources?: readonly AssistantSource[]; settings?: AssistantSettings; organizationId?: string; platform?: boolean; preview?: boolean };

function Metrics({ metrics, compact = false }: { metrics: AssistantMetric[]; compact?: boolean }) {
  return <div className={`fama-ai-metrics ${compact ? 'fama-ai-metrics-compact' : ''}`}>
    {metrics.map(metric => <div key={metric.label} className="fama-ai-metric" data-tone={metric.tone ?? 'neutral'}>
      <span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail && <small>{metric.detail}</small>}
    </div>)}
  </div>;
}

function DraftCard({ draft, data, onAction }: { draft: AssistantDraft; data: AssistantData; onAction?: Props['onAction'] }) {
  const [fields, setFields] = useState(draft.fields);
  const [error, setError] = useState('');
  const id = useId();
  const definition = assistantDraftDefinitions[draft.entity];
  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = sanitizeAssistantDraft({ entity: draft.entity, fields });
    if (!clean) return;
    const invalid = definition.fields.filter(field => fields[field.name]?.trim() && !clean.fields[field.name]);
    const missing = draftMissingFields(clean);
    if (invalid.length || missing.length) return setError(`Confira os campos: ${[...invalid.map(field => field.label), ...missing].join(', ')}.`);
    setError('');
    onAction?.({ label: 'Revisar cadastro', section: definition.source, create: clean.entity, draft: clean });
  }
  return <form className="fama-ai-draft" onSubmit={review}>
    <div className="fama-ai-block-heading"><FilePenLine size={18} /><div><strong>{definition.title}</strong><small>Os campos seguem para o formulário do sistema.</small></div><span>Rascunho</span></div>
    <div className="fama-ai-draft-fields">{definition.fields.map(field => {
      const inputId = `${id}-${field.name}`;
      const options = field.name === 'technician' && data.employees ? [['', 'Definir no formulário'], ...data.employees.filter(employee => employee.active).map(employee => [employee.name, employee.name])] : field.options;
      const change = (value: string) => { setFields(current => ({ ...current, [field.name]: value })); setError(''); };
      return <div key={field.name} className={field.type === 'textarea' ? 'fama-ai-field-wide' : ''}>
        <label htmlFor={inputId}>{field.label}{field.required ? ' *' : ''}</label>
        {options ? <select id={inputId} value={fields[field.name] ?? ''} required={field.required} onChange={event => change(event.target.value)}>{!options.some(([value]) => value === '') && <option value="">Selecione</option>}{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : field.type === 'textarea' ? <Textarea id={inputId} value={fields[field.name] ?? ''} rows={2} maxLength={1500} required={field.required} onChange={event => change(event.target.value)} /> : <Input id={inputId} type={field.type ?? 'text'} value={fields[field.name] ?? ''} maxLength={200} required={field.required} placeholder={field.placeholder} min={field.name === 'paymentDay' ? 1 : undefined} max={field.name === 'paymentDay' ? 31 : undefined} list={field.name === 'clientName' && data.customers ? `${id}-customers` : undefined} onChange={event => change(event.target.value)} />}
      </div>;
    })}</div>
    {data.customers && <datalist id={`${id}-customers`}>{data.customers.map(customer => <option value={customer.name} key={customer.id} />)}</datalist>}
    {error && <p role="alert" className="fama-ai-form-error">{error}</p>}
    <div className="fama-ai-draft-footer"><small>Revise os demais campos antes de salvar.</small>{onAction && <Button type="submit"><FilePenLine />Revisar no sistema</Button>}</div>
  </form>;
}

export function FamaAiResponse({ answer, name, data, onAction, onAsk }: { answer: AssistantAnswer; name: string; data: AssistantData; onAction?: Props['onAction']; onAsk: (suggestion: AssistantSuggestion) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [copied, setCopied] = useState<'answer' | 'message' | 'failed'>();
  const items = answer.items ?? [];
  const displayed = expanded ? items : items.slice(0, 6);
  const Icon = aiModules[answer.source].icon;
  async function copy(text: string, kind: 'answer' | 'message') {
    try { await navigator.clipboard.writeText(text); setCopied(kind); }
    catch { setCopied('failed'); }
  }
  const chartData = answer.chart?.series.map(item => ({ label: item.label, entradas: item.incomeCents / 100, saidas: item.expenseCents / 100 }));
  return <article className="fama-ai-response">
    <div className="fama-ai-response-heading"><span className="fama-ai-avatar"><Sparkles size={17} /></span><strong>{name}</strong><span className="fama-ai-source-tag"><Icon size={14} />{aiModules[answer.source].label}</span>{answer.engine === 'generative' && <span className="fama-ai-engine-label">Conversa livre</span>}</div>
    <div className="fama-ai-response-body">
      {answer.title && <h3>{answer.title}</h3>}
      {answer.narrative && <p className="fama-ai-answer-text">{answer.narrative}</p>}
      {answer.metrics?.length ? <Metrics metrics={answer.metrics} compact /> : null}
      {answer.chart && chartData && <figure className="fama-ai-chart"><figcaption>{answer.chart.title}</figcaption><div className="fama-ai-chart-canvas" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: 4, right: 8, bottom: 4 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} width={65} tickFormatter={value => Number(value).toLocaleString('pt-BR', { notation: 'compact' })} /><Tooltip formatter={value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} contentStyle={{ borderRadius: 12, background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} /><Bar dataKey="entradas" name="Entradas" fill="#16a085" radius={[4, 4, 0, 0]} /><Bar dataKey="saidas" name="Saídas" fill="#e28a4c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="fama-ai-chart-legend"><span><i />Entradas</span><span><i />Saídas</span><small>Valores em R$ · passe sobre as barras</small></div><table className="sr-only"><caption>{answer.chart.title}</caption><thead><tr><th>Período</th><th>Entradas</th><th>Saídas</th></tr></thead><tbody>{chartData.map(row => <tr key={row.label}><th>{row.label}</th><td>{row.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{row.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}</tbody></table></figure>}
      {answer.steps?.length ? <section className="fama-ai-plan"><div className="fama-ai-block-heading"><ClipboardList size={18} /><strong>Próximos passos</strong><small>{reviewed.length}/{answer.steps.length} conferidos nesta conversa</small></div>{answer.steps.map((step, index) => <div className="fama-ai-plan-step" key={step.id} data-reviewed={reviewed.includes(step.id)}><label><input type="checkbox" checked={reviewed.includes(step.id)} onChange={event => setReviewed(current => event.target.checked ? [...current, step.id] : current.filter(id => id !== step.id))} aria-label={`Marcar como conferido: ${step.title}`} /><span>{String(index + 1).padStart(2, '0')}</span></label><div><strong>{step.title}</strong><p>{step.description}</p></div>{step.question && <Button type="button" variant="outline" size="sm" onClick={() => onAsk({ label: step.title, question: step.question!, source: step.source })}>Consultar</Button>}{step.priority === 'high' && <span className="fama-ai-priority-label">Prioridade</span>}</div>)}</section> : null}
      {answer.draft && <DraftCard draft={answer.draft} data={data} onAction={onAction} />}
      {answer.communication && <section className="fama-ai-communication"><div className="fama-ai-block-heading"><MessageSquareText size={18} /><strong>{answer.communication.title}</strong><Button type="button" variant="outline" size="sm" onClick={() => void copy(answer.communication!.text, 'message')}>{copied === 'message' ? <Check /> : <Copy />}{copied === 'message' ? 'Texto copiado' : 'Copiar texto'}</Button></div><p>{answer.communication.text}</p><small>Texto preparado para sua revisão.</small></section>}
      {answer.items ? <>
        {items.length ? <div className="fama-ai-records">{displayed.map((item, index) => <div className="fama-ai-record" key={`${item.id}-${index}`}>
          <div className="fama-ai-record-main"><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div>
          <div className="fama-ai-record-meta">{item.value && <strong>{item.value}</strong>}{item.status && <span className="fama-ai-status" data-tone={item.tone ?? 'neutral'}>{item.status}</span>}</div>
        </div>)}</div> : !answer.draft && !answer.communication && !answer.steps?.length && !answer.chart && <div className="fama-ai-no-results"><Search size={20} /><p>Nenhum registro encontrado para esta consulta.</p></div>}
        {items.length > 6 && <Button type="button" variant="ghost" size="sm" className="fama-ai-expand" onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? 'Mostrar menos' : `Ver mais ${items.length - 6} resultados`}</Button>}
        {(answer.totalItems ?? 0) > items.length && <p className="fama-ai-note">Exibindo {items.length} de {answer.totalItems} registros. Abra o módulo para consultar todos.</p>}
      </> : !answer.narrative && <p className="fama-ai-answer-text">{answer.text}</p>}
      {answer.note && <p className="fama-ai-note">{answer.note}</p>}
      {onAction && answer.actions.length > 0 && <div className="fama-ai-actions">{answer.actions.map(action => <Button key={`${action.section}-${action.label}`} type="button" variant={action.create ? 'default' : 'outline'} size="sm" onClick={() => onAction(action)}>{action.create ? <Plus /> : action.record ? <Search /> : <FilePenLine />}{action.label}</Button>)}</div>}
      <div className="fama-ai-response-footer"><Button type="button" variant="ghost" size="sm" onClick={() => void copy(answer.text, 'answer')} aria-label="Copiar resposta">{copied === 'answer' ? <Check /> : <Copy />}{copied === 'answer' ? 'Copiado' : 'Copiar resposta'}</Button><span>{copied === 'failed' ? 'Selecione o texto para copiar.' : 'Com base nos registros desta área'}</span></div>
      {copied && <span className="sr-only" role="status">{copied === 'failed' ? 'O navegador não permitiu copiar.' : 'Texto copiado.'}</span>}
    </div>
    {answer.suggestions?.length ? <div className="fama-ai-followups">{answer.suggestions.map(suggestion => <button type="button" key={suggestion.question} onClick={() => onAsk(suggestion)}>{suggestion.label}<Search size={14} /></button>)}</div> : null}
  </article>;
}

export function FamaAiPanel({ data, onAction, scopeLabel = 'Área atual', allowedSections, allowedSources = allSources, settings = defaultAssistantSettings, organizationId, platform = false, preview = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<AssistantSource>('overview');
  const [previousSource, setPreviousSource] = useState<AssistantSource>();
  const [customerName, setCustomerName] = useState<string>();
  const [clientPicker, setClientPicker] = useState(false);
  const [draftPicker, setDraftPicker] = useState(false);
  const [draftEntity, setDraftEntity] = useState<AssistantDraftEntity>('appointments');
  const connection = useAssistantConnection({ organizationId, platform, preview });
  const [showHelp, setShowHelp] = useState(false);
  const [hasNewResponse, setHasNewResponse] = useState(false);
  const questionId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const scopedSettings = useMemo(() => restrictAssistantSettings(settings, allowedSources), [settings, allowedSources]);
  const availableSources = allSources.filter(id => scopedSettings.sources[id]);
  const canAsk = settings.enabled && availableSources.length > 0;
  const responseData = { employees: scopedSettings.sources.team ? data.employees : undefined, customers: scopedSettings.sources.customers ? data.customers : undefined };
  const draftEntities = (Object.keys(assistantDraftDefinitions) as AssistantDraftEntity[]).filter(entity => scopedSettings.sources[assistantDraftDefinitions[entity].source]);
  const selectedSource = availableSources.includes(source) ? source : availableSources[0] ?? 'overview';
  const workspace = useMemo(() => buildAssistantWorkspace(data, new Date(), scopedSettings), [data, scopedSettings]);
  const visibleInsights = workspace.insights;
  const sourceModule = aiModules[selectedSource];
  const ModuleIcon = sourceModule.icon;
  const prompts = (selectedSource === 'overview' ? aiStarterSources.filter(id => availableSources.includes(id)).slice(0, 6).map(id => aiModules[id].prompts[0]) : sourceModule.prompts)
    .filter(item => canAsk && scopedSettings.sources[item.source] && (settings.detectConflicts || !/conflitos?/i.test(item.question)));
  const latestAnswer = [...messages].reverse().find(item => item.answer)?.answer;

  function scrollToLatest() {
    const container = conversationRef.current;
    if (container) container.scrollTop = container.scrollHeight;
    setHasNewResponse(false);
  }
  useEffect(() => {
    const container = conversationRef.current;
    if (!container || !messages.length) return;
    // Keep the answer in this pane; never move the containing page or steal focus.
    container.scrollTop = container.scrollHeight;
    setHasNewResponse(false);
  }, [messages]);

  async function send(text: string, selected = selectedSource) {
    if (!canAsk || connection.busy || !text.trim()) return;
    const question = text.trim();
    const local = answerInternal(question, data, selected, new Date(), scopedSettings, { previousSource, customerName });
    const answer = connection.useGenerative ? await connection.ask({ question, source: selected, history: messages.filter(item => item.role === 'user').slice(-4).map(item => item.content), customerName }) : local;
    if (!answer) return;
    answer.actions = answer.actions.filter(action => (!allowedSections || allowedSections.includes(action.section)) && (action.create ? scopedSettings.allowCreate : scopedSettings.allowNavigation));
    setMessages(previous => [...previous.slice(-38), { id: nextId.current++, role: 'user', content: question }, { id: nextId.current++, role: 'assistant', content: answer.text, answer }]);
    setPreviousSource(answer.source); setCustomerName(answer.customerName ?? customerName); setMessage(''); composerRef.current?.focus();
  }
  function ask(suggestion: AssistantSuggestion) { void send(suggestion.question, suggestion.source); }
  function newConversation() { connection.cancel(); setMessages([]); setMessage(''); setPreviousSource(undefined); setCustomerName(undefined); setSource(availableSources.includes('overview') ? 'overview' : availableSources[0] ?? 'overview'); composerRef.current?.focus(); }

  return <section className="fama-ai" aria-label="Central Fama IA">
    <header className="fama-ai-header">
      <div className="fama-ai-brand"><div className="fama-ai-brand-icon"><Sparkles /></div><div><span className="fama-ai-eyebrow">Seu copiloto de gestão</span><h2>{settings.name}</h2></div></div>
      <div className="fama-ai-header-actions"><span className="fama-ai-scope" title={scopeLabel}><span />{scopeLabel}</span><Button type="button" variant="outline" onClick={newConversation}><Plus />Nova conversa</Button></div>
    </header>
    {workspace.metrics.length > 0 && <Metrics metrics={workspace.metrics} />}
    <div className="fama-ai-workspace">
      <aside className="fama-ai-rail" aria-label="Módulos da assistente">
        <div className="fama-ai-rail-heading"><Sparkles size={16} /><span>Espaço de trabalho</span></div>
        <p>Consulte, planeje e prepare ações</p>
        <nav>{availableSources.map(id => { const Icon = aiModules[id].icon; return <button type="button" key={id} aria-pressed={selectedSource === id} onClick={() => { setSource(id); composerRef.current?.focus(); }}><Icon size={18} /><span>{aiModules[id].label}</span>{workspace.counts[id] !== undefined && id !== 'overview' && <small>{workspace.counts[id]}</small>}</button>; })}</nav>
        <div className="fama-ai-rail-tip"><Search size={18} /><strong>Encontre um registro</strong><p>Escolha o módulo e digite <b>buscar: nome</b>. Você também pode buscar um número de orçamento ou contrato.</p></div>
        <button type="button" className="fama-ai-help-button" onClick={() => setShowHelp(value => !value)} aria-expanded={showHelp}>Dicas para perguntar<ArrowRight size={15} /></button>
      </aside>
      <div className="fama-ai-main">
        <div className="fama-ai-workflows" aria-label="Ferramentas da assistente">
          {scopedSettings.sources.overview && <button type="button" disabled={!canAsk || connection.busy} onClick={() => ask({ label: 'Plano do dia', question: 'Plano de ação da empresa', source: 'overview' })}><ClipboardList /><span>Plano do dia<small>Pendências e próximos passos</small></span></button>}
          {scopedSettings.sources.agenda && <button type="button" disabled={!canAsk || connection.busy} onClick={() => ask({ label: 'Planejar equipe', question: 'Planejar agenda da semana', source: 'agenda' })}><CalendarDays /><span>Planejar equipe<small>Carga e horários sugeridos</small></span></button>}
          {scopedSettings.sources.customers && <button type="button" disabled={!canAsk || connection.busy} onClick={() => setClientPicker(true)}><ContactRound /><span>Cliente 360<small>Histórico entre os módulos</small></span></button>}
          {scopedSettings.sources.finance && <button type="button" disabled={!canAsk || connection.busy} onClick={() => ask({ label: 'Projetar financeiro', question: 'Fluxo de caixa dos próximos 30 dias', source: 'finance' })}><CircleDollarSign /><span>Projetar financeiro<small>Entradas e saídas previstas</small></span></button>}
        </div>
        <div className="fama-ai-context-bar"><div><ModuleIcon size={17} /><strong>{selectedSource === 'overview' ? 'Conversa com sua operação' : sourceModule.label}</strong></div><span>{messages.length ? `${messages.filter(item => item.role === 'user').length} consulta(s)` : 'Pronto para ajudar'}</span></div>
        <div className="fama-ai-mobile-module"><label htmlFor={`${questionId}-module`}>Foco da consulta</label><select id={`${questionId}-module`} disabled={!canAsk} value={selectedSource} onChange={event => setSource(event.target.value as AssistantSource)}>{availableSources.length ? availableSources.map(id => <option key={id} value={id}>{aiModules[id].label}</option>) : <option value="overview">Nenhuma função disponível</option>}</select></div>
        {showHelp && <div className="fama-ai-help"><div><strong>Perguntas que ajudam a decidir</strong><button type="button" aria-label="Fechar dicas" onClick={() => setShowHelp(false)}><X size={17} /></button></div><p>“Agenda de amanhã”, “orçamentos enviados”, “contratos a vencer em 30 dias” ou “financeiro de 01/10/2026 a 15/10/2026”. Para continuar no mesmo assunto, pergunte “e amanhã?” ou “somente os pendentes”.</p><p>Para preparar um registro, use “Agendar visita para João amanhã às 14h” ou “Criar despesa; descrição: material; valor: 450,00; vencimento: 10/10/2026”. Consulte “Cliente 360: nome”, “Comparar financeiro” ou “Mensagem para orçamento: ORC-001”.</p><small>Os rascunhos abrem formulários para revisão. Você confirma e salva no sistema.</small></div>}
        {!canAsk ? <div className="fama-ai-disabled" role="status"><Sparkles /><h3>{settings.enabled ? 'Nenhuma função disponível' : 'Assistente pausada'}</h3><p>{settings.enabled ? 'As funções disponíveis dependem das permissões desta área e da configuração do Fama Control.' : 'Ative a assistente nas configurações do Fama Control para retomar as consultas.'}</p></div> : <>
          <div className={`fama-ai-conversation ${!messages.length ? 'fama-ai-conversation-empty' : ''}`} ref={conversationRef} onScroll={event => { const target = event.currentTarget; setHasNewResponse(target.scrollHeight - target.scrollTop - target.clientHeight > 140); }}>
            {!messages.length ? <div className="fama-ai-welcome">
              <span className="fama-ai-welcome-symbol"><Sparkles size={27} /></span>
              <span className="fama-ai-eyebrow">{selectedSource === 'overview' ? 'Um novo olhar para sua gestão' : sourceModule.label}</span>
              <h3>{selectedSource === 'overview' ? 'Qual é o próximo passo de hoje?' : `Vamos cuidar de ${sourceModule.label.toLocaleLowerCase('pt-BR')}?`}</h3>
              <p>{selectedSource === 'overview' ? settings.welcome || 'Consulte sua operação e encontre as informações para decidir o próximo passo.' : sourceModule.description}</p>
              <div className="fama-ai-prompts">{prompts.map(prompt => { const Icon = aiModules[prompt.source].icon; return <button type="button" key={prompt.question} onClick={() => ask(prompt)}><span className="fama-ai-prompt-icon"><Icon size={19} /></span><span><small>{aiModules[prompt.source].label}</small><strong>{prompt.label}</strong></span><ArrowUp size={17} /></button>; })}</div>
              {visibleInsights.length > 0 && <div className="fama-ai-priorities"><div className="fama-ai-priorities-title"><TriangleAlert size={16} /><strong>Atenção agora</strong><span>{visibleInsights.length} ponto(s) para acompanhar</span></div>{visibleInsights.slice(0, 3).map(insight => <button type="button" key={insight.id} onClick={() => ask({ label: insight.title, question: insight.question, source: insight.source })}><span className="fama-ai-priority-dot" data-tone={insight.tone} /><span><strong>{insight.title}</strong><small>{insight.detail}</small></span><b>{insight.value}</b><ArrowRight size={16} /></button>)}</div>}
            </div> : <div role="log" aria-label="Conversa com Fama IA" aria-live="polite" aria-relevant="additions" className="fama-ai-messages">{messages.map(item => item.role === 'user' ? <div className="fama-ai-user-message" key={item.id}><span>Você</span><p>{item.content}</p></div> : item.answer && <FamaAiResponse key={item.id} answer={item.answer} name={settings.name} data={responseData} onAction={onAction} onAsk={ask} />)}</div>}
          </div>
          {hasNewResponse && messages.length > 0 && <Button type="button" variant="outline" size="sm" className="fama-ai-jump" onClick={scrollToLatest}><ArrowDown />Ir para a última resposta</Button>}
        </>}
        <div className="fama-ai-composer-area">
          {messages.length > 0 && <div className="fama-ai-composer-context"><span className="fama-ai-context-dot" />{customerName ? `Cliente: ${customerName} · ` : 'Contexto atual: '}<strong>{aiModules[latestAnswer?.source ?? selectedSource].label}</strong></div>}
          <div className="fama-ai-mode-bar"><span><CircleCheck size={15} />{connection.useGenerative ? 'Conversa livre conectada' : 'Análise dos registros'}</span>{settings.allowCreate && draftEntities.length > 0 && <Button type="button" variant="ghost" size="sm" disabled={!canAsk || connection.busy} onClick={() => setDraftPicker(true)}><FilePenLine />Preparar cadastro</Button>}{connection.configured && <button type="button" disabled={connection.busy} onClick={() => connection.setUseGenerative(!connection.useGenerative)}>{connection.useGenerative ? 'Usar consultas internas' : 'Usar conversa livre'}</button>}</div>
          {connection.error && <p className="fama-ai-connection-error" role="alert">{connection.error}<button type="button" onClick={() => connection.setUseGenerative(false)}>Continuar com consultas internas</button></p>}
          {connection.busy && <div role="status" className="fama-ai-thinking"><LoaderCircle />Consultando os registros da sua empresa…<button type="button" onClick={connection.cancel}>Cancelar</button></div>}
          <form onSubmit={event => { event.preventDefault(); void send(message); }} className="fama-ai-composer">
            <label htmlFor={questionId} className="sr-only">Sua pergunta para a Fama IA</label>
            <Textarea ref={composerRef} id={questionId} disabled={!canAsk || connection.busy} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} rows={2} placeholder={selectedSource === 'overview' ? 'Pergunte sobre sua empresa, agenda, financeiro…' : `Pergunte sobre ${sourceModule.label.toLocaleLowerCase('pt-BR')} ou use “buscar: nome”…`} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(message); } }} />
            <div className="fama-ai-composer-toolbar"><span><Sparkles size={14} />{selectedSource === 'overview' ? 'Identifica o módulo da pergunta' : sourceModule.label}</span><Button type="submit" disabled={!canAsk || connection.busy || !message.trim()} className="fama-ai-send" aria-label="Enviar pergunta"><ArrowUp size={18} /><span>Enviar</span></Button></div>
          </form>
          <div className="fama-ai-composer-note"><span>Confira os registros antes de tomar uma decisão.</span><span>{message.length > 1200 ? `${message.length}/2.000` : 'Enter envia · Shift + Enter quebra a linha'}</span></div>
        </div>
      </div>
    </div>
    <Dialog open={clientPicker} onOpenChange={setClientPicker}><DialogContent><DialogHeader><DialogTitle>Visão completa do cliente</DialogTitle><DialogDescription>Escolha um cliente da empresa selecionada para reunir seu histórico.</DialogDescription></DialogHeader><div className="fama-ai-client-picker">{responseData.customers?.length ? responseData.customers.map(customer => <button type="button" key={customer.id} onClick={() => { setClientPicker(false); ask({ label: customer.name, question: `Cliente 360: ${customer.name}`, source: 'customers' }); }}><ContactRound /><span><strong>{customer.name}</strong><small>{customer.poolType || 'Cliente cadastrado'}</small></span><Search /></button>) : <p>Nenhum cliente disponível nesta área. Confira o cadastro e as permissões.</p>}</div></DialogContent></Dialog>
    <Dialog open={draftPicker} onOpenChange={setDraftPicker}><DialogContent><DialogHeader><DialogTitle>Preparar cadastro</DialogTitle><DialogDescription>Escolha o registro. A assistente monta os campos para você revisar no formulário.</DialogDescription></DialogHeader><label htmlFor={`${questionId}-draft`}>Tipo de registro</label><select className="fama-ai-draft-selector" id={`${questionId}-draft`} value={draftEntities.includes(draftEntity) ? draftEntity : draftEntities[0] ?? ''} onChange={event => setDraftEntity(event.target.value as AssistantDraftEntity)}>{draftEntities.map(entity => <option key={entity} value={entity}>{assistantDraftDefinitions[entity].title}</option>)}</select><Button type="button" disabled={!canAsk || !draftEntities.length} onClick={() => { const entity = draftEntities.includes(draftEntity) ? draftEntity : draftEntities[0]; if (!entity) return; setDraftPicker(false); ask({ label: 'Preparar cadastro', question: `Preparar ${entity === 'transactions' ? 'lançamento financeiro' : entity === 'appointments' ? 'agendamento' : entity === 'workOrders' ? 'ordem de serviço' : entity === 'leads' ? 'lead' : entity === 'quotes' ? 'orçamento' : entity === 'contracts' ? 'contrato' : 'cliente'}`, source: assistantDraftDefinitions[entity].source }); }}>Preparar campos</Button></DialogContent></Dialog>
    <footer className="fama-ai-footer"><span>Consultas nos dados disponíveis para seu usuário</span><button type="button" onClick={() => setShowHelp(value => !value)}>Como usar a Fama IA<ArrowRight size={14} /></button></footer>
  </section>;
}
