import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'vite';
import { withLocalApi } from './localhost-http.mjs';

const runtime = {};
globalThis.__famaControlRuntime = runtime;
const originalFetch = globalThis.fetch;
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE support_tickets (id TEXT PRIMARY KEY, organization_id TEXT, organization_name TEXT, user_id TEXT, user_email TEXT, type TEXT, priority TEXT, title TEXT, message TEXT, status TEXT, admin_notes TEXT, created_at TEXT, updated_at TEXT);`);
const d1 = { prepare(sql) {
 const stmt = sqlite.prepare(sql); let values = [];
 const result = { bind(...next) { values = next; return result; }, async first() { return stmt.get(...values) ?? null; }, async all() { return { results: stmt.all(...values) }; }, async run() { return { meta: { changes: Number(stmt.run(...values).changes) } }; } };
 return result;
} };
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { hmr: false, middlewareMode: true }, plugins: [{
 name: 'fama-control-fixtures', enforce: 'pre',
 resolveId(id) { if (id === 'cloudflare:workers') return '\0control-env'; if (id.endsWith('/app/chatgpt-auth') || id.endsWith('/app/chatgpt-auth.ts')) return '\0control-auth'; },
 load(id) { if (id === '\0control-env') return 'export const env = globalThis.__famaControlRuntime;'; if (id === '\0control-auth') return 'export async function getChatGPTUser() { return globalThis.__famaControlUser; }'; }
}] });
const bridge = await vite.ssrLoadModule('/app/api/internal/data/route.ts');
const plans = await vite.ssrLoadModule('/app/api/admin/plans/route.ts');
const publicPlans = await vite.ssrLoadModule('/app/api/public/plans/route.ts');
const support = await vite.ssrLoadModule('/app/api/admin/support/route.ts');
const supportIngress = await vite.ssrLoadModule('/app/api/public/support/route.ts');
const adminOrganization = await vite.ssrLoadModule('/app/api/admin/organizations/[id]/route.ts');
const securityStatus = await vite.ssrLoadModule('/app/api/admin/security/route.ts');
let tickets, requests, organization;
beforeEach(() => {
 for (const key of Object.keys(runtime)) delete runtime[key];
 Object.assign(runtime, { DATA_BACKEND: 'supabase', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture', FAMA_DATA_BRIDGE_SECRET: 'private-fixture-token', PLATFORM_OWNER_EMAIL: 'owner@example.test', DB: d1 });
 globalThis.__famaControlUser = { id: 'owner-fixture', email: 'owner@example.test', displayName: 'Owner' };
 tickets = [{ id: 'ticket-fixture', organization_id: 'org-fixture', organization_name: 'Fixture', user_id: 'user-fixture', user_email: 'member@example.test', type: 'duvida', priority: 'media', title: 'Ajuda com o sistema', message: 'Preciso conferir o cadastro', status: 'aberto', admin_notes: '', created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z' }];
 organization = { id: 'org-fixture', plan: 'inicial', plan_status: 'active', pending_plan: 'profissional', pending_billing_cycle: 'annual' };
 requests = []; sqlite.exec('DELETE FROM platform_settings; DELETE FROM support_tickets');
 globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input)); const method = init.method ?? 'GET'; const body = init.body ? JSON.parse(typeof init.body === 'string' ? init.body : new TextDecoder().decode(init.body)) : null;
  if (init.redirect === 'error') throw new TypeError('Workers requires an explicit manual redirect policy.');
  requests.push({ url: url.href, method, body, headers: new Headers(init.headers), redirect: init.redirect });
  if (url.pathname === '/rest/v1/request_rate_limits') {
   if (url.searchParams.get('select') !== 'key_hash') return Response.json({ message: 'column id does not exist' }, { status: 400 });
   return Response.json([{ key_hash: 'fixture-key' }]);
  }
  if (url.pathname === '/rest/v1/organizations') {
   if (method === 'PATCH') Object.assign(organization, body);
   return Response.json([organization]);
  }
  if (url.pathname === '/rest/v1/support_tickets') {
   const id = url.searchParams.get('id')?.replace(/^eq\./, '');
   if (method === 'PATCH') { const matching = tickets.filter(t => t.id === id); for (const t of matching) Object.assign(t, body); return Response.json(matching); }
   if (method === 'POST') { tickets.push(body); return Response.json([body]); }
   return Response.json(id ? tickets.filter(t => t.id === id) : tickets);
  }
  return Response.json([]);
 };
});
after(async () => { globalThis.fetch = originalFetch; await vite.close(); sqlite.close(); delete globalThis.__famaControlRuntime; delete globalThis.__famaControlUser; });
const request = (path, method, body, headers = {}) => new Request(`https://control.example.test${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });

test('security diagnostics verify the actual rate-limit primary key', async () => {
 const response = await securityStatus.GET();
 assert.equal(response.status, 200);
 const result = await response.json();
 assert.equal(result.production.rateLimiting, true);
 assert.deepEqual(result.tables.find(row => row.name === 'request_rate_limits'), { name: 'request_rate_limits', rows: 1, state: 'ok' });
});

test('localhost HTTP validates private bridge authorization, saved plans and administrator support', async () => {
 await assert.rejects(() => originalFetch('https://outside.example.test/blocked', { method: 'POST', body: 'local fixture' }), /External network is disabled/);
 await withLocalApi({
  '/api/internal/data': bridge,
  '/api/admin/plans': plans,
  '/api/public/plans': publicPlans,
  '/api/admin/support': support,
 }, async origin => {
  const send = (path, method = 'GET', body, headers = {}) => originalFetch(`${origin}${path}`, {
   method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
   ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
  });
  assert.equal((await send('/api/internal/data', 'POST')).status, 401);
  const authorized = await send('/api/internal/data', 'POST', { name: 'Empresa fictícia localhost' }, {
   Authorization: 'Bearer private-fixture-token', 'x-fama-data-path': '/rest/v1/organizations?id=eq.org-fixture',
   'x-fama-data-method': 'PATCH', apikey: 'untrusted-key', cookie: 'untrusted-cookie',
  });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.headers.get('cache-control'), 'private, no-store');
  assert.equal(requests[0].headers.get('apikey'), 'sb_secret_fixture');
  assert.equal(requests[0].headers.get('cookie'), null);
  const catalog = [{ id: 'inicial', name: 'Inicial localhost', price: 5990, users: '2 usuários', clients: '200 clientes', modules: 'CRM' }];
  assert.equal((await send('/api/admin/plans', 'PATCH', { plans: catalog })).status, 200);
  const visible = await send('/api/public/plans');
  assert.equal(visible.status, 200);
  assert.equal((await visible.json()).plans[0].price, 5990);
  assert.equal((await send('/api/admin/support', 'PATCH', { id: 'ticket-fixture', status: 'resolvido', adminNotes: 'Resposta fictícia localhost.' })).status, 200);
  const supportList = await send('/api/admin/support');
  assert.equal((await supportList.json()).tickets[0].adminNotes, 'Resposta fictícia localhost.');
  globalThis.__famaControlUser.email = 'member@example.test';
  assert.equal((await send('/api/admin/plans', 'PATCH', { plans: catalog })).status, 403);
  assert.equal((await send('/api/admin/support')).status, 403);
  assert.equal((await (await send('/api/public/plans')).json()).plans[0].price, 5990);
 });
});

test('private data bridge rejects unauthorized requests and unsafe destinations', async () => {
 assert.equal((await bridge.POST(request('/api/internal/data', 'POST'))).status, 401);
 for (const path of ['https://evil.test/rest/v1/organizations', '//evil.test/rest/v1/organizations', '/auth/v1/admin/users', '/rest/v1/unknown', '/rest/v1/organizations#fragment']) {
  assert.equal(bridge.allowedDataPath(path), false);
  assert.equal((await bridge.POST(request('/api/internal/data', 'POST', null, { Authorization: 'Bearer private-fixture-token', 'x-fama-data-path': path }))).status, 400);
 }
 delete runtime.FAMA_DATA_BRIDGE_SECRET;
 assert.equal((await bridge.POST(request('/api/internal/data', 'POST', null, { Authorization: 'Bearer private-fixture-token' }))).status, 401);
 assert.equal(requests.length, 0);
});

test('private data bridge forwards only server credentials and approved operations', async () => {
 const response = await bridge.POST(request('/api/internal/data', 'POST', { name: 'Fixture' }, { Authorization: 'Bearer private-fixture-token', 'x-fama-data-path': '/rest/v1/organizations?id=eq.org-fixture', 'x-fama-data-method': 'PATCH', apikey: 'untrusted-key', cookie: 'untrusted-cookie', prefer: 'return=representation' }));
 assert.equal(response.status, 200); assert.equal(requests.length, 1);
 assert.equal(requests[0].headers.get('apikey'), 'sb_secret_fixture');
 assert.equal(requests[0].headers.get('authorization'), null); assert.equal(requests[0].headers.get('cookie'), null);
 assert.equal(requests[0].method, 'PATCH'); assert.equal(response.headers.get('apikey'), null);
 assert.equal(requests[0].redirect, 'manual');
 assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('private data bridge refuses redirected responses without forwarding server credentials', async () => {
 const destinations = [];
 globalThis.fetch = async (input, init) => { destinations.push({ url: String(input), redirect: init.redirect }); return new Response(null, { status: 307, headers: { Location: 'https://untrusted.example.test' } }); };
 const response = await bridge.POST(request('/api/internal/data', 'POST', null, { Authorization: 'Bearer private-fixture-token', 'x-fama-data-path': '/rest/v1/organizations' }));
 assert.equal(response.status, 502); assert.equal(destinations.length, 1); assert.equal(destinations[0].redirect, 'manual');
 assert.equal(response.headers.get('location'), null);
});

test('saved plan prices are immediately available to the public catalog', async () => {
 const catalog = [{ id: 'inicial', name: 'Inicial', price: 5990, users: '2 usuários', clients: '200 clientes', modules: 'CRM' }];
 const saved = await plans.PATCH(request('/api/admin/plans', 'PATCH', { plans: catalog }));
 assert.equal(saved.status, 200); const published = await publicPlans.GET();
 assert.equal((await published.json()).plans[0].price, 5990);
 assert.equal((await plans.PATCH(request('/api/admin/plans', 'PATCH', { plans: [{ ...catalog[0], price: 'invalid' }] }))).status, 400);
 globalThis.__famaControlUser.email = 'member@example.test';
 assert.equal((await plans.PATCH(request('/api/admin/plans', 'PATCH', { plans: catalog }))).status, 403);
});

test('admin support responses update the shared ticket and unknown tickets return 404', async () => {
 const updated = await support.PATCH(request('/api/admin/support', 'PATCH', { id: 'ticket-fixture', status: 'resolvido', adminNotes: 'Cadastro conferido.' }));
 assert.equal(updated.status, 200); assert.equal(tickets[0].status, 'resolvido');
 const visible = (await (await support.GET()).json()).tickets[0];
 assert.equal(visible.adminNotes, 'Cadastro conferido.');
 assert.equal((await support.PATCH(request('/api/admin/support', 'PATCH', { id: 'missing', status: 'resolvido' }))).status, 404);
 globalThis.__famaControlUser.email = 'member@example.test';
 assert.equal((await support.GET()).status, 403);
});

test('support ingress requires server authentication and never resets an answered ticket', async () => {
 const body = { id: 'ticket-fixture', organizationId: 'org-fixture', title: 'Ajuda com o sistema', message: 'Preciso conferir o cadastro' };
 assert.equal((await supportIngress.POST(request('/api/public/support', 'POST', body))).status, 401);
 tickets[0].status = 'resolvido';
 assert.equal((await supportIngress.POST(request('/api/public/support', 'POST', body, { Authorization: 'Bearer private-fixture-token' }))).status, 201);
 assert.equal(tickets.length, 1); assert.equal(tickets[0].status, 'resolvido');
 body.organizationId = 'other-company';
 assert.equal((await supportIngress.POST(request('/api/public/support', 'POST', body, { Authorization: 'Bearer private-fixture-token' }))).status, 409);
});


test('Control activation applies a pending upgrade and its yearly validity', async () => {
 const response = await adminOrganization.PATCH(request('/api/admin/organizations/org-fixture', 'PATCH', { planStatus: 'active' }), { params: Promise.resolve({ id: 'org-fixture' }) });
 assert.equal(response.status, 200); assert.equal(organization.plan, 'profissional'); assert.equal(organization.billing_cycle, 'annual'); assert.equal(organization.pending_plan, '');
 assert.ok(Date.parse(organization.plan_expires_at) > Date.now() + 300 * 86400000);
});
