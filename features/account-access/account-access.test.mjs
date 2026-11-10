import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withAccountAccess } from './entry.mjs';

function fakeDb() {
  const rows = new Map();
  return { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async run() {
    if (sql.startsWith('INSERT INTO')) rows.set(args[0], { email: args[0], status: args[1], user_id: '', requested_at: args[2], approved_at: '' });
    if (sql.includes("SET status = 'active'")) Object.assign(rows.get(args[2]), { status: 'active', user_id: args[0], approved_at: args[1] });
    return { success: true };
  }, async first() { return rows.get(args[0]) ?? null; }, async all() { return { results: [...rows.values()] }; } }; } };
}

const app = { async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/api/auth/session') return Response.json({ authenticated: true, email: 'owner@example.com' });
  if (path === '/api/admin/organizations') return Response.json({ organizations: [] });
  return new Response('original');
} };

test('a collaborator request stays pending and does not create an auth identity', async () => {
  const worker = withAccountAccess(app, 'control');
  const env = { PLATFORM_OWNER_EMAIL: 'owner@example.com', DB: fakeDb(), SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('Auth must not be called while requesting approval'); };
  try {
    const response = await worker.fetch(new Request('https://control.example.com/api/control-collaborators', { method: 'POST', headers: { origin: 'https://control.example.com', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'request', email: 'helper@example.com' }) }), env, {});
    assert.equal(response.status, 201);
    const list = await worker.fetch(new Request('https://control.example.com/api/control-collaborators'), env, {});
    assert.deepEqual((await list.json()).requests.map(row => [row.email, row.status]), [['helper@example.com', 'pending']]);
  } finally { globalThis.fetch = originalFetch; }
});

test('a non-owner cannot see or approve requests', async () => {
  const worker = withAccountAccess(app, 'control');
  const response = await worker.fetch(new Request('https://control.example.com/api/control-collaborators'), { PLATFORM_OWNER_EMAIL: 'other@example.com', DB: fakeDb() }, {});
  assert.equal(response.status, 403);
});

test('approval creates an identity and server-controlled permission only after the owner acts', async () => {
  const worker = withAccountAccess(app, 'control');
  const env = { PLATFORM_OWNER_EMAIL: 'owner@example.com', DB: fakeDb(), SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' };
  const request = body => new Request('https://control.example.com/api/control-collaborators', { method: 'POST', headers: { origin: 'https://control.example.com', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await worker.fetch(request({ action: 'request', email: 'helper@example.com' }), env, {});
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (String(url).includes('/admin/users?page=')) return Response.json({ users: [] });
    if (String(url).endsWith('/invite')) return Response.json({ id: 'user-1', email: 'helper@example.com', app_metadata: { provider: 'email' } });
    return Response.json({ id: 'user-1', email: 'helper@example.com', app_metadata: { provider: 'email', fama_control_admin: true } });
  };
  try {
    const approved = await worker.fetch(request({ action: 'approve', email: 'helper@example.com' }), env, {});
    assert.equal(approved.status, 200);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].body.app_metadata.provider, 'email');
    assert.equal(calls[2].body.app_metadata.fama_control_admin, true);
    const list = await worker.fetch(new Request('https://control.example.com/api/control-collaborators'), env, {});
    assert.equal((await list.json()).requests[0].status, 'active');
  } finally { globalThis.fetch = originalFetch; }
});

test('the System add-account link opens a form and keeps the original Worker routes', async () => {
  const worker = withAccountAccess(app, 'system');
  const form = await worker.fetch(new Request('https://system.example.com/entrar?add_account=1'), {}, {});
  assert.equal(form.status, 200);
  assert.match(await form.text(), /Conectar outra conta/);
  const original = await worker.fetch(new Request('https://system.example.com/entrar'), {}, {});
  assert.equal(await original.text(), 'original');
});
