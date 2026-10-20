import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';

const f = await operationalFixture(new URL('..', import.meta.url).pathname);
const [create, records, bootstrap, trash, restore, convert, warranty, crypt, tenant] = await Promise.all([
  '/app/api/records/route.js', '/app/api/records/[id]/route.js', '/app/api/bootstrap/route.js', '/app/api/recovery/route.js', '/app/api/recovery/[id]/route.js', '/app/api/quotes/[id]/convert/route.js', '/app/api/warranties/[id]/schedule/route.js', '/lib/crypto.js', '/lib/tenant.js',
].map(f.load));
beforeEach(f.reset); after(f.close);
const entities = [
  ['leads', 'leads', 'crm', { name: 'Cliente', phone: '11999999999', interest: 'Piscina', estimatedValue: '1.234,56' }],
  ['quotes', 'quotes', 'quotes', { clientName: 'Cliente', service: 'Manutenção', labor: '125,50', notes: 'Preservar esta observação', paymentTerms: 'Pix' }],
  ['appointments', 'appointments', 'agenda', { title: 'Visita', clientName: 'Cliente', startAt: '2028-02-29T08:30', address: 'Rua teste', notes: 'Portão azul' }],
  ['workOrders', 'work_orders', 'orders', { clientName: 'Cliente', service: 'Limpeza', scheduledAt: '2028-02-29T08:30', notes: 'Observação técnica', productsUsed: 'Cloro', amount: '100,50' }],
  ['customers', 'customers', 'customers', { name: 'Cliente', phone: '11999999999', email: 'cliente@example.test', address: 'Rua teste', clientDocument: '123.456.789-01' }],
  ['inventory', 'inventory_items', 'inventory', { name: 'Cloro', quantity: 2, minimumQuantity: 1, cost: '20,50' }],
  ['transactions', 'transactions', 'finance', { description: 'Manutenção', amount: '1.234,56', category: 'Serviço', dueDate: '2028-02-29' }],
  ['employees', 'employees', 'team', { name: 'Técnico', role: 'Técnico', phone: '11999999999' }],
  ['warranties', 'warranties', 'warranties', { clientName: 'Cliente', item: 'Bomba', purchaseDate: '2027-03-01', expiresAt: '2028-02-29', notes: 'Motor' }],
  ['contracts', 'contracts', 'contracts', { clientName: 'Cliente', service: 'Manutenção', startDate: '2027-03-01', endDate: '2028-02-29', monthly: '200,50', terms: 'Condições acordadas' }],
];
async function saved(entity, input) {
  const response = await create.POST(f.request('POST', '/api/records', { entity, ...input }));
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return (await response.json()).record;
}
async function snapshot(entity, record, options = {}) {
  const row = { id: 'snapshot-one', organization_id: 'org-one', entity_type: entity, record_id: record.id, expires_at: '2099-01-01T00:00:00Z', deleted_at: '2026-01-01T00:00:00Z', restored_at: null, encrypted_payload: await crypt.encryptText(JSON.stringify(record)), ...options };
  (f.tables.recovery_snapshots ??= []).push(row); return row;
}

test('customers: alphanumeric CNPJ survives encrypted persistence and reload', async () => {
  const record = await saved('customers', { name: 'Empresa', phone: '11999999999', clientDocument: '12.abc.345/01de-35' });
  assert.equal(JSON.parse(record.notes).details.clientDocument, '12ABC34501DE35');
  const persisted = (await (await bootstrap.GET(f.request('GET', '/api/bootstrap'))).json()).customers[0];
  assert.equal(JSON.parse(persisted.notes).details.clientDocument, '12ABC34501DE35');
  assert.ok(f.tables.customers[0].notes.startsWith(crypt.encryptionPrefix));
});

for (const [entity, table, permission, input] of entities) {
  test(`${entity}: create, persisted reload, encrypted deletion and restoration form a complete lifecycle`, async () => {
    const record = await saved(entity, { ...input, organization_id: 'org-foreign', organizationId: 'org-foreign', id: 'attacker-id' });
    assert.notEqual(record.id, 'attacker-id');
    assert.equal(f.tables[table][0].organization_id, 'org-one');
    const clear = (await (await bootstrap.GET(f.request('GET', '/api/bootstrap'))).json())[entity][0];
    for (const [key, value] of Object.entries(record)) assert.deepEqual(clear[key], value, `${entity}.${key} survived reload`);
    for (const field of crypt.encryptedFieldsByEntity[entity] ?? []) if (record[field]) assert.ok(f.tables[table][0][field.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)].startsWith(crypt.encryptionPrefix));
    assert.equal((await records.DELETE(f.request('DELETE', `/api/records/${record.id}?entity=${entity}`), f.context(record.id))).status, 200);
    assert.equal(f.tables[table].length, 0);
    const copy = f.tables.recovery_snapshots[0]; assert.ok(copy.encrypted_payload.startsWith(crypt.encryptionPrefix));
    const listed = await (await trash.GET(f.request('GET', '/api/recovery'))).json(); assert.equal(listed.records[0].recordId, record.id); assert.equal(listed.records[0].encrypted_payload, undefined);
    assert.equal((await restore.POST(f.request('POST', `/api/recovery/${copy.id}`), f.context(copy.id))).status, 200);
    assert.equal(f.tables[table][0].id, record.id); assert.equal(f.tables[table][0].organization_id, 'org-one');
    assert.equal((await restore.POST(f.request('POST', `/api/recovery/${copy.id}`), f.context(copy.id))).status, 404);
    assert.equal(f.tables[table].length, 1); assert.equal(f.tables.audit_logs[0].event_type, 'restore');
  });
  for (const role of ['admin', 'member', 'technician']) test(`${entity}: ${role} with no module permission cannot create or read data`, async () => {
    f.member().role = role; f.member().permissions = [];
    f.tables[table] = [{ id: 'private', organization_id: 'org-one' }];
    assert.equal((await create.POST(f.request('POST', '/api/records', { entity, ...input }))).status, 403);
    const body = await (await bootstrap.GET(f.request('GET', '/api/bootstrap'))).json(); assert.deepEqual(body[entity], []);
    assert.equal(f.calls.filter(call => call.url.pathname === `/rest/v1/${table}`).length, 0); assert.equal(f.businessWrites().length, 0);
  });
  test(`${entity}: central module denial applies to an owner`, async () => {
    f.rules.organization.overrides[permission] = false;
    assert.equal((await create.POST(f.request('POST', '/api/records', { entity, ...input }))).status, 403);
    assert.deepEqual((await (await bootstrap.GET(f.request('GET', '/api/bootstrap'))).json())[entity], []);
    assert.equal(f.businessWrites().length, 0);
  });
  test(`${entity}: foreign company deletion cannot remove or archive another company's record`, async () => {
    f.tables[table] = [{ id: 'foreign', organization_id: 'org-two', notes: 'Private' }];
    assert.equal((await records.DELETE(f.request('DELETE', `/api/records/foreign?entity=${entity}`), f.context('foreign'))).status, 404);
    assert.equal(f.tables[table].length, 1); assert.equal(f.businessWrites().length, 0);
  });
  test(`${entity}: an administrator whose module access was removed cannot restore or list its deleted data`, async () => {
    f.member().role = 'admin'; f.member().permissions = [];
    await snapshot(entity, { id: 'deleted', organization_id: 'org-one' });
    assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context('snapshot-one'))).status, 403);
    assert.deepEqual((await (await trash.GET(f.request('GET', '/api/recovery'))).json()).records, []);
    assert.equal(f.businessWrites().length, 0);
  });
  test(`${entity}: central module denial also prevents recovery by an owner`, async () => {
    f.rules.member.overrides[permission] = false;
    await snapshot(entity, { id: 'deleted', organization_id: 'org-one' });
    assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context('snapshot-one'))).status, 403);
    assert.deepEqual((await (await trash.GET(f.request('GET', '/api/recovery'))).json()).records, []);
  });
}

const transitions = { leads: ['contato','visita','proposta','negociacao','ganho','perdido'], quotes: ['enviado','aprovado','recusado'], appointments: ['em_rota','concluido','remarcado','cancelado'], workOrders: ['em_execucao'], transactions: ['pago','atrasado'], warranties: ['agendada','concluida','expirada'], contracts: ['ativo','suspenso','encerrado'] };
for (const [entity, statuses] of Object.entries(transitions)) {
  const [, table,, input] = entities.find(([key]) => key === entity);
  for (const status of statuses) test(`${entity}: ${status} persists through the authorized API`, async () => {
    const record = await saved(entity, input);
    const response = await records.PATCH(f.request('PATCH', `/api/records/${record.id}`, { entity, status }), f.context(record.id));
    assert.equal(response.status, 200); assert.equal((await response.json()).record.status, status); assert.equal(f.tables[table][0].status, status);
  });
  test(`${entity}: an invalid status never changes the record`, async () => {
    const record = await saved(entity, input), previous = structuredClone(f.tables[table]); f.calls = [];
    assert.equal((await records.PATCH(f.request('PATCH', `/api/records/${record.id}`, { entity, status: '__invalid__' }), f.context(record.id))).status, 400);
    assert.deepEqual(f.tables[table], previous); assert.equal(f.businessWrites().length, 0);
  });
  test(`${entity}: foreign record status updates return 404`, async () => {
    f.tables[table] = [{ id: 'foreign', organization_id: 'org-two', status: 'unchanged' }];
    assert.equal((await records.PATCH(f.request('PATCH', '/api/records/foreign', { entity, status: statuses[0] }), f.context('foreign'))).status, 404);
    assert.equal(f.tables[table][0].status, 'unchanged');
  });
}

const mutations = [
  ['create', request => create.POST(request), 'POST', '/api/records', { entity: 'leads', ...entities[0][3] }],
  ['update', request => records.PATCH(request, f.context('one')), 'PATCH', '/api/records/one', { entity: 'leads', status: 'contato' }],
  ['delete', request => records.DELETE(request, f.context('one')), 'DELETE', '/api/records/one?entity=leads'],
  ['restore', request => restore.POST(request, f.context('snapshot-one')), 'POST', '/api/recovery/snapshot-one'],
  ['warranty scheduling', request => warranty.POST(request, f.context('one')), 'POST', '/api/warranties/one/schedule', { scheduledAt: '2028-02-29T08:30' }],
];
for (const [name, run, method, path, body] of mutations) for (const headers of [{ Origin: 'https://attacker.example.test' }, { 'Sec-Fetch-Site': 'cross-site' }, { Origin: 'null' }]) test(`${name}: cross-site request ${JSON.stringify(headers)} is rejected before database access`, async () => {
  assert.equal((await run(f.request(method, path, body, headers))).status, 403); assert.equal(f.calls.length, 0);
});
for (const [name, run, method, path, body] of mutations) test(`${name}: rate limit prevents operational writes`, async () => {
  f.allowed = false;
  assert.equal((await run(f.request(method, path, body))).status, 429); assert.equal(f.businessWrites().length, 0);
});
for (const [name, run, method, path, body] of mutations) test(`${name}: anonymous callers are rejected`, async () => {
  globalThis.__operationUser = null;
  assert.equal((await run(f.request(method, path, body))).status, 401); assert.equal(f.calls.length, 0);
});
for (const value of [null, [], 'text', 5, true]) for (const method of ['POST','PATCH']) test(`${method}: non-object JSON ${JSON.stringify(value)} receives a client error`, async () => {
  const request = f.request(method, '/api/records', value);
  const response = method === 'POST' ? await create.POST(request) : await records.PATCH(request, f.context('one'));
  assert.equal(response.status, 400); assert.equal(f.businessWrites().length, 0);
});
for (const method of ['POST','PATCH']) {
  test(`${method}: malformed JSON receives 400 without writing`, async () => {
    const request = new Request('https://fama.example.test/api/records', { method, headers: { 'x-organization-id': 'org-one', 'Content-Type': 'application/json' }, body: '{"entity":' });
    const response = method === 'POST' ? await create.POST(request) : await records.PATCH(request, f.context('one'));
    assert.equal(response.status, 400); assert.equal(f.businessWrites().length, 0);
  });
  test(`${method}: oversized JSON receives 413 without writing`, async () => {
    const request = f.request(method, '/api/records', { entity: 'leads', ...entities[0][3], notes: 'x'.repeat(300000) });
    const response = method === 'POST' ? await create.POST(request) : await records.PATCH(request, f.context('one'));
    assert.equal(response.status, 413); assert.equal(f.businessWrites().length, 0);
  });
}
for (const name of [{ injected: true }, ['Cliente'], true, 123]) test(`required fields reject structured or non-text values ${JSON.stringify(name)}`, async () => {
  assert.equal((await create.POST(f.request('POST', '/api/records', { entity: 'leads', ...entities[0][3], name }))).status, 400); assert.equal(f.businessWrites().length, 0);
});

for (const date of ['not-a-date','2027-02-29T08:30','2028-02-30T08:30','2028-13-01T08:30','2028-02-29T25:00']) for (const action of ['create','reschedule','warranty']) test(`${action}: invalid calendar value ${date} cannot be persisted`, async () => {
  const response = action === 'create' ? await create.POST(f.request('POST', '/api/records', { entity: 'appointments', ...entities[2][3], startAt: date })) : action === 'reschedule' ? await records.PATCH(f.request('PATCH', '/api/records/one', { entity: 'appointments', action: 'reschedule', startAt: date }), f.context('one')) : await warranty.POST(f.request('POST', '/api/warranties/one/schedule', { scheduledAt: date }), f.context('one'));
  assert.equal(response.status, 400); assert.equal(f.businessWrites().length, 0);
});
test('appointment reschedule returns readable encrypted notes and address', async () => {
  const record = await saved('appointments', entities[2][3]);
  const response = await records.PATCH(f.request('PATCH', '/api/records/one', { entity: 'appointments', action: 'reschedule', startAt: '2028-03-01T14:30' }), f.context(record.id));
  assert.equal(response.status, 200); const result = (await response.json()).record;
  assert.equal(result.notes, record.notes); assert.equal(result.address, record.address); assert.equal(result.startAt, '2028-03-01T17:30:00.000Z');
});
test('warranty scheduling requires agenda permission as well as warranties', async () => {
  f.member().role = 'technician'; f.member().permissions = ['warranties'];
  assert.equal((await warranty.POST(f.request('POST', '/api/warranties/one/schedule', { scheduledAt: '2028-03-01T14:30' }), f.context('one'))).status, 403);
  assert.equal(f.calls.some(call => call.url.pathname.endsWith('/schedule_warranty')), false);
});

for (const [name, options, record, status] of [
  ['expired', { expires_at: '2020-01-01' }, { id: 'one', organization_id: 'org-one' }, 404],
  ['invalid expiry', { expires_at: 'broken' }, { id: 'one', organization_id: 'org-one' }, 404],
  ['foreign snapshot', { organization_id: 'org-two' }, { id: 'one', organization_id: 'org-two' }, 404],
  ['foreign payload', {}, { id: 'one', organization_id: 'org-two' }, 409],
  ['mismatched ID', { record_id: 'different' }, { id: 'one', organization_id: 'org-one' }, 409],
  ['unknown type', { entity_type: 'unknown' }, { id: 'one', organization_id: 'org-one' }, 400],
]) test(`recovery rejects ${name} without changing data`, async () => {
  await snapshot('leads', record, options);
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context('snapshot-one'))).status, status); assert.equal(f.businessWrites().length, 0);
});
test('recovery never overwrites an existing record', async () => {
  const record = { id: 'one', organization_id: 'org-one', name: 'Original' }; f.tables.leads = [record];
  await snapshot('leads', { ...record, name: 'Deleted old value' });
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context('snapshot-one'))).status, 409); assert.equal(record.name, 'Original');
});

test('duplicate database and application copies appear once and all copies close after restoration', async () => {
  const record = { id: 'deleted-customer', organization_id: 'org-one', name: 'Cliente' };
  const databaseCopy = await snapshot('customers', record, { id: 'database-copy', encrypted_payload: 'database-pgp-copy', deleted_at: '2026-01-02T00:00:00Z' });
  const appCopy = await snapshot('customers', record, { id: 'application-copy' });
  const listed = (await (await trash.GET(f.request('GET', '/api/recovery'))).json()).records;
  assert.equal(listed.length, 1); assert.equal(listed[0].id, appCopy.id);
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/application-copy'), f.context(appCopy.id))).status, 200);
  assert.ok(databaseCopy.restored_at); assert.ok(appCopy.restored_at);
  assert.deepEqual((await (await trash.GET(f.request('GET', '/api/recovery'))).json()).records, []);
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/database-copy'), f.context(databaseCopy.id))).status, 404);
});

test('a database-encrypted legacy work order is recovered through the scoped server procedure', async () => {
  const record = { id: 'legacy-order', organization_id: 'org-one', client_name: 'Cliente', service: 'Limpeza' };
  const copy = await snapshot('work_orders', record, { encrypted_payload: 'database-pgp-copy' });
  f.databaseRecoveryPayloads[copy.id] = record;
  const listed = (await (await trash.GET(f.request('GET', '/api/recovery'))).json()).records;
  assert.equal(listed[0].entityType, 'workOrders');
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context(copy.id))).status, 200);
  assert.deepEqual(f.tables.work_orders, [record]);
  const read = f.calls.find(call => call.url.pathname.endsWith('/fama_recovery_payload'));
  assert.deepEqual(read.body, { p_snapshot_id: copy.id, p_organization_id: 'org-one' });
});

test('legacy database copies still respect permissions and payload identity', async () => {
  const record = { id: 'legacy-order', organization_id: 'org-one' };
  const copy = await snapshot('work_orders', record, { encrypted_payload: 'database-pgp-copy' });
  f.member().role = 'admin'; f.member().permissions = [];
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context(copy.id))).status, 403);
  assert.equal(f.calls.some(call => call.url.pathname.endsWith('/fama_recovery_payload')), false);
  f.member().role = 'owner'; f.databaseRecoveryPayloads[copy.id] = { ...record, organization_id: 'org-two' };
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context(copy.id))).status, 409);
  assert.equal(f.tables.work_orders, undefined);
});
for (const type of ['transactions','quotes','suppliers','purchases']) test(`attachment recovery respects the ${type} module permission`, async () => {
  f.member().role = 'admin'; f.member().permissions = [];
  await snapshot('attachments', { id: 'one', organization_id: 'org-one', entity_type: type, entity_id: 'deleted-parent' });
  assert.equal((await restore.POST(f.request('POST', '/api/recovery/snapshot-one'), f.context('snapshot-one'))).status, 403);
  assert.deepEqual((await (await trash.GET(f.request('GET', '/api/recovery'))).json()).records, []); assert.equal(f.businessWrites().length, 0);
});

async function approvedQuote() {
  const record = await saved('quotes', entities[1][3]); f.tables.quotes[0].status = 'aprovado'; return record;
}
test('quote conversion preserves original notes and returns clear data on repeated calls', async () => {
  const quote = await approvedQuote();
  const first = await convert.POST(f.request('POST', '/api/quotes/one/convert'), f.context(quote.id)); assert.equal(first.status, 201);
  const firstBody = await first.json();
  const second = await convert.POST(f.request('POST', '/api/quotes/one/convert'), f.context(quote.id)); assert.equal(second.status, 200);
  assert.deepEqual((await second.json()).workOrder, firstBody.workOrder); assert.equal(f.tables.work_orders.length, 1);
  const note = JSON.parse(await crypt.decryptText(f.tables.quotes[0].notes)); assert.equal(note.text, 'Preservar esta observação'); assert.equal(note.details.paymentTerms, 'Pix');
});
test('eight simultaneous quote conversions create only one work order', async () => {
  const quote = await approvedQuote();
  const responses = await Promise.all(Array.from({ length: 8 }, () => convert.POST(f.request('POST', '/api/quotes/one/convert'), f.context(quote.id))));
  assert.ok(responses.every(response => [200,201].includes(response.status)), String(responses.map(r => r.status)));
  const ids = await Promise.all(responses.map(async response => (await response.json()).workOrder.id)); assert.equal(new Set(ids).size, 1); assert.equal(f.tables.work_orders.length, 1);
});
test('retry after a failed quote-marker write reuses the existing work order', async () => {
  const quote = await approvedQuote(); f.fail = call => call.method === 'PATCH' && call.url.pathname === '/rest/v1/quotes';
  assert.equal((await convert.POST(f.request('POST', '/api/quotes/one/convert'), f.context(quote.id))).status, 503); assert.equal(f.tables.work_orders.length, 1);
  f.fail = null;
  const retry = await convert.POST(f.request('POST', '/api/quotes/one/convert'), f.context(quote.id)); assert.equal(retry.status, 200); assert.equal(f.tables.work_orders.length, 1);
  assert.equal(JSON.parse(await crypt.decryptText(f.tables.quotes[0].notes)).details.convertedWorkOrderId, (await retry.json()).workOrder.id);
});
for (const status of ['rascunho','enviado','recusado']) test(`a ${status} quote cannot create a work order`, async () => {
  const quote = await approvedQuote(); f.tables.quotes[0].status = status; f.calls = [];
  assert.equal((await convert.POST(f.request('POST', '/api/quotes/one/convert'), f.context(quote.id))).status, 409); assert.equal(f.businessWrites().length, 0);
});
for (const quantity of [0,1,3]) test(`simultaneous inventory withdrawals never take ${quantity} units below zero`, async () => {
  const record = await saved('inventory', { ...entities[5][3], quantity });
  const responses = await Promise.all(Array.from({ length: 8 }, () => records.PATCH(f.request('PATCH', '/api/records/one', { entity: 'inventory', action: 'adjustStock', delta: -1 }), f.context(record.id))));
  assert.equal(responses.filter(r => r.status === 200).length, quantity); assert.equal(f.tables.inventory_items[0].quantity, 0); assert.ok(responses.every(r => [200,409].includes(r.status)));
});
test('concurrent inventory increments either persist or explicitly report a conflict', async () => {
  const record = await saved('inventory', { ...entities[5][3], quantity: 0 });
  const responses = await Promise.all(Array.from({ length: 12 }, () => records.PATCH(f.request('PATCH', '/api/records/one', { entity: 'inventory', action: 'adjustStock', delta: 1 }), f.context(record.id))));
  assert.equal(f.tables.inventory_items[0].quantity, responses.filter(r => r.status === 200).length); assert.ok(responses.every(r => [200,409].includes(r.status)));
});
for (const delta of [0,2,-2,'1',null]) test(`inventory rejects unsupported delta ${JSON.stringify(delta)}`, async () => {
  const record = await saved('inventory', entities[5][3]);
  assert.equal((await records.PATCH(f.request('PATCH', '/api/records/one', { entity: 'inventory', action: 'adjustStock', delta }), f.context(record.id))).status, 400); assert.equal(f.tables.inventory_items[0].quantity, 2);
});
test('a recreated identity with the same email cannot acquire the previous user membership', async () => {
  f.member().user_id = 'previous-identity';
  assert.deepEqual(await tenant.getUserOrganizations(f.user), []);
  await assert.rejects(() => tenant.requireTenant(f.request('GET', '/api/bootstrap')), error => error.status === 403);
});
