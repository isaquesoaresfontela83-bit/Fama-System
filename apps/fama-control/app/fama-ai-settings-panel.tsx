'use client';

import { useState } from 'react';
import { assistantSources, defaultAssistantSettings, parseAssistantSettings, type AssistantSettings, type AssistantSource } from '@/lib/fama-ai-settings';
import { FamaAiPanel } from './fama-ai-panel';
import type { AssistantSettingsEnvelope } from '@/hooks/use-fama-ai-settings';

type Props = AssistantSettingsEnvelope & {
  onSave: (settings: AssistantSettings, revision: number) => Promise<AssistantSettingsEnvelope>;
  onReload: () => Promise<AssistantSettingsEnvelope>;
};
const inputClass = 'mt-2 w-full rounded-xl border border-border bg-background p-3';

export function FamaAiSettingsPanel({ settings, revision, updatedAt, onSave, onReload }: Props) {
  const [draft, setDraft] = useState<AssistantSettings>(() => structuredClone(settings));
  const [baseRevision, setBaseRevision] = useState(revision);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const update = <K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) => { setDraft(current => ({ ...current, [key]: value })); setFeedback(''); };
  async function apply(reload = false) {
    setBusy(true); setFeedback(''); setFailed(false);
    try {
      const next = reload ? await onReload() : await onSave(parseAssistantSettings(draft), baseRevision);
      setDraft(structuredClone(next.settings)); setBaseRevision(next.revision);
      setFeedback(reload ? 'Configuração recarregada.' : 'Configuração salva para os usuários do sistema.');
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5">
    <div><h2 className="text-2xl font-bold">Configurar IA interna</h2><p className="mt-2 text-sm text-muted-foreground">Controle as funções e mensagens do assistente em todo o sistema. As permissões dos usuários continuam sendo verificadas pelos módulos.</p><p className="mt-2 text-sm text-muted-foreground">Versão salva: {revision} · {updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : '—'}</p></div>
    {revision !== baseRevision && <p role="alert" className="rounded-xl border border-[#7e622b] bg-[#3b2c12] p-3 text-[#ffe3a8]">Há uma versão mais recente. Recarregue antes de editar para evitar sobrescrever alterações de outro administrador.</p>}
    <form onSubmit={event => { event.preventDefault(); void apply(); }} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={draft.enabled} onChange={event => update('enabled', event.target.checked)} />Assistente habilitado</label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Nome exibido<input required maxLength={60} value={draft.name} onChange={event => update('name', event.target.value)} className={inputClass} /></label><label className="text-sm">Limite de itens por resposta<input required type="number" min={5} max={100} value={draft.maxItems} onChange={event => update('maxItems', Number(event.target.value))} className={inputClass} /></label></div>
          <label className="mt-4 block text-sm">Mensagem inicial exibida aos usuários<textarea maxLength={300} rows={3} value={draft.welcome} onChange={event => update('welcome', event.target.value)} className={inputClass} /></label>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-xl font-bold">Funções disponíveis</h2><p className="mt-2 text-sm text-muted-foreground">Desativar um módulo também remove seus dados do resumo do assistente.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(assistantSources).map(([source, label]) => <label key={source} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={draft.sources[source as AssistantSource]} onChange={event => update('sources', { ...draft.sources, [source]: event.target.checked })} />{label}</label>)}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-xl font-bold">Ações e agenda</h2><div className="mt-4 space-y-3">{([['allowNavigation', 'Permitir abrir módulos'], ['allowCreate', 'Permitir abrir formulários de cadastro'], ['detectConflicts', 'Detectar conflitos na agenda']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft[key]} onChange={event => update(key, event.target.checked)} />{label}</label>)}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Respostas personalizadas</h2><button type="button" disabled={draft.commands.length >= 30} onClick={() => update('commands', [...draft.commands, { trigger: '', response: '', source: 'overview', enabled: true }])} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">+ Nova resposta</button></div><p className="mt-2 text-sm text-muted-foreground">A pergunta exata retorna o texto cadastrado. Essas mensagens são compartilhadas com os usuários; não executam ações ou código.</p>
          <div className="mt-4 space-y-4">{draft.commands.map((command, index) => {
            const patch = (changes: Partial<typeof command>) => update('commands', draft.commands.map((item, position) => position === index ? { ...item, ...changes } : item));
            return <div key={index} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={command.enabled} onChange={event => patch({ enabled: event.target.checked })} />Resposta habilitada</label><button type="button" onClick={() => update('commands', draft.commands.filter((_, position) => position !== index))} className="text-sm text-destructive">Remover</button></div><label className="mt-3 block text-sm">Pergunta<input required maxLength={120} value={command.trigger} onChange={event => patch({ trigger: event.target.value })} className={inputClass} /></label><label className="mt-3 block text-sm">Função associada<select value={command.source} onChange={event => patch({ source: event.target.value as AssistantSource })} className={inputClass}>{Object.entries(assistantSources).map(([source, label]) => <option key={source} value={source}>{label}</option>)}</select></label><label className="mt-3 block text-sm">Resposta<textarea required maxLength={1000} value={command.response} onChange={event => patch({ response: event.target.value })} className={inputClass} /></label></div>;
          })}</div>
        </div>
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={revision !== baseRevision} className="rounded-xl bg-primary text-primary-foreground px-5 py-3 font-bold disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar configuração'}</button><button type="button" onClick={() => void apply(true)} className="rounded-xl border border-border px-4 py-3">Recarregar</button><button type="button" onClick={() => { setDraft(structuredClone(defaultAssistantSettings)); setFeedback('Padrão aplicado ao rascunho. Salve para confirmar.'); setFailed(false); }} className="rounded-xl border border-border px-4 py-3">Restaurar padrão no rascunho</button></div>
      </fieldset>
      {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-destructive' : 'text-primary'}>{feedback}</p>}
    </form>
    <div><h2 className="mb-3 text-xl font-bold">Prévia do rascunho</h2><p className="mb-3 text-sm text-muted-foreground">Teste mensagens e funções antes de salvar. A prévia usa listas vazias e não altera registros.</p><FamaAiPanel key={JSON.stringify(draft)} data={{ appointments: [], inventory: [], transactions: [] }} settings={draft} scopeLabel="Prévia das configurações" /></div>
  </section>;
}
