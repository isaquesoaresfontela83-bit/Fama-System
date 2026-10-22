import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCOUNT_MAX_AGE, ACTIVE_ACCOUNT_COOKIE, accountCookie, accountAccessCookie, readAccountSessions, saveAccountSession, forgetAccountSession, expireAccountCookie, publicAccount } from '../lib/account-sessions.js';
import { installAccountSessionGuard } from '../lib/account-switcher-client.js';

const secret = 'account-session-fixture-key-longer-than-32';
function jar() {
  const values = new Map(), options = new Map();
  return { values, options, get: name => values.has(name) ? { value: values.get(name) } : undefined, set(name, value, config) { if (config?.maxAge === 0) values.delete(name); else values.set(name, value); options.set(name, config); }, delete: name => values.delete(name) };
}
const user = id => ({ id, email: `${id}@example.test`, displayName: `Pessoa ${id}` });
const session = id => ({ access_token: `access-${id}`, refresh_token: `refresh-private-${id}`, expires_in: 3600 });

test('two encrypted HttpOnly sessions can be updated and removed independently', async () => {
  const store = jar();
  await saveAccountSession(store, secret, user('one'), session('one'));
  await saveAccountSession(store, secret, user('two'), session('two'));
  assert.equal(store.get(ACTIVE_ACCOUNT_COOKIE).value, 'two');
  const accounts = await readAccountSessions(store, secret);
  assert.deepEqual(accounts.map(item => item.id), ['one', 'two']);
  assert.deepEqual(accounts.map(publicAccount), [user('one'), user('two')]);
  for (const [name, config] of store.options) {
    assert.deepEqual({ ...config, maxAge: undefined }, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: undefined });
    if (!name.endsWith('-access')) assert.equal(config.maxAge, ACCOUNT_MAX_AGE);
  }
  assert.equal(store.get(accountCookie(0)).value.includes('refresh-private-one'), false);
  await saveAccountSession(store, secret, user('one'), { ...session('one'), refresh_token: 'rotated-one' }, { activate: false });
  assert.equal(store.get(ACTIVE_ACCOUNT_COOKIE).value, 'two', 'late refresh cannot select the previous account');
  assert.equal((await readAccountSessions(store, secret))[0].refreshToken, 'rotated-one');
  const before = [...store.values];
  await assert.rejects(saveAccountSession(store, secret, user('three'), session('three')), error => error.code === 'ACCOUNT_LIMIT');
  assert.deepEqual([...store.values], before, 'capacity errors must not change either account');
  forgetAccountSession(store, accounts[0]);
  assert.equal(store.get(accountAccessCookie(0)), undefined);
  assert.deepEqual((await readAccountSessions(store, secret)).map(item => item.id), ['two']);
});

test('tampering, moving a cookie between slots, wrong keys and expired sessions fail closed', async () => {
  const store = jar();
  await saveAccountSession(store, secret, user('one'), session('one'));
  const sealed = store.get(accountCookie(0)).value;
  assert.deepEqual(await readAccountSessions(store, 'a-different-secret-that-is-long-enough'), []);
  assert.deepEqual(await readAccountSessions(store, secret, Date.now() + ACCOUNT_MAX_AGE * 1000 + 1000), []);
  store.values.set(accountCookie(0), `${sealed.slice(0, 20)}${sealed[20] === 'A' ? 'B' : 'A'}${sealed.slice(21)}`);
  assert.deepEqual(await readAccountSessions(store, secret), []);
  store.values.delete(accountCookie(0));
  store.values.set(accountCookie(1), sealed);
  assert.deepEqual(await readAccountSessions(store, secret), [], 'encryption binds a session to its original slot');
});

test('actual framework headers expire Host-prefixed cookies with Secure and preserve the other account', async () => {
  const next = await import('../node_modules/vinext/dist/shims/headers.js');
  await next.runWithHeadersContext({ headers: new Headers(), cookies: new Map() }, async () => {
    next.setHeadersAccessPhase('route-handler');
    const store = await next.cookies();
    await saveAccountSession(store, secret, user('one'), session('one'));
    await saveAccountSession(store, secret, user('two'), session('two'), { activate: false });
    const browser = new Map();
    function apply(headers) {
      for (const header of headers) {
        const [pair, ...attributes] = header.split(';').map(part => part.trim());
        const name = pair.slice(0, pair.indexOf('='));
        if (name.startsWith('__Host-') && (!attributes.includes('Secure') || !attributes.includes('Path=/') || attributes.some(value => value.startsWith('Domain=')))) continue;
        if (attributes.includes('Max-Age=0')) browser.delete(name);
        else browser.set(name, pair.slice(pair.indexOf('=') + 1));
      }
    }
    apply(next.getAndClearPendingCookies());
    assert.ok(browser.has(accountCookie(1)));
    forgetAccountSession(store, { slot: 1 });
    expireAccountCookie(store, '__Host-fama-mfa-access');
    const expired = next.getAndClearPendingCookies();
    assert.equal(expired.length, 3);
    for (const header of expired) {
      assert.match(header, /; Secure(?:;|$)/); assert.match(header, /; Path=\/(?:;|$)/);
      assert.match(header, /; Max-Age=0(?:;|$)/); assert.doesNotMatch(header, /Domain=/);
    }
    apply(expired);
    assert.equal(browser.has(accountCookie(1)), false);
    assert.equal(browser.has(accountAccessCookie(1)), false);
    assert.ok(browser.has(accountCookie(0))); assert.equal(browser.get(ACTIVE_ACCOUNT_COOKIE), 'one');
  });
});

function browserFixture() {
  const events = new Map(), documentEvents = new Map(), requests = [], channels = [];
  const browser = {
    activeId: 'one', requests, events, documentEvents, channels,
    location: { href: 'https://fama.example/', origin: 'https://fama.example' },
    document: { visibilityState: 'visible', addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: name => documentEvents.delete(name) },
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
    async fetch(input, init = {}) { requests.push({ input, init }); return Response.json({ activeId: browser.activeId }); },
    BroadcastChannel: class { constructor() { channels.push(this); } close() { this.closed = true; } }
  };
  return browser;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('browser requests pin the rendered account without leaking it to other origins', async () => {
  const browser = browserFixture(), original = browser.fetch;
  let reloads = 0;
  const dispose = installAccountSessionGuard(browser, 'one', () => reloads++);
  await flush();
  await browser.fetch(new Request('https://fama.example/api/clients', { headers: { 'X-Organization': 'org-one' } }), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const sent = browser.requests.at(-1);
  assert.equal(sent.init.headers.get('X-Fama-Account'), 'one');
  assert.equal(sent.init.headers.get('X-Organization'), 'org-one');
  assert.equal(sent.init.headers.get('Content-Type'), 'application/json');
  assert.equal(sent.init.body, '{}');
  await browser.fetch('https://other.example/api/user');
  assert.equal(browser.requests.at(-1).init.headers, undefined);
  await browser.fetch('/assets/index.js');
  assert.equal(browser.requests.at(-1).init.headers, undefined);
  browser.events.get('storage')({ key: 'fama:account-change:v1', newValue: JSON.stringify({ userId: 'one' }) });
  assert.equal(reloads, 0);
  browser.channels[0].onmessage({ data: { userId: 'two' } });
  browser.events.get('storage')({ key: 'fama:account-change:v1', newValue: JSON.stringify({ userId: 'two' }) });
  assert.equal(reloads, 1);
  dispose();
  assert.equal(browser.fetch, original);
  assert.equal(browser.events.size, 0);
  assert.equal(browser.documentEvents.size, 0);
  assert.equal(browser.channels[0].closed, true);
});

test('focus detects a switched session when browser storage and broadcasts are unavailable', async () => {
  const browser = browserFixture();
  browser.BroadcastChannel = class { constructor() { throw new Error('disabled'); } };
  let reloads = 0;
  const dispose = installAccountSessionGuard(browser, 'one', () => reloads++);
  await flush();
  browser.activeId = 'two';
  await browser.events.get('focus')();
  assert.equal(reloads, 1);
  const check = browser.events.get('focus');
  dispose();
  await check();
  assert.equal(reloads, 1, 'an unmounted view must never trigger navigation');
});
