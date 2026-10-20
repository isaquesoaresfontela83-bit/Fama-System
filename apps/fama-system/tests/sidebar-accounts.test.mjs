import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import React, { act } from 'react';
import { create } from 'react-test-renderer';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const original = { fetch: globalThis.fetch, window: globalThis.window, FormData: globalThis.FormData, BroadcastChannel: globalThis.BroadcastChannel, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{
  name: 'sidebar-account-dialog-fixture', enforce: 'pre',
  resolveId(id) { if (/components\/ui\/sheet(?:\.jsx)?$/.test(id)) return '\0sidebar-sheet'; },
  load(id) {
    if (id === '\0sidebar-sheet') return `import React from 'react';
      export function Sheet({open,children}) { return open ? React.createElement('div',{'data-dialog':'accounts'},children) : null; }
      export function SheetContent({children,...props}) { return React.createElement('div',props,children); }
      export function SheetHeader({children}) { return React.createElement('header',null,children); }
      export function SheetTitle({children}) { return React.createElement('h2',null,children); }
      export function SheetDescription({children}) { return React.createElement('p',null,children); }`;
  }
}] });
const { AccountSwitcher } = await vite.ssrLoadModule('/app/account-switcher.jsx');
const one = { id: 'one', email: 'one@example.test', displayName: 'Pessoa um' };
const two = { id: 'two', email: 'two@example.test', displayName: 'Pessoa dois' };
let listing, calls, navigations, signals, switching;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  listing = { enabled: true, limit: 2, activeId: 'one', accounts: [one, two] };
  calls = []; navigations = []; signals = [];
  switching = () => Response.json({ activeId: 'two' });
  globalThis.window = { location: { replace: path => navigations.push(path) }, localStorage: { setItem: (key, value) => signals.push({ key, value }) } };
  globalThis.BroadcastChannel = class { postMessage() {} close() {} };
  globalThis.FormData = class { constructor(form) { this.values = form.values; } get(name) { return this.values[name]; } };
  globalThis.fetch = async (path, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, method: init.method || 'GET', body });
    if (path === '/api/auth/accounts') return body ? switching(body) : Response.json(listing);
    if (path === '/api/auth/mfa-login') return Response.json(body.action === 'challenge' ? { challengeId: 'challenge-fixture' } : { authenticated: true });
    throw new Error(`Unexpected path: ${path}`);
  };
});
after(async () => { await vite.close(); Object.assign(globalThis, { fetch: original.fetch, window: original.window, FormData: original.FormData, BroadcastChannel: original.BroadcastChannel, IS_REACT_ACT_ENVIRONMENT: original.act }); });

async function mount() {
  let view;
  await act(async () => { view = create(React.createElement(AccountSwitcher, { sidebar: true, currentUser: one, companyName: 'Fama piscinas', roleLabel: 'Administrador', signOutPath: '/api/auth/logout' })); });
  return view;
}
const rows = view => view.root.findAllByProps({ className: 'sidebar-account-choice' });
const text = view => JSON.stringify(view.toJSON());

test('both connected identities appear directly in the sidebar, with one active account', async () => {
  const view = await mount();
  try {
    assert.equal(rows(view).length, 2);
    assert.match(text(view), /Fama piscinas/); assert.match(text(view), /one@example.test/);
    assert.match(text(view), /Pessoa dois/); assert.match(text(view), /two@example.test/);
    assert.match(text(view), /Em uso · Administrador/);
    assert.equal(rows(view)[0].props['aria-current'], 'true');
    assert.equal(rows(view)[0].props.disabled, true);
    assert.equal(rows(view)[1].props.disabled, false);
    assert.equal(view.root.findAllByProps({ className: 'sidebar-account-add' }).length, 0);
    assert.equal(view.root.findAllByProps({ 'data-dialog': 'accounts' }).length, 0, 'the accounts stay visible while the management dialog is closed');
    await act(async () => { await rows(view)[1].props.onClick(); });
    assert.deepEqual(calls.find(item => item.method === 'POST').body, { action: 'switch', accountId: 'two' });
    assert.deepEqual(navigations, ['/']);
    assert.equal(JSON.parse(signals[0].value).userId, 'two');
  } finally { await act(async () => view.unmount()); }
});

test('a single session offers adding another account without inventing a connected identity', async () => {
  listing.accounts = [one];
  const view = await mount();
  try {
    assert.equal(rows(view).length, 1);
    const add = view.root.findByProps({ className: 'sidebar-account-add' });
    assert.equal(add.props.href, '/entrar?add_account=1');
    assert.match(text(view), /Adicionar outra conta/);
    assert.doesNotMatch(text(view), /two@example.test/);
  } finally { await act(async () => view.unmount()); }
});

test('an unavailable account list preserves the active identity and can be retried', async () => {
  const workingFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('Falha de conexão'); };
  const view = await mount();
  try {
    assert.equal(rows(view).length, 1); assert.match(text(view), /one@example.test/);
    assert.match(text(view), /Falha de conexão/); assert.deepEqual(navigations, []);
    globalThis.fetch = workingFetch;
    const retry = view.root.findAllByType('button').find(button => button.props.children === 'Tentar novamente');
    await act(async () => retry.props.onClick());
    assert.equal(rows(view).length, 2);
    assert.doesNotMatch(text(view), /Falha de conexão/);
  } finally { await act(async () => view.unmount()); }
});

test('switching from the sidebar opens MFA and waits for verification before changing accounts', async () => {
  switching = () => Response.json({ requiresMfa: true, factorId: 'factor-fixture' });
  const view = await mount();
  try {
    await act(async () => rows(view)[1].props.onClick());
    assert.match(text(view), /Confirme esta conta/);
    assert.equal(rows(view)[0].props['aria-current'], 'true');
    assert.deepEqual(navigations, []); assert.deepEqual(signals, []);
    const form = view.root.findByType('form');
    await act(async () => form.props.onSubmit({ preventDefault() {}, currentTarget: { values: { code: '123456' } } }));
    assert.deepEqual(calls.find(item => item.body?.action === 'verify').body, { action: 'verify', factorId: 'factor-fixture', challengeId: 'challenge-fixture', code: '123456' });
    assert.deepEqual(navigations, ['/']);
    assert.equal(JSON.parse(signals[0].value).userId, 'two');
  } finally { await act(async () => view.unmount()); }
});

test('an expired second session offers reauthentication and keeps the current account selected', async () => {
  switching = () => Response.json({ code: 'ACCOUNT_SESSION_EXPIRED', error: 'A sessão desta conta expirou.' }, { status: 401 });
  const view = await mount();
  try {
    await act(async () => rows(view)[1].props.onClick());
    assert.match(text(view), /A sessão desta conta expirou/);
    assert.equal(rows(view)[0].props['aria-current'], 'true');
    assert.deepEqual(navigations, []);
    const reauthenticate = view.root.findAllByType('a').find(link => link.props.children === 'Entrar novamente');
    assert.equal(reauthenticate.props.href, '/entrar?add_account=1&reconnect=1&email=two%40example.test');
    const disconnected = view.root.findByProps({ 'aria-label': 'Reconectar two@example.test' });
    assert.equal(disconnected.type, 'a'); assert.equal(disconnected.props['data-expired'], true);
    assert.match(text(view), /1 de 2/);
  } finally { await act(async () => view.unmount()); }
});
