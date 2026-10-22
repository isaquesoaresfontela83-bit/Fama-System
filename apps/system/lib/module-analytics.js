import { dateKey, managementCharts } from './general-management';

export const analyticsSections = {
    dashboard: 'Visão geral', crm: 'Comercial', quotes: 'Orçamentos', agenda: 'Agenda', orders: 'Serviços',
    finance: 'Financeiro', customers: 'Clientes', inventory: 'Estoque', contracts: 'Contratos',
    warranties: 'Garantias', team: 'Equipe', planning: 'Planejamento', mobile: 'Modo técnico',
    consultation: 'Consultas', assistant: 'Fama IA', chat: 'Chat', invoices: 'Notas fiscais',
    members: 'Usuários e permissões', settings: 'Configurações', billing: 'Planos e pagamentos',
    support: 'Suporte', privacy: 'Privacidade', manual: 'Manual', platform: 'Administração',
};
const resourceSections = { finance: ['finance', 'invoices'], members: ['members'], chat: ['chat'], support: ['support'], privacy: ['privacy'] };
export const analyticsResources = {
    finance: { url: '/api/finance', fields: ['fiscalInvoices', 'purchases', 'bankMovements'] },
    members: { url: '/api/members', fields: ['members'] },
    chat: { url: '/api/internal-chat', fields: ['threads'] },
    support: { url: '/api/support', fields: ['tickets'] },
    privacy: { url: '/api/privacy', fields: ['requests'] },
};
export function analyticsRequestsFor(section, allowed) {
    return Object.entries(resourceSections).filter(([, sections]) => sections.some(target => allowed.includes(target) && (section === target || section === 'charts' || section === 'management'))).map(([key]) => key);
}
const rows = (data, key) => Array.isArray(data?.[key]) ? data[key] : [];
const group = (items, key, labels = {}) => {
    const values = new Map();
    for (const item of items) {
        const raw = key(item);
        const name = labels[raw] || raw || 'Não informado';
        values.set(name, (values.get(name) || 0) + 1);
    }
    return [...values].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
};
const moduleGroups = [
    ['Visão geral', ['dashboard']],
    ['Comercial', ['crm', 'quotes', 'customers', 'contracts']],
    ['Operação', ['agenda', 'orders', 'inventory', 'warranties', 'team', 'mobile', 'planning']],
    ['Financeiro', ['finance', 'invoices']],
    ['Ferramentas', ['assistant', 'chat', 'consultation']],
];
export function moduleCharts(data, from, to, allowed, lowStockAlert = 0, context = {}) {
    const charts = managementCharts(data, from, to, allowed, lowStockAlert);
    const has = section => allowed.includes(section);
    const range = (value) => { const day = dateKey(value); return !!day && (!from || day >= from) && (!to || day <= to); };
    const add = (section, id, title, points, note, model = 'columns', extra = {}) => {
        if (has(section)) charts.push({ section, id, title, points, note, model, unit: 'count', ...extra });
    };
    const snapshot = 'Retrato atual dos registros disponíveis neste acesso; o filtro de período não se aplica.';
    const available = () => moduleGroups.map(([name, sections]) => ({ name, value: sections.filter(has).length }));
    add('dashboard', 'overview-access', 'Áreas disponíveis neste acesso', available(), 'Módulos liberados pelo plano e pelas permissões atuais. Não mede utilização. O período não se aplica.', 'bars');
    const auxiliary = (resource, section, id, title, field, key, labels, note, model = 'donut', datedBy) => {
        const source = context[resource];
        const state = source?.status || 'loading';
        const items = rows(source?.data, field).filter(item => !datedBy || range(item[datedBy]));
        add(section, id, title, state === 'ready' ? group(items, key, labels) : [], note, model, { state, error: state === 'error' ? 'Não foi possível carregar estes dados. Atualize os gráficos para tentar novamente.' : undefined });
    };

    add('contracts', 'contract-status', 'Contratos por situação', group(rows(data, 'contracts'), row => row.status, { rascunho: 'Rascunho', ativo: 'Ativo', suspenso: 'Suspenso', encerrado: 'Encerrado' }), snapshot, 'donut');
    add('warranties', 'warranty-status', 'Garantias por situação', group(rows(data, 'warranties'), row => row.status, { ativa: 'Ativa', agendada: 'Agendada', concluida: 'Concluída', expirada: 'Expirada' }), snapshot, 'donut');
    add('team', 'team-availability', 'Disponibilidade da equipe', [{ name: 'Ativos', value: rows(data, 'employees').filter(row => row.active).length }, { name: 'Inativos', value: rows(data, 'employees').filter(row => !row.active).length }], snapshot, 'donut');
    add('team', 'team-roles', 'Equipe por função', group(rows(data, 'employees'), row => row.role), snapshot, 'bars');
    if (has('agenda')) {
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const appointments = rows(data, 'appointments').filter(row => range(row.startAt));
        const weekday = value => new Date(dateKey(value) + 'T12:00:00Z').getUTCDay();
        add('planning', 'planning-weekdays', 'Atendimentos por dia da semana', [1, 2, 3, 4, 5, 6, 0].map(day => ({ name: weekdays[day], value: appointments.filter(row => weekday(row.startAt) === day).length })), 'Compromissos no período, pelo dia do atendimento em Brasília. Inclui todos os status.');
    }
    if (has('customers')) add('consultation', 'consultation-pools', 'Piscinas da carteira de clientes', group(rows(data, 'customers'), row => row.poolType), 'Perfil dos clientes cadastrados que podem precisar de consultas e novos atendimentos. Não representa o histórico de consultas CNPJ ou CEP. O período não se aplica.', 'donut');
    const sourceEntities = { crm: 'leads', quotes: 'quotes', agenda: 'appointments', orders: 'workOrders', customers: 'customers', inventory: 'inventory', finance: 'transactions', contracts: 'contracts', warranties: 'warranties', team: 'employees' };
    add('assistant', 'assistant-sources', 'Registros disponíveis por módulo', Object.entries(sourceEntities).filter(([section]) => has(section)).map(([section, entity]) => ({ name: analyticsSections[section], value: rows(data, entity).length })), 'Cadastros visíveis neste acesso. Não mede uso da IA nem confirma quais fontes estão habilitadas na configuração da assistente. O período não se aplica.', 'bars');
    if (has('mobile')) {
        if (has('orders')) add('mobile', 'mobile-orders', 'Serviços disponíveis no modo técnico', group(rows(data, 'workOrders').filter(row => range(row.scheduledAt)), row => row.status, { aberta: 'Aberta', em_execucao: 'Em execução', concluida: 'Concluída' }), 'Ordens disponíveis neste acesso, pela data programada no período.', 'donut');
        else if (has('agenda')) add('mobile', 'mobile-agenda', 'Agenda disponível no modo técnico', group(rows(data, 'appointments').filter(row => range(row.startAt)), row => row.status, { agendado: 'Agendado', em_rota: 'Em rota', concluido: 'Concluído', remarcado: 'Remarcado', cancelado: 'Cancelado' }), 'Compromissos disponíveis neste acesso, pela data do atendimento.', 'donut');
        else add('mobile', 'mobile-access', 'Recursos disponíveis neste acesso', available(), 'Quantidade de módulos liberados pelo plano e pelas permissões atuais. Não mede utilização. O período não se aplica.');
    }
    for (const [section, title] of Object.entries({ settings: 'Áreas configuráveis neste acesso', billing: 'Módulos disponíveis no seu plano', manual: 'Módulos para consultar no manual', platform: 'Áreas do sistema neste acesso' })) add(section, section + '-access', title, available(), 'Quantidade de módulos por área liberados pelo plano e pelas permissões atuais. Não mede utilização. O período não se aplica.', 'bars');
    auxiliary('members', 'members', 'member-roles', 'Usuários por perfil de acesso', 'members', row => row.role, { owner: 'Proprietário', admin: 'Administrador', member: 'Colaborador', technician: 'Técnico' }, snapshot);
    auxiliary('members', 'members', 'member-status', 'Situação dos acessos', 'members', row => row.status, { active: 'Ativo', invited: 'Convidado' }, snapshot, 'columns');
    auxiliary('chat', 'chat', 'chat-threads', 'Conversas disponíveis', 'threads', row => row.kind, { channel: 'Canais', direct: 'Conversas diretas' }, 'Somente as conversas disponíveis para você. Não lê conteúdo das mensagens. O período não se aplica.');
    auxiliary('support', 'support', 'support-status', 'Solicitações de suporte', 'tickets', row => row.status, { aberto: 'Aberto', em_analise: 'Em análise', resolvido: 'Resolvido' }, 'Status atual dos chamados criados no período e disponíveis neste acesso.', 'donut', 'createdAt');
    auxiliary('privacy', 'privacy', 'privacy-status', 'Seus pedidos de privacidade', 'requests', row => row.status, { open: 'Aberto', in_progress: 'Em atendimento', completed: 'Concluído', rejected: 'Não atendido' }, 'Suas solicitações criadas no período, agrupadas pelo status atual.', 'columns', 'createdAt');
    auxiliary('finance', 'invoices', 'invoice-status', 'Notas fiscais por situação', 'fiscalInvoices', row => row.status, { rascunho: 'Rascunho', processando: 'Processando', emitida: 'Emitida', registrada: 'Registrada', cancelando: 'Cancelando', cancelada: 'Cancelada', erro: 'Erro' }, 'Documentos pela data de emissão no período. Inclui registros de emissores externos.', 'donut', 'issueDate');
    auxiliary('finance', 'finance', 'purchase-status', 'Compras por situação', 'purchases', row => row.status, { pendente: 'Pendente', pago: 'Pago', cancelado: 'Cancelado' }, 'Compras pela data da compra no período.', 'columns', 'purchaseDate');
    auxiliary('finance', 'finance', 'bank-reconciliation', 'Conciliação bancária', 'bankMovements', row => row.status, { pendente: 'Pendente', conciliado: 'Conciliado', ignorado: 'Ignorado' }, 'Movimentos carregados pelo módulo financeiro (até 1.000), pela data do movimento no período.', 'donut', 'postedAt');
    return charts;
}

export function chartsForSection(charts, section, financeTab = 'visao') {
    if (section === 'dashboard') {
        const preferred = ['finance-summary', 'income-trend', 'quote-status', 'service-status', 'appointment-status', 'lead-stages', 'inventory-health', 'customer-pools'];
        const selected = preferred.map(id => charts.find(chart => chart.id === id)).filter(Boolean).slice(0, 6);
        return selected.length ? selected : charts.filter(chart => chart.section === 'dashboard');
    }
    if (section === 'charts' || section === 'management') return charts;
    const preferred = section === 'finance' ? { compras: 'purchase-status', bancos: 'bank-reconciliation', notas: 'invoice-status', cobrancas: 'finance-summary', asaas: 'finance-summary', contas: 'finance-summary' }[financeTab] : undefined;
    const chart = charts.find(chart => chart.id === preferred) || charts.find(chart => chart.section === section);
    return chart ? [chart] : [];
}
