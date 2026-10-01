import type { BootstrapData } from '@/app/data-model';
import { assistantSources, defaultAssistantSettings, normalizeCommand, type AssistantSettings, type AssistantSource } from './fama-ai-settings';
export { assistantSources, type AssistantSource } from './fama-ai-settings';

type AdminRecord = { id?: string; name?: string; display_name?: string; status?: string; role?: string; label?: string; event_type?: string; occurred_at?: string; request_type?: string };
export type AssistantData = Partial<BootstrapData> & {
  organizations?: AdminRecord[]; members?: AdminRecord[]; audit?: AdminRecord[]; backups?: AdminRecord[]; privacy?: AdminRecord[];
};
export type AssistantAction = { label: string; section: string; create?: keyof BootstrapData };
export type AssistantAnswer = { text: string; source: AssistantSource; actions: AssistantAction[] };

function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR');
}
const keywords: [AssistantSource, RegExp][] = [
  ['agenda', /\b(agenda|agendamentos?|agendar|compromissos?|visitas?|conflitos?|horarios?)\b/],
  ['finance', /\b(financeiro|receitas?|despesas?|pagamentos?|receber|saldo|atrasad[oa]s?)\b/],
  ['inventory', /\b(estoque|produtos?|reposicao|repor|minimo)\b/],
  ['warranties', /\b(garantias?)\b/], ['contracts', /\b(contratos?)\b/], ['quotes', /\b(orcamentos?|propostas?)\b/],
  ['orders', /\b(ordens?|servicos?|os)\b/], ['customers', /\b(clientes?|piscinas?)\b/],
  ['crm', /\b(crm|leads?|vendas?|funil)\b/], ['team', /\b(equipe|tecnicos?|profissionais?)\b/],
  ['companies', /\b(empresas?)\b/], ['users', /\b(usuarios?|permissoes|acessos?)\b/],
  ['audit', /\b(auditoria|eventos?)\b/], ['backup', /\b(backups?)\b/], ['privacy', /\b(privacidade|lgpd)\b/],
];

function detectSource(message: string): AssistantSource {
  return keywords.find(([, pattern]) => pattern.test(message))?.[0]
    ?? (/\b(hoje|amanha|semana)\b/.test(message) ? 'agenda' : 'overview');
}

/** Pure local rules: never performs network, storage, SQL or arbitrary code. */
export function answerInternal(message: string, data: AssistantData, selected: AssistantSource = 'overview', now = new Date(), settings: AssistantSettings = defaultAssistantSettings): AssistantAnswer {
  if (!message.trim() || message.length > 2000) return { text: 'Digite uma pergunta de até 2.000 caracteres.', source: selected, actions: [] };
  if (!settings.enabled) return { text: 'O assistente está desativado pelo Fama Control.', source: selected, actions: [] };
  const command = settings.commands.find(item => item.enabled && normalizeCommand(item.trigger) === normalizeCommand(message));
  const detected = selected === 'overview' ? detectSource(normalize(message)) : selected;
  const source = command?.source ?? detected;
  if (!settings.sources[source]) return { text: `A função ${assistantSources[source]} está desativada pelo Fama Control.`, source, actions: [] };
  if (source === 'agenda' && /\bconflitos?\b/.test(normalize(message)) && !settings.detectConflicts) return { text: 'A detecção de conflitos na agenda está desativada pelo Fama Control.', source, actions: [] };
  if (command) return { text: command.response, source, actions: [] };
  const keys: Partial<Record<AssistantSource, keyof AssistantData>> = {
    agenda: 'appointments', crm: 'leads', quotes: 'quotes', orders: 'workOrders', customers: 'customers', inventory: 'inventory',
    finance: 'transactions', team: 'employees', warranties: 'warranties', contracts: 'contracts', companies: 'organizations', users: 'members', audit: 'audit', backup: 'backups', privacy: 'privacy',
  };
  const permitted = { ...data };
  for (const [module, key] of Object.entries(keys)) if (!settings.sources[module as AssistantSource]) delete permitted[key as keyof AssistantData];
  const answer = answerWithRules(message, permitted, selected, now, settings.maxItems);
  return { ...answer, actions: answer.actions.filter(action => action.create ? settings.allowCreate : settings.allowNavigation) };
}

function answerWithRules(message: string, data: AssistantData, selected: AssistantSource, now: Date, maxItems: number): AssistantAnswer {
  function list(items: string[]) {
    return items.length ? items.slice(0, maxItems).map(item => `• ${item}`).join('\n') + (items.length > maxItems ? `\nMais ${items.length - maxItems} registros. Abra o módulo para ver todos.` : '') : 'Nenhum registro encontrado nos dados carregados.';
  }
  const query = normalize(message.trim());
  if (!query || message.length > 2000) return { text: 'Digite uma pergunta de até 2.000 caracteres.', source: selected, actions: [] };
  const source = selected === 'overview' ? detectSource(query) : selected;
  const actions: AssistantAction[] = [];
  const result = (text: string): AssistantAnswer => ({ text, source, actions });
  const missing = () => {
    actions.push({ label: `Abrir ${assistantSources[source]}`, section: source });
    return result(`${assistantSources[source]} não está carregado nesta área. Abra o módulo autorizado da sua empresa para consultar esses registros. O assistente não busca dados de outras empresas.`);
  };
  const search = message.match(/(?:buscar|busque|pesquisar|pesquise|cliente|tecnico)\s*:\s*(.+)$/i)?.[1];
  const matches = (values: (string | undefined)[]) => !search || values.some(value => normalize(value ?? '').includes(normalize(search)));
  if (/\b(ajuda|como funciona|o que voce faz)\b/.test(query)) return result('Analiso os registros do Fama System usando regras locais. Pergunte: “agenda de hoje”, “agenda amanhã”, “conflitos na agenda”, “estoque baixo”, “resumo financeiro”, “garantias vencidas” ou “resumo da gestão”. Use “buscar: nome” para filtrar. Para cadastrar ou alterar, abra a ação do módulo e revise o formulário.');

  if (source === 'agenda') {
    if (!data.appointments) return missing();
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
    const specified = query.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    const targetDay = specified ? `${specified[3]}-${specified[2]}-${specified[1]}` : /\bamanha\b/.test(query) ? dayKey(tomorrow) : /\bhoje\b/.test(query) ? dayKey(now) : null;
    if (specified && dayKey(new Date(`${targetDay}T12:00:00`)) !== targetDay) return result('Informe uma data válida no formato DD/MM/AAAA.');
    const items = data.appointments.filter(item => {
      const date = new Date(item.startAt);
      if (Number.isNaN(date.getTime()) || !matches([item.title, item.clientName, item.technician])) return false;
      if (targetDay && dayKey(date) !== targetDay) return false;
      if (/\bsemana\b/.test(query) && (dayKey(date) < dayKey(now) || dayKey(date) >= dayKey(weekEnd))) return false;
      if (/\b(pendentes?|proximos?|conflitos?)\b/.test(query) && ['concluido', 'cancelado'].includes(item.status)) return false;
      if (/\bproximos?\b/.test(query) && date < now) return false;
      return true;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    actions.push({ label: 'Abrir agenda', section: 'agenda' }, { label: 'Novo agendamento', section: 'agenda', create: 'appointments' });
    if (/\bconflitos?\b/.test(query)) {
      const groups = new Map<string, typeof items>();
      for (const item of items) {
        if (!item.technician.trim()) continue;
        const key = `${normalize(item.technician.trim())}:${new Date(item.startAt).getTime()}`;
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
      const conflicts = [...groups.values()].filter(group => group.length > 1);
      return result(`Agenda: ${conflicts.length} grupo(s) com o mesmo técnico no mesmo horário.\n${list(conflicts.map(group => `${dateLabel(group[0].startAt)} · ${group[0].technician}: ${group.map(item => item.title).join(', ')}`))}\nA agenda não registra duração; horários diferentes não permitem concluir se há sobreposição.`);
    }
    return result(`Agenda${targetDay ? ` em ${targetDay.split('-').reverse().join('/')}` : /\bsemana\b/.test(query) ? ' nos próximos 7 dias' : ''}: ${items.length} compromisso(s).\n${list(items.map(item => `${dateLabel(item.startAt)} · ${item.title} · ${item.clientName} · ${item.technician || 'Sem técnico'} · ${item.status}`))}`);
  }
  if (source === 'finance') {
    if (!data.transactions) return missing();
    const records = data.transactions.filter(item => matches([item.description, item.category]));
    const sum = (type: string, paid: boolean) => records.filter(item => item.type === type && (item.status === 'pago') === paid).reduce((total, item) => total + item.amountCents, 0);
    const overdue = records.filter(item => item.status !== 'pago' && (item.status === 'atrasado' || (item.dueDate && item.dueDate < dayKey(now))));
    actions.push({ label: 'Abrir financeiro', section: 'finance' }, { label: 'Novo lançamento', section: 'finance', create: 'transactions' });
    return result(`Financeiro dos registros carregados:\nReceitas recebidas: ${money(sum('receita', true))}\nDespesas pagas: ${money(sum('despesa', true))}\nSaldo realizado: ${money(sum('receita', true) - sum('despesa', true))}\nA receber: ${money(sum('receita', false))}\nA pagar: ${money(sum('despesa', false))}\nVencidos não pagos: ${overdue.length}.\n${list((/\batrasad[oa]s?\b/.test(query) ? overdue : records).map(item => `${item.description} · ${money(item.amountCents)} · ${item.type} · ${item.status} · ${item.dueDate || 'Sem vencimento'}`))}`);
  }
  if (source === 'inventory') {
    if (!data.inventory) return missing();
    const records = data.inventory.filter(item => matches([item.name, item.sku]) && (!/\b(baixo|reposicao|repor|minimo|alertas?)\b/.test(query) || item.quantity <= item.minimumQuantity));
    actions.push({ label: 'Abrir estoque', section: 'inventory' });
    return result(`Estoque: ${records.length} item(ns).\n${list(records.map(item => `${item.name}: ${item.quantity} ${item.unit} · mínimo ${item.minimumQuantity}${item.quantity <= item.minimumQuantity ? ' · Reposição necessária' : ''}`))}`);
  }
  const collections = {
    crm: 'leads', quotes: 'quotes', orders: 'workOrders', customers: 'customers', team: 'employees', warranties: 'warranties',
    contracts: 'contracts', companies: 'organizations', users: 'members', audit: 'audit', backup: 'backups', privacy: 'privacy',
  } as const;
  if (source !== 'overview') {
    const records = data[collections[source]];
    if (!records) return missing();
    actions.push({ label: `Abrir ${assistantSources[source]}`, section: source });
    const createLabels: Partial<Record<AssistantSource, string>> = { crm: 'Novo lead', quotes: 'Novo orçamento', orders: 'Nova ordem', customers: 'Novo cliente', team: 'Novo membro', warranties: 'Nova garantia', contracts: 'Novo contrato' };
    if (createLabels[source]) actions.push({ label: createLabels[source]!, section: source, create: collections[source] as keyof BootstrapData });
    const rows = records as (AdminRecord & { clientName?: string; service?: string; item?: string; expiresAt?: string; startDate?: string; endDate?: string; validUntil?: string; createdAt?: string; quoteNumber?: string; contractNumber?: string; warrantyNumber?: string; osNumber?: string; totalCents?: number; monthlyCents?: number; frequency?: string; nextAction?: string; active?: boolean })[];
    const filtered = rows.filter(item => {
      if (!matches([item.name, item.display_name, item.clientName, item.label])) return false;
      if (/\bsuspens[oa]s?\b/.test(query) && !['suspended', 'suspenso'].includes(item.status ?? '')) return false;
      if (/\binativ[oa]s?\b/.test(query) && !(item.active === false || item.status === 'inactive')) return false;
      if (/\bhoje\b/.test(query) && source === 'quotes' && (!item.createdAt || dayKey(new Date(item.createdAt)) !== dayKey(now))) return false;
      if (/\baprovad[oa]s?\b/.test(query) && item.status !== 'aprovado') return false;
      if (/\benviad[oa]s?\b/.test(query) && item.status !== 'enviado') return false;
      if (/\bativ[oa]s?\b/.test(query) && !(item.active === true || ['ativo', 'active', 'ativa'].includes(item.status ?? ''))) return false;
      const expires = item.expiresAt || item.endDate || item.validUntil;
      if (/\b(vencid[oa]s?|expirad[oa]s?)\b/.test(query) && !(item.status === 'expirada' || (expires && expires < dayKey(now)))) return false;
      return true;
    });
    return result(`${assistantSources[source]}${source === 'quotes' && /\bhoje\b/.test(query) ? ' criados hoje' : ''}: ${filtered.length} registro(s).\n${list(filtered.map(item => [item.name || item.display_name || item.clientName || item.label || item.event_type || item.request_type || item.id || 'Registro', item.quoteNumber || item.osNumber || item.contractNumber || item.warrantyNumber, item.service || item.item, item.status, item.role, typeof item.totalCents === 'number' ? money(item.totalCents) : undefined, typeof item.monthlyCents === 'number' ? `${money(item.monthlyCents)}/mês` : undefined, item.frequency, item.startDate ? `Início: ${item.startDate}` : undefined, item.expiresAt || item.endDate || item.validUntil, item.nextAction, item.occurred_at ? dateLabel(item.occurred_at) : undefined].filter(Boolean).join(' · ')))}`);
  }
  if (!/\b(resumo|gestao|situacao|pendencias?|visao|geral)\b/.test(query)) return result('Posso ajudar com a gestão cadastrada no sistema. Escolha um módulo ou pergunte “resumo da gestão”, “agenda de hoje” ou “estoque baixo”. Não interpreto comandos livres fora dessas consultas.');
  const lines: string[] = [];
  if (data.organizations) lines.push(`Empresas: ${data.organizations.length} · ${data.organizations.filter(item => item.status === 'suspended').length} suspensas`);
  if (data.members) lines.push(`Usuários: ${data.members.length}`);
  if (data.appointments) lines.push(`Agenda de hoje: ${data.appointments.filter(item => dayKey(new Date(item.startAt)) === dayKey(now)).length} compromissos`);
  if (data.workOrders) lines.push(`Ordens em aberto: ${data.workOrders.filter(item => item.status !== 'concluida').length}`);
  if (data.inventory) lines.push(`Itens para reposição: ${data.inventory.filter(item => item.quantity <= item.minimumQuantity).length}`);
  if (data.transactions) lines.push(`Lançamentos não pagos: ${data.transactions.filter(item => item.status !== 'pago').length}`);
  if (data.leads) lines.push(`Leads em negociação: ${data.leads.filter(item => item.status !== 'ganho').length}`);
  if (data.customers) lines.push(`Clientes: ${data.customers.length}`);
  if (data.quotes) lines.push(`Orçamentos: ${data.quotes.length}`);
  if (data.contracts) lines.push(`Contratos: ${data.contracts.length}`);
  if (data.warranties) lines.push(`Garantias: ${data.warranties.length}`);
  if (data.employees) lines.push(`Equipe ativa: ${data.employees.filter(item => item.active).length}`);
  return result(`Resumo dos dados carregados nesta área:\n${lines.join('\n') || 'Nenhum módulo carregado.'}`);
}
