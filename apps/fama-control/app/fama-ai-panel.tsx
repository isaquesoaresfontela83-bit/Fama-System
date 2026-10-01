'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Plus, Search, Sparkles, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { answerInternal, assistantSources, buildAssistantWorkspace, type AssistantAction, type AssistantAnswer, type AssistantData, type AssistantMetric, type AssistantSource, type AssistantSuggestion } from '@/lib/fama-ai';
import { defaultAssistantSettings, restrictAssistantSettings, type AssistantSettings } from '@/lib/fama-ai-settings';
import { aiModules, aiStarterSources } from './fama-ai-modules';

const allSources = Object.keys(assistantSources) as AssistantSource[];
type Message = { id: number; role: 'user' | 'assistant'; content: string; answer?: AssistantAnswer };
type Props = { data: AssistantData; onAction?: (action: AssistantAction) => void; scopeLabel?: string; allowedSections?: readonly string[]; allowedSources?: readonly AssistantSource[]; settings?: AssistantSettings };

function Metrics({ metrics, compact = false }: { metrics: AssistantMetric[]; compact?: boolean }) {
  return <div className={`fama-ai-metrics ${compact ? 'fama-ai-metrics-compact' : ''}`}>
    {metrics.map(metric => <div key={metric.label} className="fama-ai-metric" data-tone={metric.tone ?? 'neutral'}>
      <span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail && <small>{metric.detail}</small>}
    </div>)}
  </div>;
}

function AssistantResponse({ answer, name, onAction, onAsk }: { answer: AssistantAnswer; name: string; onAction?: Props['onAction']; onAsk: (suggestion: AssistantSuggestion) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const items = answer.items ?? [];
  const displayed = expanded ? items : items.slice(0, 6);
  const Icon = aiModules[answer.source].icon;
  async function copy() {
    try { await navigator.clipboard.writeText(answer.text); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  }
  return <article className="fama-ai-response">
    <div className="fama-ai-response-heading"><span className="fama-ai-avatar"><Sparkles size={17} /></span><strong>{name}</strong><span className="fama-ai-source-tag"><Icon size={13} />{aiModules[answer.source].label}</span></div>
    <div className="fama-ai-response-body">
      {answer.title && <h3>{answer.title}</h3>}
      {answer.metrics?.length ? <Metrics metrics={answer.metrics} compact /> : null}
      {answer.items ? <>
        {items.length ? <div className="fama-ai-records">{displayed.map((item, index) => <div className="fama-ai-record" key={`${item.id}-${index}`}>
          <div className="fama-ai-record-main"><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div>
          <div className="fama-ai-record-meta">{item.value && <strong>{item.value}</strong>}{item.status && <span className="fama-ai-status" data-tone={item.tone ?? 'neutral'}>{item.status}</span>}</div>
        </div>)}</div> : <div className="fama-ai-no-results"><Search size={20} /><p>Nenhum registro encontrado para esta consulta.</p></div>}
        {items.length > 6 && <Button type="button" variant="ghost" size="sm" className="fama-ai-expand" onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? 'Mostrar menos' : `Ver mais ${items.length - 6} resultados`}</Button>}
        {(answer.totalItems ?? 0) > items.length && <p className="fama-ai-note">Exibindo {items.length} de {answer.totalItems} registros. Abra o módulo para consultar todos.</p>}
        {answer.note && <p className="fama-ai-note">{answer.note}</p>}
      </> : <p className="fama-ai-answer-text">{answer.text}</p>}
      {onAction && answer.actions.length > 0 && <div className="fama-ai-actions">{answer.actions.map(action => <Button key={`${action.section}-${action.label}`} type="button" variant={action.create ? 'default' : 'outline'} size="sm" onClick={() => onAction(action)}>{action.create ? <Plus /> : <ArrowRight />}{action.label}</Button>)}</div>}
      <div className="fama-ai-response-footer"><Button type="button" variant="ghost" size="sm" onClick={() => void copy()} aria-label="Copiar resposta">{copyState === 'copied' ? <Check /> : <Copy />}{copyState === 'copied' ? 'Copiado' : 'Copiar'}</Button><span>{copyState === 'failed' ? 'Selecione o texto para copiar.' : 'Com base nos registros desta área'}</span></div>
      {copyState !== 'idle' && <span className="sr-only" role="status">{copyState === 'copied' ? 'Resposta copiada.' : 'O navegador não permitiu copiar a resposta.'}</span>}
    </div>
    {answer.suggestions?.length ? <div className="fama-ai-followups">{answer.suggestions.map(suggestion => <button type="button" key={suggestion.question} onClick={() => onAsk(suggestion)}>{suggestion.label}<ArrowRight size={14} /></button>)}</div> : null}
  </article>;
}

export function FamaAiPanel({ data, onAction, scopeLabel = 'Área atual', allowedSections, allowedSources = allSources, settings = defaultAssistantSettings }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<AssistantSource>('overview');
  const [previousSource, setPreviousSource] = useState<AssistantSource>();
  const [showHelp, setShowHelp] = useState(false);
  const [hasNewResponse, setHasNewResponse] = useState(false);
  const questionId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const scopedSettings = useMemo(() => restrictAssistantSettings(settings, allowedSources), [settings, allowedSources]);
  const availableSources = allSources.filter(id => scopedSettings.sources[id]);
  const canAsk = settings.enabled && availableSources.length > 0;
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

  function send(text: string, selected = selectedSource) {
    if (!canAsk || !text.trim()) return;
    const answer = answerInternal(text.trim(), data, selected, new Date(), scopedSettings, { previousSource });
    answer.actions = answer.actions.filter(action => !allowedSections || allowedSections.includes(action.section));
    setMessages(previous => [...previous.slice(-38), { id: nextId.current++, role: 'user', content: text.trim() }, { id: nextId.current++, role: 'assistant', content: answer.text, answer }]);
    setPreviousSource(answer.source); setMessage(''); composerRef.current?.focus();
  }
  function ask(suggestion: AssistantSuggestion) { send(suggestion.question, suggestion.source); }
  function newConversation() { setMessages([]); setMessage(''); setPreviousSource(undefined); setSource(availableSources.includes('overview') ? 'overview' : availableSources[0] ?? 'overview'); composerRef.current?.focus(); }

  return <section className="fama-ai" aria-label="Central Fama IA">
    <header className="fama-ai-header">
      <div className="fama-ai-brand"><div className="fama-ai-brand-icon"><Sparkles /></div><div><span className="fama-ai-eyebrow">Sua operação, mais clara</span><h2>{settings.name}</h2></div></div>
      <div className="fama-ai-header-actions"><span className="fama-ai-scope" title={scopeLabel}><span />{scopeLabel}</span><Button type="button" variant="outline" onClick={newConversation}><Plus />Nova conversa</Button></div>
    </header>
    {workspace.metrics.length > 0 && <Metrics metrics={workspace.metrics} />}
    <div className="fama-ai-workspace">
      <aside className="fama-ai-rail" aria-label="Módulos da assistente">
        <div className="fama-ai-rail-heading"><Sparkles size={16} /><span>Espaço de trabalho</span></div>
        <p>Escolha o foco da consulta</p>
        <nav>{availableSources.map(id => { const Icon = aiModules[id].icon; return <button type="button" key={id} aria-pressed={selectedSource === id} onClick={() => { setSource(id); composerRef.current?.focus(); }}><Icon size={18} /><span>{aiModules[id].label}</span>{workspace.counts[id] !== undefined && id !== 'overview' && <small>{workspace.counts[id]}</small>}</button>; })}</nav>
        <div className="fama-ai-rail-tip"><Search size={18} /><strong>Encontre um registro</strong><p>Escolha o módulo e digite <b>buscar: nome</b>. Você também pode buscar um número de orçamento ou contrato.</p></div>
        <button type="button" className="fama-ai-help-button" onClick={() => setShowHelp(value => !value)} aria-expanded={showHelp}>Dicas para perguntar<ArrowRight size={15} /></button>
      </aside>
      <div className="fama-ai-main">
        <div className="fama-ai-context-bar"><div><ModuleIcon size={17} /><strong>{selectedSource === 'overview' ? 'Conversa com sua operação' : sourceModule.label}</strong></div><span>{messages.length ? `${messages.filter(item => item.role === 'user').length} consulta(s)` : 'Pronto para ajudar'}</span></div>
        <div className="fama-ai-mobile-module"><label htmlFor={`${questionId}-module`}>Foco da consulta</label><select id={`${questionId}-module`} disabled={!canAsk} value={selectedSource} onChange={event => setSource(event.target.value as AssistantSource)}>{availableSources.length ? availableSources.map(id => <option key={id} value={id}>{aiModules[id].label}</option>) : <option value="overview">Nenhuma função disponível</option>}</select></div>
        {showHelp && <div className="fama-ai-help"><div><strong>Perguntas que ajudam a decidir</strong><button type="button" aria-label="Fechar dicas" onClick={() => setShowHelp(false)}><X size={17} /></button></div><p>“Agenda de amanhã”, “orçamentos enviados”, “contratos a vencer em 30 dias” ou “financeiro de 01/10/2026 a 15/10/2026”. Para continuar no mesmo assunto, pergunte “e amanhã?” ou “somente os pendentes”.</p><small>As respostas usam consultas internas. O assistente abre cadastros para você revisar e salvar.</small></div>}
        {!canAsk ? <div className="fama-ai-disabled" role="status"><Sparkles /><h3>{settings.enabled ? 'Nenhuma função disponível' : 'Assistente pausada'}</h3><p>{settings.enabled ? 'As funções disponíveis dependem das permissões desta área e da configuração do Fama Control.' : 'Ative a assistente nas configurações do Fama Control para retomar as consultas.'}</p></div> : <>
          <div className={`fama-ai-conversation ${!messages.length ? 'fama-ai-conversation-empty' : ''}`} ref={conversationRef} onScroll={event => { const target = event.currentTarget; setHasNewResponse(target.scrollHeight - target.scrollTop - target.clientHeight > 140); }}>
            {!messages.length ? <div className="fama-ai-welcome">
              <span className="fama-ai-welcome-symbol"><Sparkles size={27} /></span>
              <span className="fama-ai-eyebrow">{selectedSource === 'overview' ? 'Um novo olhar para sua gestão' : sourceModule.label}</span>
              <h3>{selectedSource === 'overview' ? 'Qual é o próximo passo de hoje?' : `Vamos cuidar de ${sourceModule.label.toLocaleLowerCase('pt-BR')}?`}</h3>
              <p>{selectedSource === 'overview' ? settings.welcome || 'Consulte sua operação e encontre as informações para decidir o próximo passo.' : sourceModule.description}</p>
              <div className="fama-ai-prompts">{prompts.map(prompt => { const Icon = aiModules[prompt.source].icon; return <button type="button" key={prompt.question} onClick={() => ask(prompt)}><span className="fama-ai-prompt-icon"><Icon size={19} /></span><span><small>{aiModules[prompt.source].label}</small><strong>{prompt.label}</strong></span><ArrowUp size={17} /></button>; })}</div>
              {visibleInsights.length > 0 && <div className="fama-ai-priorities"><div className="fama-ai-priorities-title"><TriangleAlert size={16} /><strong>Atenção agora</strong><span>{visibleInsights.length} ponto(s) para acompanhar</span></div>{visibleInsights.slice(0, 3).map(insight => <button type="button" key={insight.id} onClick={() => ask({ label: insight.title, question: insight.question, source: insight.source })}><span className="fama-ai-priority-dot" data-tone={insight.tone} /><span><strong>{insight.title}</strong><small>{insight.detail}</small></span><b>{insight.value}</b><ArrowRight size={16} /></button>)}</div>}
            </div> : <div role="log" aria-label="Conversa com Fama IA" aria-live="polite" aria-relevant="additions" className="fama-ai-messages">{messages.map(item => item.role === 'user' ? <div className="fama-ai-user-message" key={item.id}><span>Você</span><p>{item.content}</p></div> : item.answer && <AssistantResponse key={item.id} answer={item.answer} name={settings.name} onAction={onAction} onAsk={ask} />)}</div>}
          </div>
          {hasNewResponse && messages.length > 0 && <Button type="button" variant="outline" size="sm" className="fama-ai-jump" onClick={scrollToLatest}><ArrowDown />Ir para a última resposta</Button>}
        </>}
        <div className="fama-ai-composer-area">
          {messages.length > 0 && <div className="fama-ai-composer-context"><span className="fama-ai-context-dot" />Contexto atual: <strong>{aiModules[latestAnswer?.source ?? selectedSource].label}</strong></div>}
          <form onSubmit={event => { event.preventDefault(); send(message); }} className="fama-ai-composer">
            <label htmlFor={questionId} className="sr-only">Sua pergunta para a Fama IA</label>
            <Textarea ref={composerRef} id={questionId} disabled={!canAsk} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} rows={2} placeholder={selectedSource === 'overview' ? 'Pergunte sobre sua empresa, agenda, financeiro…' : `Pergunte sobre ${sourceModule.label.toLocaleLowerCase('pt-BR')} ou use “buscar: nome”…`} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(message); } }} />
            <div className="fama-ai-composer-toolbar"><span><Sparkles size={14} />{selectedSource === 'overview' ? 'Identifica o módulo da pergunta' : sourceModule.label}</span><Button type="submit" disabled={!canAsk || !message.trim()} className="fama-ai-send" aria-label="Enviar pergunta"><ArrowUp size={18} /><span>Enviar</span></Button></div>
          </form>
          <div className="fama-ai-composer-note"><span>Confira os registros antes de tomar uma decisão.</span><span>{message.length > 1200 ? `${message.length}/2.000` : 'Enter envia · Shift + Enter quebra a linha'}</span></div>
        </div>
      </div>
    </div>
    <footer className="fama-ai-footer"><span>Consultas nos dados disponíveis para seu usuário</span><button type="button" onClick={() => setShowHelp(value => !value)}>Como usar a Fama IA<ArrowRight size={14} /></button></footer>
  </section>;
}
