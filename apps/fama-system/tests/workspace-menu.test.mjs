import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

const previous = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { WorkspaceNavigationMenu } = await vite.ssrLoadModule('/app/workspace-navigation-menu.jsx');
const { workspaceNavigationGroupsFor } = await vite.ssrLoadModule('/app/cloriva-app.jsx');
const { SidebarProvider } = await vite.ssrLoadModule('/components/ui/sidebar.jsx');
const owner = { role: 'owner', permissions: [], plan: 'profissional' };
let renderer, navigations;
beforeEach(() => {
  navigations = [];
  globalThis.window = { innerWidth: 1200, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  globalThis.document = { cookie: '', addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { await vite.close(); for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
const button = label => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === label);
const menu = section => React.createElement(SidebarProvider, null, React.createElement(WorkspaceNavigationMenu, { section, groups: workspaceNavigationGroupsFor(owner), onNavigate: value => navigations.push(value) }));

test('six main entries stay visible while folders expand one at a time and keep navigation working', async () => {
  await act(async () => { renderer = create(menu('dashboard')); });
  for (const label of ['Início', 'Agenda', 'Clientes', 'Orçamentos', 'Serviços', 'Financeiro']) assert.ok(button(label));
  for (const label of ['Gestão', 'Ferramentas', 'Configurações e ajuda']) assert.equal(button(label).props['aria-expanded'], false);
  assert.equal(button('Notas fiscais'), undefined);
  await act(async () => button('Gestão').props.onClick());
  assert.equal(button('Gestão').props['aria-expanded'], true); assert.ok(button('Notas fiscais'));
  await act(async () => button('Ferramentas').props.onClick());
  assert.equal(button('Gestão').props['aria-expanded'], false); assert.equal(button('Notas fiscais'), undefined); assert.ok(button('Fama IA'));
  await act(async () => button('Fama IA').props.onClick()); assert.deepEqual(navigations, ['assistant']);
  await act(async () => button('Ferramentas').props.onClick()); assert.equal(button('Fama IA'), undefined);
});

test('the active module opens its folder and company access filters forbidden modules', async () => {
  await act(async () => { renderer = create(menu('invoices')); });
  assert.equal(button('Gestão').props['aria-expanded'], true); assert.equal(button('Notas fiscais').props['aria-current'], 'page');
  await act(async () => renderer.update(menu('settings')));
  assert.equal(button('Gestão').props['aria-expanded'], false); assert.equal(button('Configurações e ajuda').props['aria-expanded'], true);
  const limited = workspaceNavigationGroupsFor({ ...owner, role: 'member', permissions: ['agenda'], moduleAccess: ['agenda'] }).flatMap(group => group.items).map(item => item.id);
  for (const id of ['invoices', 'finance', 'settings', 'members', 'billing']) assert.ok(!limited.includes(id));
  assert.ok(limited.includes('agenda')); assert.ok(limited.includes('support'));
});
