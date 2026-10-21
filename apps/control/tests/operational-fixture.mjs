import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Every request is contained in this in-memory PostgREST substitute. Unexpected
// destinations fail immediately; these tests cannot create real provider data.
export async function operationalFixture(root, auth = 'system-auth') {
  const originalFetch = globalThis.fetch;
  const runtime = {};
  globalThis.__operationRuntime = runtime;
  const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{
    name: 'operational-fixture', enforce: 'pre',
    resolveId(id) {
      if (id === 'cloudflare:workers') return '\0operation-env';
      if (id.endsWith(`/app/${auth}`) || id.endsWith(`/app/${auth}.js`)) return '\0operation-auth';
    },
    load(id) {
      if (id === '\0operation-env') return 'export const env=globalThis.__operationRuntime;';
      if (id === '\0operation-auth') return "export async function getFamaUser(){return globalThis.__operationUser;} export const getChatGPTUser=getFamaUser; export async function getSupabaseAccessToken(){return globalThis.__operationAccessToken ?? 'fixture-user-access-token';}";
    },
  }] });
  const f = { runtime, tables: {}, calls: [], allowed: true, rules: null, fail: null, beforeRequest: null, user: null };
  f.load = path => vite.ssrLoadModule(path);
  f.reset = () => {
    Object.assign(runtime, { PLATFORM_OWNER_USER_ID: 'user-one', DATA_BACKEND: 'supabase', SUPABASE_URL: 'https://operation.fixture.test', SUPABASE_SECRET_KEY: 'sb_secret_fixture', FAMA_DATA_ENCRYPTION_KEY: 'a'.repeat(64), DB: { prepare() { throw new Error('Unexpected D1 request in Supabase fixture'); } } });
    f.user = globalThis.__operationUser = { id: 'user-one', email: 'one@example.test', displayName: 'One' };
    f.tables = {
      organizations: [{ id: 'org-one', name: 'Empresa um', slug: 'one', status: 'active', plan: 'profissional', plan_status: 'active', plan_expires_at: '2099-01-01T00:00:00Z', billing_enabled: false, block_on_expiry: false }],
      organization_members: [{ id: 'member-one', organization_id: 'org-one', user_id: 'user-one', user_email: 'one@example.test', role: 'owner', status: 'active' }],
    };
    f.calls = []; f.allowed = true; f.fail = null; f.beforeRequest = null;
    f.rules = Object.fromEntries(['global', 'organization', 'member'].map(scope => [scope, { overrides: {}, revision: 0, updatedAt: null }]));
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input)), method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      const call = { url, method, body, headers: new Headers(init.headers) };
      f.calls.push(call);
      if (url.pathname === '/api/public/plans' && method === 'GET') return Response.json({ plans: [] });
      assert.equal(url.origin, 'https://operation.fixture.test', 'fixture attempted an external request');
      if (f.beforeRequest) await f.beforeRequest(call);
      if (f.fail?.(call)) return Response.json({ message: 'Fixture database unavailable', code: 'FIXTURE' }, { status: 503 });
      if (url.pathname === '/rest/v1/rpc/fama_consume_rate_limit') return Response.json(f.allowed);
      if (url.pathname === '/rest/v1/rpc/fama_get_block_rules') return Response.json(f.rules);
      assert.match(url.pathname, /^\/rest\/v1\/[a-z_]+$/, 'unexpected fixture API');
      const table = url.pathname.split('/').at(-1), rows = f.tables[table] ??= [];
      const matches = row => [...url.searchParams].every(([key, value]) => {
        if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) return true;
        if (value === 'is.null') return row[key] == null;
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        throw new Error(`Unsupported fixture filter ${key}=${value}`);
      });
      if (method === 'POST') {
        if (body.id && rows.some(row => row.id === body.id)) return Response.json({ code: '23505', message: 'duplicate key' }, { status: 409 });
        rows.push(structuredClone(body)); return Response.json([body], { status: 201 });
      }
      let selected = rows.filter(matches);
      if (method === 'PATCH') { for (const row of selected) Object.assign(row, structuredClone(body)); }
      if (method === 'DELETE') { f.tables[table] = rows.filter(row => !matches(row)); return Response.json(selected); }
      const limit = Number(url.searchParams.get('limit') ?? selected.length);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      selected = selected.slice(offset, offset + limit);
      return Response.json(selected);
    };
  };
  f.request = (method, path, body, headers = {}) => new Request(`https://fama.example.test${path}`, { method, headers: { 'x-organization-id': 'org-one', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  f.context = id => ({ params: Promise.resolve({ id }) });
  f.member = () => f.tables.organization_members[0];
  f.businessWrites = () => f.calls.filter(call => call.url.pathname.startsWith('/rest/v1/') && !call.url.pathname.includes('/rpc/') && call.method !== 'GET');
  f.close = async () => { globalThis.fetch = originalFetch; delete globalThis.__operationRuntime; delete globalThis.__operationUser; await vite.close(); };
  f.reset();
  return f;
}
