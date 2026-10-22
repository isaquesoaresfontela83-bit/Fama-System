import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname, originalFetch = globalThis.fetch;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { ConsultationWorkspace } = await vite.ssrLoadModule('/app/consultation-workspace.jsx');
const { FamaSystemApp, workspaceNavigationGroupsFor } = await vite.ssrLoadModule('/app/cloriva-app.jsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let renderer, requests, upgraded;
const text = node => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const button = label => renderer.root.findAllByType('button').find(node => text(node) === label);
beforeEach(() => {
  requests = []; upgraded = 0;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init }); assert.equal(url, '/api/freight'); assert.equal(init.method ?? 'GET', 'GET');
    return Response.json({ originCep: '72505101', rateCentsPerKm: 1000, routingConfigured: true });
  };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { globalThis.fetch = originalFetch; delete globalThis.IS_REACT_ACT_ENVIRONMENT; await vite.close(); });

test('menus reflect Basic, Plus and Pro even with legacy unrestricted owner permissions', () => {
  const organization = plan => ({ id: 'org-a', name: 'Empresa', role: 'owner', permissions: [], plan, planStatus: 'active', billingEnabled: false, blockOnExpiry: false });
  const page = plan => renderToString(React.createElement(FamaSystemApp, {
    organizations: [organization(plan)],
    currentUser: { id: 'user-a', email: 'a@example.test', displayName: 'Owner', isPlatformAdmin: false }, signOutPath: '/api/auth/signout',
  }));
  const basic = page('inicial'), plus = page('intermediario'), pro = page('profissional');
  assert.doesNotMatch(basic, /<span>Financeiro<\/span>/);
  for (const html of [plus, pro]) assert.match(html, /<span>Financeiro<\/span>/);
  assert.doesNotMatch(basic, /<span>Contratos<\/span>|<span>Estoque<\/span>|<span>Chat<\/span>/);
  const items = plan => workspaceNavigationGroupsFor(organization(plan)).flatMap(group => group.items).map(item => item.id);
  for (const id of ['contracts', 'inventory', 'chat']) assert.ok(!items('inicial').includes(id));
  for (const id of ['contracts', 'inventory']) assert.ok(items('intermediario').includes(id));
  for (const html of [basic, plus]) assert.doesNotMatch(html, /<span>Fama IA<\/span>|<span>Notas fiscais<\/span>/);
  for (const plan of ['inicial', 'intermediario']) for (const id of ['assistant', 'invoices']) assert.ok(!items(plan).includes(id));
  for (const id of ['assistant', 'invoices']) assert.ok(items('profissional').includes(id));
  for (const html of [basic, plus, pro]) assert.match(html, /aria-label="Gestão" aria-expanded="false"/);
  assert.doesNotMatch(pro, /<span>Fama IA<\/span>|<span>Notas fiscais<\/span>/, 'secondary modules start collapsed');
});

test('Basic and Plus freight tabs explain the upgrade without settings or CEP provider calls', async () => {
  for (const plan of ['inicial', 'intermediario']) {
    await act(async () => { renderer = create(React.createElement(ConsultationWorkspace, { organizationId: 'org-a', plan, onUpgrade: () => upgraded++ })); });
    await act(async () => button('Frete').props.onClick());
    assert.match(text(renderer.root), /Frete automático no Pro/); assert.equal(requests.length, 0);
    assert.equal(button('Calcular frete'), undefined);
    await act(async () => button('Conhecer o Pro').props.onClick());
    await act(async () => renderer.unmount()); renderer = null;
  }
  assert.equal(upgraded, 2);
});

test('Pro keeps the two-CEP calculator; downgrading immediately removes its form', async () => {
  const props = { organizationId: 'org-a', plan: 'profissional' };
  await act(async () => { renderer = create(React.createElement(ConsultationWorkspace, props)); });
  await act(async () => button('Frete').props.onClick());
  assert.equal(requests.length, 1); assert.match(text(renderer.root), /CEP de origem/); assert.match(text(renderer.root), /CEP de destino/);
  assert.ok(button('Calcular frete'));
  await act(async () => renderer.update(React.createElement(ConsultationWorkspace, { ...props, plan: 'inicial' })));
  assert.equal(button('Calcular frete'), undefined); assert.match(text(renderer.root), /Frete automático no Pro/); assert.equal(requests.length, 1);
});
