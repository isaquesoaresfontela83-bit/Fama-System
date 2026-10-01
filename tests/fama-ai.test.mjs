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
