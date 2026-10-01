import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'vite';

const runtime = {};
globalThis.__famaTestRuntime = runtime;
const originalFetch = globalThis.fetch;
const sqlite = new DatabaseSync(':memory:');
for (const file of ['0000_crazy_nitro.sql', '0001_fresh_sugar_man.sql', '0002_foamy_roland_deschain.sql', '0003_adorable_calypso.sql', '0004_purple_thor_girl.sql', '0005_reflective_fenris.sql']) {
  sqlite.exec(await readFile(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
}
sqlite.exec("CREATE TABLE organization_settings (organization_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
const d1 = {
  prepare(sql) {
    const stmt = sqlite.prepare(sql);
    let values = [];
    const result = {
      bind(...next) { values = next; return result; },
      async first() { return stmt.get(...values) ?? null; },
      async all() { return { results: stmt.all(...values) }; },
      async run() { const changes = stmt.run(...values).changes; return { meta: { changes: Number(changes) } }; },
    };
    return result;
  },
  async batch(statements) { return Promise.all(statements.map(s => s.run())); },
};
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({
  appType: 'custom', configFile: false, root,
  resolve: { alias: { '@': root } },
  server: { hmr: false, middlewareMode: true },
  plugins: [{
    name: 'fama-fixtures', enforce: 'pre',
    resolveId(id) {
      if (id === 'cloudflare:workers') return '\0fama-env';
      if (id.endsWith('/app/system-auth') || id.endsWith('/app/system-auth.ts')) return '\0fama-auth';
    },
    load(id) {
      if (id === '\0fama-env') return 'export const env = globalThis.__famaTestRuntime;';
      if (id === '\0fama-auth') return 'export async function getFamaUser() { return globalThis.__famaTestUser; }';
    },
  }],
});
const plans = await vite.ssrLoadModule('/lib/plans.ts');
const billing = await vite.ssrLoadModule('/lib/billing.ts');
const tenant = await vite.ssrLoadModule('/lib/tenant.ts');
const subscriptionRoute = await vite.ssrLoadModule('/app/api/billing/route.ts');
const webhook = await vite.ssrLoadModule('/app/api/billing/asaas-webhook/route.ts');
const fiscal = await vite.ssrLoadModule('/lib/fiscal.ts');
const financeRoute = await vite.ssrLoadModule('/app/api/finance/route.ts');
const supabase = await vite.ssrLoadModule('/lib/supabase.ts');
const settingsModule = await vite.ssrLoadModule('/lib/company-settings.ts');
const supportRoute = await vite.ssrLoadModule('/app/api/support/route.ts');
const membersRoute = await vite.ssrLoadModule('/app/api/members/route.ts');
const recordsRoute = await vite.ssrLoadModule('/app/api/records/route.ts');
const adminOrganizationRoute = await vite.ssrLoadModule('/app/api/admin/organizations/[id]/route.ts');
const launchRoute = await vite.ssrLoadModule('/app/api/admin/launch/route.ts');
const launchOperations = await vite.ssrLoadModule('/lib/launch-readiness.ts');
const attachmentsRoute = await vite.ssrLoadModule('/app/api/attachments/route.ts');
const attachmentDeleteRoute = await vite.ssrLoadModule('/app/api/attachments/[id]/route.ts');
const portal = await vite.ssrLoadModule('/lib/fiscal-portal.ts');
const fiscalDocument = await vite.ssrLoadModule('/lib/fiscal-document.ts');
const quoteConfig = await vite.ssrLoadModule('/lib/quote-config.ts');
const quoteConfigRoute = await vite.ssrLoadModule('/app/api/quote-config/route.ts');
const quoteCatalog = await vite.ssrLoadModule('/lib/pool-quote-catalog.ts');
const quoteMath = await vite.ssrLoadModule('/lib/quote-calculation.ts');
const inventory = await vite.ssrLoadModule('/lib/inventory.ts');
const organizationsRoute = await vite.ssrLoadModule('/app/api/organizations/route.ts');
let organization, membership, requests, paymentStatus, fiscalStatus, supportTickets, webhookRows, bankConnections, providerAccountStatus, receiverAccessible, attachments, signedLinksAvailable;
const json = (value, status = 200) => Response.json(value, { status });

beforeEach(() => {
  for (const key of Object.keys(runtime)) delete runtime[key];
  Object.assign(runtime, { DATA_BACKEND: 'supabase', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture', FAMA_ASAAS_API_KEY: '$aact_hmlg_123456789012345678901234567890', FAMA_ASAAS_ENVIRONMENT: 'sandbox', FAMA_ASAAS_WEBHOOK_TOKEN: 'fixture-webhook', FAMA_DATA_ENCRYPTION_KEY: 'a'.repeat(64), DB: d1 });
  globalThis.__famaTestUser = { id: 'user-fixture', email: 'fixture@example.test', displayName: 'Fixture' };
  organization = { id: 'org-fixture', name: 'Empresa de teste', slug: 'fixture', status: 'active', plan: 'inicial', plan_status: 'active', plan_expires_at: '2030-01-01T00:00:00.000Z', billing_provider: 'asaas', billing_payment_id: 'pay_first', billing_customer_id: 'cus_fixture', billing_cycle: 'monthly', pending_plan: '', pending_billing_cycle: 'monthly' };
  membership = { id: 'member-fixture', organization_id: 'org-fixture', user_id: 'user-fixture', user_email: 'fixture@example.test', role: 'owner', status: 'active', permissions: ['finance', 'crm'] };
  requests = []; paymentStatus = 'PENDING'; fiscalStatus = 'queued'; supportTickets = []; webhookRows = []; bankConnections = []; providerAccountStatus = 'APPROVED'; receiverAccessible = true;
  attachments = [];
  signedLinksAvailable = true;
  globalThis.fetch = async (input, init = {}) => {
    if (init.redirect === 'error') throw new TypeError('Workers requires an explicit manual redirect policy.');
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    requests.push({ url: url.href, method, body, headers: new Headers(init.headers) });
    if (url.pathname === '/api/public/plans') return json({ plans: [] });
    if (url.href === launchOperations.BILLING_WEBHOOK_URL) return json({ ok: true, ignored: true }, receiverAccessible ? 200 : 401);
    if (url.pathname === '/v3/myAccount/status') return json({ general: providerAccountStatus });
    if (url.pathname === '/v3/webhooks') {
      if (method === 'POST') { const row = { ...body, id: 'wh_fixture' }; webhookRows.push(row); return json(row); }
      return json({ data: webhookRows, hasMore: false });
    }
    if (url.pathname === '/v3/webhooks/wh_fixture' && method === 'PUT') { Object.assign(webhookRows.find(row => row.id === 'wh_fixture'), body); return json(webhookRows.find(row => row.id === 'wh_fixture')); }
    if (url.pathname === '/rest/v1/bank_connections') return json(bankConnections);
    if (url.pathname === '/rest/v1/rpc/fama_consume_rate_limit') return json(true);
    if (url.pathname === '/rest/v1/organization_members') {
      if (method === 'POST') return json([body]);
      if (url.searchParams.get('status') === 'eq.invited') return json([]);
      const requested = url.searchParams.get('organization_id');
      return json(requested && requested !== `eq.${membership.organization_id}` ? [] : [membership]);
    }
    if (url.pathname === '/rest/v1/support_tickets') {
      if (method === 'POST') { supportTickets.push(body); return json([body]); }
      return json(supportTickets.filter(t => `eq.${t.organization_id}` === url.searchParams.get('organization_id')));
    }
    if (url.pathname === '/rest/v1/attachments') {
      if (method === 'POST') { attachments.push(body); return json([body]); }
      if (method === 'DELETE') { attachments = attachments.filter(row => `eq.${row.id}` !== url.searchParams.get('id')); return json([]); }
      return json(attachments.filter(row => ['id', 'organization_id', 'entity_type', 'entity_id'].every(key => !url.searchParams.get(key) || url.searchParams.get(key) === `eq.${row[key]}`)));
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/')) return signedLinksAvailable ? json({ signedURL: '/object/sign/fama-documents/fixture?token=fixture' }) : json({ error: 'Fixture signing unavailable' }, 503);
    if (url.pathname.startsWith('/storage/v1/object/')) return json({ path: 'fixture' });
    if (url.pathname === '/rest/v1/organizations') {
      if (method === 'POST') return json([body]);
      if (method === 'PATCH') { Object.assign(organization, body); return json([organization]); }
      if (url.searchParams.has('name_key')) return json([]);
      if (url.searchParams.has('created_by_user_id')) return json(organization.created_by_user_id === url.searchParams.get('created_by_user_id').slice(3) ? [organization] : []);
      const id = url.searchParams.get('id');
      const payment = url.searchParams.get('billing_payment_id');
      return json((id && id !== `eq.${organization.id}`) || (payment && payment !== `eq.${organization.billing_payment_id}`) ? [] : [organization]);
    }
    if (url.pathname === '/v3/customers') return json({ id: 'cus_fixture' });
    if (url.pathname === '/v3/payments' && method === 'POST') return json({ id: 'pay_first', invoiceUrl: 'https://sandbox.asaas.com/i/fixture', dueDate: '2026-09-30' });
    if (url.pathname.endsWith('/pixQrCode')) return json({ payload: 'fixture-pix', encodedImage: 'fixture-image' });
    if (url.pathname === '/v3/payments/pay_first') return json({ id: 'pay_first', status: paymentStatus });
    if (url.pathname === '/api/v1/emitir') return json({ invoiceId: 'inv_fixture', status: 'queued' }, 202);
    if (url.pathname === '/api/v1/cancelar') return json({ invoiceId: 'inv_fixture', status: 'queued' }, 202);
    if (url.pathname === '/api/v1/invoices/inv_fixture/status') return json({ status: fiscalStatus, numeroNfe: fiscalStatus === 'issued' ? '123' : '', pdfUrl: fiscalStatus === 'issued' ? 'https://cdn.example.test/invoice.pdf' : '' });
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    if (url.pathname === '/api/internal/data') return json([]);
    throw new Error(`Unexpected fixture request: ${method} ${url}`);
  };
});

after(async () => { globalThis.fetch = originalFetch; await vite.close(); sqlite.close(); delete globalThis.__famaTestRuntime; delete globalThis.__famaTestUser; });

test('company catalogs persist after reload on the local database and remain isolated', async () => {
  runtime.DATA_BACKEND = 'd1';
  const config = structuredClone(quoteCatalog.defaultPoolQuoteConfig);
  config.catalog[0].items[0].price = 875;
  config.title = 'Catálogo personalizado';
  await quoteConfig.writeQuoteConfig('company-one', config);
  assert.deepEqual(await quoteConfig.readQuoteConfig('company-one'), config);
  assert.equal((await quoteConfig.readQuoteConfig('company-two')).catalog[0].items[0].price, 1850);
  config.catalog[0].items[0].price = 990;
  await quoteConfig.writeQuoteConfig('company-one', config);
  assert.equal((await quoteConfig.readQuoteConfig('company-one')).catalog[0].items[0].price, 990);
});

test('catalog API requires an authorized company and only administrators can save', async () => {
  const withoutCompany = await quoteConfigRoute.GET(new Request('https://fixture.local/api/quote-config'));
  assert.equal(withoutCompany.status, 400);
  const config = structuredClone(quoteCatalog.defaultPoolQuoteConfig);
  const saved = await quoteConfigRoute.POST(tenantRequest('/api/quote-config', { config }));
  assert.equal(saved.status, 200);
  const mutation = requests.find(row => row.method === 'POST' && row.url.endsWith('/rest/v1/fama_quote_config'));
  assert.equal(mutation.body.id, 'org-fixture:pool-catalog');
  membership.role = 'member';
  assert.equal((await quoteConfigRoute.POST(tenantRequest('/api/quote-config', { config }))).status, 403);
});

test('quote measurements retain their purpose with custom labels and field keys', () => {
  const item = { name: 'Piscina', unit: 'm²', price: 100, markup: 20, fields: [
    { key: 'custom_long', label: 'Comprimento da piscina', role: 'length', type: 'number' },
    { key: 'custom_wide', label: 'Lado menor', role: 'width', type: 'number' },
  ] };
  assert.equal(quoteCatalog.poolQuoteQuantity(item, { custom_long: '4,5', custom_wide: '3' }), 13.5);
  assert.equal(quoteCatalog.poolQuoteQuantity(item, { custom_long: '-4', custom_wide: '-3' }), 0);
  assert.equal(quoteCatalog.poolQuoteQuantity({ ...item, unit: 'm' }, { custom_long: '8' }), 8);
  assert.equal(quoteCatalog.poolQuoteQuantity({ ...item, unit: 'm3', fields: [{ key: 'capacity', role: 'volume' }] }, { capacity: '24' }), 24);
});

test('card calculation preserves the agreed net amount after the processor fee', () => {
  for (const base of [1, 9999, 12545, 10000000]) for (const rate of [0, 3.99, 10, 49.99]) {
    const payment = quoteMath.quoteCardPayment(base, rate);
    assert.ok(payment.totalCents - Math.round(payment.totalCents * rate / 100) >= base);
    assert.equal(payment.totalCents, base + payment.feeCents);
  }
  assert.deepEqual(quoteMath.quoteCardPayment(10000, 10), { totalCents: 11112, feeCents: 1112 });
});

test('a selected plan starts a seven-day trial without creating any payment', async () => {
  membership.user_id = 'unrelated-user';
  const start = Date.now();
  const response = await organizationsRoute.POST(tenantRequest('/api/organizations', { name: 'Empresa do teste grátis', plan: 'profissional', legalAccepted: true }));
  assert.equal(response.status, 201);
  const saved = requests.find(row => row.method === 'POST' && row.url.endsWith('/rest/v1/organizations')).body;
  assert.equal(saved.plan, 'profissional'); assert.equal(saved.plan_status, 'trial');
  assert.ok(Date.parse(saved.plan_expires_at) >= start + 7 * 86400000);
  assert.ok(Date.parse(saved.plan_expires_at) < start + 7 * 86400000 + 5000);
  assert.equal(saved.billing_payment_id, '');
  assert.equal(requests.some(row => row.url.includes('asaas.com')), false);
  assert.equal(tenant.isPlanAccessBlocked('trial', new Date(Date.parse(saved.plan_expires_at) - 7 * 86400000 - 1000).toISOString()), true);
});

test('an email with an existing company cannot create a new company or a new trial', async () => {
  const response = await organizationsRoute.POST(tenantRequest('/api/organizations', { name: 'Segunda empresa', plan: 'profissional', legalAccepted: true }));
  assert.equal(response.status, 409);
  assert.equal(requests.some(row => row.method === 'POST' && row.url.endsWith('/rest/v1/organizations')), false);
});

test('a suspended company cannot be replaced by another free trial', async () => {
  organization.created_by_user_id = 'user-fixture';
  organization.status = 'suspended';
  const response = await organizationsRoute.POST(tenantRequest('/api/organizations', { name: 'Nova tentativa', legalAccepted: true }));
  assert.equal(response.status, 409);
  assert.equal(requests.some(row => row.method === 'POST' && row.url.endsWith('/rest/v1/organizations')), false);
});

test('each stock scan changes one unit and never permits a negative stock balance', async () => {
  runtime.DATA_BACKEND = 'd1';
  sqlite.prepare("INSERT OR REPLACE INTO inventory_items (id, organization_id, name, sku, unit, quantity, minimum_quantity, cost_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)")
    .run('led-fixture', 'company-inventory', 'Central LED', 'LED-1', 'unidade', 3, new Date().toISOString(), new Date().toISOString());
  const balances = await Promise.all([1, 2, 3].map(() => inventory.adjustInventoryStock('led-fixture', 'company-inventory', -1)));
  assert.deepEqual(balances.map(row => row.quantity), [2, 1, 0]);
  await assert.rejects(() => inventory.adjustInventoryStock('led-fixture', 'company-inventory', -1), error => error.status === 409);
  assert.equal((await inventory.adjustInventoryStock('led-fixture', 'company-inventory', 1)).quantity, 1);
  await assert.rejects(() => inventory.adjustInventoryStock('led-fixture', 'other-company', 1), error => error.status === 404);
  await assert.rejects(() => inventory.adjustInventoryStock('led-fixture', 'company-inventory', 100), error => error.status === 400);
});

test('catalog validation rejects malformed entries and ambiguous names without throwing', () => {
  for (const value of [null, [], {}, { title: 'Catálogo', urgency: { normal: 0, urgente: 10, emergencia: 20 }, catalog: [null] }]) assert.equal(quoteCatalog.isPoolQuoteConfig(value), false);
  const config = structuredClone(quoteCatalog.defaultPoolQuoteConfig);
  config.catalog.push(structuredClone(config.catalog[0]));
  assert.equal(quoteCatalog.isPoolQuoteConfig(config), false);
  config.catalog.pop();
  config.catalog[0].items[0].fields[1].key = 'length';
  assert.equal(quoteCatalog.isPoolQuoteConfig(config), false);
});

function tenantRequest(path, body) {
  return new Request(`https://fama.example.test${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-organization-id': 'org-fixture', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

function launchRequest(action, token) {
  return new Request('https://fama.example.test/api/admin/launch', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action }) });
}

function launchConfiguration() {
  runtime.PLATFORM_OWNER_EMAIL = 'fixture@example.test';
  runtime.FAMA_ASAAS_ENVIRONMENT = 'production';
  runtime.FAMA_ASAAS_WEBHOOK_TOKEN = 'w'.repeat(64);
}

test('launch diagnostics reject unauthenticated callers and expired or unbounded operations tokens', async () => {
  globalThis.__famaTestUser = null;
  assert.equal((await launchRoute.POST(launchRequest('readiness'))).status, 401);
  runtime.FAMA_LAUNCH_CHECK_TOKEN = 'a'.repeat(64);
  for (const expiration of ['invalid', new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 7200000).toISOString()]) {
    runtime.FAMA_LAUNCH_CHECK_EXPIRES_AT = expiration;
    assert.equal((await launchRoute.POST(launchRequest('readiness', runtime.FAMA_LAUNCH_CHECK_TOKEN))).status, 401);
  }
  runtime.FAMA_LAUNCH_CHECK_EXPIRES_AT = new Date(Date.now() + 600000).toISOString();
  assert.equal((await launchRoute.POST(launchRequest('readiness', 'b'.repeat(64)))).status, 401);
  assert.equal(requests.length, 0);
});

test('launch diagnostics validate real provider responses without returning keys or account details', async () => {
  launchConfiguration();
  webhookRows = [{ id: 'wh_fixture', url: launchOperations.BILLING_WEBHOOK_URL, enabled: true, interrupted: false, events: launchOperations.BILLING_WEBHOOK_EVENTS, authToken: runtime.FAMA_ASAAS_WEBHOOK_TOKEN }];
  bankConnections = [{ id: 'conn_fixture', organization_id: 'org-fixture', institution: 'Asaas', encrypted_item_id: '$aact_prod_fixture_private' }];
  const response = await launchRoute.POST(launchRequest('readiness'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.billing.ready, true); assert.equal(result.accounts[0].approved, true);
  for (const secret of [runtime.FAMA_ASAAS_API_KEY, runtime.FAMA_ASAAS_WEBHOOK_TOKEN, bankConnections[0].encrypted_item_id]) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(requests.every(request => request.method !== 'PUT' && (request.method !== 'POST' || request.url === launchOperations.BILLING_WEBHOOK_URL)), true);
  receiverAccessible = false;
  const failedReceiver = await launchRoute.POST(launchRequest('readiness'));
  assert.equal((await failedReceiver.json()).billing.ready, false);
});

test('billing webhook setup verifies the receiver and creates only one matching webhook', async () => {
  launchConfiguration();
  webhookRows = [{ id: 'unrelated', url: 'https://another.example.test/webhook', enabled: false, interrupted: true, events: ['INVOICE_AUTHORIZED'] }];
  const first = await launchRoute.POST(launchRequest('configureBillingWebhook'));
  assert.equal(first.status, 200); assert.equal((await first.json()).webhook.receiverVerified, true);
  const created = webhookRows.find(row => row.id === 'wh_fixture');
  assert.equal(created.authToken, runtime.FAMA_ASAAS_WEBHOOK_TOKEN); assert.equal(created.sendType, 'SEQUENTIALLY');
  assert.equal(created.url, launchOperations.BILLING_WEBHOOK_URL); assert.deepEqual(created.events, launchOperations.BILLING_WEBHOOK_EVENTS);
  created.events.push('INVOICE_AUTHORIZED');
  const second = await launchRoute.POST(launchRequest('configureBillingWebhook'));
  assert.equal(second.status, 200); assert.equal(webhookRows.length, 2);
  assert.ok(created.events.includes('INVOICE_AUTHORIZED'));
  assert.equal(webhookRows[0].enabled, false); assert.equal(webhookRows[0].interrupted, true);
  assert.equal(requests.filter(request => request.method === 'POST' && request.url.endsWith('/webhooks')).length, 1);
  assert.equal(requests.filter(request => request.method === 'PUT' && request.url.endsWith('/webhooks/wh_fixture')).length, 1);
});

test('billing webhook setup stops before mutation when credentials, account approval or the receiver are incomplete', async () => {
  launchConfiguration();
  runtime.FAMA_ASAAS_WEBHOOK_TOKEN = 'too-short';
  assert.equal((await launchRoute.POST(launchRequest('configureBillingWebhook'))).status, 503);
  runtime.FAMA_ASAAS_WEBHOOK_TOKEN = 'w'.repeat(64); providerAccountStatus = 'AWAITING_APPROVAL';
  assert.equal((await launchRoute.POST(launchRequest('configureBillingWebhook'))).status, 409);
  providerAccountStatus = 'APPROVED'; receiverAccessible = false;
  assert.equal((await launchRoute.POST(launchRequest('configureBillingWebhook'))).status, 503);
  assert.equal(requests.some(request => ['PUT', 'DELETE'].includes(request.method) || (request.method === 'POST' && request.url.endsWith('/webhooks'))), false);
});

test('temporary launch credentials allow only bounded launch operations', async () => {
  launchConfiguration(); globalThis.__famaTestUser = null;
  runtime.FAMA_LAUNCH_CHECK_TOKEN = 'a'.repeat(64); runtime.FAMA_LAUNCH_CHECK_EXPIRES_AT = new Date(Date.now() + 600000).toISOString();
  const verified = await launchRoute.POST(launchRequest('readiness', runtime.FAMA_LAUNCH_CHECK_TOKEN));
  assert.equal(verified.status, 200);
  const unknown = await launchRoute.POST(launchRequest('arbitraryCommand', runtime.FAMA_LAUNCH_CHECK_TOKEN));
  assert.equal(unknown.status, 400);
});

test('rejects inherited object properties as plan and billing cycle', () => {
  for (const value of ['__proto__', 'constructor', 'toString']) { assert.equal(plans.isPlanCode(value), false); assert.equal(plans.isBillingCycle(value), false); }
});

test('billing validity ends on the last day of shorter months', () => {
  assert.equal(billing.addMonths(new Date('2026-01-31T10:30:00Z'), 1), '2026-02-28T10:30:00.000Z');
  assert.equal(billing.addMonths(new Date('2028-01-31T10:30:00Z'), 1), '2028-02-29T10:30:00.000Z');
});

test('installment charges send a single total without incompatible single-payment fields', async () => {
  await billing.createAsaasPixCheckout({ organizationId: 'org-fixture', organizationName: 'Fixture', plan: 'inicial', buyerName: 'Fixture', buyerEmail: 'fixture@example.test', billingCycle: 'annual', installments: 12 });
  const payment = requests.find(r => r.url.endsWith('/payments') && r.method === 'POST').body;
  assert.equal(payment.installmentCount, 12); assert.equal(payment.totalValue, 508.98);
  assert.equal(Object.hasOwn(payment, 'value'), false); assert.equal(Object.hasOwn(payment, 'installmentValue'), false);
  assert.equal(requests.some(r => r.url.endsWith('/pixQrCode')), false);
  await assert.rejects(() => billing.createAsaasPixCheckout({ organizationId: 'x', organizationName: 'X', plan: 'inicial', buyerName: 'X', buyerEmail: 'fixture@example.test', installments: NaN }), /parcelas/);
});

test('unpaid upgrades preserve the current plan and only apply the upgrade after payment', async () => {
  const originalExpiry = organization.plan_expires_at;
  const created = await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'checkout', plan: 'profissional', billingCycle: 'annual', installments: 2 }));
  assert.equal(created.status, 200);
  assert.equal(organization.plan, 'inicial'); assert.equal(organization.pending_plan, 'profissional'); assert.equal(organization.plan_expires_at, originalExpiry);
  const pending = await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'check' }));
  assert.equal((await pending.json()).billing.pendingPlan, 'profissional');
  paymentStatus = 'CONFIRMED';
  const confirmed = await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'check' }));
  const state = (await confirmed.json()).billing;
  assert.equal(state.plan, 'profissional'); assert.equal(state.billingCycle, 'annual'); assert.equal(state.pendingPlan, ''); assert.equal(state.planStatus, 'active');
});

test('replayed payment webhooks do not grant extra subscription validity', async () => {
  organization.pending_plan = 'profissional'; organization.pending_billing_cycle = 'annual';
  const request = () => new Request('https://fama.example.test/api/billing/asaas-webhook', { method: 'POST', headers: { 'asaas-access-token': 'fixture-webhook', 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_first', status: 'CONFIRMED' } }) });
  assert.equal((await webhook.POST(request())).status, 200);
  const expiry = organization.plan_expires_at;
  const firstUpdates = requests.filter(r => r.method === 'PATCH').length;
  const replay = await webhook.POST(request());
  assert.equal((await replay.json()).ignored, 'already_active'); assert.equal(organization.plan_expires_at, expiry); assert.equal(requests.filter(r => r.method === 'PATCH').length, firstUpdates);
});

test('payment webhooks reject missing configuration and invalid authorization', async () => {
  const request = () => new Request('https://fama.example.test/api/billing/asaas-webhook', { method: 'POST', body: '{}' });
  assert.equal((await webhook.POST(request())).status, 401);
  runtime.FAMA_ASAAS_WEBHOOK_TOKEN = '';
  assert.equal((await webhook.POST(request())).status, 503); assert.equal(requests.length, 0);
});

test('company authorization rejects other companies and mismatched account IDs', async () => {
  await assert.rejects(() => tenant.requireTenant(new Request('https://fama.example.test/api/records', { headers: { 'x-organization-id': 'another-company' } })), e => e.status === 403);
  membership.user_id = 'another-user';
  await assert.rejects(() => tenant.requireTenant(tenantRequest('/api/records')), e => e.status === 403);
});

test('data service uses the private server bridge when a direct key is unavailable', async () => {
  runtime.SUPABASE_SECRET_KEY = ''; runtime.FAMA_DATA_BRIDGE_SECRET = 'fixture-bridge';
  await supabase.selectRows('customers', { organization_id: 'org-fixture' });
  const request = requests.at(-1);
  assert.equal(request.url, 'https://control.famasystem.online/api/internal/data'); assert.equal(request.headers.get('authorization'), 'Bearer fixture-bridge'); assert.equal(request.headers.get('x-fama-data-method'), 'GET'); assert.match(request.headers.get('x-fama-data-path'), /^\/rest\/v1\/customers\?/);
});

test('fiscal calculations use an explicit ISS rate and reject unsafe provider URLs', () => {
  const settings = { ...settingsModule.defaultCompanySettings, fiscalIssRate: '2,5', fiscalTaxRegime: 'Simples Nacional' };
  const invoice = { id: 'inv', type: 'nfse', customerName: 'Fixture', customerDocument: '12345678901', amountCents: 12545, serviceDescription: 'Serviço', issueDate: '2026-09-30' };
  assert.equal(fiscal.notaasInvoicePayload(settings, invoice).valores.aliquotaIss, 2.5);
  assert.throws(() => fiscal.notaasInvoicePayload({ ...settings, fiscalIssRate: '' }, invoice), /alíquota/);
  assert.throws(() => fiscal.notaasBaseUrl({ ...settings, fiscalApiBaseUrl: 'http://127.0.0.1/api/v1' }), /URL oficial/);
  assert.equal(fiscal.fiscalProviderState({ status: 'error', pdfUrl: 'javascript:alert(1)' }).pdfUrl, '');
});

test('fiscal drafts, asynchronous issuance, polling and cancellation work with the Supabase tenant backend', async () => {
  const settings = { ...settingsModule.defaultCompanySettings, fiscalProvider: 'notaas', fiscalApiToken: 'sk_test_fixture', fiscalIssRate: '2.5', fiscalEnvironment: 'sandbox' };
  sqlite.prepare('INSERT OR REPLACE INTO organization_settings VALUES (?, ?, ?)').run('org-fixture', JSON.stringify(settings), new Date().toISOString());
  const draft = await financeRoute.POST(tenantRequest('/api/finance', { action: 'fiscalInvoice', type: 'nfse', customerName: 'Fixture', customerDocument: '12345678901', amount: '125.45', serviceDescription: 'Manutenção da piscina', issueDate: '2026-09-30' }));
  assert.equal(draft.status, 201); const id = (await draft.json()).fiscalInvoice.id;
  const listing = await financeRoute.GET(tenantRequest('/api/finance'));
  assert.equal((await listing.json()).fiscalInvoices.some(i => i.id === id), true);
  const sent = await financeRoute.POST(tenantRequest('/api/finance', { action: 'issueFiscalInvoice', id }));
  assert.equal(sent.status, 200); assert.equal((await sent.json()).status, 'processando');
  const duplicate = await financeRoute.POST(tenantRequest('/api/finance', { action: 'issueFiscalInvoice', id }));
  assert.equal(duplicate.status, 409); assert.equal(requests.filter(r => r.url.endsWith('/emitir')).length, 1);
  fiscalStatus = 'issued';
  const refreshed = await financeRoute.POST(tenantRequest('/api/finance', { action: 'refreshFiscalInvoice', id }));
  assert.equal((await refreshed.json()).officialNumber, '123');
  const cancelled = await financeRoute.POST(tenantRequest('/api/finance', { action: 'updateFiscalInvoice', id, status: 'cancelada' }));
  assert.equal((await cancelled.json()).status, 'cancelando');
  fiscalStatus = 'cancelled';
  const checked = await financeRoute.POST(tenantRequest('/api/finance', { action: 'refreshFiscalInvoice', id }));
  assert.equal((await checked.json()).status, 'cancelada');
  const unauthorized = await financeRoute.POST(tenantRequest('/api/finance', { action: 'issueFiscalInvoice', id: 'unknown-invoice' }));
  assert.equal(unauthorized.status, 404);
});

const nationalKey = '5300108' + '1'.repeat(43);
const issuerFixture = '12345678000195';
function nationalXml({ key = nationalKey, issuer = issuerFixture, amount = '125.45', customer = '12345678901', environment = '1' } = {}) {
  return `<?xml version="1.0"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${key}"><nNFSe>123</nNFSe><emit><CNPJ>${issuer}</CNPJ></emit><DPS><infDPS><tpAmb>${environment}</tpAmb><toma><CPF>${customer}</CPF></toma><valores><vServPrest><vServ>${amount}</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`;
}
async function portalDraft() {
  const settings = { ...settingsModule.defaultCompanySettings, legalName: 'Empresa fixture', document: issuerFixture };
  sqlite.prepare('INSERT OR REPLACE INTO organization_settings VALUES (?, ?, ?)').run('org-fixture', JSON.stringify(settings), new Date().toISOString());
  const response = await financeRoute.POST(tenantRequest('/api/finance', { action: 'fiscalInvoice', customerName: 'Fixture', customerDocument: '12345678901', amount: '125.45', serviceDescription: 'Manutenção da piscina', issueDate: '2026-09-30' }));
  assert.equal(response.status, 201);
  return (await response.json()).fiscalInvoice;
}
function uploadFiscal(id, content, name = 'nota.xml', type = 'application/xml') {
  const data = new FormData(); data.set('entity', 'fiscalInvoices'); data.set('entityId', id); data.set('file', new Blob([content], { type }), name);
  return attachmentsRoute.POST(new Request('https://fama.example.test/api/attachments', { method: 'POST', headers: { 'x-organization-id': 'org-fixture' }, body: data }));
}

test('official portal workflow needs no API and never marks a draft as officially issued', async () => {
  const draft = await portalDraft();
  const listed = await financeRoute.GET(tenantRequest('/api/finance'));
  const result = await listed.json();
  assert.equal(result.fiscalSettings.apiEnabled, false);
  assert.equal(result.fiscalSettings.provider, 'portal_nacional');
  assert.equal('fiscalApiToken' in result.fiscalSettings, false);
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { action: 'issueFiscalInvoice', id: draft.id }))).status, 400);
  assert.equal(sqlite.prepare('SELECT status FROM fiscal_invoices WHERE id = ?').get(draft.id).status, 'rascunho');
  const uploaded = await uploadFiscal(draft.id, nationalXml());
  assert.equal(uploaded.status, 201);
  const file = await uploaded.json();
  assert.deepEqual(file.fiscalMetadata, { provider: 'portal_nacional', officialNumber: '123', accessKey: nationalKey });
  assert.equal(requests.find(r => r.url.includes('/storage/v1/object/fama-documents/org-fixture/')).headers.get('content-type'), 'application/octet-stream');
  const registration = { action: 'registerPortalInvoice', id: draft.id, provider: 'portal_nacional', officialNumber: '123', accessKey: nationalKey, attachmentId: file.attachment.id, productionConfirmed: true };
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { ...registration, productionConfirmed: false }))).status, 400);
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { ...registration, accessKey: '2'.repeat(50) }))).status, 400);
  const recorded = await financeRoute.POST(tenantRequest('/api/finance', registration));
  assert.equal(recorded.status, 200); assert.equal((await recorded.json()).status, 'registrada');
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', registration))).status, 200);
  assert.equal(requests.some(r => r.url.includes('notaas') || r.url.endsWith('/emitir')), false);
  const cancellation = { action: 'registerPortalCancellation', id: draft.id, productionConfirmed: true };
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { ...cancellation, productionConfirmed: false }))).status, 400);
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', cancellation))).status, 200);
  const deleteRequest = new Request(`https://fama.example.test/api/attachments/${file.attachment.id}?entity=fiscalInvoices`, { method: 'DELETE', headers: { 'x-organization-id': 'org-fixture' } });
  assert.equal((await attachmentDeleteRoute.DELETE(deleteRequest, { params: Promise.resolve({ id: file.attachment.id }) })).status, 409);
});

test('fiscal attachments and registrations reject another tenant and duplicate official keys', async () => {
  const first = await portalDraft();
  const key = '3'.repeat(50);
  const file = await (await uploadFiscal(first.id, nationalXml({ key }))).json();
  const values = { action: 'registerPortalInvoice', id: first.id, provider: 'portal_nacional', officialNumber: '123', accessKey: key, attachmentId: file.attachment.id, productionConfirmed: true };
  membership.organization_id = 'org-other'; organization.id = 'org-other';
  assert.equal((await uploadFiscal(first.id, nationalXml())).status, 403);
  const foreign = new Request('https://fama.example.test/api/finance', { method: 'POST', headers: { 'x-organization-id': 'org-other', 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  assert.equal((await financeRoute.POST(foreign)).status, 404);
  membership.organization_id = 'org-fixture'; organization.id = 'org-fixture';
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', values))).status, 200);
  const second = await portalDraft();
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { ...values, id: second.id }))).status, 400);
  const secondFile = await (await uploadFiscal(second.id, nationalXml({ key }))).json();
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { ...values, id: second.id, attachmentId: secondFile.attachment.id }))).status, 409);
  assert.equal(sqlite.prepare('SELECT status FROM fiscal_invoices WHERE id = ?').get(second.id).status, 'rascunho');
});

test('XML conferences reject test environment, malformed XML and mismatched issuer, buyer or amount', () => {
  const invoice = { type: 'nfse', amountCents: 12545, customerDocument: '12345678901' };
  assert.throws(() => fiscalDocument.readFiscalXml('<DPS />', invoice, issuerFixture), /Use o XML/);
  assert.throws(() => fiscalDocument.readFiscalXml(nationalXml({ environment: '2' }), invoice, issuerFixture), /produção/);
  assert.throws(() => fiscalDocument.readFiscalXml(nationalXml({ issuer: '99999999999999' }), invoice, issuerFixture), /emitente/);
  assert.throws(() => fiscalDocument.readFiscalXml(nationalXml({ amount: '126.45' }), invoice, issuerFixture), /valor/);
  assert.throws(() => fiscalDocument.readFiscalXml(nationalXml({ customer: '99999999999' }), invoice, issuerFixture), /cliente/);
  assert.throws(() => fiscalDocument.readFiscalXml('<!DOCTYPE NFSe [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + nationalXml(), invoice, issuerFixture), /não permitida/);
  assert.throws(() => fiscalDocument.readFiscalXml('<NFSe><broken></NFSe>', invoice, issuerFixture), /inválido/);
});

test('municipal invoices accept an official PDF without MIME information and retain the issuer portal', async () => {
  const draft = await portalDraft();
  assert.equal((await uploadFiscal(draft.id, 'not a PDF', 'nota.pdf', '')).status, 400);
  const response = await uploadFiscal(draft.id, '%PDF-1.7\nfixture document', 'nota.pdf', '');
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.attachment.mimeType, 'application/pdf');
  const values = { action: 'registerPortalInvoice', id: draft.id, provider: 'portal_municipal', portalUrl: 'https://prefeitura.example.test/emissor', officialNumber: '456', accessKey: 'ABCD-1234', attachmentId: result.attachment.id, productionConfirmed: true };
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', { ...values, portalUrl: 'javascript:alert(1)' }))).status, 400);
  assert.equal((await financeRoute.POST(tenantRequest('/api/finance', values))).status, 200);
  const saved = sqlite.prepare('SELECT provider_reference AS providerReference FROM fiscal_invoices WHERE id = ?').get(draft.id);
  assert.equal(portal.portalForInvoice({ type: 'nfse', provider: 'portal_municipal', ...saved }, portal.fiscalPortalSettings(settingsModule.defaultCompanySettings)).consultation, values.portalUrl);
  globalThis.__famaTestUser = null;
  assert.equal((await uploadFiscal(draft.id, nationalXml())).status, 401);
});

test('failed document upload is recoverable and does not leave a broken attachment record', async () => {
  const draft = await portalDraft();
  signedLinksAvailable = false;
  assert.equal((await uploadFiscal(draft.id, nationalXml())).status, 503);
  assert.equal(attachments.length, 0);
  assert.equal(requests.some(r => r.url.endsWith('/storage/v1/object/fama-documents') && r.method === 'DELETE'), true);
  assert.equal(sqlite.prepare('SELECT status FROM fiscal_invoices WHERE id = ?').get(draft.id).status, 'rascunho');
  signedLinksAvailable = true;
  assert.equal((await uploadFiscal(draft.id, nationalXml())).status, 201);
});

test('product NF-e XML requires a production authorization protocol and portal keys have correct lengths', () => {
  const key = '4'.repeat(44);
  const xml = `<nfeProc><NFe><infNFe Id="NFe${key}"><ide><mod>55</mod><nNF>32</nNF></ide><emit><CNPJ>${issuerFixture}</CNPJ></emit><dest><CPF>12345678901</CPF></dest><total><ICMSTot><vNF>125.45</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>1</tpAmb><cStat>100</cStat><chNFe>${key}</chNFe></infProt></protNFe></nfeProc>`;
  const invoice = { type: 'nfe', amountCents: 12545, customerDocument: '12345678901' };
  assert.equal(fiscalDocument.readFiscalXml(xml, invoice, issuerFixture).officialNumber, '32');
  assert.throws(() => fiscalDocument.readFiscalXml(xml.replace('<cStat>100', '<cStat>110'), invoice, issuerFixture), /autorização/);
  const values = { provider: 'portal_nacional', officialNumber: '123', accessKey: key, attachmentId: 'fixture', productionConfirmed: true };
  assert.throws(() => portal.portalRegistration(values, 'nfse'), /50 dígitos/);
  assert.equal(portal.portalRegistration({ ...values, provider: 'portal_estadual' }, 'nfe').accessKey, key);
  assert.equal(portal.safePortalUrl('javascript:alert(1)'), '');
  assert.equal(portal.safePortalUrl('https://user:password@example.test'), '');
});


test('overdue upgrade payments preserve an existing paid plan', async () => {
  organization.pending_plan = 'profissional'; organization.pending_billing_cycle = 'annual'; paymentStatus = 'OVERDUE';
  const response = await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'check' }));
  assert.equal(response.status, 200); assert.equal(organization.plan_status, 'active'); assert.equal(organization.plan, 'inicial');
});

test('manual approval applies the requested plan and the complete billing cycle', async () => {
  runtime.PLATFORM_OWNER_USER_ID = 'user-fixture';
  await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'manual', plan: 'profissional', billingCycle: 'annual', installments: 1 }));
  assert.equal(organization.plan, 'inicial'); assert.equal(organization.pending_plan, 'profissional');
  const response = await adminOrganizationRoute.PATCH(new Request('https://fama.example.test/api/admin/organizations/org-fixture', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planStatus: 'active' }) }), { params: Promise.resolve({ id: 'org-fixture' }) });
  assert.equal(response.status, 200); assert.equal(organization.plan, 'profissional'); assert.equal(organization.pending_plan, ''); assert.equal(organization.billing_cycle, 'annual');
  assert.ok(Date.parse(organization.plan_expires_at) > Date.now() + 300 * 86400000);
});

test('support persists the actual ticket and returns the administrator response', async () => {
  const response = await supportRoute.POST(tenantRequest('/api/support', { title: 'Ajuda no cadastro', message: 'Preciso de ajuda para cadastrar um cliente.' }));
  assert.equal(response.status, 201); assert.equal(supportTickets.length, 1);
  supportTickets[0].status = 'resolvido'; supportTickets[0].admin_notes = 'Cadastro conferido.';
  const visible = await supportRoute.GET(tenantRequest('/api/support'));
  const ticket = (await visible.json()).tickets[0];
  assert.equal(ticket.status, 'resolvido'); assert.equal(ticket.adminNotes, 'Cadastro conferido.');
  assert.equal(requests.some(r => r.url.endsWith('/api/public/support')), false);
});

test('plan limits prevent additional users and customers at the advertised capacity', async () => {
  const fixtureFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/organization_members' && url.searchParams.get('select') === 'id,status') return json([{ id: 'one', status: 'active' }, { id: 'two', status: 'invited' }]);
    if (url.pathname === '/rest/v1/customers') return json(Array.from({ length: 200 }, (_, i) => ({ id: `customer-${i}` })));
    return fixtureFetch(input, init);
  };
  assert.equal((await membersRoute.POST(tenantRequest('/api/members', { email: 'extra@example.test', displayName: 'Extra' }))).status, 409);
  assert.equal((await recordsRoute.POST(tenantRequest('/api/records', { entity: 'customers', name: 'Extra', phone: '11999999999' }))).status, 409);
  assert.equal(requests.some(r => r.method === 'POST' && ['/rest/v1/customers', '/rest/v1/organization_members'].includes(new URL(r.url).pathname)), false);
});

test('malformed plan validity does not grant access', () => {
  assert.equal(tenant.isPlanAccessBlocked('active', 'invalid-date'), true);
  assert.equal(tenant.isPlanAccessBlocked('active', ''), false);
});


test('late upgrade webhook retains the pending plan for a later payment confirmation', async () => {
  organization.pending_plan = 'profissional'; organization.pending_billing_cycle = 'annual';
  const hook = (event) => new Request('https://fama.example.test/api/billing/asaas-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': 'fixture-webhook' }, body: JSON.stringify({ event, payment: { id: 'pay_first', customer: 'cus_fixture' } }) });
  assert.equal((await webhook.POST(hook('PAYMENT_OVERDUE'))).status, 200);
  assert.equal(organization.plan_status, 'active'); assert.equal(organization.pending_plan, 'profissional');
  assert.equal((await webhook.POST(hook('PAYMENT_CONFIRMED'))).status, 200);
  assert.equal(organization.plan, 'profissional'); assert.equal(organization.pending_plan, '');
});

test('early renewal preserves the remaining validity of the same paid plan', async () => {
  organization.pending_plan = 'inicial'; organization.pending_billing_cycle = 'monthly'; paymentStatus = 'CONFIRMED';
  const confirmed = await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'check' }));
  assert.equal(confirmed.status, 200); assert.equal(organization.plan_expires_at, '2030-02-01T00:00:00.000Z');
  await subscriptionRoute.POST(tenantRequest('/api/billing', { action: 'check' }));
  assert.equal(organization.plan_expires_at, '2030-02-01T00:00:00.000Z');
});


test('administrator exemption bypasses expiry but never bypasses company suspension or permissions', async () => {
  organization.billing_enabled = false; organization.block_on_expiry = false;
  organization.plan_status = 'expired'; organization.plan_expires_at = '2000-01-01T00:00:00Z';
  const req = tenantRequest('/api/records', { entity: 'customers' });
  assert.equal((await tenant.requireTenant(req)).organization.billingEnabled, false);
  assert.equal((await subscriptionRoute.POST(tenantRequest('/api/billing', { plan: 'profissional' }))).status, 409);
  assert.equal(requests.some(r => r.url.includes('asaas.com')), false);
  organization.status = 'suspended';
  await assert.rejects(() => tenant.requireTenant(req), e => e.status === 403);
  organization.status = 'active'; membership.status = 'inactive';
  await assert.rejects(() => tenant.requireTenant(req), e => e.status === 403);
  membership.status = 'active'; membership.role = 'member'; membership.permissions = [];
  assert.equal((await recordsRoute.POST(req)).status, 403);
});

test('billing and automatic blocking are independent and missing flags preserve paid accounts', async () => {
  organization.plan_status = 'expired'; organization.plan_expires_at = '2000-01-01T00:00:00Z';
  const req = tenantRequest('/api/records', {});
  organization.billing_enabled = true; organization.block_on_expiry = false;
  assert.equal((await tenant.requireTenant(req)).organization.blockOnExpiry, false);
  organization.block_on_expiry = true;
  await assert.rejects(() => tenant.requireTenant(req), e => e.status === 402);
  assert.equal(tenant.isPlanAccessBlocked('expired', '', false, true), false);
  assert.equal(tenant.isPlanAccessBlocked('expired', '', true, false), false);
  assert.equal(tenant.isPlanAccessBlocked('expired', ''), true);
  assert.equal(tenant.isPlanAccessBlocked('active', '2030-01-01T00:00:00Z'), false);
});

test('exempt billing reads do not refresh or create old provider charges', async () => {
  organization.billing_enabled = false; organization.block_on_expiry = false;
  organization.plan_status = 'pending_payment'; organization.pending_plan = 'profissional';
  const response = await subscriptionRoute.GET(tenantRequest('/api/billing'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).billing.billingEnabled, false);
  assert.equal(requests.some(r => r.url.includes('asaas.com')), false);
});
