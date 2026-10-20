import { dateKey } from './general-management';
export const normalizeSearch = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function workspaceRecords(data, allowed) {
    const groups = [
        ['customers', 'customers', r => r.name, r => [r.phone, r.email, r.address].join(' · '), () => ''],
        ['leads', 'crm', r => r.name, r => [r.phone, r.interest, r.nextAction].join(' · '), r => r.createdAt],
        ['quotes', 'quotes', r => `${r.quoteNumber} · ${r.clientName}`, r => r.service, r => r.createdAt],
        ['appointments', 'agenda', r => `${r.title} · ${r.clientName}`, r => r.technician, r => r.startAt],
        ['workOrders', 'orders', r => `${r.osNumber} · ${r.clientName}`, r => r.service, r => r.scheduledAt],
        ['transactions', 'finance', r => r.description, r => r.category, r => r.dueDate],
        ['inventory', 'inventory', r => r.name, r => r.sku, () => ''],
        ['contracts', 'contracts', r => `${r.contractNumber} · ${r.clientName}`, r => r.service, r => r.startDate],
        ['warranties', 'warranties', r => `${r.warrantyNumber} · ${r.clientName}`, r => r.item, r => r.purchaseDate],
        ['employees', 'team', r => r.name, r => r.role, r => r.createdAt]
    ];
    return groups.filter(([, section]) => allowed.includes(section)).flatMap(([entity, section, title, detail, date]) => data[entity].map(record => ({ entity, section, record, title: title(record), detail: detail(record), date: date(record) })));
}
export function searchWorkspace(records, query) { const terms = normalizeSearch(query).split(' ').filter(Boolean); if (!terms.length)
    return []; return records.filter(item => terms.every(term => normalizeSearch(item.title + ' ' + item.detail + ' ' + (item.record.notes || '')).includes(term))).slice(0, 60); }
export function customerHistory(data, customer, allowed) {
    // Older operational records store a name rather than a customer ID. Never merge ambiguous names.
    const name = normalizeSearch(customer.name);
    if (!name || data.customers.filter(c => normalizeSearch(c.name) === name).length !== 1)
        return [];
    return workspaceRecords(data, allowed).filter(item => ['quotes', 'appointments', 'workOrders', 'contracts', 'warranties'].includes(item.entity) && normalizeSearch(item.record.clientName || '') === name).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
export function workspaceAlerts(data, allowed, lowStock, today = dateKey(new Date().toISOString())) {
    const records = workspaceRecords(data, allowed), result = [];
    const add = (item, title, detail, severity = 'attention') => result.push({ id: item.entity + ':' + item.record.id + ':' + detail, title, detail, item, severity });
    for (const item of records) {
        const r = item.record, day = dateKey(item.date || '');
        if (item.entity === 'transactions' && r.status !== 'pago' && (r.status === 'atrasado' || day && day < today))
            add(item, 'Pagamento vencido', r.dueDate, 'urgent');
        if (item.entity === 'appointments' && day === today && !['cancelado', 'concluido'].includes(r.status))
            add(item, 'Atendimento hoje', r.startAt);
        if (item.entity === 'workOrders' && day && day <= today && !['concluida', 'cancelada'].includes(r.status))
            add(item, 'Ordem de serviço pendente', r.scheduledAt, day < today ? 'urgent' : 'attention');
        if (item.entity === 'inventory' && r.quantity <= Math.max(r.minimumQuantity, lowStock))
            add(item, 'Estoque baixo', `${r.quantity} ${r.unit}`);
        if (item.entity === 'quotes' && ['rascunho', 'enviado'].includes(r.status) && r.validUntil && r.validUntil <= new Date(new Date(today + 'T12:00:00Z').getTime() + 3 * 86400000).toISOString().slice(0, 10))
            add(item, 'Orçamento vencido ou próximo do vencimento', r.validUntil);
        if (item.entity === 'warranties' && r.status !== 'concluida' && r.expiresAt && r.expiresAt <= new Date(new Date(today + 'T12:00:00Z').getTime() + 30 * 86400000).toISOString().slice(0, 10))
            add(item, 'Garantia exige atenção', r.expiresAt);
    }
    return result.sort((a, b) => Number(b.severity === 'urgent') - Number(a.severity === 'urgent'));
}
