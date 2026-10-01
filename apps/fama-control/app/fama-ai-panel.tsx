'use client';

import { useState } from 'react';
import { answerInternal, assistantSources, type AssistantAction, type AssistantData, type AssistantSource } from '@/lib/fama-ai';
import { defaultAssistantSettings, restrictAssistantSettings, type AssistantSettings } from '@/lib/fama-ai-settings';

type Message = { role: 'user' | 'assistant'; content: string; actions?: AssistantAction[] };
type Props = { data: AssistantData; onAction?: (action: AssistantAction) => void; scopeLabel?: string; allowedSections?: readonly string[]; allowedSources?: readonly AssistantSource[]; settings?: AssistantSettings };
const shortcuts: { text: string; source: AssistantSource; conflict?: boolean }[] = [
  { text: 'Resumo da gestão', source: 'overview' }, { text: 'Agenda de hoje', source: 'agenda' }, { text: 'Agenda amanhã', source: 'agenda' },
  { text: 'Conflitos na agenda', source: 'agenda', conflict: true }, { text: 'Orçamentos', source: 'quotes' }, { text: 'Contratos ativos', source: 'contracts' },
  { text: 'Estoque baixo', source: 'inventory' }, { text: 'Resumo financeiro', source: 'finance' }, { text: 'Empresas suspensas', source: 'companies' },
];
const buttonClass = 'rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

export function FamaAiPanel({ data, onAction, scopeLabel = 'Área atual', allowedSections, allowedSources = Object.keys(assistantSources) as AssistantSource[], settings = defaultAssistantSettings }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<AssistantSource>('overview');
  const scopedSettings = restrictAssistantSettings(settings, allowedSources);
  const availableSources = allowedSources.filter(id => scopedSettings.sources[id]);
  const canAsk = settings.enabled && availableSources.length > 0;
  const selectedSource = availableSources.includes(source) ? source : availableSources[0] ?? 'overview';

  function send(text: string, selected = selectedSource) {
    if (!canAsk || !text.trim()) return;
    const answer = answerInternal(text, data, selected, new Date(), scopedSettings);
    setMessages(previous => [...previous.slice(-38), { role: 'user', content: text }, { role: 'assistant', content: answer.text, actions: answer.actions.filter(action => !allowedSections || allowedSections.includes(action.section)) }]);
    setMessage('');
  }

  return <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold">{settings.name}</h2><p className="mt-2 text-sm text-muted-foreground">{scopeLabel}</p></div>
      <button type="button" onClick={() => { setMessages([]); setMessage(''); }} className={buttonClass}>Nova conversa</button>
    </div>
    <p className="mt-3 text-sm text-muted-foreground">Consulte os registros disponíveis para você. As ações abrem os módulos e os formulários para você revisar e salvar.</p>
    <label className="mt-5 flex flex-wrap items-center gap-3 text-sm">Módulo
      <select disabled={!canAsk} value={selectedSource} onChange={event => { setSource(event.target.value as AssistantSource); setMessages([]); setMessage(''); }} className="rounded-xl border border-border bg-background p-2">
        {availableSources.length ? availableSources.map(id => <option key={id} value={id}>{assistantSources[id]}</option>) : <option value="overview">Nenhuma função disponível</option>}
      </select>
    </label>
    {!canAsk && <p role="status" className="mt-4 text-sm text-muted-foreground">{settings.enabled ? 'Nenhuma função da assistente está disponível nesta área.' : 'O assistente está desativado pelo Fama Control.'}</p>}
    <div className="mt-4 flex flex-wrap gap-2">{shortcuts.filter(item => canAsk && scopedSettings.sources[item.source] && (!item.conflict || settings.detectConflicts)).map(({ text, source: shortcutSource }) => <button type="button" key={text} onClick={() => { setSource(shortcutSource); send(text, shortcutSource); }} className={buttonClass}>{text}</button>)}</div>
    <div role="log" aria-label="Conversa com Fama IA" aria-live="polite" className="my-5 max-h-[480px] space-y-4 overflow-y-auto">
      {!messages.length && <p className="text-sm text-muted-foreground">{settings.welcome}</p>}
      {messages.map((item, index) => <div key={index} className={'rounded-xl border border-border p-4 '+(item.role === 'user' ? 'bg-muted' : 'bg-background')}><b className="text-sm text-primary">{item.role === 'user' ? 'Você' : settings.name}</b><p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.content}</p>{onAction && <div className="mt-3 flex flex-wrap gap-2">{item.actions?.map(action => <button type="button" key={action.label} onClick={() => onAction(action)} className={buttonClass}>{action.label}</button>)}</div>}</div>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); send(message); }}>
      <label htmlFor="fama-ai-question" className="text-sm">Sua pergunta</label>
      <textarea id="fama-ai-question" disabled={!canAsk} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} rows={3} placeholder="Escolha um módulo e faça sua consulta…" className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm" />
      <button type="submit" disabled={!canAsk || !message.trim()} className="mt-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Consultar sistema</button>
    </form>
    <p className="mt-4 text-sm text-muted-foreground">Datas seguem o fuso do seu dispositivo. A consulta usa a última atualização dos registros nesta tela.</p>
  </section>;
}
