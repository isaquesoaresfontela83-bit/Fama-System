import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { withLocalApi } from './localhost-http.mjs';

const runtime = {};
globalThis.__companyRuntime = runtime;
const originalFetch = globalThis.fetch;
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { hmr: false, middlewareMode: true }, plugins: [{
  name: 'company-account-fixtures', enforce: 'pre',
  resolveId(id) { if (id === 'cloudflare:workers') return '\0company-env'; if (id.endsWith('/app/chatgpt-auth') || id.endsWith('/app/chatgpt-auth.ts')) return '\0company-auth'; },
  load(id) { if (id === '\0company-env') return 'export const env = globalThis.__companyRuntime;'; if (id === '\0company-auth') return `export async function getChatGPTUser() { return globalThis.__companyAdmin; }
    export class AuthRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
    export async function signInWithPassword() { throw new AuthRequestError('Invalid credentials', 400); }
    export async function supabaseAuthRequest() { return null; }`; },
}] });
const companiesApi = await vite.ssrLoadModule('/app/api/admin/organizations/route.ts');
const companyApi = await vite.ssrLoadModule('/app/api/admin/organizations/[id]/route.ts');
const usersApi = await vite.ssrLoadModule('/app/api/admin/organizations/[id]/members/route.ts');
const userApi = await vite.ssrLoadModule('/app/api/admin/members/[id]/route.ts');
const validationApi = await vite.ssrLoadModule('/app/api/admin/validation/route.ts');
let organizations, members, accounts, audits, requests, failRpc, failAuth, failVerify, failCompanyDelete;
const ownerId = '10000000-0000-4000-8000-000000000001';
const memberId = '20000000-0000-4000-8000-000000000002';
beforeEach(() => {
  Object.assign(runtime, { DATA_BACKEND: 'supabase', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture', PLATFORM_OWNER_EMAIL: 'platform@example.test' });
  globalThis.__companyAdmin = { id: 'platform-fixture', email: 'platform@example.test', displayName: 'Plataforma' };
  organizations = [{ id: 'company-fixture', name: 'Empresa de teste', name_key: 'empresa de teste', status: 'active', plan: 'profissional', plan_status: 'active', plan_expires_at: '', billing_enabled: false, block_on_expiry: false, billing_cycle: 'monthly', billing_provider: '' }];
  members = [
    { id: 'owner-member', organization_id: 'company-fixture', user_id: ownerId, user_email: 'owner@example.test', display_name: 'Responsável', role: 'owner', status: 'active', permissions: [] },
    { id: 'user-member', organization_id: 'company-fixture', user_id: memberId, user_email: 'user@example.test', display_name: 'Colaborador', role: 'member', status: 'active', permissions: ['crm'], updated_at: '2026-09-30T00:00:00Z' },
  ];
  accounts = members.map(row => ({ id: row.user_id, email: row.user_email, user_metadata: { display_name: row.display_name } }));
  audits = []; requests = []; failRpc = false; failAuth = false; failVerify = false; failCompanyDelete = false;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)), method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ path: url.pathname, method, body });
    if (url.pathname.endsWith('/rpc/fama_consume_rate_limit')) return Response.json(true);
    if (url.pathname.endsWith('/rpc/fama_admin_create_company')) {
      if (failRpc) return Response.json({ message: 'Transaction rejected' }, { status: 409 });
      organizations.push({ id: body.p_id, name: body.p_name, name_key: body.p_name_key, slug: body.p_slug, status: 'active', plan: body.p_plan, plan_status: 'active', plan_expires_at: '', billing_enabled: false, block_on_expiry: false });
      members.push({ id: body.p_member_id, organization_id: body.p_id, user_id: body.p_user_id, user_email: body.p_email, display_name: body.p_display_name, role: 'owner', status: 'active', permissions: body.p_permissions });
      return Response.json({ id: body.p_id, memberId: body.p_member_id });
    }
    if (url.pathname.startsWith('/auth/v1/admin/users')) {
      if (method === 'POST') {
        if (accounts.some(account => account.email === body.email)) return Response.json({ error_code: 'email_exists' }, { status: 422 });
        const account = { id: crypto.randomUUID(), email: body.email, user_metadata: body.user_metadata };
        accounts.push(account); return Response.json(account, { status: 201 });
      }
      const id = url.pathname.split('/').at(-1), account = accounts.find(item => item.id === id);
      if (method === 'DELETE') { if (!account) return Response.json({ message: 'User not found' }, { status: 404 }); accounts = accounts.filter(item => item.id !== id); return Response.json({}); }
      if (method === 'PUT') {
        if (failAuth) return Response.json({ error_code: 'email_exists' }, { status: 422 });
        Object.assign(account, body); return Response.json(account);
      }
    }
    if (url.pathname === '/rest/v1/leads') return Response.json([]);
    const rows = url.pathname === '/rest/v1/organizations' ? organizations : url.pathname === '/rest/v1/organization_members' ? members : url.pathname === '/rest/v1/audit_logs' ? audits : null;
    if (rows) {
      const matching = rows.filter(row => [...url.searchParams].every(([key, value]) => ['select', 'order', 'limit'].includes(key) || String(row[key]) === value.replace(/^eq\./, '')));
      if (method === 'POST') { rows.push(body); return Response.json([body]); }
      if (method === 'PATCH') { matching.forEach(row => Object.assign(row, body)); return Response.json(matching); }
      if (method === 'DELETE') {
        if (rows === organizations && failCompanyDelete) { failCompanyDelete = false; return Response.json({ message: 'Temporary failure' }, { status: 503 }); }
        if (rows === organizations) members = members.filter(member => !matching.some(row => row.id === member.organization_id));
        for (const row of matching) rows.splice(rows.indexOf(row), 1); return Response.json(matching);
      }
      if (failVerify && requests.some(item => item.method === 'PATCH') && url.pathname.endsWith('organization_members')) return Response.json(matching.map(row => ({ ...row, permissions: ['quotes'] })));
      return Response.json(rows === audits ? matching.slice(-1).reverse() : matching);
    }
    throw new Error(`Unexpected fixture destination: ${url.pathname}`);
  };
});
after(async () => { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__companyRuntime; delete globalThis.__companyAdmin; });
const request = (body, headers = {}) => new Request('https://control.example.test/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const context = id => ({ params: Promise.resolve({ id }) });
const createInput = { name: 'Empresa nova', displayName: 'Responsável novo', email: 'new@example.test', password: 'Fixture-password-8', plan: 'profissional' };

test('localhost company creation is permanently free and users can be created and edited', async () => {
  await withLocalApi({
    '/companies': companiesApi,
    '/users': { GET: req => usersApi.GET(req, context('company-fixture')), POST: req => usersApi.POST(req, context('company-fixture')) },
    '/user': { PATCH: req => userApi.PATCH(req, context('user-member')) },
  }, async origin => {
    const send = (path, method, body) => originalFetch(`${origin}${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: origin }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const response = await send('/companies', 'POST', { ...createInput, billingEnabled: true, freeUntil: '2020-01-01' });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.verified, true); assert.equal(result.organization.billingEnabled, false); assert.equal(result.organization.blockOnExpiry, false); assert.equal(result.organization.planExpiresAt, '');
    assert.equal(members.find(row => row.organization_id === result.organization.id).role, 'owner');
    assert.equal(JSON.stringify(result).includes(createInput.password), false);
    const user = await send('/users', 'POST', { displayName: 'Técnico novo', email: 'tech@example.test', password: 'Fixture-password-9', role: 'technician', permissions: ['agenda', 'orders'] });
    assert.equal(user.status, 201); assert.equal((await user.json()).member.role, 'technician');
    const changed = await send('/user', 'PATCH', { displayName: 'Financeiro', email: 'finance@example.test', password: 'Fixture-password-10', role: 'admin', status: 'inactive', permissions: ['finance'] });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).member.status, 'inactive');
    assert.equal(accounts.find(item => item.id === memberId).email, 'finance@example.test');
    assert.equal(members.find(item => item.id === 'user-member').user_email, 'finance@example.test');
    assert.equal(JSON.stringify(audits).includes('Fixture-password'), false);
  });
});

test('billing and automatic blocking require explicit activation and a due date', async () => {
  assert.equal((await companyApi.PATCH(request({ billingEnabled: true, blockOnExpiry: true }), context('company-fixture'))).status, 400);
  assert.equal(organizations[0].billing_enabled, false);
  const expires = '2027-01-31T23:59:59-03:00';
  const paid = await companyApi.PATCH(request({ name: 'Empresa editada', plan: 'intermediario', billingEnabled: true, blockOnExpiry: false, billingCycle: 'annual', planExpiresAt: expires }), context('company-fixture'));
  assert.equal(paid.status, 200); assert.equal((await paid.json()).verified, true);
  assert.equal(organizations[0].name, 'Empresa editada'); assert.equal(organizations[0].billing_enabled, true); assert.equal(organizations[0].block_on_expiry, false); assert.equal(organizations[0].plan_status, 'pending_payment');
  assert.equal((await companyApi.PATCH(request({ blockOnExpiry: true }), context('company-fixture'))).status, 400);
  assert.equal((await companyApi.PATCH(request({ blockOnExpiry: true, planExpiresAt: expires }), context('company-fixture'))).status, 200);
  assert.equal(organizations[0].block_on_expiry, true);
  assert.equal((await companyApi.PATCH(request({ billingEnabled: false }), context('company-fixture'))).status, 200);
  assert.equal(organizations[0].block_on_expiry, false); assert.equal(organizations[0].plan_expires_at, '');
});

test('administrator and same-origin checks prevent company/account changes', async () => {
  globalThis.__companyAdmin.email = 'outsider@example.test';
  assert.equal((await companiesApi.POST(request(createInput))).status, 403);
  assert.equal((await userApi.PATCH(request({ permissions: [] }), context('user-member'))).status, 403);
  globalThis.__companyAdmin.email = 'platform@example.test';
  assert.equal((await companiesApi.POST(request(createInput, { Origin: 'https://attacker.test' }))).status, 403);
  assert.equal((await usersApi.POST(request({ ...createInput, role: 'member' }, { 'sec-fetch-site': 'cross-site' }), context('company-fixture'))).status, 403);
  assert.equal(requests.length, 0);
});

test('owner and platform identity are protected while ordinary access can be disabled', async () => {
  for (const body of [{ role: 'member' }, { status: 'inactive' }, { permissions: ['crm'] }]) assert.equal((await userApi.PATCH(request(body), context('owner-member'))).status, 400);
  assert.equal((await userApi.PATCH(request({ email: 'platform@example.test' }), context('user-member'))).status, 400);
  assert.equal((await usersApi.POST(request({ displayName: 'Usuário', email: 'platform@example.test', password: 'Fixture-password', role: 'member' }), context('company-fixture'))).status, 400);
  const changed = await userApi.PATCH(request({ status: 'inactive', permissions: [] }), context('user-member'));
  assert.equal(changed.status, 200); assert.deepEqual((await changed.json()).permissions, []);
  assert.equal(members.find(row => row.id === 'user-member').status, 'inactive');
});

test('blank password is preserved and rejected Auth changes roll back membership data', async () => {
  const changed = await userApi.PATCH(request({ displayName: 'Novo nome', password: '', permissions: ['agenda'] }), context('user-member'));
  assert.equal(changed.status, 200);
  assert.equal(requests.find(item => item.path.endsWith(memberId) && item.method === 'PUT').body.password, undefined);
  failAuth = true;
  assert.equal((await userApi.PATCH(request({ email: 'rejected@example.test', role: 'admin' }), context('user-member'))).status, 409);
  assert.equal(members.find(row => row.id === 'user-member').user_email, 'user@example.test');
  assert.equal(members.find(row => row.id === 'user-member').role, 'member');
});

test('duplicate identity and failed company transaction do not overwrite existing accounts', async () => {
  assert.equal((await companiesApi.POST(request({ ...createInput, email: 'user@example.test' }))).status, 409);
  assert.equal(requests.some(item => item.path.startsWith('/auth/v1/admin/users')), false);
  failRpc = true;
  const response = await companiesApi.POST(request(createInput));
  assert.equal(response.status, 503); assert.equal(organizations.length, 1); assert.equal(accounts.length, 2);
  assert.ok(requests.some(item => item.method === 'DELETE' && item.path.startsWith('/auth/v1/admin/users/')));
});

test('server verifies persisted modules and validates roles before any identity mutation', async () => {
  assert.equal((await userApi.PATCH(request({ role: 'owner' }), context('user-member'))).status, 400);
  assert.equal((await userApi.PATCH(request({ permissions: ['unknown'] }), context('user-member'))).status, 400);
  assert.equal(requests.some(item => item.method === 'PATCH' || item.method === 'PUT'), false);
  failVerify = true;
  assert.equal((await userApi.PATCH(request({ permissions: ['finance'] }), context('user-member'))).status, 409);
});

test('discardable validation rejects outsiders and cross-site calls before creating resources', async () => {
  globalThis.__companyAdmin.email = 'outsider@example.test';
  assert.equal((await validationApi.POST(request({ stage: 'start' }))).status, 403);
  assert.equal((await validationApi.GET(new Request('https://control.example.test/api/admin/validation'))).status, 403);
  globalThis.__companyAdmin.email = 'platform@example.test';
  assert.equal((await validationApi.POST(request({ stage: 'start' }, { Origin: 'https://attacker.test' }))).status, 403);
  assert.equal(requests.length, 0);
});

function validationFixture() {
  const runId = '30000000-0000-4000-8000-000000000003';
  const run = { runId, organizationId: 'company-fixture', companyName: `Fama Validação ${runId}`, actorId: 'platform-fixture', stage: 'access', checks: [], cleaned: false, failed: false, checkedAt: new Date().toISOString() };
  organizations[0].name = run.companyName;
  organizations.push({ id: 'real-company', name: 'Empresa permanente', status: 'active' });
  members[0].user_email = `fama-validation-${runId}-owner@example.com`;
  members[1].user_email = `fama-validation-${runId}-member@example.com`;
  Object.assign(runtime, { FAMA_DATA_ENCRYPTION_KEY: 'a'.repeat(64) });
  audits.push({ organization_id: run.organizationId, actor_user_id: run.actorId, entity_type: 'company_created', record_id: run.organizationId });
  audits.push({ actor_user_id: run.actorId, entity_type: 'access_validation', record_id: runId, metadata: structuredClone(run) });
  return run;
}

test('cleanup refuses shared identities and only reads runs owned by the current administrator', async () => {
  const run = validationFixture();
  members.push({ id: 'shared-member', organization_id: 'real-company', user_id: ownerId, user_email: members[0].user_email });
  const response = await validationApi.POST(request({ stage: 'cleanup', runId: run.runId }));
  const result = await response.json();
  assert.equal(result.run.cleaned, false);
  assert.ok(result.run.error.includes('outro vínculo'));
  assert.equal(requests.some(item => item.method === 'DELETE' || item.method === 'PATCH' || item.path.startsWith('/auth/')), false);
  globalThis.__companyAdmin.id = 'different-platform-owner';
  assert.equal((await validationApi.POST(request({ stage: 'cleanup', runId: run.runId }))).status, 404);
});

test('failed cleanup can be retried after Auth accounts were removed and preserves the real company', async () => {
  const run = validationFixture();
  failCompanyDelete = true;
  const first = await (await validationApi.POST(request({ stage: 'cleanup', runId: run.runId }))).json();
  assert.equal(first.run.cleaned, false); assert.equal(accounts.length, 0);
  assert.ok(organizations.some(row => row.id === 'company-fixture'));
  const second = await (await validationApi.POST(request({ stage: 'cleanup', runId: run.runId }))).json();
  assert.equal(second.run.cleaned, true); assert.equal(members.length, 0);
  assert.deepEqual(organizations, [{ id: 'real-company', name: 'Empresa permanente', status: 'active' }]);
  assert.equal(second.run.checks.filter(check => check.passed).length, 2);
  assert.equal(JSON.stringify(second).includes('Aa1!'), false);
  assert.equal(JSON.stringify(audits).includes('sb_secret'), false);
});
