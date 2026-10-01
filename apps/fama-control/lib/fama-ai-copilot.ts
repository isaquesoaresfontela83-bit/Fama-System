import type { AssistantAction, AssistantAnswer, AssistantData, AssistantItem, AssistantMetric, AssistantContext, AssistantPlanStep, AssistantChart } from './fama-ai';
import { normalizeCommand, type AssistantSource, type AssistantSettings } from './fama-ai-settings';
import { assistantDraftDefinitions, draftEntityForSource, draftMissingFields, sanitizeAssistantDraft } from './fama-ai-drafts';

const normalize = normalizeCommand;
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function shift(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function keyOf(value?: string) { if (!value) return null; const date = new Date(value.includes('T') ? value : `${value}T12:00:00`); return Number.isNaN(date.getTime()) ? null : dayKey(date); }
function labelDate(value: string) { const date = new Date(value.includes('T') ? value : `${value}T12:00:00`); return Number.isNaN(date.getTime()) ? 'Sem data' : date.toLocaleString('pt-BR', value.includes('T') ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }); }
function isPending(status: string) { return !['concluido', 'cancelado'].includes(status); }
function build(source: AssistantSource, title: string, narrative: string, items: AssistantItem[], metrics: AssistantMetric[], actions: AssistantAction[], settings: AssistantSettings, extra: Partial<AssistantAnswer> = {}): AssistantAnswer {
  const limited = items.slice(0, settings.maxItems);
  const note = extra.note;
  return { source, title, narrative, metrics, items: limited, totalItems: items.length, actions, engine: 'internal', ...extra,
    text: [title, narrative, ...metrics.map(item => `${item.label}: ${item.value}`), ...limited.map(item => `• ${[item.title, item.detail, item.value, item.status].filter(Boolean).join(' · ')}`), ...extra.steps?.map(item => `• ${item.title}: ${item.description}`) ?? [], extra.communication?.text, note].filter(Boolean).join('\n') };
}
export function copilotSource(message: string): AssistantSource | undefined {
  const query = normalize(message);
  if (/\b(cliente 360|visao do cliente|historico do cliente|dossie do cliente)\b/.test(query)) return 'customers';
  if (/\b(planejar|planejamento|organizar)\b.*\b(agenda|semana|atendimentos)\b|\b(horarios?|vagas?)\b.*\b(livres?|disponiveis?)\b/.test(query)) return 'agenda';
  if (/\b(plano de acao|checklist do dia|priorizar o dia)\b/.test(query)) return 'overview';
  if (/\b(fluxo de caixa|projecao financeira|comparar os meses|comparar financeiro|diagnostico financeiro)\b/.test(query)) return 'finance';
  return undefined;
}

export function answerWithCopilot(message: string, data: AssistantData, source: AssistantSource, now: Date, settings: AssistantSettings, context?: AssistantContext): AssistantAnswer | null {
  const query = normalize(message);
  if (source === 'finance' && /\b(do cliente|desse cliente|deste cliente)\b/.test(query)) return { source, title: 'Vínculo financeiro do cliente', text: 'Os lançamentos desta consulta não possuem um vínculo de cliente que permita calcular valores individuais com segurança. Abra o financeiro e confira os registros antes de atribuir uma dívida ou recebimento a esse cliente.', actions: [{ label: 'Abrir financeiro', section: source }] };
  const creating = /\b(criar|cadastrar|preparar|agendar|montar|novo|nova|rascunho)\b/.test(query) && !/\b(mensagem|cronograma|plano de acao|planejamento)\b/.test(query);
  const entity = draftEntityForSource(source);
  if (creating && entity) {
    if (!settings.allowCreate) return { source, title: 'Cadastro não disponível pela assistente', text: 'A abertura de formulários está desativada pelo Fama Control.', actions: [] };
    const definition = assistantDraftDefinitions[entity];
    const fields: Record<string, string> = {};
    const aliases: Record<string, string> = { cliente: 'clientName', nome: 'name', compromisso: 'title', titulo: 'title', tecnico: 'technician', endereco: 'address', telefone: 'phone', email: 'email', servico: 'service', descricao: 'description', valor: 'amount', vencimento: 'dueDate', categoria: 'category', inicio: 'startDate', termino: 'endDate', mensalidade: 'monthly', frequencia: 'frequency', observacoes: 'notes', interesse: 'interest', origem: 'source', 'proxima acao': 'nextAction', 'mao de obra': 'labor', deslocamento: 'travel', desconto: 'discount', urgencia: 'urgency', validade: 'validUntil', 'condicao de pagamento': 'paymentTerms', duracao: 'duration', tipo: 'type', 'data e hora': entity === 'appointments' ? 'startAt' : 'scheduledAt', condicoes: 'terms', 'dia de pagamento': 'paymentDay', 'valor estimado': 'estimatedValue' };
    for (const part of message.split(';')) {
      const match = part.match(/([^:]+):\s*(.+)/);
      if (!match) continue;
      const label = normalize(match[1]).replace(/^.*\b(?:com|para)\s+/, '').trim();
      const key = aliases[label] ?? Object.entries(aliases).find(([alias]) => label.endsWith(` ${alias}`))?.[1];
      if (key) fields[key] = match[2].trim();
    }
    const namedClient = message.match(/\b(?:para|cliente)\s+([^;\n]+?)(?=\s+(?:hoje|amanh[ãa]|[àa]s\s|com\s)|;|$)/i)?.[1]?.trim();
    if (namedClient && !fields.clientName && ['appointments', 'quotes', 'contracts', 'workOrders'].includes(entity)) fields.clientName = namedClient;
    const day = /\bamanha\b/.test(query) ? dayKey(shift(now, 1)) : /\bhoje\b/.test(query) ? dayKey(now) : null;
    const explicit = message.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    const date = explicit ? `${explicit[3]}-${explicit[2]}-${explicit[1]}` : day;
    const time = message.match(/(?:[àa]s\s+|hor[áa]rio\s*:\s*)(\d{1,2})(?::|h)?(\d{2})?\b/i);
    if (date && time && Number(time[1]) < 24 && Number(time[2] ?? 0) < 60) {
      if (entity === 'appointments') fields.startAt = `${date}T${time[1].padStart(2, '0')}:${time[2] ?? '00'}`;
      if (entity === 'workOrders') fields.scheduledAt = `${date}T${time[1].padStart(2, '0')}:${time[2] ?? '00'}`;
    }
    if (entity === 'appointments') { fields.title ||= /garantia/.test(query) ? 'Atendimento de garantia' : 'Visita técnica'; fields.kind ||= /garantia/.test(query) ? 'Garantia' : 'Visita técnica'; }
    if (entity === 'transactions') fields.type ||= /despesa|pagar/.test(query) ? 'despesa' : 'receita';
    for (const field of definition.fields) {
      const value = fields[field.name];
      if (field.type === 'date' && value) {
        const parsed = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (parsed) fields[field.name] = `${parsed[3]}-${parsed[2]}-${parsed[1]}`;
        else if (normalize(value) === 'amanha') fields[field.name] = dayKey(shift(now, 1));
        else if (normalize(value) === 'hoje') fields[field.name] = dayKey(now);
      }
    }
    const draft = sanitizeAssistantDraft({ entity, fields })!;
    const missing = draftMissingFields(draft);
    const narrative = missing.length ? `Vamos preparar o cadastro. Complete ${missing.join(', ')} abaixo e abra o formulário para revisar os demais campos.` : 'Preparei os campos informados. Revise abaixo e abra o formulário do sistema para confirmar o cadastro.';
    return build(source, definition.title, narrative, [], [], [], settings, { draft, note: entity === 'quotes' ? 'Selecione os itens no catálogo da empresa no formulário. Os preços e as taxas serão calculados pelo orçamento inteligente.' : entity === 'contracts' ? 'O rascunho organiza os dados informados; confira escopo, condições e cláusulas antes de salvar.' : 'O registro só é criado quando você salva o formulário do sistema.' });
  }
  if (source === 'customers' && /\b(cliente 360|visao do cliente|historico do cliente|dossie do cliente)\b/.test(query)) return clientDossier(message, data, now, settings, context);
  if (source === 'agenda' && /\b(planejar|planejamento|organizar|livres?|disponiveis?)\b/.test(query)) return schedulePlan(data, now, settings);
  if (source === 'finance' && /\b(comparar|comparacao|evolucao|variacao)\b/.test(query)) return financialComparison(data, now, settings);
  if (source === 'finance' && /\b(fluxo de caixa|projecao|diagnostico)\b/.test(query)) return cashFlow(data, now, settings);
  if (source === 'crm' && /\b(funil|diagnostico|analise)\b/.test(query)) return salesPipeline(data, settings);
  if (/\b(mensagem|texto|cronograma)\b/.test(query)) return communicationDraft(message, data, source, now, settings);
  return null;
}

function clientDossier(message: string, data: AssistantData, now: Date, settings: AssistantSettings, context?: AssistantContext): AssistantAnswer {
  const source = 'customers';
  if (!data.customers) return { source, text: 'O módulo de clientes precisa estar carregado e autorizado para consultar o histórico.', actions: [] };
  const name = message.split(':').slice(1).join(':').trim() || context?.customerName || '';
  if (!name) return { source, title: 'Qual cliente você quer analisar?', text: 'Use “Cliente 360: nome completo”. Vou reunir os registros dos módulos disponíveis para seu usuário.', actions: [], suggestions: data.customers.slice(0, 3).map(item => ({ label: item.name, question: `Cliente 360: ${item.name}`, source })) };
  const exact = data.customers.filter(item => normalize(item.name) === normalize(name));
  const matches = exact.length ? exact : data.customers.filter(item => normalize(item.name).includes(normalize(name)));
  if (matches.length !== 1) return build(source, matches.length ? 'Escolha o cliente certo' : 'Cliente não encontrado', matches.length ? 'Há mais de um cadastro correspondente. Abra Clientes e confira o cadastro para evitar misturar históricos.' : 'Confira o nome no cadastro da empresa selecionada.', matches.map(item => ({ id: item.id, title: item.name, detail: item.address })), [], [{ label: 'Abrir clientes', section: source }], settings);
  const customer = matches[0]; const equal = (candidate: string) => normalize(candidate) === normalize(customer.name);
  const quotes = data.quotes?.filter(item => equal(item.clientName));
  const visits = data.appointments?.filter(item => equal(item.clientName));
  const orders = data.workOrders?.filter(item => equal(item.clientName));
  const contracts = data.contracts?.filter(item => equal(item.clientName));
  const warranties = data.warranties?.filter(item => equal(item.clientName));
  const metrics: AssistantMetric[] = []; const items: AssistantItem[] = []; const actions: AssistantAction[] = [{ label: 'Abrir cadastro do cliente', section: source, record: { entity: 'customers', id: customer.id } }];
  if (quotes) { metrics.push({ label: 'Propostas cadastradas', value: String(quotes.length), detail: money(quotes.reduce((sum, item) => sum + item.totalCents, 0)) }); for (const item of quotes) items.push({ id: `q-${item.id}`, title: item.quoteNumber, detail: `${item.service} · validade ${item.validUntil ? labelDate(item.validUntil) : 'não informada'}`, value: money(item.totalCents), status: item.status }); }
  if (visits) { const upcoming = visits.filter(item => isPending(item.status) && new Date(item.startAt) >= now); metrics.push({ label: 'Próximas visitas', value: String(upcoming.length) }); for (const item of visits.slice().sort((a, b) => b.startAt.localeCompare(a.startAt))) items.push({ id: `a-${item.id}`, title: item.title, detail: `${labelDate(item.startAt)} · ${item.technician || 'Sem técnico'}`, status: item.status }); }
  if (orders) { metrics.push({ label: 'Serviços em aberto', value: String(orders.filter(item => item.status !== 'concluida').length) }); for (const item of orders) items.push({ id: `o-${item.id}`, title: item.osNumber, detail: item.service, value: money(item.amountCents), status: item.status }); }
  if (contracts) { metrics.push({ label: 'Contratos ativos', value: String(contracts.filter(item => item.status === 'ativo').length) }); for (const item of contracts) items.push({ id: `c-${item.id}`, title: item.contractNumber, detail: `${item.service} · término ${labelDate(item.endDate)}`, value: `${money(item.monthlyCents)}/mês`, status: item.status }); }
  if (warranties) for (const item of warranties) items.push({ id: `w-${item.id}`, title: item.warrantyNumber, detail: `${item.item} · validade ${labelDate(item.expiresAt)}`, status: item.status });
  if (settings.sources.agenda && visits) actions.push({ label: 'Preparar visita para este cliente', section: 'agenda', create: 'appointments', draft: { entity: 'appointments', fields: { clientName: customer.name, title: 'Visita técnica', address: customer.address, kind: 'Visita técnica' } } });
  return build(source, `Visão do cliente · ${customer.name}`, [customer.poolType, customer.poolVolume ? `${customer.poolVolume.toLocaleString('pt-BR')} litros` : '', customer.plan ? `Plano ${customer.plan}` : '', customer.address].filter(Boolean).join(' · ') || 'Histórico disponível da sua empresa.', items, metrics, actions, settings, { customerName: customer.name, note: 'Os registros são associados pelo nome exato do cliente. Nomes duplicados impedem esta análise. Valores de propostas e contratos não confirmam recebimentos; os lançamentos financeiros não possuem vínculo de cliente nesta consulta.' });
}

function durationMinutes(notes: string): number | null {
  try { const parsed = JSON.parse(notes); const value = String(parsed.details?.duration ?? '').trim(); const match = value.match(/^(\d{1,2})\s*h(?:\s*(\d{1,2})(?:\s*min)?)?$|^(\d{1,3})\s*(?:min|minutos)?$/i); if (!match || Number(match[2] ?? 0) > 59) return null; const minutes = match[3] ? Number(match[3]) : Number(match[1]) * 60 + Number(match[2] ?? 0); return minutes > 0 && minutes <= 720 ? minutes : null; } catch { return null; }
}
function schedulePlan(data: AssistantData, now: Date, settings: AssistantSettings): AssistantAnswer {
  const source = 'agenda';
  if (!data.appointments || !data.employees) return { source, title: 'Agenda e equipe são necessárias', text: 'Para planejar a semana, os módulos Agenda e Equipe precisam estar carregados e autorizados.', actions: [] };
  const employees = data.employees.filter(item => item.active);
  const visits = data.appointments.filter(item => isPending(item.status) && keyOf(item.startAt) && keyOf(item.startAt)! >= dayKey(now) && keyOf(item.startAt)! <= dayKey(shift(now, 6)));
  const items: AssistantItem[] = []; const steps: AssistantPlanStep[] = []; const drafts: AssistantAction[] = [];
  let unknownDuration = 0;
  const firstDay = new Date(now); firstDay.setHours(0, 0, 0, 0);
  const lastDay = shift(firstDay, 7);
  const intervals = data.appointments.filter(item => isPending(item.status)).map(item => { const start = new Date(item.startAt); const duration = durationMinutes(item.notes); return { item, duration, start: start.getTime(), end: start.getTime() + (duration ?? 60) * 60000 }; }).filter(item => Number.isFinite(item.start) && item.start < lastDay.getTime() && item.end > firstDay.getTime());
  unknownDuration = intervals.filter(item => item.duration === null).length;
  for (const employee of employees) {
    const assigned = intervals.filter(({ item }) => normalize(item.technician) === normalize(employee.name));
    items.push({ id: employee.id, title: employee.name, detail: employee.role, value: `${assigned.length} atendimento(s)`, status: 'Próximos 7 dias' });
    if (employees.filter(other => normalize(other.name) === normalize(employee.name)).length !== 1) {
      steps.push({ id: `duplicate-${employee.id}`, title: `Conferir identificação · ${employee.name}`, description: 'Há profissionais ativos com o mesmo nome. Confira o cadastro antes de atribuir horários.', priority: 'high', source });
      continue;
    }
    const slots: string[] = [];
    for (let day = 0; day < 7 && slots.length < 2; day++) {
      const date = shift(now, day); if (date.getDay() === 0 || date.getDay() === 6) continue;
      for (const hour of [8, 9, 10, 11, 14, 15, 16, 17]) {
        const slot = new Date(date); slot.setHours(hour, 0, 0, 0);
        const start = slot.getTime(); const end = start + 60 * 60000;
        if (start <= now.getTime() || assigned.some(visit => start < visit.end && end > visit.start)) continue;
        slots.push(`${dayKey(slot)}T${String(hour).padStart(2, '0')}:00`);
        if (slots.length === 2) break;
      }
    }
    if (slots.length) {
      steps.push({ id: `slot-${employee.id}`, title: `${employee.name} · horários sugeridos`, description: slots.map(labelDate).join(' ou '), priority: 'normal', source });
      if (drafts.length < 4) drafts.push({ label: `Preparar visita · ${employee.name}`, section: source, create: 'appointments', draft: { entity: 'appointments', fields: { title: 'Visita técnica', technician: employee.name, startAt: slots[0], duration: '1h', kind: 'Visita técnica' } } });
    }
  }
  const unassigned = visits.filter(item => !item.technician.trim());
  if (unassigned.length) steps.unshift({ id: 'unassigned', title: 'Distribuir visitas sem técnico', description: `${unassigned.length} compromisso(s) aguardam um responsável. Confirme localização e duração antes de distribuir.`, priority: 'high', source, question: 'Agenda pendente sem técnico' });
  return build(source, 'Planejamento da equipe · próximos 7 dias', employees.length ? 'Separei a carga cadastrada e algumas opções para novos atendimentos.' : 'Não há profissionais ativos cadastrados para sugerir horários.', items, [{ label: 'Equipe ativa', value: String(employees.length) }, { label: 'Atendimentos pendentes', value: String(visits.length) }, { label: 'Sem responsável', value: String(unassigned.length), tone: unassigned.length ? 'warning' : 'neutral' }], [{ label: 'Abrir agenda', section: source }, ...drafts], settings, { steps, note: `Sugestões estimadas para segunda a sexta, das 8h às 12h e das 14h às 18h, com novas visitas de 60 minutos. ${unknownDuration} visita(s) sem duração válida foram consideradas com 60 minutos. As opções não avaliam deslocamentos, folgas nem disponibilidade externa; revise antes de salvar.` });
}

function financialComparison(data: AssistantData, now: Date, settings: AssistantSettings): AssistantAnswer {
  const source = 'finance'; if (!data.transactions) return { source, text: 'O financeiro precisa estar carregado e autorizado para comparar os períodos.', actions: [] };
  const months = [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  const chart: AssistantChart = { title: 'Lançamentos pagos por mês de vencimento', series: months.map(month => {
    const from = dayKey(month); const until = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const rows = data.transactions!.filter(item => { const key = keyOf(item.dueDate); return key && key >= from && key <= until; });
    return { label: month.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }), incomeCents: rows.filter(item => item.type === 'receita' && item.status === 'pago').reduce((sum, item) => sum + item.amountCents, 0), expenseCents: rows.filter(item => item.type === 'despesa' && item.status === 'pago').reduce((sum, item) => sum + item.amountCents, 0) };
  }) };
  const [previous, current] = chart.series; const balance = current.incomeCents - current.expenseCents; const oldBalance = previous.incomeCents - previous.expenseCents;
  return build(source, 'Comparação financeira · mês atual e anterior', `A diferença no saldo dos registros pagos é ${money(balance - oldBalance)} em relação ao mês anterior.`, chart.series.map(item => ({ id: item.label, title: item.label, detail: `Receitas ${money(item.incomeCents)} · despesas ${money(item.expenseCents)}`, value: money(item.incomeCents - item.expenseCents), status: 'Saldo realizado dos registros' })), [{ label: 'Saldo do mês atual', value: money(balance) }, { label: 'Saldo do mês anterior', value: money(oldBalance) }, { label: 'Diferença', value: money(balance - oldBalance), tone: balance >= oldBalance ? 'success' : 'warning' }], [{ label: 'Abrir financeiro', section: source }], settings, { chart, note: 'A comparação usa o mês de vencimento dos lançamentos marcados como pagos. O mês atual ainda está em andamento. O resultado não é saldo bancário nem comprova a data do recebimento ou pagamento.' });
}
function cashFlow(data: AssistantData, now: Date, settings: AssistantSettings): AssistantAnswer {
  const source = 'finance'; if (!data.transactions) return { source, text: 'O financeiro precisa estar carregado e autorizado para esta análise.', actions: [] };
  const today = dayKey(now); const limit = dayKey(shift(now, 30));
  const pending = data.transactions.filter(item => item.status !== 'pago');
  const future = pending.filter(item => { const key = keyOf(item.dueDate); return key && key >= today && key <= limit && item.status !== 'atrasado'; });
  const late = pending.filter(item => item.status === 'atrasado' || Boolean(keyOf(item.dueDate) && keyOf(item.dueDate)! < today));
  const missing = pending.filter(item => !keyOf(item.dueDate));
  const sum = (rows: typeof pending, type: string) => rows.filter(item => item.type === type).reduce((total, item) => total + item.amountCents, 0);
  const income = sum(future, 'receita'); const expense = sum(future, 'despesa');
  const steps: AssistantPlanStep[] = [];
  if (late.length) steps.push({ id: 'late', title: 'Conferir os lançamentos vencidos', description: `${late.length} registro(s) somam ${money(sum(late, 'receita') + sum(late, 'despesa'))}. Confira recebimentos e pagamentos antes de atualizar o status.`, priority: 'high', source, question: 'Financeiro atrasado' });
  if (missing.length) steps.push({ id: 'missing', title: 'Completar as datas de vencimento', description: `${missing.length} registro(s) não entram na projeção por falta de data válida.`, priority: 'normal', source });
  if (expense > income) steps.push({ id: 'gap', title: 'Revisar a diferença entre entradas e saídas', description: `As saídas previstas superam as entradas em ${money(expense - income)} nos próximos 30 dias. Consulte também o saldo bancário e os vencimentos.`, priority: 'high', source });
  const chart: AssistantChart = { title: 'Entradas e saídas previstas · próximas semanas', series: [0, 7, 14, 21].map(offset => {
    const from = dayKey(shift(now, offset)); const until = dayKey(shift(now, offset === 21 ? 30 : offset + 6));
    const rows = future.filter(item => item.dueDate >= from && item.dueDate <= until);
    return { label: offset === 0 ? 'Dias 1–7' : offset === 7 ? 'Dias 8–14' : offset === 14 ? 'Dias 15–21' : 'Dias 22–31', incomeCents: sum(rows, 'receita'), expenseCents: sum(rows, 'despesa') };
  }) };
  return build(source, 'Projeção dos lançamentos · próximos 30 dias', 'Esta análise separa o que está vencido e o que tem vencimento previsto. Valores pagos e vencidos não entram nas entradas e saídas futuras.', future.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(item => ({ id: item.id, title: item.description, detail: `${labelDate(item.dueDate)} · ${item.type}`, value: money(item.amountCents), status: 'Previsão cadastrada' })), [{ label: 'Entradas previstas', value: money(income), tone: 'success' }, { label: 'Saídas previstas', value: money(expense) }, { label: 'Diferença prevista', value: money(income - expense), tone: income >= expense ? 'success' : 'warning' }, { label: 'Vencidos não pagos', value: String(late.length), tone: late.length ? 'danger' : 'neutral' }], [{ label: 'Abrir financeiro', section: source }], settings, { chart, steps, note: 'Projeção baseada somente nos vencimentos e estados dos registros carregados, com horizonte de hoje até daqui a 30 dias. Não soma saldo bancário, não garante recebimentos e não cria cobranças.' });
}
function salesPipeline(data: AssistantData, settings: AssistantSettings): AssistantAnswer {
  const source = 'crm'; if (!data.leads) return { source, text: 'O CRM precisa estar carregado e autorizado para analisar o funil.', actions: [] };
  const stages = [['novo', 'Novo contato'], ['contato', 'Em contato'], ['visita', 'Visita'], ['proposta', 'Proposta'], ['negociacao', 'Negociação'], ['ganho', 'Ganho'], ['perdido', 'Perdido']] as const;
  const open = data.leads.filter(item => !['ganho', 'perdido'].includes(item.status));
  const missing = open.filter(item => !item.nextAction?.trim());
  return build(source, 'Diagnóstico do funil comercial', missing.length ? `${missing.length} negociação(ões) em aberto estão sem próxima ação definida.` : 'As negociações em aberto possuem uma próxima ação registrada.', stages.map(([status, label]) => { const rows = data.leads!.filter(item => item.status === status); return { id: status, title: label, value: String(rows.length), detail: `Valor estimado: ${money(rows.reduce((sum, item) => sum + item.estimatedValueCents, 0))}` }; }), [{ label: 'Negociações abertas', value: String(open.length) }, { label: 'Potencial cadastrado', value: money(open.reduce((sum, item) => sum + item.estimatedValueCents, 0)) }, { label: 'Sem próxima ação', value: String(missing.length), tone: missing.length ? 'warning' : 'neutral' }], [{ label: 'Abrir CRM', section: source }], settings, { steps: missing.slice(0, 5).map(item => ({ id: item.id, title: `Definir retorno · ${item.name}`, description: item.interest || 'Confirme o interesse e registre a próxima ação no CRM.', priority: 'normal', source })), note: 'Os valores do CRM são estimativas comerciais. Não são receita recebida nem previsão garantida de fechamento.' });
}
function communicationDraft(message: string, data: AssistantData, source: AssistantSource, now: Date, settings: AssistantSettings): AssistantAnswer | null {
  const reference = message.split(':').slice(1).join(':').trim();
  if (source === 'quotes' && data.quotes) {
    const rows = data.quotes.filter(item => !reference || [item.quoteNumber, item.clientName].some(value => normalize(value) === normalize(reference)));
    if (rows.length !== 1) return { source, title: 'Selecione um orçamento para a mensagem', text: 'Use “Mensagem para orçamento: número do orçamento”. A mensagem será preparada com os dados da proposta escolhida.', actions: [], suggestions: rows.slice(0, 3).map(item => ({ label: item.quoteNumber, question: `Mensagem para orçamento: ${item.quoteNumber}`, source })) };
    const item = rows[0]; const expired = Boolean(keyOf(item.validUntil) && keyOf(item.validUntil)! < dayKey(now));
    const draftText = `Olá, ${item.clientName}! Estou entrando em contato sobre o orçamento ${item.quoteNumber}, referente a ${item.service}, no valor de ${money(item.totalCents)}. ${expired ? 'A validade anterior encerrou; vamos conferir os valores e atualizar a proposta antes da confirmação.' : item.validUntil ? `A proposta é válida até ${labelDate(item.validUntil)}.` : 'Vamos confirmar as condições e a validade da proposta.'} Posso esclarecer alguma dúvida sobre o atendimento?`;
    return build(source, 'Mensagem de acompanhamento do orçamento', 'Preparei um texto com os dados cadastrados. Confira as condições antes de copiar.', [], [], [{ label: 'Abrir orçamento', section: source, record: { entity: 'quotes', id: item.id } }], settings, { communication: { title: 'Texto para o cliente', text: draftText }, note: 'A mensagem não foi enviada. Confira destinatário, validade e condições antes de usar.' });
  }
  if (source === 'agenda' && data.appointments) {
    const rows = data.appointments.filter(item => isPending(item.status) && (!reference || normalize(item.technician) === normalize(reference)) && keyOf(item.startAt) === dayKey(now)).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const text = `Cronograma de hoje${reference ? ` · ${reference}` : ''}\n${rows.map(item => `• ${labelDate(item.startAt)} — ${item.title} — ${item.clientName}${item.address ? ` — ${item.address}` : ''}`).join('\n') || 'Nenhum atendimento pendente registrado para hoje.'}\nConfirme horários, endereços e materiais antes de iniciar a rota.`;
    return build(source, 'Cronograma para a equipe', reference ? `Separei os compromissos de ${reference} registrados para hoje.` : 'Separei os compromissos pendentes de hoje. Você pode filtrar com “Cronograma da agenda: nome do técnico”.', [], [{ label: 'Atendimentos no texto', value: String(rows.length) }], [{ label: 'Abrir agenda', section: source }], settings, { communication: { title: 'Texto para copiar', text }, note: 'O cronograma não foi enviado. A sequência segue os horários cadastrados e não otimiza deslocamentos.' });
  }
  return null;
}

export function stepsFromPriorities(insights: { id: string; source: AssistantSource; title: string; detail: string; question: string; tone: string }[]): AssistantPlanStep[] {
  return insights.map(item => ({ id: item.id, title: item.title, description: item.detail, priority: item.tone === 'danger' ? 'high' : 'normal', source: item.source, question: item.question }));
}
