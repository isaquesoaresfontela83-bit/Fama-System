'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowRight, Check, Eye, FileText, FlaskConical, LoaderCircle, MessageSquarePlus, Plus, RotateCcw, Save, Settings2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assistantSources, defaultAssistantSettings, parseAssistantSettings, type AssistantSettings, type AssistantSource } from '@/lib/fama-ai-settings';
import type { AssistantData } from '@/lib/fama-ai';
import { FamaAiPanel } from './fama-ai-panel';
import { aiModules } from './fama-ai-modules';
import type { AssistantSettingsEnvelope } from '@/hooks/use-fama-ai-settings';

type Props = AssistantSettingsEnvelope & {
  onSave: (settings: AssistantSettings, revision: number) => Promise<AssistantSettingsEnvelope>;
  onReload: () => Promise<AssistantSettingsEnvelope>;
};

function demoData(): AssistantData {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const end = new Date(now); end.setDate(end.getDate() + 15);
  const endDay = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return {
    appointments: [{ id: 'demo-visit', title: 'Manutenção semanal', clientName: 'Cliente de demonstração', startAt: `${day}T15:00:00`, address: 'Endereço de demonstração', technician: 'Ana', kind: 'Manutenção', status: 'agendado', notes: '' }],
    transactions: [{ id: 'demo-receivable', description: 'Manutenção mensal', type: 'receita', category: 'Serviços', amountCents: 45000, dueDate: day, status: 'pendente' }, { id: 'demo-paid', description: 'Serviço recebido', type: 'receita', category: 'Serviços', amountCents: 80000, dueDate: day, status: 'pago' }],
    quotes: [{ id: 'demo-quote', quoteNumber: 'DEMO-001', clientName: 'Cliente de demonstração', service: 'Troca de filtro', totalCents: 125000, materialsCents: 90000, laborCents: 35000, discountCents: 0, status: 'enviado', validUntil: endDay, notes: '', createdAt: `${day}T09:00:00` }],
    contracts: [{ id: 'demo-contract', contractNumber: 'DEMO-001', clientName: 'Cliente de demonstração', clientDocument: '', clientAddress: '', service: 'Manutenção de piscina', startDate: day, endDate: endDay, frequency: 'Semanal', monthlyCents: 45000, paymentDay: 10, status: 'ativo', terms: '', createdAt: `${day}T09:00:00` }],
    inventory: [{ id: 'demo-stock', name: 'Cloro granulado', sku: 'DEMO-CL', unit: 'kg', quantity: 2, minimumQuantity: 5, costCents: 3500 }],
    employees: [{ id: 'demo-team', name: 'Ana', role: 'Técnica', phone: '', color: '#0b72e7', active: true, createdAt: `${day}T09:00:00` }],
    leads: [], customers: [], workOrders: [], warranties: [],
    organizations: [{ id: 'demo-company', name: 'Empresa de demonstração', status: 'active' }], members: [{ id: 'demo-user', display_name: 'Usuário de demonstração', role: 'admin' }], audit: [], privacy: [], backups: [],
  };
}

export function FamaAiSettingsPanel({ settings, revision, updatedAt, onSave, onReload }: Props) {
  const [draft, setDraft] = useState<AssistantSettings>(() => structuredClone(settings));
  const [baseRevision, setBaseRevision] = useState(revision);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(settings));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const [previewAction, setPreviewAction] = useState('');
  const [tab, setTab] = useState('configuration');
  const id = useId();
  const previewData = useMemo(() => demoData(), []);
  const dirty = JSON.stringify(draft) !== savedJson;
  const stale = revision !== baseRevision;
  const update = <K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) => { setDraft(current => ({ ...current, [key]: value })); setFeedback(''); setFailed(false); };
  async function apply(reload = false) {
    if (busy || (!reload && stale)) return;
    setBusy(true); setFeedback(''); setFailed(false);
    try {
      const next = reload ? await onReload() : await onSave(parseAssistantSettings(draft), baseRevision);
      setDraft(structuredClone(next.settings)); setBaseRevision(next.revision); setSavedJson(JSON.stringify(next.settings));
      setFeedback(reload ? 'Configuração recarregada.' : 'Configuração salva e disponível para os usuários do sistema.');
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar a configuração.'); }
    finally { setBusy(false); }
  }
  function addCommand() { if (draft.commands.length < 30) update('commands', [...draft.commands, { trigger: '', response: '', source: 'overview', enabled: true }]); }

  return <section className="fama-ai-settings">
    <header className="fama-ai-settings-header"><div className="fama-ai-settings-title"><span><Settings2 /></span><div><span className="fama-ai-eyebrow">Estúdio da assistente</span><h2>Configure a Fama IA</h2></div></div><span className="fama-ai-settings-status" data-enabled={settings.enabled}><span />{settings.enabled ? 'Ativa no sistema' : 'Pausada no sistema'}</span></header>
    <p className="fama-ai-settings-subtitle">Dê uma identidade à assistente, escolha suas funções e teste a experiência antes de disponibilizar para os usuários.</p>
    {stale && <div role="alert" className="fama-ai-settings-alert"><RotateCcw size={18} /><p>Outro administrador salvou uma versão mais recente. Recarregue a configuração antes de salvar suas alterações.</p></div>}
    <Tabs value={tab} onValueChange={setTab}>
      <div className="fama-ai-settings-tabs"><TabsList aria-label="Configuração da Fama IA"><TabsTrigger value="configuration"><Settings2 />Configuração</TabsTrigger><TabsTrigger value="commands"><MessageSquarePlus />Respostas</TabsTrigger><TabsTrigger value="preview"><Eye />Prévia</TabsTrigger></TabsList></div>
      <TabsContent value="configuration">
        <div className="fama-ai-settings-grid"><fieldset disabled={busy} className="fama-ai-settings-fieldset">
          <div className="fama-ai-settings-card">
            <div className="fama-ai-settings-card-title"><Sparkles /><h3>Identidade e disponibilidade</h3></div><p>Defina como a assistente recebe os usuários.</p>
            <div className="fama-ai-setting-toggle"><div><label htmlFor={`${id}-enabled`}><strong>Assistente habilitada</strong></label><p>Disponibiliza as consultas nas áreas autorizadas do sistema.</p></div><Switch id={`${id}-enabled`} checked={draft.enabled} onCheckedChange={value => update('enabled', value)} /></div>
            <div className="fama-ai-settings-fields"><label className="fama-ai-field">Nome da assistente<input maxLength={60} value={draft.name} onChange={event => update('name', event.target.value)} placeholder="Fama IA" /></label><label className="fama-ai-field">Itens por resposta<input type="number" min={5} max={100} value={draft.maxItems} onChange={event => update('maxItems', Number(event.target.value))} /><small>De 5 a 100 registros</small></label></div>
            <label className="fama-ai-field">Mensagem de boas-vindas<textarea maxLength={300} rows={3} value={draft.welcome} onChange={event => update('welcome', event.target.value)} placeholder="Como você quer receber os usuários?" /><small>{draft.welcome.length}/300 caracteres</small></label>
          </div>
          <div className="fama-ai-settings-card"><div className="fama-ai-settings-card-title"><FileText /><h3>Conhecimento do sistema</h3></div><p>Escolha os módulos que a assistente pode consultar. Cada usuário continua limitado pelas próprias permissões.</p><div className="fama-ai-source-options">{Object.entries(assistantSources).map(([source, label]) => { const Icon = aiModules[source as AssistantSource].icon; return <label key={source} className="fama-ai-source-option" data-enabled={draft.sources[source as AssistantSource]}><input type="checkbox" checked={draft.sources[source as AssistantSource]} onChange={event => update('sources', { ...draft.sources, [source]: event.target.checked })} /><Icon /><span>{label}</span></label>; })}</div></div>
          <div className="fama-ai-settings-card"><div className="fama-ai-settings-card-title"><ShieldCheck /><h3>Ações e análise da agenda</h3></div><p>Configure os caminhos que ajudam o usuário a dar o próximo passo.</p>{([
            ['allowNavigation', 'Abrir os módulos do sistema', 'Exibe atalhos para consultar e acompanhar os registros.'],
            ['allowCreate', 'Abrir formulários de cadastro', 'Exibe ações de criação. O usuário revisa o formulário e confirma o salvamento.'],
            ['detectConflicts', 'Identificar conflitos na agenda', 'Sinaliza compromissos do mesmo técnico no mesmo instante.'],
          ] as const).map(([key, title, description]) => <div key={key} className="fama-ai-setting-toggle"><div><label htmlFor={`${id}-${key}`}><strong>{title}</strong></label><p>{description}</p></div><Switch id={`${id}-${key}`} checked={draft[key]} onCheckedChange={value => update(key, value)} /></div>)}</div>
        </fieldset><aside className="fama-ai-settings-aside"><Sparkles /><h3>Uma experiência consistente</h3><p>Esta configuração vale para a assistente no Fama System e no Fama Control.</p><ul><li><Check />{Object.values(draft.sources).filter(Boolean).length} funções no rascunho</li><li><Check />{draft.commands.filter(item => item.enabled).length} respostas personalizadas ativas</li><li><ShieldCheck />Permissões por usuário e empresa</li></ul><Button type="button" variant="outline" onClick={() => setTab('preview')}>Testar o rascunho<ArrowRight /></Button><div className="fama-ai-settings-revision"><strong>Versão salva: {revision}</strong>{updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : 'Data de atualização indisponível'}<p>As consultas usam regras internas sobre os dados carregados em cada área.</p></div></aside></div>
      </TabsContent>
      <TabsContent value="commands"><fieldset disabled={busy} className="fama-ai-settings-fieldset"><div className="fama-ai-settings-card"><div className="fama-ai-command-toolbar"><div className="fama-ai-settings-card-title"><MessageSquarePlus /><h3>Respostas da sua empresa</h3></div><Button type="button" variant="outline" disabled={draft.commands.length >= 30} onClick={addCommand}><Plus />Nova resposta</Button></div><p>Cadastre orientações para perguntas frequentes. A pergunta exata retorna sua resposta, desde que a função associada esteja autorizada.</p><div className="fama-ai-commands">{draft.commands.length ? draft.commands.map((command, index) => {
        const patch = (changes: Partial<typeof command>) => update('commands', draft.commands.map((item, position) => position === index ? { ...item, ...changes } : item));
        return <div key={index} className="fama-ai-command"><div className="fama-ai-command-top"><label><input type="checkbox" checked={command.enabled} onChange={event => patch({ enabled: event.target.checked })} />Resposta {String(index + 1).padStart(2, '0')} habilitada</label><Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover resposta ${index + 1}`} onClick={() => update('commands', draft.commands.filter((_, position) => position !== index))}><Trash2 /></Button></div><div className="fama-ai-settings-fields"><label className="fama-ai-field">Pergunta do usuário<input maxLength={120} value={command.trigger} onChange={event => patch({ trigger: event.target.value })} placeholder="Ex.: Como funciona o atendimento?" /></label><label className="fama-ai-field">Função associada<select value={command.source} onChange={event => patch({ source: event.target.value as AssistantSource })}>{Object.entries(assistantSources).map(([source, label]) => <option key={source} value={source}>{label}</option>)}</select></label></div><label className="fama-ai-field">Resposta da assistente<textarea maxLength={1000} rows={4} value={command.response} onChange={event => patch({ response: event.target.value })} placeholder="Escreva uma orientação clara para o usuário…" /><small>{command.response.length}/1.000 caracteres · Texto compartilhado com os usuários autorizados</small></label></div>;
      }) : <div className="fama-ai-commands-empty"><MessageSquarePlus size={28} /><strong>Suas orientações, sempre à mão</strong><p>Adicione respostas sobre os processos da empresa para ajudar a equipe nas perguntas do dia a dia.</p><Button type="button" onClick={addCommand}><Plus />Criar primeira resposta</Button></div>}</div></div></fieldset></TabsContent>
      <TabsContent value="preview"><p className="fama-ai-settings-preview-note"><FlaskConical size={19} />Prévia com dados fictícios de demonstração. As consultas e os botões não alteram registros reais.</p>{previewAction && <div className="fama-ai-settings-alert" role="status"><Eye size={18} /><p>{previewAction}</p></div>}<FamaAiPanel key={JSON.stringify(draft)} data={previewData} settings={draft} scopeLabel="Empresa de demonstração · Prévia" onAction={action => setPreviewAction(`${action.label}: no sistema, esta ação ${action.create ? 'abre o formulário para revisão e salvamento' : 'abre o módulo correspondente'}. Esta prévia não navega nem salva registros.`)} /></TabsContent>
    </Tabs>
    <div className="fama-ai-settings-savebar"><Button type="button" disabled={busy || stale || !dirty} onClick={() => void apply()}>{busy ? <LoaderCircle className="animate-spin" /> : <Save />}{busy ? 'Salvando…' : 'Salvar configuração'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void apply(true)}><RotateCcw />Recarregar</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setDraft(structuredClone(defaultAssistantSettings)); setFeedback('Padrão aplicado ao rascunho. Salve para disponibilizar no sistema.'); setFailed(false); }}>Restaurar padrão</Button><span>{dirty ? 'Alterações ainda não salvas' : `Tudo salvo · versão ${baseRevision}`}</span></div>
    {feedback && <p role={failed ? 'alert' : 'status'} className="fama-ai-settings-feedback" data-failed={failed}>{feedback}</p>}
  </section>;
}
