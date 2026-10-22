import { operationDate } from './operation-overview.js';

export function dailyWork(data, allowed, now = new Date()) {
    const today = operationDate(now);
    const visits = allowed.includes('agenda') ? data.appointments ?? [] : [];
    const orders = allowed.includes('orders') ? data.workOrders ?? [] : [];
    const items = [
        ...visits.filter(record => !['concluido', 'cancelado'].includes(record.status)).map(record => ({ entity: 'appointments', record, date: record.startAt, title: record.kind || record.title || 'Atendimento', active: record.status === 'em_rota' })),
        ...orders.filter(record => !['concluida', 'cancelada'].includes(record.status)).map(record => ({ entity: 'workOrders', record, date: record.scheduledAt, title: record.service || 'Serviço', active: record.status === 'em_execucao' })),
    ].map(item => {
        const timestamp = new Date(item.date).getTime();
        const valid = Number.isFinite(timestamp);
        return { ...item, timestamp: valid ? timestamp : Infinity, group: item.active ? 'active' : valid && timestamp < now.getTime() ? 'pending' : 'next' };
    }).sort((a, b) => a.timestamp - b.timestamp);
    const pending = items.filter(item => item.group === 'pending');
    const active = items.filter(item => item.group === 'active');
    const next = items.filter(item => item.group === 'next');
    const todayVisits = visits.filter(record => operationDate(record.startAt) === today && record.status !== 'cancelado');
    return { pending, active, next, priority: [...active, ...pending, ...next], totalToday: todayVisits.length, completedToday: todayVisits.filter(record => record.status === 'concluido').length };
}
