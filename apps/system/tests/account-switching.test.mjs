import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const values = new Map();
const fixture = globalThis.__accountSwitchFixture = {
  runtime: { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', FAMA_SESSION_SECRET: 'account-switch-fixture-secret-longer-than-32' },
  headers: new Headers(),
  cookies: { get: name => values.has(name) ? { value: values.get(name) } : undefined, set: (name, value, options) => options?.maxAge === 0 ? values.delete(name) : values.set(name, value), delete: name => values.delete(name) }
};
const originalFetch = globalThis.fetch;
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, ssr: { noExternal: ['next'] }, server: { hmr: false, middlewareMode: true, ws: false }, plugins: [{
  name: 'account-switch-fixtures', enforce: 'pre',
  resolveId(id) {
    if (id === 'cloudflare:workers') return '\0account-env';
    if (id === 'next/headers') return '\0account-cookies';
    if (/\/lib\/security(?:\.js)?$/.test(id)) return '\0account-security';
    if (/\/lib\/firebase-push(?:\.js)?$/.test(id)) return '\0account-push';
  },
  load(id) {
    if (id === '\0account-env') return 'export const env=globalThis.__accountSwitchFixture.runtime;';
    if (id === '\0account-cookies') return 'export async function cookies(){return globalThis.__accountSwitchFixture.cookies;} export async function headers(){return globalThis.__accountSwitchFixture.headers;}';
    if (id === '\0account-security') return 'export async function logAudit(){} export async function assertRateLimit(){}';
    if (id === '\0account-push') return 'export async function removePushDevice(){} export function deviceCookie(){return "fixture-device";}';
  }
}] });
const auth = await vite.ssrLoadModule('/app/system-auth.js');
const vault = await vite.ssrLoadModule('/lib/account-sessions.js');
const accounts = await vite.ssrLoadModule('/app/api/auth/accounts/route.js');
const login = await vite.ssrLoadModule('/app/api/auth/login/route.js');
const mfa = await vite.ssrLoadModule('/app/api/auth/mfa-login/route.js');
const logout = await vite.ssrLoadModule('/app/api/auth/logout/route.js');
const { requireUser } = await vite.ssrLoadModule('/lib/tenant.js');
let users, tokens, refreshes, sequence, requests, refreshFailure;
const jwt = (id, aal) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: id, aal, session_id: `fixture-${++sequence}` })).toString('base64url')}.fixture`;
function issue(id, aal = 'aal1') {
  const access = jwt(id, aal), refresh = `private-refresh-${id}-${sequence}`;
  tokens.set(access, id); refreshes.set(refresh, { id, aal });
  return { access_token: access, refresh_token: refresh, expires_in: 3600, user: users.get(id) };
}
const request = (path, body, origin = 'https://fama.example') => new Request(`https://fama.example${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const signIn = id => login.POST(request('/api/auth/login', { email: `${id}@example.test`, password: 'fixture-password' }));
const accountAction = (action, accountId, origin) => accounts.POST(request('/api/auth/accounts', { action, accountId }, origin));
async function connected() { return (await vault.readAccountSessions(fixture.cookies, fixture.runtime.FAMA_SESSION_SECRET)).map(item => item.id); }

beforeEach(() => {
  values.clear(); fixture.headers = new Headers(); sequence = 0; requests = []; refreshFailure = null;
  users = new Map(['one', 'two', 'three'].map(id => [id, { id, email: `${id}@example.test`, user_metadata: { full_name: `Pessoa ${id}`, role: 'owner' }, factors: [] }]));
  tokens = new Map(); refreshes = new Map();
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)), body = init.body ? JSON.parse(init.body) : {};
    assert.equal(url.origin, 'https://fixture.supabase.co');
    requests.push({ url, init, body });
    const token = new Headers(init.headers).get('authorization')?.replace(/^Bearer /, '');
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const id = body.email.split('@')[0];
      return body.password === 'fixture-password' && users.has(id) ? Response.json(issue(id)) : Response.json({ message: 'Invalid credentials' }, { status: 400 });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      if (refreshFailure) return Response.json({ message: 'Refresh unavailable' }, { status: refreshFailure });
      const previous = refreshes.get(body.refresh_token);
      if (!previous) return Response.json({ message: 'Invalid refresh token' }, { status: 400 });
      refreshes.delete(body.refresh_token);
      return Response.json(issue(previous.id, previous.aal));
    }
    const id = tokens.get(token);
    if (!id) return Response.json({ message: 'Invalid access token' }, { status: 401 });
    if (url.pathname === '/auth/v1/user') return Response.json(users.get(id));
    if (url.pathname.endsWith('/challenge')) return Response.json({ id: 'challenge-fixture' });
    if (url.pathname.endsWith('/verify')) return body.code === '123456' ? Response.json(issue(id, 'aal2')) : Response.json({ message: 'Código inválido' }, { status: 400 });
    if (url.pathname === '/auth/v1/logout') { assert.equal(url.searchParams.get('scope'), 'local'); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected provider path: ${url.pathname}`);
  };
});
after(async () => { globalThis.fetch = originalFetch; delete globalThis.__accountSwitchFixture; await vite.close(); });

test('sign in to two accounts, switch both ways and expose only public account details', async () => {
  assert.equal((await signIn('one')).status, 200);
  assert.equal((await auth.getFamaUser()).id, 'one');
  assert.equal((await signIn('two')).status, 200);
  assert.equal((await auth.getFamaUser()).id, 'two');
  const response = await accounts.GET(), listing = await response.json();
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(listing.limit, 2); assert.equal(listing.enabled, true); assert.equal(listing.activeId, 'two');
  assert.deepEqual(listing.accounts.map(item => Object.keys(item)), [['id', 'email', 'displayName'], ['id', 'email', 'displayName']]);
  assert.equal(JSON.stringify(listing).includes('refresh'), false); assert.equal(JSON.stringify(listing).includes('owner'), false);
  for (const id of ['one', 'two', 'one']) {
    const switched = await accountAction('switch', id);
    assert.equal(switched.status, 200); assert.equal((await switched.json()).activeId, id);
    assert.equal((await requireUser()).id, id);
    assert.deepEqual(await connected(), ['one', 'two']);
  }
});

test('a wrong second password and a third account never replace the existing sessions', async () => {
  await signIn('one');
  const wrong = await login.POST(request('/api/auth/login', { email: 'two@example.test', password: 'wrong' }));
  assert.equal(wrong.status, 401); assert.equal((await auth.getFamaUser()).id, 'one');
  assert.deepEqual(await connected(), ['one']);
  await signIn('two');
  const before = requests.filter(item => item.url.searchParams.get('grant_type') === 'password').length;
  assert.equal((await signIn('three')).status, 409);
  assert.equal(requests.filter(item => item.url.searchParams.get('grant_type') === 'password').length, before);
  assert.equal((await auth.getFamaUser()).id, 'two');
  assert.deepEqual(await connected(), ['one', 'two']);
  assert.equal((await signIn('one')).status, 200, 'signing in again updates the existing slot');
  assert.deepEqual(await connected(), ['one', 'two']);
});

test('stale tabs cannot read or mutate through the newly selected account identity', async () => {
  await signIn('one'); await signIn('two');
  fixture.headers.set('X-Fama-Account', 'one');
  assert.equal(await auth.getFamaUser(), null);
  assert.equal(await auth.getSupabaseAccessToken(), '');
  await assert.rejects(requireUser(), error => error.status === 401);
  fixture.headers.set('X-Fama-Account', 'two');
  assert.equal((await requireUser()).id, 'two');
  assert.ok(await auth.getSupabaseAccessToken());
});

test('refresh rotation and a late refresh update only the correct slot, while another account stays selected', async () => {
  await signIn('one'); await signIn('two');
  const selected = values.get(vault.ACTIVE_ACCOUNT_COOKIE);
  const oldTwo = (await vault.readAccountSessions(fixture.cookies, fixture.runtime.FAMA_SESSION_SECRET)).find(item => item.id === 'two');
  values.delete(vault.accountAccessCookie(oldTwo.slot));
  assert.equal((await auth.getFamaUser()).id, 'two');
  const updated = (await vault.readAccountSessions(fixture.cookies, fixture.runtime.FAMA_SESSION_SECRET)).find(item => item.id === 'two');
  assert.notEqual(updated.refreshToken, oldTwo.refreshToken);
  await auth.setSupabaseSession(issue('one'), false, { activate: false, preservePending: true });
  assert.equal(values.get(vault.ACTIVE_ACCOUNT_COOKIE), selected);
  assert.equal((await auth.getFamaUser()).id, 'two');
});

test('an outage preserves both accounts; an expired inactive session removes only that account', async () => {
  await signIn('one'); await signIn('two');
  const inactive = (await vault.readAccountSessions(fixture.cookies, fixture.runtime.FAMA_SESSION_SECRET)).find(item => item.id === 'one');
  values.delete(vault.accountAccessCookie(inactive.slot));
  refreshFailure = 503;
  assert.equal((await accountAction('switch', 'one')).status, 503);
  assert.deepEqual(await connected(), ['one', 'two']);
  assert.equal((await auth.getFamaUser()).id, 'two');
  refreshFailure = 400;
  const response = await accountAction('switch', 'one');
  assert.equal(response.status, 401); assert.equal((await response.json()).code, 'ACCOUNT_SESSION_EXPIRED');
  assert.deepEqual(await connected(), ['two']); assert.equal((await auth.getFamaUser()).id, 'two');
});

test('switching an already valid account does not consume or rotate its refresh token', async () => {
  await signIn('one'); await signIn('two');
  const before = await vault.readAccountSessions(fixture.cookies, fixture.runtime.FAMA_SESSION_SECRET);
  refreshFailure = 400;
  assert.equal((await accountAction('switch', 'one')).status, 200);
  assert.equal((await auth.getFamaUser()).id, 'one');
  assert.equal(requests.some(item => item.url.searchParams.get('grant_type') === 'refresh_token'), false);
  const after = await vault.readAccountSessions(fixture.cookies, fixture.runtime.FAMA_SESSION_SECRET);
  assert.deepEqual(after.map(item => item.refreshToken), before.map(item => item.refreshToken));
});

test('a provider-confirmed revoked account is removed without affecting the current account', async () => {
  await signIn('one'); await signIn('two');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const token = new Headers(init.headers).get('authorization')?.replace(/^Bearer /, '');
    if (new URL(input).pathname === '/auth/v1/user' && tokens.get(token) === 'one')
      return Response.json({ code: 'session_not_found', message: 'Session not found' }, { status: 403 });
    return previousFetch(input, init);
  };
  const response = await accountAction('switch', 'one');
  assert.equal(response.status, 401); assert.equal((await response.json()).code, 'ACCOUNT_SESSION_EXPIRED');
  assert.deepEqual(await connected(), ['two']); assert.equal((await auth.getFamaUser()).id, 'two');
});

test('MFA on the second account never activates it until a valid verification is complete', async () => {
  users.get('two').factors = [{ id: 'factor-fixture', factor_type: 'totp', status: 'verified' }];
  await signIn('one');
  const signingIn = await signIn('two');
  assert.equal((await signingIn.json()).requiresMfa, true);
  assert.equal((await auth.getFamaUser()).id, 'one'); assert.deepEqual(await connected(), ['one']);
  const verify = code => mfa.POST(request('/api/auth/mfa-login', { action: 'verify', factorId: 'factor-fixture', challengeId: 'challenge-fixture', code }));
  assert.equal((await verify('000000')).status, 400);
  assert.equal((await auth.getFamaUser()).id, 'one');
  assert.equal((await verify('123456')).status, 200);
  assert.equal((await auth.getFamaUser()).id, 'two'); assert.deepEqual(await connected(), ['one', 'two']);
  assert.equal(await auth.getSupabaseAccessToken(true), '', 'pending credentials are cleared after confirmation');
});

test('MFA enabled after remembering an account is enforced when switching back', async () => {
  await signIn('one'); await signIn('two');
  users.get('one').factors = [{ id: 'factor-fixture', factor_type: 'totp', status: 'verified' }];
  const response = await accountAction('switch', 'one');
  assert.equal(response.status, 200); assert.equal((await response.json()).requiresMfa, true);
  assert.equal((await auth.getFamaUser()).id, 'two');
  values.set(vault.ACTIVE_ACCOUNT_COOKIE, 'one');
  assert.equal(await auth.getFamaUser(), null, 'even changing the untrusted pointer cannot bypass MFA');
  assert.equal(await auth.getSupabaseAccessToken(), '');
});

test('remove, local logout and logout all preserve or clear precisely the selected sessions', async () => {
  await signIn('one'); await signIn('two');
  assert.equal((await accountAction('remove', 'one')).status, 200);
  assert.deepEqual(await connected(), ['two']); assert.equal((await auth.getFamaUser()).id, 'two');
  await signIn('one');
  assert.equal((await logout.GET(new Request('https://fama.example/api/auth/logout'))).status, 303);
  assert.equal(await auth.getFamaUser(), null); assert.deepEqual(await connected(), ['two']);
  await accountAction('switch', 'two'); await signIn('one');
  assert.equal((await accountAction('logout_all')).status, 200);
  assert.deepEqual(await connected(), []); assert.equal(values.size, 0);
  assert.ok(requests.some(item => item.url.pathname === '/auth/v1/logout'));
});

test('old browser sessions are preserved during migration, and unknown or cross-origin switches are denied', async () => {
  const legacy = issue('one');
  values.set('__Host-fama-access', legacy.access_token); values.set('__Host-fama-refresh', legacy.refresh_token);
  assert.equal((await signIn('two')).status, 200);
  assert.deepEqual(await connected(), ['one', 'two']);
  assert.equal(values.has('__Host-fama-refresh'), false);
  assert.equal((await accountAction('switch', 'three')).status, 404);
  assert.equal((await accountAction('switch', 'one', 'https://other.example')).status, 403);
  assert.equal((await auth.getFamaUser()).id, 'two');
});
