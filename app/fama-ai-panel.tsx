'use client';

import { useState } from 'react';
import { answerInternal, assistantSources, type AssistantAction, type AssistantData, type AssistantSource } from '@/lib/fama-ai';
import { defaultAssistantSettings, type AssistantSettings } from '@/lib/fama-ai-settings';

type Message = { role: 'user' | 'assistant'; content: string; actions?: AssistantAction[] };
type Props = { data: AssistantData; onAction?: (action: AssistantAction) => void; scopeLabel?: string; allowedSections?: readonly string[]; settings?: AssistantSettings };
const shortcuts: { text: string; source: AssistantSource; conflict?: boolean }[] = [
  { text: 'Resumo da gestão', source: 'overview' }, { text: 'Agenda de hoje', source: 'agenda' }, { text: 'Agenda amanhã', source: 'agenda' },
  { text: 'Conflitos na agenda', source: 'agenda', conflict: true }, { text: 'Estoque baixo', source: 'inventory' }, { text: 'Resumo financeiro', source: 'finance' },
];

export function FamaAiPanel({ data, onAction, scopeLabel = 'Área atual', allowedSections, settings = defaultAssistantSettings }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<AssistantSource>('overview');

  function send(text: string, selected = source) {
    if (!text.trim()) return;
    const answer = answerInternal(text, data, selected, new Date(), settings);
    setMessages(previous => [...previous.slice(-38), { role: 'user', content: text }, { role: 'assistant', content: answer.text, actions: answer.actions.filter(action => !allowedSections || allowedSections.includes(action.section)) }]);
    setMessage('');
  }

  return <section className="rounded-2xl border border-[#2a507c] bg-[#0d284c] p-5 text-[#edf7ff]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-bold">{settings.name}</h1><p className="mt-2 text-sm text-[#b8cadb]">Assistente local de gestão · {scopeLabel}</p></div>
      <button onClick={() => { setMessages([]); setMessage(''); }} className="rounded-xl border border-[#2a507c] px-3 py-2">Nova conversa</button>
    </div>
    <label className="mt-5 block text-sm">Módulo
      <select value={source} onChange={event => { setSource(event.target.value as AssistantSource); setMessages([]); }} className="ml-3 rounded-xl border border-[#355f8b] bg-[#12335d] p-2">
        {Object.entries(assistantSources).map(([id, label]) => <option key={id} value={id} disabled={!settings.sources[id as AssistantSource]}>{label}{!settings.sources[id as AssistantSource] ? ' (desativado)' : ''}</option>)}
      </select>
    </label>
    <p className="mt-2 text-xs text-[#b8cadb]">Funciona por regras locais, sem API externa. Usa os registros já carregados nesta área. Datas seguem o fuso do navegador. As ações abrem os módulos e formulários existentes.</p>
    {!settings.enabled && <p role="status" className="mt-4 text-[#ffe3a8]">O assistente está desativado pelo Fama Control.</p>}
    <div className="mt-4 flex flex-wrap gap-2">{shortcuts.filter(item => settings.enabled && settings.sources[item.source] && (!item.conflict || settings.detectConflicts)).map(({ text }) => <button key={text} onClick={() => { setSource('overview'); send(text, 'overview'); }} className="rounded-full border border-[#355f8b] px-3 py-2 text-xs">{text}</button>)}</div>
    <div role="log" aria-label="Conversa com Fama IA" aria-live="polite" className="my-5 max-h-[480px] space-y-4 overflow-y-auto">
      {!messages.length && <p className="text-[#b8cadb]">{settings.welcome}</p>}
      {messages.map((item, index) => <div key={index} className={'rounded-xl border border-[#2a507c] p-4 '+(item.role === 'user' ? 'bg-[#12335d]' : 'bg-[#071b31]')}><b className="text-sm text-[#74def5]">{item.role === 'user' ? 'Você' : settings.name}</b><p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.content}</p>{onAction && <div className="mt-3 flex flex-wrap gap-2">{item.actions?.map(action => <button key={action.label} onClick={() => onAction(action)} className="rounded-xl border border-[#355f8b] px-3 py-2 text-sm">{action.label}</button>)}</div>}</div>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); send(message); }}>
      <label htmlFor="fama-ai-question" className="text-sm">Sua pergunta</label>
      <textarea id="fama-ai-question" disabled={!settings.enabled} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} rows={3} placeholder="Quais são os compromissos de hoje?" className="mt-2 w-full rounded-xl border border-[#355f8b] bg-[#071b31] p-3" />
      <button type="submit" disabled={!settings.enabled || !message.trim()} className="mt-3 rounded-xl bg-[#1685d6] px-5 py-2 font-bold disabled:opacity-50">Consultar sistema</button>
    </form>
  </section>;
}
