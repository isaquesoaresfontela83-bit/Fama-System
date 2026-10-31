export const VERSION = '15.21.0';
export const RELEASE = '2026-10-30-pedidos-vendas-entregas-01';
export const STAGES = { registrado: 'A confirmar', confirmado: 'Confirmado', preparacao: 'Em preparação', pronto: 'Pronto para entrega', agendado: 'Entrega agendada', transporte: 'Em transporte', entregue: 'Entregue', cancelado: 'Cancelado' };
export class OrderError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function text(value, max = 250) { return String(value ?? '').trim().slice(0, max); }
export function required(value, label, max = 250) {
  const result = text(value, max);
  if (!result) throw new OrderError(`${label} é obrigatório.`);
  return result;
}
export function integer(value, label, min = 0, max = 100_000_000) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new OrderError(`${label} inválido.`);
  return value;
}
export function date(value, label, optional = false) {
  if (!value && optional) return '';
  const parsed = typeof value === 'string' ? new Date(value + 'T12:00:00Z') : new Date(NaN);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new OrderError(`${label} inválida.`);
  return value;
}
export function today(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addMonths(value, offset) {
  const [y, m, d] = value.split('-').map(Number);
  const last = new Date(Date.UTC(y, m + offset, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + offset, Math.min(d, last))).toISOString().slice(0, 10);
}
export function normalizeOrder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new OrderError('Pedido inválido.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 30) throw new OrderError('Adicione de 1 a 30 produtos.');
  const items = input.items.map(item => ({
    name: required(item.name, 'Modelo ou produto', 180), dimensions: text(item.dimensions, 100), color: text(item.color, 80),
    quantity: integer(item.quantity, 'Quantidade', 1, 100), unitPriceCents: integer(item.unitPriceCents, 'Preço', 0),
  }));
  const subtotalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  integer(subtotalCents, 'Subtotal', 1);
  const discountCents = integer(input.discountCents ?? 0, 'Desconto', 0, subtotalCents);
  const freightCents = integer(input.freightCents ?? 0, 'Frete');
  const totalCents = integer(subtotalCents - discountCents + freightCents, 'Total', 1);
  const depositCents = integer(input.depositCents ?? 0, 'Entrada', 0, totalCents);
  const installmentCount = depositCents === totalCents ? 0 : integer(input.installmentCount ?? 1, 'Parcelas', 1, 36);
  if (installmentCount > totalCents - depositCents) throw new OrderError('O valor das parcelas deve ser de pelo menos um centavo.');
  return {
    clientName: required(input.clientName, 'Cliente', 180), customerId: text(input.customerId, 128), phone: text(input.phone, 40),
    address: required(input.address, 'Endereço de entrega', 500), reference: text(input.reference, 250),
    seller: required(input.seller, 'Vendedor', 120), carrier: text(input.carrier, 120), carrierPhone: text(input.carrierPhone, 40),
    deliveryDate: date(input.deliveryDate, 'Previsão de entrega', true), deliveryTime: text(input.deliveryTime, 5),
    notes: text(input.notes, 4000), items, subtotalCents, discountCents, freightCents, totalCents, depositCents, installmentCount,
    firstDueDate: date(input.firstDueDate || today(), 'Primeiro vencimento'), sourceQuoteId: text(input.sourceQuoteId, 128),
    paymentMethod: ['pix', 'boleto', 'cartao', 'dinheiro', 'transferencia'].includes(input.paymentMethod) ? input.paymentMethod : 'pix',
  };
}
export function installments(order) {
  const result = [];
  if (order.depositCents) result.push({ sequence: 0, label: 'Entrada', amountCents: order.depositCents, dueDate: order.firstDueDate });
  const remainder = order.totalCents - order.depositCents;
  for (let n = 0; n < order.installmentCount; n++) {
    const amountCents = Math.floor(remainder / order.installmentCount) + (n < remainder % order.installmentCount ? 1 : 0);
    result.push({ sequence: n + 1, label: `Parcela ${n + 1}/${order.installmentCount}`, amountCents, dueDate: addMonths(order.firstDueDate, n + (order.depositCents ? 1 : 0)) });
  }
  return result;
}
export function transition(current, next) {
  const allowed = { registrado: ['confirmado', 'cancelado'], confirmado: ['preparacao', 'cancelado'], preparacao: ['pronto', 'cancelado'], pronto: ['agendado', 'cancelado'], agendado: ['agendado', 'transporte', 'cancelado'], transporte: ['entregue'], entregue: [], cancelado: [] };
  if (!allowed[current]?.includes(next)) throw new OrderError('Esta mudança de etapa não está disponível.', 409);
}
export function isOverdue(order, now = today()) { return Boolean(order.deliveryDate && order.deliveryDate < now && !['entregue', 'cancelado'].includes(order.status)); }
export function policyDefaults() { return { enabled: true, editRoles: ['owner', 'admin', 'member'], deliveryRoles: ['owner', 'admin', 'member', 'technician'], financeRoles: ['owner', 'admin', 'member'] }; }
export function validatePolicy(value) {
  if (!value || typeof value.enabled !== 'boolean') throw new OrderError('Defina se os pedidos estão habilitados.');
  const result = { enabled: value.enabled };
  for (const field of ['editRoles', 'deliveryRoles', 'financeRoles']) {
    if (!Array.isArray(value[field]) || value[field].some(role => !['owner', 'admin', 'member', 'technician'].includes(role))) throw new OrderError('Perfil de acesso inválido.');
    result[field] = [...new Set(value[field])];
  }
  return result;
}
export function resolvePolicy(rows, access, userId) {
  let policy = policyDefaults();
  for (const key of ['global', `plan:${access.plan}`, ...(access.parentOrganizationId?[`organization:${access.parentOrganizationId}`]:[]), `organization:${access.organizationId}`, `member:${access.organizationId}:${userId}`]) {
    const row = rows.find(item => item.scope === key);
    if (row) policy = { ...policy, ...JSON.parse(row.policy) };
  }
  const modules = access.moduleAccess ?? access.permissions ?? [];
  const allowed = modules.includes('quotes') && policy.enabled;
  return { enabled: allowed, edit: allowed && policy.editRoles.includes(access.role), deliver: allowed && policy.deliveryRoles.includes(access.role), finance: allowed && (modules.includes('finance')||modules.includes('financeBasic')) && policy.financeRoles.includes(access.role), agenda: allowed && modules.includes('agenda') };
}
