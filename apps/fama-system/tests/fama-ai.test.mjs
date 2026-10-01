import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, hmr: false } });
after(() => vite.close());
const { answerInternal } = await vite.ssrLoadModule('/lib/fama-ai.ts');
const now = new Date('2026-10-01T12:00:00');
const appointment = (id, startAt, changes = {}) => ({ id, startAt, title: `Visita ${id}`, clientName: 'João', technician: 'Ana', status: 'agendado', address: '', kind: 'Visita', notes: '', ...changes });

test('assistant executes entirely locally without sending questions or records', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('External request forbidden'); };
  try {
    const answer = answerInternal('agenda de hoje', { appointments: [appointment('1', '2026-10-01T15:00:00')] }, 'overview', now);
    assert.match(answer.text, /1 compromisso/);
    for (const path of ['../lib/fama-ai.ts', '../app/fama-ai-panel.tsx']) {
      const source = await readFile(new URL(path, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|api\.openai\.com|OPENAI_API_KEY|FAMA_AI_MODEL|https?:\/\//);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('agenda uses browser-local dates, tomorrow, explicit dates and the next seven days', () => {
  const data = { appointments: [appointment('today', '2026-10-01T15:00:00'), appointment('tomorrow', '2026-10-02T08:00:00'), appointment('future', '2026-10-07T23:00:00'), appointment('outside', '2026-10-08T09:00:00'), appointment('past', '2026-09-30T23:00:00'), appointment('bad', 'invalid')] };
  assert.match(answerInternal('agenda hoje', data, 'overview', now).text, /1 compromisso/);
  assert.match(answerInternal('agenda amanhã', data, 'overview', now).text, /Visita tomorrow/);
  assert.doesNotMatch(answerInternal('agenda amanhã', data, 'overview', now).text, /Visita today/);
  assert.match(answerInternal('agenda em 07/10/2026', data, 'overview', now).text, /Visita future/);
  assert.match(answerInternal('agenda da semana', data, 'overview', now).text, /3 compromisso/);
  assert.match(answerInternal('próximos horários', data, 'overview', now).text, /4 compromisso/);
  assert.match(answerInternal('agenda em 31/02/2026', data, 'overview', now).text, /data válida/);
});

test('agenda detects same-instant conflicts and excludes completed and unassigned work', () => {
  const data = { appointments: [appointment('1', '2026-10-01T14:00:00Z'), appointment('2', '2026-10-01T11:00:00-03:00', { technician: ' ANA ' }), appointment('done', '2026-10-01T14:00:00Z', { status: 'concluido' }), appointment('3', '2026-10-01T15:00:00Z', { technician: '' }), appointment('4', '2026-10-01T15:00:00Z', { technician: '' })] };
  const answer = answerInternal('conflitos na agenda', data, 'overview', now);
  assert.match(answer.text, /1 grupo/);
  assert.doesNotMatch(answer.text, /Visita done/);
  assert.match(answer.text, /não registra duração/);
  assert.equal(answer.actions.find(action => action.create)?.create, 'appointments');
});

test('stock includes threshold equality and filters names without accents', () => {
  const data = { inventory: [{ name: 'Cloro', sku: '1', quantity: 5, minimumQuantity: 5, unit: 'kg' }, { name: 'Ácido', sku: '2', quantity: 1, minimumQuantity: 3, unit: 'L' }, { name: 'Filtro', sku: '3', quantity: 10, minimumQuantity: 1, unit: 'un' }] };
  assert.match(answerInternal('estoque baixo', data).text, /2 item/);
  assert.match(answerInternal('buscar: acido', data, 'inventory').text, /Ácido/);
  assert.doesNotMatch(answerInternal('buscar: acido', data, 'inventory').text, /Cloro/);
});

test('finance computes paid balance separately from receivables and payables', () => {
  const transactions = [
    { description: 'Venda', amountCents: 10000, type: 'receita', status: 'pago' },
    { description: 'Produto', amountCents: 2500, type: 'despesa', status: 'pago' },
    { description: 'Manutenção', amountCents: 4000, type: 'receita', status: 'pendente', dueDate: '2026-09-30' },
    { description: 'Compra', amountCents: 1000, type: 'despesa', status: 'pendente', dueDate: '2026-10-02' },
  ];
  const answer = answerInternal('resumo financeiro', { transactions }, 'overview', now).text;
  assert.match(answer, /Saldo realizado: R\$\s*75,00/);
  assert.match(answer, /A receber: R\$\s*40,00/);
  assert.match(answer, /A pagar: R\$\s*10,00/);
  assert.match(answer, /Vencidos não pagos: 1/);
});

test('scope distinguishes an unavailable module from an empty loaded collection', () => {
  assert.match(answerInternal('agenda hoje', {}).text, /não está carregado/);
  assert.match(answerInternal('agenda hoje', { appointments: [] }).text, /0 compromisso/);
  const companyA = { customers: [{ name: 'Empresa A' }] };
  const companyB = { customers: [{ name: 'Empresa B' }] };
  assert.match(answerInternal('clientes', companyA).text, /Empresa A/);
  assert.doesNotMatch(answerInternal('clientes', companyB).text, /Empresa A/);
});

test('supports administrative filters and expiry queries, without changing data', () => {
  const data = { organizations: [{ name: 'Ativa', status: 'active' }, { name: 'Suspensa', status: 'suspended' }], warranties: [{ clientName: 'Vencida', expiresAt: '2026-09-30', status: 'ativa' }, { clientName: 'Futura', expiresAt: '2026-10-02', status: 'ativa' }] };
  const before = JSON.stringify(data);
  assert.doesNotMatch(answerInternal('empresas suspensas', data).text, /Ativa/);
  assert.match(answerInternal('garantias vencidas', data, 'overview', now).text, /Vencida/);
  assert.doesNotMatch(answerInternal('garantias vencidas', data, 'overview', now).text, /Futura/);
  answerInternal('excluir empresas', data);
  assert.equal(JSON.stringify(data), before);
  assert.match(answerInternal('escreva um poema', {}).text, /gestão cadastrada/);
});


test('explicit modules take priority over date words and display quote and contract amounts', () => {
  const data = { appointments: [], quotes: [{ clientName: 'Cliente A', quoteNumber: 'ORC-1', totalCents: 25000, status: 'enviado', createdAt: '2026-10-01T08:00:00', validUntil: '2026-10-10' }, { clientName: 'Anterior', totalCents: 7000, createdAt: '2026-09-30T08:00:00' }], contracts: [{ clientName: 'Cliente A', contractNumber: 'CTR-1', status: 'ativo', monthlyCents: 15000, frequency: 'Semanal', startDate: '2026-09-01', endDate: '2027-09-01' }] };
  const quotes = answerInternal('orçamentos de hoje', data, 'overview', now);
  assert.equal(quotes.source, 'quotes');
  assert.match(quotes.text, /250,00/);
  assert.doesNotMatch(quotes.text, /Anterior/);
  assert.equal(quotes.actions.find(action => action.create)?.create, 'quotes');
  assert.equal(answerInternal('financeiro hoje', data, 'overview', now).source, 'finance');
  const contracts = answerInternal('contratos ativos', data, 'overview', now);
  assert.match(contracts.text, /150,00.*mês/);
  assert.match(contracts.text, /CTR-1/);
  assert.equal(contracts.actions.find(action => action.create)?.create, 'contracts');
});

test('cancelled appointments do not cause conflicts or appear as upcoming work', () => {
  const data = { appointments: [appointment('active', '2026-10-01T15:00:00'), appointment('cancelled', '2026-10-01T15:00:00', { status: 'cancelado' })] };
  assert.match(answerInternal('conflitos na agenda', data, 'overview', now).text, /0 grupo/);
  assert.doesNotMatch(answerInternal('próximos horários', data, 'overview', now).text, /Visita cancelled/);
});

const { buildAssistantWorkspace } = await vite.ssrLoadModule('/lib/fama-ai.ts');
const { defaultAssistantSettings, restrictAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');

test('workspace indicators and priorities never include data from disabled modules', () => {
  const data = { appointments: [appointment('pending', '2026-10-01T15:00:00', { technician: '' }), appointment('cancel', '2026-10-01T10:00:00', { status: 'cancelado' })], transactions: [{ id: 'hidden', description: 'Segredo financeiro', type: 'receita', amountCents: 998877, status: 'atrasado', dueDate: '2026-09-01' }], quotes: [{ id: 'hidden-quote', clientName: 'Segredo comercial', totalCents: 887766, status: 'enviado' }] };
  const settings = restrictAssistantSettings(defaultAssistantSettings, ['overview', 'agenda']);
  const workspace = buildAssistantWorkspace(data, now, settings);
  assert.deepEqual(workspace.counts, { agenda: 2, overview: 2 });
  assert.equal(workspace.metrics[0].value, '1');
  assert.equal(workspace.insights[0].source, 'agenda');
  assert.doesNotMatch(JSON.stringify(workspace), /finance|quotes|998877|887766|Segredo/);
  assert.deepEqual(buildAssistantWorkspace(data, now, { ...settings, enabled: false }), { metrics: [], insights: [], counts: {} });
});

test('follow-up questions retain context, explicit modules switch it, and disabled sources remain blocked', () => {
  const data = { appointments: [appointment('tomorrow', '2026-10-02T08:00:00')], quotes: [{ id: 'quote', clientName: 'Cliente', status: 'enviado', totalCents: 10000 }], transactions: [{ description: 'Conta futura', type: 'despesa', status: 'pendente', amountCents: 3000, dueDate: '2026-10-02' }] };
  const continuation = answerInternal('e amanhã?', data, 'overview', now, defaultAssistantSettings, { previousSource: 'finance' });
  assert.equal(continuation.source, 'finance');
  assert.match(continuation.text, /Conta futura/);
  assert.doesNotMatch(continuation.text, /Visita tomorrow/);
  assert.equal(answerInternal('orçamentos enviados', data, 'agenda', now, defaultAssistantSettings, { previousSource: 'finance' }).source, 'quotes');
  const denied = restrictAssistantSettings(defaultAssistantSettings, ['overview', 'agenda']);
  assert.match(answerInternal('e amanhã?', data, 'overview', now, denied, { previousSource: 'finance' }).text, /desativada/);
  assert.match(answerInternal('agenda hoje sem técnico', { appointments: [appointment('unassigned', '2026-10-01T14:00:00', { technician: '' }), appointment('assigned', '2026-10-01T14:00:00')] }, 'overview', now).text, /Visita unassigned/);
});

test('finance periods use due dates, accept date intervals and reject invalid ranges', () => {
  const data = { transactions: [
    { id: 'past', description: 'Mês anterior', type: 'receita', amountCents: 10000, dueDate: '2026-09-30', status: 'pago' },
    { id: 'current', description: 'Conta de outubro', type: 'receita', amountCents: 20000, dueDate: '2026-10-02', status: 'pendente' },
    { id: 'next', description: 'Mês seguinte', type: 'despesa', amountCents: 40000, dueDate: '2026-11-01', status: 'pendente' },
    { id: 'no-date', description: 'Sem data', type: 'despesa', amountCents: 80000, dueDate: '', status: 'pendente' },
  ] };
  const monthly = answerInternal('financeiro deste mês', data, 'overview', now);
  assert.deepEqual(monthly.items.map(item => item.id), ['current']);
  assert.match(monthly.note, /data de vencimento/);
  assert.match(monthly.text, /A receber: R\$\s*200,00/);
  assert.deepEqual(answerInternal('financeiro de 30/09/2026 a 02/10/2026', data, 'overview', now).items.map(item => item.id), ['past', 'current']);
  assert.match(answerInternal('financeiro de 02/10/2026 a 30/09/2026', data, 'overview', now).text, /data final/);
  assert.match(answerInternal('financeiro em 31/02/2026', data, 'overview', now).text, /data válida/);
});

test('contract renewal includes the 30-day boundary and does not mix monthly values with received cash', () => {
  const data = { contracts: [
    { id: 'today', clientName: 'Termina hoje', status: 'ativo', monthlyCents: 10000, endDate: '2026-10-01' },
    { id: 'edge', clientName: 'Limite', status: 'ativo', monthlyCents: 20000, endDate: '2026-10-31' },
    { id: 'outside', clientName: 'Futuro', status: 'ativo', monthlyCents: 40000, endDate: '2026-11-01' },
    { id: 'expired', clientName: 'Vencido', status: 'ativo', monthlyCents: 80000, endDate: '2026-09-30' },
    { id: 'closed', clientName: 'Encerrado', status: 'encerrado', monthlyCents: 160000, endDate: '2026-10-10' },
  ] };
  const answer = answerInternal('contratos ativos a vencer em 30 dias', data, 'overview', now);
  assert.deepEqual(answer.items.map(item => item.id), ['today', 'edge']);
  assert.match(answer.metrics[1].value, /300,00/);
  assert.match(answer.note, /verificar os recebimentos/);
  assert.equal(buildAssistantWorkspace(data, now).insights.find(item => item.source === 'contracts').value, '2');
});

test('team workload requires both authorized collections and excludes cancelled and completed appointments', () => {
  const data = { employees: [{ id: 'ana', name: 'Ana', role: 'Técnica', active: true }], appointments: [appointment('pending', '2026-10-01T15:00:00'), appointment('done', '2026-10-01T15:00:00', { status: 'concluido' }), appointment('cancel', '2026-10-01T15:00:00', { status: 'cancelado' }), appointment('none', '2026-10-01T16:00:00', { technician: '' })] };
  const answer = answerInternal('carga de trabalho da equipe hoje', data, 'overview', now);
  assert.equal(answer.source, 'team');
  assert.equal(answer.items[0].value, '1 compromisso(s)');
  assert.equal(answer.metrics[1].value, '1');
  const denied = restrictAssistantSettings(defaultAssistantSettings, ['overview', 'team']);
  const blocked = answerInternal('carga de trabalho da equipe hoje', data, 'overview', now, denied);
  assert.match(blocked.text, /Agenda carregados e autorizados/);
  assert.equal(blocked.items, undefined);
});

test('structured answers honor the configured result limit, actions and search without mutating data', () => {
  const data = { quotes: Array.from({ length: 8 }, (_, i) => ({ id: `q-${i}`, quoteNumber: `ORC-${i}`, clientName: `Cliente ${i}`, totalCents: 10000, status: 'enviado' })) };
  const before = JSON.stringify(data);
  const settings = { ...defaultAssistantSettings, maxItems: 5, allowNavigation: false, allowCreate: false };
  const answer = answerInternal('orçamentos enviados', data, 'overview', now, settings);
  assert.equal(answer.totalItems, 8);
  assert.equal(answer.items.length, 5);
  assert.deepEqual(answer.actions, []);
  assert.match(answer.text, /Mais 3 registros/);
  assert.deepEqual(answerInternal('buscar: ORC-6', data, 'quotes', now).items.map(item => item.id), ['q-6']);
  assert.equal(JSON.stringify(data), before);
});
