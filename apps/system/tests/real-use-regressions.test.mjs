import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';

const f = await operationalFixture(new URL('..', import.meta.url).pathname);
const [create, records, bootstrap, convert, reports, documents] = await Promise.all([
  '/app/api/records/route.js', '/app/api/records/[id]/route.js', '/app/api/bootstrap/route.js',
  '/app/api/quotes/[id]/convert/route.js', '/lib/work-order-report.js', '/app/api/documents/[id]/route.js',
].map(f.load));
beforeEach(f.reset); after(f.close);
async function saved(entity, input) {
  const response = await create.POST(f.request('POST', '/api/records', { entity, ...input }));
  assert.equal(response.status, 201, await response.clone().text());
  return (await response.json()).record;
}
async function complete(id, checklist) {
  return records.PATCH(f.request('PATCH', `/api/records/${id}`, { entity: 'workOrders', action: 'complete', completionReport: {
    summary: 'Serviço executado em teste', customerName: 'Cliente de QA', confirmed: true, ...(checklist === undefined ? {} : { checklist }),
  } }), f.context(id));
}
const keys = reports.serviceChecklist.flatMap(item => item.keys);
test('completion persists checked and unchecked items, timestamp and report through reload', async () => {
  const order = await saved('workOrders', { clientName: 'QA', service: 'Limpeza', productsUsed: 'Cloro', notes: 'Preservar observação', amount: '125,50' });
  const checklist = Object.fromEntries(keys.map((key, i) => [key, i !== 4]));
  assert.equal((await complete(order.id, checklist)).status, 200);
  const row = f.tables.work_orders[0];
  assert.deepEqual(row.checklist, checklist); assert.ok(Number.isFinite(Date.parse(row.completed_at)));
  assert.ok(row.notes.startsWith('fama:v1:'));
  const body = await (await bootstrap.GET(f.request('GET', '/api/bootstrap'))).json();
  const notes = JSON.parse(body.workOrders[0].notes);
  const report = JSON.parse(notes.details.completionReport);
  assert.deepEqual(report.checklist, checklist); assert.equal(report.confirmedAt, row.completed_at);
  assert.ok(notes.text.includes('Preservar observação'));
  assert.ok(reports.checklistSummary(checklist).includes('Medir pH e cloro'));
  assert.ok(!reports.checklistSummary(checklist).includes('Aspirar fundo'));
});
for (const invalid of [[], 'on', { medir_ph: 'on' }, { aspirar_fundo: 1 }]) test(`invalid checklist ${JSON.stringify(invalid)} never completes an order`, async () => {
  const order = await saved('workOrders', { clientName: 'QA', service: 'Limpeza' });
  const before = structuredClone(f.tables.work_orders[0]);
  assert.equal((await complete(order.id, invalid)).status, 400);
  assert.deepEqual(f.tables.work_orders[0], before);
});
test('legacy completion preserves the existing checklist', async () => {
  const order = await saved('workOrders', { clientName: 'QA', service: 'Limpeza' });
  f.tables.work_orders[0].checklist = { medir_ph: true };
  assert.equal((await complete(order.id)).status, 200);
  assert.deepEqual(f.tables.work_orders[0].checklist, { medir_ph: true });
});
test('conversion preserves customer instructions and readable reference and remains idempotent', async () => {
  const quote = await saved('quotes', { clientName: 'QA', service: 'Piscina', labor: '125,50', products: 'Item de teste', notes: 'Entrar pelo portão lateral', paymentTerms: 'Pix' });
  f.tables.quotes[0].status = 'aprovado';
  const first = await convert.POST(f.request('POST', `/api/quotes/${quote.id}/convert`), f.context(quote.id));
  assert.equal(first.status, 201);
  const order = (await first.json()).workOrder;
  const notes = JSON.parse(order.notes);
  assert.ok(notes.text.includes('Entrar pelo portão lateral'));
  assert.equal(notes.details.sourceQuoteNumber, quote.quoteNumber);
  assert.equal((await convert.POST(f.request('POST', `/api/quotes/${quote.id}/convert`), f.context(quote.id))).status, 200);
  assert.equal(f.tables.work_orders.length, 1);
  assert.equal(reports.serviceProducts('[{"name":"Cloro","quantity":2,"unit":"kg"}]'), 'Cloro · 2 · kg');
  assert.equal(reports.serviceProducts('Texto antigo'), 'Texto antigo');
});

const cases = [
  ['quotes', 'quotes', 'quotes', { clientName: 'QA', service: 'Piscina', labor: '125,50' }],
  ['contracts', 'contracts', 'contracts', { clientName: 'QA', service: 'Teste', startDate: '2026-10-04', endDate: '2026-12-31', monthly: '350,50', terms: 'Somente teste' }],
  ['workOrders', 'work_orders', 'orders', { clientName: 'QA', service: 'Limpeza', productsUsed: 'Cloro', amount: '125,50' }],
];
for (const [entity, table, permission, input] of cases) {
  test(`${entity}: authenticated download returns a real private PDF attachment`, async () => {
    const record = await saved(entity, input);
    const response = await documents.GET(f.request('GET', `/api/documents/${record.id}?entity=${entity}&organization_id=org-one`), f.context(record.id));
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="[a-z0-9_-]+\.pdf"$/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-'); assert.ok(bytes.length > 1000);
  });
  test(`${entity}: another company's document is inaccessible`, async () => {
    const record = await saved(entity, input); f.tables[table][0].organization_id = 'org-two';
    const response = await documents.GET(f.request('GET', `/api/documents/${record.id}?entity=${entity}`), f.context(record.id));
    assert.equal(response.status, 404);
  });
  test(`${entity}: disabled module cannot download even for an owner`, async () => {
    const record = await saved(entity, input); f.rules.organization.overrides[permission] = false; f.calls = [];
    assert.equal((await documents.GET(f.request('GET', `/api/documents/${record.id}?entity=${entity}`), f.context(record.id))).status, 403);
    assert.equal(f.calls.filter(call => call.url.pathname === `/rest/v1/${table}`).length, 0);
  });
  test(`${entity}: an anonymous visitor cannot download`, async () => {
    const record = await saved(entity, input); globalThis.__operationUser = null; f.calls = [];
    assert.equal((await documents.GET(f.request('GET', `/api/documents/${record.id}?entity=${entity}`), f.context(record.id))).status, 401);
    assert.equal(f.calls.length, 0);
  });
}
