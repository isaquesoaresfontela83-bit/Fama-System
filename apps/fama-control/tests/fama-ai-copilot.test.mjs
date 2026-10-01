import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, ws: false, hmr: false } });
after(() => vite.close());
const { answerInternal } = await vite.ssrLoadModule('/lib/fama-ai.ts');
const { sanitizeAssistantDraft, draftMissingFields } = await vite.ssrLoadModule('/lib/fama-ai-drafts.ts');
const { defaultAssistantSettings: settings, restrictAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');
const { assistantCalendar, parseAssistantRequest } = await vite.ssrLoadModule('/lib/fama-ai-request.ts');
const now = new Date('2026-10-01T07:00:00');
const visit = (id, startAt, changes = {}) => ({ id, startAt, title: id, clientName: 'João', address: '', technician: 'Ana', status: 'agendado', notes: JSON.stringify({ details: { duration: '1h30min' } }), kind: 'Visita técnica', ...changes });
const customer = (id, name = 'João') => ({ id, name, phone: '', email: '', address: 'Rua da Piscina', poolType: 'Fibra', poolVolume: 30000, plan: 'Premium', status: 'ativo', notes: '' });
const entry = (id, amountCents, type, dueDate, status = 'pendente') => ({ id, description: id, amountCents, type, dueDate, status, category: '' });

test('prepares appointment fields and Brazilian dates without persisting or choosing missing clients', () => {
  const data = { appointments: [] }; const before = JSON.stringify(data);
  const answer = answerInternal('Agendar visita para João amanhã às 14h; técnico: Ana; duração: 1h30', data, 'overview', now);
  assert.equal(answer.source, 'agenda');
  assert.deepEqual(answer.draft.fields, { title: 'Visita técnica', clientName: 'João', startAt: '2026-10-02T14:00', technician: 'Ana', kind: 'Visita técnica', duration: '1h30' });
  assert.deepEqual(answer.actions, []);
  assert.equal(JSON.stringify(data), before);
  const expense = answerInternal('Criar despesa; descrição: Material; valor: 450,00; vencimento: 10/10/2026', {}, 'overview', now);
  assert.equal(expense.draft.entity, 'transactions');
  assert.deepEqual(expense.draft.fields, { description: 'Material', type: 'despesa', amount: '450.00', dueDate: '2026-10-10' });
  assert.equal(answerInternal('Preparar orçamento', {}, 'overview', now).draft.entity, 'quotes');
  assert.match(answerInternal('Preparar contrato', {}, 'overview', now).note, /cláusulas/);
});

test('drafts reject arbitrary fields, illegal values, rollover dates and backwards contract ranges', () => {
  assert.equal(sanitizeAssistantDraft({ entity: '__proto__', fields: {} }), null);
  const appointment = sanitizeAssistantDraft({ entity: 'appointments', fields: { clientName: 'João', startAt: '2026-02-31T10:00', status: 'concluido', organizationId: 'other', technician: 'Ana', title: '<script>text</script>' } });
  assert.deepEqual(Object.keys(appointment.fields), ['title', 'clientName', 'technician']);
  assert.deepEqual(draftMissingFields(appointment), ['Data e hora']);
  assert.equal(sanitizeAssistantDraft({ entity: 'appointments', fields: { startAt: '2026-10-01T24:00' } }).fields.startAt, undefined);
  const finance = sanitizeAssistantDraft({ entity: 'transactions', fields: { amount: '-500', type: 'transferencia', status: 'pago', description: 'Material' } });
  assert.deepEqual(finance.fields, { description: 'Material' });
  const contract = sanitizeAssistantDraft({ entity: 'contracts', fields: { startDate: '2026-10-02', endDate: '2026-10-01', paymentDay: '32' } });
  assert.deepEqual(contract.fields, { startDate: '2026-10-02' });
});

test('client dossier combines only exact-name authorized relationships and blocks homonyms', () => {
  const data = { customers: [customer('c')], appointments: [visit('a', '2026-10-02T08:00'), visit('other', '2026-10-02T09:00', { clientName: 'Outra pessoa' })], quotes: [{ id: 'q', quoteNumber: 'ORC-1', clientName: 'João', service: 'Filtro', totalCents: 45000, status: 'enviado', validUntil: '2026-10-10' }], contracts: [{ id: 'x', clientName: 'João', contractNumber: 'CTR-1', service: 'Manutenção', endDate: '2026-12-31', status: 'ativo', monthlyCents: 10000 }], transactions: [entry('SEGREDO', 999000, 'receita', '2026-10-02')] };
  const answer = answerInternal('Cliente 360: joao', data, 'overview', now);
  assert.equal(answer.customerName, 'João');
  assert.deepEqual(answer.actions[0].record, { entity: 'customers', id: 'c' });
  assert.equal(answer.actions[1].draft.fields.clientName, 'João');
  assert.match(answer.text, /ORC-1|CTR-1/);
  assert.doesNotMatch(answer.text, /Outra pessoa|SEGREDO|9\.990/);
  const limited = answerInternal('Cliente 360: João', data, 'overview', now, restrictAssistantSettings(settings, ['overview', 'customers', 'agenda']));
  assert.doesNotMatch(JSON.stringify(limited), /ORC-1|CTR-1|SEGREDO/);
  const duplicates = answerInternal('Cliente 360: João', { ...data, customers: [customer('c'), customer('d', 'JOÃO')] }, 'overview', now);
  assert.match(duplicates.text, /mais de um cadastro/);
  assert.equal(duplicates.customerName, undefined);
  assert.doesNotMatch(duplicates.text, /ORC-1|CTR-1/);
  const continuation = answerInternal('Histórico do cliente', data, 'overview', now, settings, { customerName: 'João' });
  assert.equal(continuation.customerName, 'João');
  assert.match(answerInternal('Financeiro desse cliente', data, 'overview', now).text, /não possuem um vínculo de cliente/);
});

test('agenda planning respects duration overlap, inactive staff, weekends and creation settings', () => {
  const data = { employees: [{ id: 'ana', name: 'Ana', role: 'Técnica', active: true }, { id: 'off', name: 'Inativa', active: false }], appointments: [visit('busy', '2026-10-01T08:00'), visit('cancel', '2026-10-01T10:00', { status: 'cancelado' }), visit('unassigned', '2026-10-01T15:00', { technician: '', notes: '' })] };
  const answer = answerInternal('Planejar agenda da semana', data, 'overview', now);
  assert.equal(answer.actions.find(action => action.draft)?.draft.fields.startAt, '2026-10-01T10:00');
  assert.match(answer.note, /1 visita\(s\) sem duração/);
  assert.doesNotMatch(JSON.stringify(answer), /Inativa/);
  assert.equal(answer.steps[0].priority, 'high');
  const saturday = answerInternal('Planejar agenda da semana', { ...data, appointments: [] }, 'overview', new Date('2026-10-03T07:00'));
  assert.equal(saturday.actions.find(action => action.draft)?.draft.fields.startAt, '2026-10-05T08:00');
  assert.equal(answerInternal('Planejar agenda da semana', data, 'overview', now, { ...settings, allowCreate: false }).actions.some(action => action.draft), false);
  assert.match(answerInternal('Planejar agenda da semana', data, 'overview', now, restrictAssistantSettings(settings, ['overview', 'agenda'])).text, /Equipe precisam estar/);
});

test('planning detects duplicate staff names and carry-over intervals from the previous day', () => {
  const staff = { id: 'ana', name: 'Ana', role: 'Técnica', active: true };
  const data = { employees: [staff], appointments: [visit('overnight', '2026-09-30T23:00', { notes: JSON.stringify({ details: { duration: '10h' } }) })] };
  assert.equal(answerInternal('Planejar agenda da semana', data, 'overview', now).actions.find(action => action.draft).draft.fields.startAt, '2026-10-01T09:00');
  const ambiguous = answerInternal('Planejar agenda da semana', { ...data, employees: [staff, { ...staff, id: 'duplicate', name: ' ANA ' }] }, 'overview', now);
  assert.equal(ambiguous.actions.some(action => action.draft), false);
  assert.match(ambiguous.steps[0].description, /mesmo nome/);
});

test('financial projection separates paid, overdue, missing dates and the 30-day boundary', () => {
  const data = { transactions: [entry('today', 10000, 'receita', '2026-10-01'), entry('expense', 15000, 'despesa', '2026-10-02'), entry('boundary', 20000, 'receita', '2026-10-31'), entry('outside', 40000, 'receita', '2026-11-01'), entry('late', 80000, 'receita', '2026-09-30'), entry('paid', 160000, 'receita', '2026-10-02', 'pago'), entry('unknown', 320000, 'receita', '')] };
  const before = JSON.stringify(data); const answer = answerInternal('Fluxo de caixa', data, 'overview', now);
  assert.deepEqual(answer.items.map(item => item.id), ['today', 'expense', 'boundary']);
  assert.equal(answer.chart.series.reduce((sum, item) => sum + item.incomeCents, 0), 30000);
  assert.equal(answer.chart.series.reduce((sum, item) => sum + item.expenseCents, 0), 15000);
  assert.equal(answer.metrics[3].value, '1');
  assert.match(answer.note, /Não soma saldo bancário/);
  assert.equal(answer.steps.some(step => step.id === 'missing'), true);
  assert.equal(JSON.stringify(data), before);
  const comparison = answerInternal('Comparar financeiro', data, 'overview', now);
  assert.equal(comparison.chart.series[1].incomeCents, 160000);
  assert.equal(comparison.chart.series[0].incomeCents, 0);
  assert.match(comparison.note, /mês de vencimento/);
});

test('pipeline treats lead estimates as potential and identifies missing next actions', () => {
  const answer = answerInternal('Diagnóstico do funil do CRM', { leads: [{ id: '1', name: 'Contato', status: 'negociacao', nextAction: '', estimatedValueCents: 50000, interest: 'Piscina' }, { id: '2', name: 'Ganho', status: 'ganho', nextAction: '', estimatedValueCents: 90000 }] }, 'overview', now);
  assert.equal(answer.metrics[0].value, '1');
  assert.match(answer.metrics[1].value, /500,00/);
  assert.match(answer.note, /Não são receita recebida/);
  assert.equal(answer.steps[0].title, 'Definir retorno · Contato');
});

test('communication drafts require a unique record, disclose expired prices and never send messages', () => {
  const quote = { id: '1', quoteNumber: 'ORC-1', clientName: 'João', service: 'Troca de filtro', totalCents: 50000, validUntil: '2026-09-30', status: 'enviado' };
  const answer = answerInternal('Mensagem para orçamento: ORC-1', { quotes: [quote] }, 'overview', now);
  assert.match(answer.communication.text, /validade anterior encerrou/);
  assert.match(answer.communication.text, /500,00/);
  assert.match(answer.note, /não foi enviada/);
  assert.deepEqual(answer.actions[0].record, { entity: 'quotes', id: '1' });
  assert.equal(answerInternal('Mensagem para orçamento: João', { quotes: [quote, { ...quote, id: '2', quoteNumber: 'ORC-2' }] }, 'overview', now).communication, undefined);
  const schedule = answerInternal('Cronograma da agenda: Ana', { appointments: [visit('today', '2026-10-01T09:00'), visit('tomorrow', '2026-10-02T09:00'), visit('other', '2026-10-01T10:00', { technician: 'Bia' })] }, 'overview', now);
  assert.match(schedule.communication.text, /today/);
  assert.doesNotMatch(schedule.communication.text, /tomorrow|other/);
});

test('drafts, plans and cross-module replies obey all source and action restrictions', () => {
  const disabled = { ...settings, allowCreate: false, allowNavigation: false };
  assert.equal(answerInternal('Preparar orçamento', {}, 'overview', now, disabled).draft, undefined);
  const denied = restrictAssistantSettings(settings, ['overview', 'agenda']);
  assert.equal(answerInternal('Cliente 360: João', { customers: [customer('c')] }, 'overview', now, denied).customerName, undefined);
  assert.doesNotMatch(answerInternal('Cliente 360: João', { customers: [customer('c')] }, 'overview', now, denied).text, /Rua da Piscina/);
  const plan = answerInternal('Plano de ação da empresa', { transactions: [entry('late', 10000, 'receita', '2026-09-30')] }, 'overview', now);
  assert.equal(plan.steps[0].source, 'finance');
  assert.deepEqual(answerInternal('Plano de ação da empresa', { transactions: [entry('hidden', 10000, 'receita', '2026-09-30')] }, 'overview', now, denied).steps, []);
});

test('server calendar follows Sao Paulo midnight and preserves local appointment dates', () => {
  const calendar = assistantCalendar({ appointments: [visit('absolute', '2026-10-02T01:00:00Z'), visit('local', '2026-10-01T22:00')] }, 'America/Sao_Paulo', new Date('2026-10-02T01:30:00Z'));
  assert.equal(calendar.now.getDate(), 1);
  assert.equal(calendar.now.getHours(), 22);
  assert.equal(calendar.data.appointments[0].startAt, '2026-10-01T22:00:00');
  assert.equal(calendar.data.appointments[1].startAt, '2026-10-01T22:00');
  assert.match(answerInternal('Agenda de hoje', calendar.data, 'overview', calendar.now).text, /2 compromisso/);
});

test('request accepts only bounded question metadata, rejects supplied records and invalid zones', () => {
  assert.equal(parseAssistantRequest('{"question":"Meu dia"}').timeZone, 'America/Sao_Paulo');
  for (const body of [{ question: 'Meu dia', context: { balance: 99999 } }, { question: 'Meu dia', source: '__proto__' }, { question: 'Meu dia', timeZone: 'Mars/City' }, { question: 'Meu dia', history: ['a', 'b', 'c', 'd', 'e'] }, { question: 'a'.repeat(2001) }]) assert.throws(() => parseAssistantRequest(JSON.stringify(body)));
  assert.throws(() => parseAssistantRequest('x'.repeat(20001)));
});
