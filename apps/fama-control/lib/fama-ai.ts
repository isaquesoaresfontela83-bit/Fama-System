import type { BootstrapData } from '@/app/data-model';
import { assistantSources, defaultAssistantSettings, normalizeCommand, type AssistantSettings, type AssistantSource } from './fama-ai-settings';
export { assistantSources, type AssistantSource } from './fama-ai-settings';

type AdminRecord = { id?: string; name?: string; display_name?: string; status?: string; role?: string; label?: string; event_type?: string; occurred_at?: string; request_type?: string };
export type AssistantData = Partial<BootstrapData> & {
  organizations?: AdminRecord[]; members?: AdminRecord[]; audit?: AdminRecord[]; backups?: AdminRecord[]; privacy?: AdminRecord[];
};
export type AssistantAction = { label: string; section: string; create?: keyof BootstrapData };
export type AssistantTone = 'neutral' | 'success' | 'warning' | 'danger';
export type AssistantMetric = { label: string; value: string; detail?: string; tone?: AssistantTone; source?: AssistantSource };
export type AssistantItem = { id: string; title: string; detail?: string; value?: string; status?: string; tone?: AssistantTone };
export type AssistantSuggestion = { label: string; question: string; source: AssistantSource };
export type AssistantAnswer = {
  text: string; source: AssistantSource; actions: AssistantAction[]; title?: string; metrics?: AssistantMetric[];
  items?: AssistantItem[]; note?: string; suggestions?: AssistantSuggestion[]; totalItems?: number;
};
export type AssistantInsight = { id: string; source: AssistantSource; title: string; detail: string; value: string; question: string; tone: AssistantTone };
export type AssistantWorkspace = { metrics: AssistantMetric[]; insights: AssistantInsight[]; counts: Partial<Record<AssistantSource, number>> };
export type AssistantContext = { previousSource?: AssistantSource };

const dataKeys: Partial<Record<AssistantSource, keyof AssistantData>> = {
  agenda: 'appointments', crm: 'leads', quotes: 'quotes', orders: 'workOrders', customers: 'customers', inventory: 'inventory',
  finance: 'transactions', team: 'employees', warranties: 'warranties', contracts: 'contracts', companies: 'organizations',
  users: 'members', audit: 'audit', backup: 'backups', privacy: 'privacy',
};
function normalize(value: string) { return normalizeCommand(value); }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function dateLabel(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR', value.includes('T') ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
}
function dateKey(value?: string) {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}
function prettyStatus(status?: string) { return status?.replace(/_/g, ' ') ?? ''; }
function overdue(dueDate: string | undefined, status: string, today: string) {
  return status !== 'pago' && (status === 'atrasado' || Boolean(dateKey(dueDate) && dateKey(dueDate)! < today));
}
function pruneData(data: AssistantData, settings: AssistantSettings): AssistantData {
  if (!settings.enabled) return {};
  const permitted = { ...data };
  for (const [module, key] of Object.entries(dataKeys)) if (!settings.sources[module as AssistantSource]) delete permitted[key as keyof AssistantData];
  return permitted;
}
const keywords: [AssistantSource, RegExp][] = [
  ['contracts', /\b(contratos?|mensalidades?)\b/], ['warranties', /\b(garantias?)\b/], ['quotes', /\b(orcamentos?|propostas?)\b/],
  ['inventory', /\b(estoque|produtos?|reposicao|repor|minimo)\b/],
  ['agenda', /\b(agenda|agendamentos?|agendar|compromissos?|visitas?|conflitos?|horarios?)\b/],
  ['team', /\b(equipe|tecnicos?|profissionais?|carga de trabalho)\b/],
  ['finance', /\b(financeiro|receitas?|despesas?|pagamentos?|receber|pagar|saldo|contas?|atrasad[oa]s?)\b/],
  ['orders', /\b(ordens?|servicos?|os)\b/], ['customers', /\b(clientes?|piscinas?)\b/],
  ['crm', /\b(crm|leads?|vendas?|funil|negociacoes?)\b/], ['companies', /\b(empresas?)\b/],
  ['users', /\b(usuarios?|permissoes|acessos?)\b/], ['audit', /\b(auditoria|eventos?)\b/],
  ['backup', /\b(backups?)\b/], ['privacy', /\b(privacidade|lgpd)\b/],
];
function explicitSource(query: string) { return keywords.find(([, pattern]) => pattern.test(query))?.[0]; }
function resolveSource(query: string, selected: AssistantSource, context?: AssistantContext): AssistantSource {
  if (/\b(resumo da gestao|visao geral|prioridades|pendencias da empresa|meu dia)\b/.test(query)) return 'overview';
  const explicit = explicitSource(query);
  if (explicit) return explicit;
  if (selected !== 'overview') return selected;
  if (context?.previousSource && /^(e\b|agora\b|somente\b|apenas\b|tambem\b|buscar\s*:|busque\s*:|quais\b)|\b(amanha|hoje|semana|mes|vencid[oa]s?|ativ[oa]s?|pendentes?)\b/.test(query)) return context.previousSource;
  return /\b(hoje|amanha|semana)\b/.test(query) ? 'agenda' : 'overview';
}

type Period = { from: string; until: string; label: string };
function readPeriod(query: string, now: Date): Period | string | null {
  const dates = [...query.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)].map(match => `${match[3]}-${match[2]}-${match[1]}`);
  if (dates.some(date => dateKey(date) !== date)) return 'Informe uma data válida no formato DD/MM/AAAA.';
  if (dates.length > 2) return 'Informe uma data ou um intervalo com duas datas no formato DD/MM/AAAA.';
  if (dates.length) {
    if (dates.length === 2 && dates[1] < dates[0]) return 'A data final precisa ser igual ou posterior à data inicial.';
    return { from: dates[0], until: dates[1] ?? dates[0], label: dates.length === 2 ? `de ${dateLabel(dates[0])} a ${dateLabel(dates[1])}` : `em ${dateLabel(dates[0])}` };
  }
  if (/\bamanha\b/.test(query)) { const key = dayKey(addDays(now, 1)); return { from: key, until: key, label: 'amanhã' }; }
  if (/\bhoje\b/.test(query)) { const key = dayKey(now); return { from: key, until: key, label: 'hoje' }; }
  if (/\bsemana\b|proximos? 7 dias/.test(query)) return { from: dayKey(now), until: dayKey(addDays(now, 6)), label: 'nos próximos 7 dias' };
  if (/\bmes\b/.test(query)) return { from: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), until: dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: 'neste mês' };
  return null;
}
function within(value: string | undefined, period: Period | null) { const key = dateKey(value); return !period || Boolean(key && key >= period.from && key <= period.until); }
function isExpiring(value: string | undefined, now: Date) { const key = dateKey(value); return Boolean(key && key >= dayKey(now) && key <= dayKey(addDays(now, 30))); }
function activeAppointment(status: string) { return !['concluido', 'cancelado'].includes(status); }

/** Pure local analysis of authorized, loaded records. Does not perform any writes or network calls. */
export function buildAssistantWorkspace(input: AssistantData, now = new Date(), settings: AssistantSettings = defaultAssistantSettings): AssistantWorkspace {
  const data = pruneData(input, settings);
  const today = dayKey(now);
  const metrics: AssistantMetric[] = [];
  const insights: AssistantInsight[] = [];
  const counts: AssistantWorkspace['counts'] = {};
  for (const [source, key] of Object.entries(dataKeys)) if (data[key]) counts[source as AssistantSource] = data[key]!.length;
  if (settings.enabled && settings.sources.overview) counts.overview = Object.values(counts).reduce((total, count) => total + (count ?? 0), 0);
  if (data.appointments) {
    const visits = data.appointments.filter(item => dateKey(item.startAt) === today && !['cancelado'].includes(item.status));
    const pending = visits.filter(item => activeAppointment(item.status));
    metrics.push({ label: 'Agenda de hoje', value: String(visits.length), detail: `${pending.length} por concluir`, source: 'agenda' });
    const unassigned = pending.filter(item => !item.technician.trim());
    if (unassigned.length) insights.push({ id: 'unassigned', source: 'agenda', title: 'Visitas sem técnico', detail: 'Defina quem atende os compromissos de hoje.', value: String(unassigned.length), question: 'Agenda de hoje sem técnico', tone: 'warning' });
  }
  if (data.transactions) {
    const due = data.transactions.filter(item => overdue(item.dueDate, item.status, today));
    const receivable = data.transactions.filter(item => item.type === 'receita' && item.status !== 'pago');
    metrics.push({ label: 'A receber', value: money(receivable.reduce((sum, item) => sum + item.amountCents, 0)), detail: `${receivable.length} lançamento(s) em aberto`, source: 'finance' });
    if (due.length) insights.unshift({ id: 'overdue', source: 'finance', title: 'Vencimentos em atraso', detail: `${due.filter(item => item.type === 'receita').length} a receber · ${due.filter(item => item.type === 'despesa').length} a pagar`, value: money(due.reduce((sum, item) => sum + item.amountCents, 0)), question: 'Lançamentos financeiros atrasados', tone: 'danger' });
  }
  if (data.quotes) {
    const waiting = data.quotes.filter(item => item.status === 'enviado');
    metrics.push({ label: 'Orçamentos enviados', value: String(waiting.length), detail: money(waiting.reduce((sum, item) => sum + item.totalCents, 0)), source: 'quotes' });
    if (waiting.length) insights.push({ id: 'quotes', source: 'quotes', title: 'Orçamentos aguardando retorno', detail: 'Veja os valores e a validade antes de falar com o cliente.', value: String(waiting.length), question: 'Orçamentos enviados', tone: 'warning' });
  }
  if (data.contracts) {
    const active = data.contracts.filter(item => item.status === 'ativo');
    metrics.push({ label: 'Contratos ativos', value: String(active.length), detail: `${money(active.reduce((sum, item) => sum + item.monthlyCents, 0))}/mês cadastrado`, source: 'contracts' });
    const expiring = active.filter(item => isExpiring(item.endDate, now));
    if (expiring.length) insights.push({ id: 'contracts', source: 'contracts', title: 'Contratos perto do fim', detail: 'Término nos próximos 30 dias. Confira a renovação.', value: String(expiring.length), question: 'Contratos ativos a vencer em 30 dias', tone: 'warning' });
  }
  if (data.inventory) {
    const low = data.inventory.filter(item => item.quantity <= item.minimumQuantity);
    if (metrics.length < 4) metrics.push({ label: 'Itens para reposição', value: String(low.length), detail: `${data.inventory.length} produto(s) no estoque`, source: 'inventory', tone: low.length ? 'warning' : 'neutral' });
    if (low.length) insights.push({ id: 'stock', source: 'inventory', title: 'Estoque precisa de reposição', detail: 'Produtos no mínimo ou abaixo dele.', value: String(low.length), question: 'Estoque baixo', tone: 'warning' });
  }
  if (data.workOrders) {
    const open = data.workOrders.filter(item => item.status !== 'concluida');
    if (open.length) insights.push({ id: 'orders', source: 'orders', title: 'Ordens de serviço em aberto', detail: 'Acompanhe as próximas entregas da equipe.', value: String(open.length), question: 'Ordens de serviço pendentes', tone: 'neutral' });
  }
  if (data.organizations) {
    const suspended = data.organizations.filter(item => item.status === 'suspended');
    metrics.push({ label: 'Empresas cadastradas', value: String(data.organizations.length), detail: `${suspended.length} suspensa(s)`, source: 'companies' });
    if (suspended.length) insights.push({ id: 'companies', source: 'companies', title: 'Empresas suspensas', detail: 'Consulte a situação no cadastro da plataforma.', value: String(suspended.length), question: 'Empresas suspensas', tone: 'warning' });
  }
  if (data.members) metrics.push({ label: 'Usuários cadastrados', value: String(data.members.length), detail: 'Acessos da plataforma', source: 'users' });
  if (data.audit) metrics.push({ label: 'Eventos carregados', value: String(data.audit.length), detail: 'Histórico de auditoria disponível', source: 'audit' });
  if (data.privacy) metrics.push({ label: 'Pedidos de privacidade', value: String(data.privacy.length), detail: 'Solicitações carregadas nesta área', source: 'privacy' });
  if (!metrics.length && data.customers) metrics.push({ label: 'Clientes cadastrados', value: String(data.customers.length), detail: 'Carteira da sua empresa', source: 'customers' });
  if (!metrics.length && data.employees) metrics.push({ label: 'Equipe ativa', value: String(data.employees.filter(item => item.active).length), detail: 'Profissionais disponíveis no cadastro', source: 'team' });
  return { metrics: metrics.slice(0, 4), insights: insights.slice(0, 6), counts };
}

/** Pure local rules: never performs network, storage, SQL or arbitrary code. */
export function answerInternal(message: string, data: AssistantData, selected: AssistantSource = 'overview', now = new Date(), settings: AssistantSettings = defaultAssistantSettings, context?: AssistantContext): AssistantAnswer {
  if (!message.trim() || message.length > 2000) return { text: 'Digite uma pergunta de até 2.000 caracteres.', source: selected, actions: [] };
  if (!settings.enabled) return { text: 'O assistente está desativado pelo Fama Control.', source: selected, actions: [] };
  const command = settings.commands.find(item => item.enabled && normalizeCommand(item.trigger) === normalizeCommand(message));
  const source = command?.source ?? resolveSource(normalize(message), selected, context);
  if (!settings.sources[source]) return { text: `A função ${assistantSources[source]} está desativada pelo Fama Control.`, source, actions: [] };
  if (source === 'agenda' && /\bconflitos?\b/.test(normalize(message)) && !settings.detectConflicts) return { text: 'A detecção de conflitos na agenda está desativada pelo Fama Control.', source, actions: [] };
  if (command) return { text: command.response, title: command.trigger, source, actions: [] };
  const answer = answerWithRules(message, pruneData(data, settings), source, now, settings);
  return {
    ...answer,
    actions: answer.actions.filter(action => action.create ? settings.allowCreate : settings.allowNavigation),
    suggestions: answer.suggestions?.filter(item => settings.sources[item.source] && (settings.detectConflicts || !/conflitos?/i.test(item.question))),
  };
}

function answerWithRules(message: string, data: AssistantData, source: AssistantSource, now: Date, settings: AssistantSettings): AssistantAnswer {
  const query = normalize(message);
  const actions: AssistantAction[] = [];
  const result = (text: string, extra: Partial<AssistantAnswer> = {}): AssistantAnswer => ({ text, source, actions, ...extra });
  const missing = () => {
    actions.push({ label: `Abrir ${assistantSources[source]}`, section: source });
    return result(`${assistantSources[source]} não está carregado nesta área. Abra o módulo autorizado da sua empresa para consultar esses registros. O assistente não busca dados de outras empresas.`, { title: 'Registros indisponíveis nesta área' });
  };
  const search = message.match(/(?:buscar|busque|pesquisar|pesquise|cliente|tecnico)\s*:\s*(.+)$/i)?.[1];
  const matches = (values: (string | undefined)[]) => !search || values.some(value => normalize(value ?? '').includes(normalize(search)));
  const period = readPeriod(query, now);
  if (typeof period === 'string') return result(period, { title: 'Confira as datas' });
  const today = dayKey(now);
  function recordsAnswer(title: string, items: AssistantItem[], metrics: AssistantMetric[] = [], note?: string, suggestions: AssistantSuggestion[] = []) {
    const lines = items.slice(0, settings.maxItems).map(item => `• ${[item.title, item.detail, item.value, item.status].filter(Boolean).join(' · ')}`);
    const metricsText = metrics.map(item => `${item.label}: ${item.value}`).join('\n');
    const suffix = items.length > settings.maxItems ? `\nMais ${items.length - settings.maxItems} registros. Abra o módulo para ver todos.` : '';
    return result(`${title}\n${metricsText ? metricsText + '\n' : ''}${lines.join('\n') || 'Nenhum registro encontrado nos dados carregados.'}${suffix}${note ? '\n' + note : ''}`, {
      title, metrics, items: items.slice(0, settings.maxItems), totalItems: items.length, note, suggestions,
    });
  }
  if (/\b(ajuda|como funciona|o que voce faz)\b/.test(query)) return result('Analiso os registros do Fama System usando regras locais. Consulte agenda, períodos financeiros, propostas, contratos, estoque e pendências. Use “buscar: nome” para filtrar ou datas DD/MM/AAAA. Você pode continuar com “e amanhã?” ou “somente os pendentes”. As ações abrem os formulários para revisão e salvamento.', { title: 'Como posso ajudar', suggestions: [{ label: 'Ver prioridades', question: 'Prioridades da empresa', source: 'overview' }, { label: 'Agenda de hoje', question: 'Agenda de hoje', source: 'agenda' }] });

  if (source === 'agenda') {
    if (!data.appointments) return missing();
    const items = data.appointments.filter(item => {
      const date = new Date(item.startAt);
      if (Number.isNaN(date.getTime()) || !matches([item.title, item.clientName, item.technician]) || !within(item.startAt, period)) return false;
      if (/\b(pendentes?|proximos?|conflitos?|sem tecnico)\b/.test(query) && !activeAppointment(item.status)) return false;
      if (/\bproximos?\b/.test(query) && date < now) return false;
      if (/\bsem tecnico\b/.test(query) && item.technician.trim()) return false;
      if (/\bconcluid[oa]s?\b/.test(query) && item.status !== 'concluido') return false;
      if (/\bcancelad[oa]s?\b/.test(query) && !['cancelado'].includes(item.status)) return false;
      return true;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    actions.push({ label: 'Abrir agenda', section: 'agenda' }, { label: 'Novo agendamento', section: 'agenda', create: 'appointments' });
    if (/\bconflitos?\b/.test(query)) {
      const groups = new Map<string, typeof items>();
      for (const item of items) {
        if (!item.technician.trim()) continue;
        const key = `${normalize(item.technician)}:${new Date(item.startAt).getTime()}`;
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
      const conflicts = [...groups.values()].filter(group => group.length > 1);
      return recordsAnswer(`Agenda: ${conflicts.length} grupo(s) com o mesmo técnico no mesmo horário.`, conflicts.map((group, index) => ({ id: `conflict-${index}`, title: group[0].technician, detail: `${dateLabel(group[0].startAt)} · ${group.map(item => item.title).join(', ')}`, status: 'Revisar agenda', tone: 'warning' })), [], 'A agenda não registra duração; horários diferentes não permitem concluir se há sobreposição.');
    }
    return recordsAnswer(`Agenda${period ? ` ${period.label}` : ''}: ${items.length} compromisso(s).`, items.map(item => ({ id: item.id, title: item.title, detail: `${dateLabel(item.startAt)} · ${item.clientName} · ${item.technician || 'Sem técnico'}`, status: prettyStatus(item.status), tone: item.status === 'concluido' ? 'success' : ['cancelado'].includes(item.status) ? 'neutral' : 'warning' })), [
      { label: 'Por concluir', value: String(items.filter(item => activeAppointment(item.status)).length) },
      { label: 'Concluídos', value: String(items.filter(item => item.status === 'concluido').length), tone: 'success' },
    ], undefined, [{ label: 'Amanhã', question: 'Agenda amanhã', source: 'agenda' }, { label: 'Próximos 7 dias', question: 'Agenda da semana', source: 'agenda' }, { label: 'Ver conflitos', question: 'Conflitos na agenda', source: 'agenda' }]);
  }
  if (source === 'finance') {
    if (!data.transactions) return missing();
    const records = data.transactions.filter(item => matches([item.description, item.category]) && within(item.dueDate, period)
      && (!/\b(receitas?|a receber)\b/.test(query) || item.type === 'receita') && (!/\b(despesas?|a pagar)\b/.test(query) || item.type === 'despesa'));
    const sum = (type: string, paid: boolean) => records.filter(item => item.type === type && (item.status === 'pago') === paid).reduce((total, item) => total + item.amountCents, 0);
    const late = records.filter(item => overdue(item.dueDate, item.status, today));
    const unpaidOnly = /\b(pendentes?|em aberto|a receber|a pagar)\b/.test(query);
    const paidOnly = /\b(pag[oa]s?|recebid[oa]s?)\b/.test(query);
    const listed = /\b(atrasad[oa]s?|vencid[oa]s?)\b/.test(query) ? late : unpaidOnly ? records.filter(item => item.status !== 'pago') : paidOnly ? records.filter(item => item.status === 'pago') : records;
    actions.push({ label: 'Abrir financeiro', section: 'finance' }, { label: 'Novo lançamento', section: 'finance', create: 'transactions' });
    return recordsAnswer(`Financeiro dos registros carregados${period ? ` · vencimentos ${period.label}` : ''}:`, listed.map(item => ({ id: item.id, title: item.description, detail: `${item.category || item.type} · ${item.type} · ${item.dueDate ? dateLabel(item.dueDate) : 'Sem vencimento'}`, value: money(item.amountCents), status: item.status === 'pago' ? 'pago' : overdue(item.dueDate, item.status, today) ? 'atrasado' : 'pendente', tone: item.status === 'pago' ? 'success' : overdue(item.dueDate, item.status, today) ? 'danger' : 'warning' })), [
      { label: 'Receitas recebidas', value: money(sum('receita', true)), tone: 'success' }, { label: 'Despesas pagas', value: money(sum('despesa', true)) },
      { label: 'Saldo realizado', value: money(sum('receita', true) - sum('despesa', true)), tone: sum('receita', true) >= sum('despesa', true) ? 'success' : 'danger' },
      { label: 'A receber', value: money(sum('receita', false)) }, { label: 'A pagar', value: money(sum('despesa', false)) },
      { label: 'Vencidos não pagos', value: String(late.length), tone: late.length ? 'danger' : 'neutral' },
    ], 'Valores dos lançamentos carregados. Os períodos usam a data de vencimento; o saldo realizado considera apenas os registros marcados como pagos.', [{ label: 'Ver atrasados', question: 'Financeiro atrasado', source: 'finance' }, { label: 'Este mês', question: 'Financeiro deste mês', source: 'finance' }, { label: 'Contas a pagar', question: 'Contas a pagar', source: 'finance' }]);
  }
  if (source === 'inventory') {
    if (!data.inventory) return missing();
    const records = data.inventory.filter(item => matches([item.name, item.sku]) && (!/\b(baixo|reposicao|repor|minimo|alertas?)\b/.test(query) || item.quantity <= item.minimumQuantity) && (!/\b(zerad[oa]s?|esgotad[oa]s?|sem estoque)\b/.test(query) || item.quantity <= 0));
    actions.push({ label: 'Abrir estoque', section: 'inventory' });
    return recordsAnswer(`Estoque: ${records.length} item(ns).`, records.map(item => ({ id: item.id, title: item.name, detail: `SKU ${item.sku || '—'} · mínimo ${item.minimumQuantity} ${item.unit}`, value: `${item.quantity} ${item.unit}`, status: item.quantity <= item.minimumQuantity ? 'Reposição necessária' : 'Disponível', tone: item.quantity <= 0 ? 'danger' : item.quantity <= item.minimumQuantity ? 'warning' : 'success' })), [
      { label: 'Para reposição', value: String(records.filter(item => item.quantity <= item.minimumQuantity).length), tone: 'warning' },
      { label: 'Sem estoque', value: String(records.filter(item => item.quantity <= 0).length), tone: 'danger' },
    ], undefined, [{ label: 'Ver reposição', question: 'Estoque baixo', source: 'inventory' }, { label: 'Produtos esgotados', question: 'Estoque zerado', source: 'inventory' }]);
  }
  if (source === 'team' && /\b(carga|distribuicao|atendimentos?|trabalho)\b/.test(query)) {
    if (!data.employees) return missing();
    if (!data.appointments) return result('A distribuição de trabalho precisa dos módulos Equipe e Agenda carregados e autorizados.', { title: 'Agenda necessária para esta análise' });
    const employees = data.employees.filter(item => item.active && matches([item.name, item.role]));
    const visits = data.appointments.filter(item => activeAppointment(item.status) && within(item.startAt, period) && (period || new Date(item.startAt) >= now));
    actions.push({ label: 'Abrir equipe', section: 'team' }, { label: 'Abrir agenda', section: 'agenda' });
    const unassigned = visits.filter(item => !item.technician.trim()).length;
    return recordsAnswer(`Distribuição da equipe${period ? ` ${period.label}` : ' nos próximos atendimentos'}:`, employees.map(item => ({ id: item.id, title: item.name, detail: item.role, value: `${visits.filter(visit => normalize(visit.technician) === normalize(item.name)).length} compromisso(s)`, status: 'Ativo' })), [{ label: 'Profissionais ativos', value: String(employees.length) }, { label: 'Sem técnico', value: String(unassigned), tone: unassigned ? 'warning' : 'neutral' }], 'A contagem associa o nome do técnico na agenda ao cadastro da equipe; não estima duração nem horas disponíveis.');
  }
  if (source !== 'overview') {
    const key = dataKeys[source]!;
    const records = data[key];
    if (!records) return missing();
    actions.push({ label: `Abrir ${assistantSources[source]}`, section: source });
    const createLabels: Partial<Record<AssistantSource, string>> = { crm: 'Novo lead', quotes: 'Novo orçamento', orders: 'Nova ordem', customers: 'Novo cliente', team: 'Novo membro', warranties: 'Nova garantia', contracts: 'Novo contrato' };
    if (createLabels[source]) actions.push({ label: createLabels[source]!, section: source, create: key as keyof BootstrapData });
    type Row = AdminRecord & { clientName?: string; service?: string; item?: string; expiresAt?: string; startDate?: string; endDate?: string; validUntil?: string; createdAt?: string; quoteNumber?: string; contractNumber?: string; warrantyNumber?: string; osNumber?: string; totalCents?: number; monthlyCents?: number; amountCents?: number; estimatedValueCents?: number; frequency?: string; nextAction?: string; active?: boolean; interest?: string; email?: string; phone?: string; plan?: string; poolType?: string; poolVolume?: number | null; technician?: string; scheduledAt?: string };
    const rows = records as Row[];
    const filtered = rows.filter(item => {
      if (!matches([item.name, item.display_name, item.clientName, item.label, item.id, item.quoteNumber, item.contractNumber, item.osNumber, item.email, item.service, item.technician])) return false;
      if (/\bsuspens[oa]s?\b/.test(query) && !['suspended', 'suspenso'].includes(item.status ?? '')) return false;
      if (/\binativ[oa]s?\b/.test(query) && !(item.active === false || item.status === 'inactive')) return false;
      if (/\bativ[oa]s?\b/.test(query) && !(item.active === true || ['ativo', 'active', 'ativa'].includes(item.status ?? ''))) return false;
      const requested: [RegExp, string][] = [[/\baprovad[oa]s?\b/, 'aprovado'], [/\benviad[oa]s?|aguardando retorno/, 'enviado'], [/\brecusad[oa]s?\b/, 'recusado'], [/\brascunhos?\b/, 'rascunho'], [/\bencerrad[oa]s?\b/, 'encerrado'], [/\bconcluid[oa]s?\b/, source === 'orders' || source === 'warranties' ? 'concluida' : 'concluido']];
      if (requested.some(([pattern, status]) => pattern.test(query) && item.status !== status)) return false;
      if (/\b(pendentes?|em aberto)\b/.test(query)) {
        if (source === 'orders' && item.status === 'concluida') return false;
        if (source === 'quotes' && !['rascunho', 'enviado'].includes(item.status ?? '')) return false;
        if (source === 'crm' && ['ganho', 'perdido'].includes(item.status ?? '')) return false;
      }
      const expires = item.expiresAt || item.endDate || item.validUntil;
      if (/\b(vencid[oa]s?|expirad[oa]s?)\b/.test(query) && !(item.status === 'expirada' || (dateKey(expires) && dateKey(expires)! < today))) return false;
      const expiring = /\b(a vencer|por vencer|vencer|renovar|renovacoes?|proximos? 30 dias)\b/.test(query);
      if (expiring && !isExpiring(expires, now)) return false;
      if (period && !expiring && !within(source === 'orders' ? item.scheduledAt : source === 'audit' ? item.occurred_at : item.createdAt, period)) return false;
      return true;
    });
    const metrics: AssistantMetric[] = [{ label: 'Registros encontrados', value: String(filtered.length) }];
    let note: string | undefined;
    const suggestions: AssistantSuggestion[] = [];
    if (source === 'quotes') {
      metrics.push({ label: 'Valor das propostas', value: money(filtered.reduce((sum, item) => sum + (item.totalCents ?? 0), 0)) }, { label: 'Aprovados', value: String(filtered.filter(item => item.status === 'aprovado').length), tone: 'success' });
      suggestions.push({ label: 'Aguardando retorno', question: 'Orçamentos enviados', source }, { label: 'Validade vencida', question: 'Orçamentos vencidos', source });
      note = 'Os valores representam propostas cadastradas; a aprovação não confirma recebimento financeiro.';
    }
    if (source === 'contracts') {
      const active = filtered.filter(item => item.status === 'ativo');
      metrics.push({ label: 'Mensalidades ativas', value: money(active.reduce((sum, item) => sum + (item.monthlyCents ?? 0), 0)), detail: 'Valor mensal cadastrado', tone: 'success' });
      suggestions.push({ label: 'Ativos', question: 'Contratos ativos', source }, { label: 'Renovação em 30 dias', question: 'Contratos ativos a vencer em 30 dias', source });
      note = 'As mensalidades são valores contratuais cadastrados. Consulte o financeiro para verificar os recebimentos.';
    }
    if (source === 'crm') metrics.push({ label: 'Valor estimado', value: money(filtered.reduce((sum, item) => sum + (item.estimatedValueCents ?? 0), 0)) });
    if (source === 'orders') metrics.push({ label: 'Valor dos serviços', value: money(filtered.reduce((sum, item) => sum + (item.amountCents ?? 0), 0)) });
    return recordsAnswer(`${assistantSources[source]}${period ? source === 'quotes' && period.label === 'hoje' ? ' criados hoje' : ` ${period.label}` : ''}: ${filtered.length} registro(s).`, filtered.map((item, index) => ({
      id: item.id ?? `record-${index}`, title: item.name || item.display_name || item.clientName || item.label || item.event_type || item.request_type || item.id || 'Registro',
      detail: [item.quoteNumber || item.osNumber || item.contractNumber || item.warrantyNumber, item.service || item.item || item.interest, item.role, item.frequency, source === 'customers' ? [item.phone, item.email, item.poolType, item.poolVolume ? `${item.poolVolume} L` : undefined, item.plan].filter(Boolean).join(' · ') : undefined, item.startDate ? `Início: ${dateLabel(item.startDate)}` : undefined, item.expiresAt || item.endDate || item.validUntil ? `Validade: ${dateLabel((item.expiresAt || item.endDate || item.validUntil)!)}` : undefined, item.nextAction, item.occurred_at ? dateLabel(item.occurred_at) : undefined].filter(Boolean).join(' · '),
      value: typeof item.totalCents === 'number' ? money(item.totalCents) : typeof item.monthlyCents === 'number' ? `${money(item.monthlyCents)}/mês` : typeof item.amountCents === 'number' ? money(item.amountCents) : undefined,
      status: prettyStatus(item.status) || (item.active === true ? 'Ativo' : item.active === false ? 'Inativo' : undefined),
      tone: ['ativo', 'active', 'aprovado', 'ganho', 'concluida'].includes(item.status ?? '') || item.active === true ? 'success' : ['suspended', 'suspenso', 'expirada', 'recusado'].includes(item.status ?? '') ? 'warning' : 'neutral',
    })), metrics, note, suggestions);
  }
  if (!/\b(resumo|gestao|situacao|pendencias?|visao|geral|prioridades|meu dia)\b/.test(query)) return result('Posso ajudar com a gestão cadastrada no sistema. Escolha um módulo ou consulte a visão do dia, os orçamentos enviados, os contratos a vencer e o financeiro deste mês. Use “buscar: nome” para localizar registros.', { title: 'Vamos consultar sua operação', suggestions: [{ label: 'Ver prioridades', question: 'Prioridades da empresa', source: 'overview' }, { label: 'Agenda de hoje', question: 'Agenda de hoje', source: 'agenda' }] });
  const workspace = buildAssistantWorkspace(data, now, settings);
  const lines: string[] = [];
  if (data.organizations) lines.push(`Empresas: ${data.organizations.length} · ${data.organizations.filter(item => item.status === 'suspended').length} suspensas`);
  if (data.members) lines.push(`Usuários: ${data.members.length}`);
  if (data.appointments) lines.push(`Agenda de hoje: ${data.appointments.filter(item => dateKey(item.startAt) === today && !['cancelado'].includes(item.status)).length} compromissos`);
  if (data.workOrders) lines.push(`Ordens em aberto: ${data.workOrders.filter(item => item.status !== 'concluida').length}`);
  if (data.inventory) lines.push(`Itens para reposição: ${data.inventory.filter(item => item.quantity <= item.minimumQuantity).length}`);
  if (data.transactions) lines.push(`Lançamentos não pagos: ${data.transactions.filter(item => item.status !== 'pago').length}`);
  if (data.leads) lines.push(`Leads em negociação: ${data.leads.filter(item => !['ganho', 'perdido'].includes(item.status)).length}`);
  if (data.customers) lines.push(`Clientes: ${data.customers.length}`);
  if (data.quotes) lines.push(`Orçamentos: ${data.quotes.length}`);
  if (data.contracts) lines.push(`Contratos: ${data.contracts.length}`);
  if (data.warranties) lines.push(`Garantias: ${data.warranties.length}`);
  if (data.employees) lines.push(`Equipe ativa: ${data.employees.filter(item => item.active).length}`);
  return result(`Resumo dos dados carregados nesta área:\n${lines.join('\n') || 'Nenhum módulo carregado.'}\n${workspace.insights.map(item => `${item.title}: ${item.value}`).join('\n')}`, {
    title: 'Visão da sua operação', metrics: workspace.metrics,
    items: workspace.insights.map(item => ({ id: item.id, title: item.title, detail: item.detail, value: item.value, status: assistantSources[item.source], tone: item.tone })),
    totalItems: workspace.insights.length,
    note: lines.length ? lines.join(' · ') : 'Nenhum módulo carregado nesta área.',
    suggestions: workspace.insights.slice(0, 3).map(item => ({ label: item.title, question: item.question, source: item.source })),
  });
}
