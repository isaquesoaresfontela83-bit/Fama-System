import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { operationalFixture } from './operational-fixture.mjs';

const f = await operationalFixture(new URL('..', import.meta.url).pathname);
const [tenant, bootstrap, records, freight, assistant, finance, company, attachments, chat, schema, asaas, connections] = await Promise.all([
  '/lib/tenant.js', '/app/api/bootstrap/route.js', '/app/api/records/route.js', '/app/api/freight/route.js', '/app/api/assistant/route.js', '/app/api/finance/route.js', '/app/api/company-settings/route.js', '/app/api/attachments/route.js', '/app/api/internal-chat/route.js', '/lib/finance-schema.js', '/app/api/asaas/route.js', '/app/api/finance-connections/route.js',
].map(f.load));
const sqlite = new DatabaseSync(':memory:');
const queries = [];
const d1 = {
  prepare(sql) {
    let values = [];
    const item = { bind(...next) { values = next; return item; }, async first() { queries.push(sql); return sqlite.prepare(sql).get(...values) ?? null; }, async all() { queries.push(sql); return { results: sqlite.prepare(sql).all(...values) }; }, async run() { queries.push(sql); return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; } };
    return item;
  },
  async batch(items) { return Promise.all(items.map(item => item.run())); },
};
f.runtime.DB = d1; f.runtime.DATA_BACKEND = 'd1'; await schema.ensureFinanceSchema();
sqlite.exec('CREATE TABLE organization_settings (organization_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)');
const organization = () => f.tables.organizations[0];
const fiscalActions = ['fiscalInvoice', 'registerPortalInvoice', 'registerPortalCancellation', 'issueFiscalInvoice', 'refreshFiscalInvoice', 'updateFiscalInvoice'];
beforeEach(() => {
  f.reset(); f.runtime.DB = d1; organization().plan = 'inicial'; queries.length = 0;
  sqlite.exec('DELETE FROM fiscal_invoices; DELETE FROM organization_settings');
  sqlite.prepare('INSERT INTO organization_settings VALUES (?, ?, ?)').run('org-one', JSON.stringify({ freightOriginCep: '72505101', freightRateCentsPerKm: 1000, fiscalProvider: 'asaas', fiscalApiToken: 'retained-private-token' }), '2026-10-10');
});
after(async () => { await f.close(); sqlite.close(); });

test('Basic keeps essential operation and owner overrides cannot unlock paid modules', async () => {
  for (const rule of Object.values(f.rules)) rule.overrides = { assistant: true, contracts: true, inventory: true, chat: true, finance: true };
  const access = (await tenant.requireTenant(f.request('GET', '/api/access'))).organization.moduleAccess;
  assert.deepEqual(new Set(access), new Set(['dashboard', 'crm', 'quotes', 'agenda', 'orders', 'customers']));
  for (const entity of ['contracts', 'warranties', 'inventory', 'employees', 'transactions']) assert.equal((await records.POST(f.request('POST', '/api/records', { entity }))).status, 403);
  assert.equal((await chat.GET(f.request('GET', '/api/internal-chat'))).status, 403);
  const core = await records.POST(f.request('POST', '/api/records', { entity: 'leads', name: 'Cliente', phone: '61999999999', interest: 'Piscina' }));
  assert.equal(core.status, 201);
});

test('Basic bootstrap does not read premium tables or discard their saved records', async () => {
  f.tables.contracts = [{ id: 'retained-contract', organization_id: 'org-one', client_name: 'Cliente' }];
  f.tables.transactions = [{ id: 'retained-transaction', organization_id: 'org-one', description: 'Recebimento' }];
  const result = await bootstrap.GET(f.request('GET', '/api/bootstrap'));
  assert.equal(result.status, 200); const data = await result.json(); assert.deepEqual(data.contracts, []); assert.deepEqual(data.transactions, []);
  assert.equal(f.calls.some(call => /\/(contracts|warranties|inventory_items|employees|transactions)$/.test(call.url.pathname)), false);
  assert.equal(f.tables.contracts.length, 1); assert.equal(f.tables.transactions.length, 1); assert.equal(f.businessWrites().length, 0);
});

test('Basic and Plus deny all premium API operations before providers or fiscal queries', async () => {
  for (const plan of ['inicial', 'intermediario']) {
    organization().plan = plan;
    for (const method of ['GET', 'POST', 'PATCH']) assert.equal((await freight[method](f.request(method, '/api/freight', method === 'GET' ? undefined : { originCep: '72505-101', destinationCep: '72415-990', rateCentsPerKm: 1000 }))).status, 403);
    for (const method of ['GET', 'POST']) assert.equal((await assistant[method](f.request(method, '/api/assistant', method === 'GET' ? undefined : { question: 'Resumo', source: 'overview' }))).status, 403);
    for (const action of fiscalActions) {
      const response = await finance.POST(f.request('POST', '/api/finance', { action, id: 'invoice' }));
      assert.equal(response.status, 403); assert.match((await response.json()).error, plan === 'inicial' ? /Plus/ : /Pro/);
    }
    assert.equal((await attachments.GET(f.request('GET', '/api/attachments?entity=fiscalInvoices&entityId=invoice'))).status, 403);
  }
  assert.equal(queries.length, 0); assert.equal(f.businessWrites().length, 0);
});

test('Plus adds operational modules while Pro preserves role restrictions', async () => {
  organization().plan = 'intermediario';
  let access = (await tenant.requireTenant(f.request('GET', '/api/access'))).organization.moduleAccess;
  for (const feature of ['finance', 'contracts', 'warranties', 'inventory', 'team', 'mobile', 'chat']) assert.ok(access.includes(feature));
  assert.equal(access.includes('assistant'), false);
  organization().plan = 'profissional'; f.member().role = 'member'; f.member().permissions = ['crm'];
  access = (await tenant.requireTenant(f.request('GET', '/api/access'))).organization.moduleAccess;
  assert.deepEqual(access, ['crm', 'assistant']);
  assert.equal((await finance.GET(f.request('GET', '/api/finance'))).status, 403);
  assert.equal((await freight.GET(f.request('GET', '/api/freight'))).status, 403);
});

test('pending upgrades do not unlock features; activation and downgrade apply on the next request', async () => {
  const validity = organization().plan_expires_at;
  organization().pending_plan = 'profissional';
  assert.equal((await assistant.GET(f.request('GET', '/api/assistant'))).status, 403);
  organization().plan = 'profissional';
  assert.equal((await assistant.GET(f.request('GET', '/api/assistant'))).status, 200);
  assert.equal((await freight.GET(f.request('GET', '/api/freight'))).status, 200);
  const draft = await finance.POST(f.request('POST', '/api/finance', { action: 'fiscalInvoice', type: 'nfse', customerName: 'Cliente', serviceDescription: 'Manutenção', amount: '100,00', issueDate: '2026-10-10' }));
  assert.equal(draft.status, 201, JSON.stringify(await draft.clone().json()));
  organization().plan = 'inicial';
  assert.equal((await assistant.GET(f.request('GET', '/api/assistant'))).status, 403);
  assert.equal((await finance.POST(f.request('POST', '/api/finance', { action: 'issueFiscalInvoice', id: (await draft.json()).fiscalInvoice.id }))).status, 403);
  assert.equal(sqlite.prepare('SELECT count(*) AS total FROM fiscal_invoices').get().total, 1);
  assert.equal(organization().plan_expires_at, validity); assert.equal(f.businessWrites().length, 0);
});

test('Plus finance returns no fiscal records and Basic settings preserve premium configuration', async () => {
  organization().plan = 'intermediario';
  const response = await finance.GET(f.request('GET', '/api/finance'));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).fiscalInvoices, []);
  assert.equal(queries.some(sql => /FROM fiscal_invoices|FROM organization_settings/.test(sql)), false);
  organization().plan = 'inicial';
  const settings = (await (await company.GET(f.request('GET', '/api/company-settings'))).json()).settings;
  assert.equal(settings.fiscalApiToken, ''); assert.equal(settings.freightOriginCep, '');
  const saved = await company.POST(f.request('POST', '/api/company-settings', { settings: { ...settings, companyName: 'Empresa atualizada' } }));
  assert.equal(saved.status, 200);
  const retained = JSON.parse(sqlite.prepare('SELECT settings_json FROM organization_settings').get().settings_json);
  assert.equal(retained.fiscalApiToken, 'retained-private-token'); assert.equal(retained.freightOriginCep, '72505101'); assert.equal(retained.freightRateCentsPerKm, 1000);
  organization().plan = 'intermediario';
  assert.equal((await finance.POST(f.request('POST', '/api/finance', { action: 'bankAccount', name: 'Caixa' }))).status, 201);
});


test('Basic blocks finance, Asaas and bank APIs before reading or writing financial records', async () => {
  for (const [route, url, methods] of [[finance, '/api/finance', ['GET', 'POST', 'PATCH']], [asaas, '/api/asaas', ['GET', 'POST']], [connections, '/api/finance-connections', ['GET', 'POST']]]) {
    for (const method of methods) {
      const response = await route[method](f.request(method, url, method === 'GET' ? undefined : { action: 'bankAccount', name: 'Caixa' }));
      assert.equal(response.status, 403); assert.match((await response.json()).error, /financeiro.*Plus/);
    }
  }
  assert.equal(queries.some(sql => /FROM suppliers|FROM purchases|FROM bank_accounts|FROM bank_movements|FROM fiscal_invoices/.test(sql)), false);
  assert.equal(f.calls.some(call => /asaas\.com|\/rest\/v1\/(bank_accounts|bank_connections|transactions)/.test(String(call.url))), false);
  assert.equal(f.businessWrites().length, 0);
});

const policy=await f.load('/lib/plan-policy.js');
test('configured Pro restrictions prevent fiscal reads and freight calls while preserving finance',async()=>{
 organization().plan='profissional';const state=policy.defaultPlanPolicy();state.current[2].featureIds=state.current[2].featureIds.filter(id=>!['invoices','freight'].includes(id));f.tables.platform_settings=[{key:policy.planPolicyKey,value:state}];
 const access=(await tenant.requireTenant(f.request('GET','/api/access'))).organization;assert.equal(access.planFeatures.includes('invoices'),false);assert.equal(access.planFeatures.includes('freight'),false);assert.equal(access.moduleAccess.includes('finance'),true);
 queries.length=0;const response=await finance.GET(f.request('GET','/api/finance'));assert.equal(response.status,200);assert.deepEqual((await response.json()).fiscalInvoices,[]);assert.equal(queries.some(sql=>sql.startsWith('SELECT')&&sql.includes('FROM fiscal_invoices')),false);
 assert.equal((await freight.GET(f.request('GET','/api/freight'))).status,403);
});
