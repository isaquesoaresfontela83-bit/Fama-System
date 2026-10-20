export const operationDate = (date) => {
    const value = typeof date === 'string' ? new Date(date) : date;
    if (!Number.isFinite(value.getTime()))
        return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
};
export function operationOverview(data, allowed, lowStock, now = new Date()) {
    const todayKey = operationDate(now), month = todayKey.slice(0, 7), can = (section) => allowed.includes(section);
    const appointments = can('agenda') ? [...data.appointments].filter(item => operationDate(item.startAt)).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()) : [];
    const today = appointments.filter(item => operationDate(item.startAt) === todayKey);
    const actionable = appointments.filter(item => !['concluido', 'cancelado'].includes(item.status));
    const next = actionable.find(item => item.status === 'em_rota' && operationDate(item.startAt) === todayKey) ?? actionable.find(item => new Date(item.startAt).getTime() >= now.getTime());
    const transactions = can('finance') ? data.transactions : [];
    const overdue = transactions.filter(item => item.type === 'receita' && item.status !== 'pago' && (item.status === 'atrasado' || item.dueDate.slice(0, 10) < todayKey));
    const receivable = transactions.filter(item => item.type === 'receita' && item.status !== 'pago').reduce((sum, item) => sum + item.amountCents, 0);
    const revenue = transactions.filter(item => item.type === 'receita' && item.status === 'pago' && item.dueDate.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0);
    const inventory = can('inventory') ? data.inventory.filter(item => item.quantity <= Math.max(item.minimumQuantity, lowStock)) : [];
    const quotes = can('quotes') ? data.quotes.filter(item => ['rascunho', 'enviado'].includes(item.status)) : [];
    const pending = today.filter(item => ['agendado', 'remarcado'].includes(item.status));
    const anchor = new Date(todayKey + 'T12:00:00Z');
    const flow = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(anchor);
        day.setUTCDate(day.getUTCDate() - 6 + index);
        const key = day.toISOString().slice(0, 10);
        const paid = transactions.filter(item => item.status === 'pago' && item.dueDate.slice(0, 10) === key);
        return { day: key, income: paid.filter(item => item.type === 'receita').reduce((sum, item) => sum + item.amountCents, 0), expense: paid.filter(item => item.type === 'despesa').reduce((sum, item) => sum + item.amountCents, 0) };
    });
    return { todayKey, today, next, overdue, receivable, revenue, inventory, quotes, pending, flow, completed: today.filter(item => item.status === 'concluido').length };
}
