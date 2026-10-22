export const chartModels = [{ id: 'columns', label: 'Colunas' }, { id: 'bars', label: 'Barras' }, { id: 'line', label: 'Linhas' }, { id: 'area', label: 'Área' }, { id: 'pie', label: 'Pizza' }, { id: 'donut', label: 'Rosca' }, { id: 'radar', label: 'Radar' }];
export function dateKey(value) { if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return value; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function managementCharts(data, from, to, allowed, lowStockAlert = 0) {
    const charts = [];
    const inRange = (value) => { const key = dateKey(value); return !!key && (!from || key >= from) && (!to || key <= to); };
    const group = (rows, key, value = () => 1) => { const result = new Map(); for (const row of rows) {
        const label = key(row) || 'Não informado';
        result.set(label, (result.get(label) ?? 0) + value(row));
    } return [...result].map(([name, value]) => ({ name, value })); };
    const add = (chart) => charts.push(chart);
    if (allowed.includes('crm')) {
        const rows = data.leads.filter(row => inRange(row.createdAt));
        const stages = { novo: 'Novo contato', contato: 'Em atendimento', visita: 'Visita', proposta: 'Proposta enviada', negociacao: 'Negociação', ganho: 'Ganho', perdido: 'Perdido' };
        add({ id: 'lead-stages', title: 'Pipeline comercial', section: 'crm', unit: 'count', model: 'bars', note: 'Quantidade por etapa atual dos leads criados no período. As etapas não representam uma conversão entre módulos.', points: Object.entries(stages).map(([status, name]) => ({ name, value: rows.filter(row => row.status === status).length })) });
        add({ id: 'lead-values', title: 'Valor das oportunidades', section: 'crm', unit: 'money', model: 'columns', note: 'Valor estimado por etapa dos leads criados no período.', points: Object.entries(stages).map(([status, name]) => ({ name, value: rows.filter(row => row.status === status).reduce((sum, row) => sum + row.estimatedValueCents, 0) })) });
    }
    if (allowed.includes('quotes')) {
        const rows = data.quotes.filter(row => inRange(row.createdAt));
        const labels = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' };
        add({ id: 'quote-status', title: 'Orçamentos por status', section: 'quotes', unit: 'count', model: 'donut', note: 'Status atual dos orçamentos criados no período.', points: Object.entries(labels).map(([status, name]) => ({ name, value: rows.filter(row => row.status === status).length })) });
        add({ id: 'quote-values', title: 'Valores dos orçamentos', section: 'quotes', unit: 'money', model: 'columns', note: 'Soma dos valores por status. Um orçamento aprovado ainda não significa receita recebida.', points: group(rows, row => labels[row.status], row => row.totalCents) });
    }
    if (allowed.includes('orders')) {
        const rows = data.workOrders.filter(row => inRange(row.scheduledAt));
        const labels = { aberta: 'Aberta', em_execucao: 'Em execução', concluida: 'Concluída' };
        add({ id: 'service-status', title: 'Execução dos serviços', section: 'orders', unit: 'count', model: 'columns', note: 'Ordens por status atual, filtradas pela data programada.', points: group(rows, row => labels[row.status]) });
        add({ id: 'technicians', title: 'Serviços por técnico', section: 'orders', unit: 'count', model: 'bars', note: 'Quantidade de ordens programadas no período por técnico.', points: group(rows, row => row.technician).sort((a, b) => b.value - a.value).slice(0, 12) });
    }
    if (allowed.includes('agenda')) {
        const rows = data.appointments.filter(row => inRange(row.startAt));
        const labels = { agendado: 'Agendado', em_rota: 'Em rota', concluido: 'Concluído', remarcado: 'Remarcado', cancelado: 'Cancelado' };
        add({ id: 'appointment-status', title: 'Atendimentos da agenda', section: 'agenda', unit: 'count', model: 'pie', note: 'Compromissos por status, filtrados pela data do atendimento.', points: group(rows, row => labels[row.status]) });
    }
    if (allowed.includes('finance')) {
        const rows = data.transactions.filter(row => inRange(row.dueDate));
        add({ id: 'finance-summary', title: 'Receitas e despesas', section: 'finance', unit: 'money', model: 'columns', note: 'Lançamentos por vencimento no período. Recebido e pago consideram somente status Pago.', points: [{ name: 'Recebido', value: rows.filter(row => row.type === 'receita' && row.status === 'pago').reduce((sum, row) => sum + row.amountCents, 0) }, { name: 'Despesas pagas', value: rows.filter(row => row.type === 'despesa' && row.status === 'pago').reduce((sum, row) => sum + row.amountCents, 0) }, { name: 'A receber', value: rows.filter(row => row.type === 'receita' && row.status !== 'pago').reduce((sum, row) => sum + row.amountCents, 0) }, { name: 'A pagar', value: rows.filter(row => row.type === 'despesa' && row.status !== 'pago').reduce((sum, row) => sum + row.amountCents, 0) }] });
        add({ id: 'expense-categories', title: 'Despesas por categoria', section: 'finance', unit: 'money', model: 'donut', note: 'Todas as despesas com vencimento no período, pagas ou em aberto.', points: group(rows.filter(row => row.type === 'despesa'), row => row.category, row => row.amountCents) });
        const months = [...new Set(rows.map(row => dateKey(row.dueDate).slice(0, 7)))].sort();
        add({ id: 'income-trend', title: 'Receitas recebidas por mês', section: 'finance', unit: 'money', model: 'area', note: 'Lançamentos pagos agrupados pelo mês de vencimento, não pela data efetiva de pagamento.', points: months.map(month => ({ name: month.slice(5) + '/' + month.slice(0, 4), value: rows.filter(row => row.type === 'receita' && row.status === 'pago' && dateKey(row.dueDate).startsWith(month)).reduce((sum, row) => sum + row.amountCents, 0) })) });
    }
    if (allowed.includes('customers'))
        add({ id: 'customer-pools', title: 'Perfil das piscinas', section: 'customers', unit: 'count', model: 'donut', note: 'Retrato atual de todos os clientes. Não se aplica o período porque o cadastro não possui data de criação disponível.', points: group(data.customers, row => row.poolType) });
    if (allowed.includes('inventory'))
        add({ id: 'inventory-health', title: 'Situação do estoque', section: 'inventory', unit: 'count', model: 'columns', note: 'Retrato atual dos produtos. Usa o maior valor entre estoque mínimo do produto e alerta da empresa; não se aplica o período.', points: [{ name: 'Sem saldo', value: data.inventory.filter(row => row.quantity <= 0).length }, { name: 'Abaixo do mínimo', value: data.inventory.filter(row => row.quantity > 0 && row.quantity <= Math.max(row.minimumQuantity, lowStockAlert)).length }, { name: 'Regular', value: data.inventory.filter(row => row.quantity > Math.max(row.minimumQuantity, lowStockAlert)).length }] });
    return charts;
}
