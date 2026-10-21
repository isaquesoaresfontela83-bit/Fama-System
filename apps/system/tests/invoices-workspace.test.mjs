import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname, originalFetch = globalThis.fetch;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { FinanceWorkspace } = await vite.ssrLoadModule('/app/finance-workspace.jsx');
const { workspaceNavigationGroupsFor } = await vite.ssrLoadModule('/app/cloriva-app.jsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let renderer, requests, invoices, configured;
const invoice = { id: 'nf-a', type: 'nfse', status: 'emitida', customerName: 'Cliente fiscal A', customerDocument: '12345678901', customerEmail: '', serviceDescription: 'Manutenção da piscina', city: 'Brasília', amountCents: 35000, issueDate: '2026-10-04', officialNumber: '123', accessKey: 'VALIDACAO', xmlUrl: 'https://documents.example.test/nf.xml', pdfUrl: 'https://documents.example.test/nf.pdf', provider: 'asaas', providerReference: 'inv-a', notes: '', createdAt: '2026-10-04' };
beforeEach(() => {
  requests = []; invoices = [invoice]; configured = 0;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init }); assert.equal(url, '/api/finance'); assert.equal(init.method ?? 'GET', 'GET');
    return Response.json({ fiscalInvoices: invoices, fiscalSettings: { provider: 'asaas', apiEnabled: true }, suppliers: [], purchases: [], bankAccounts: [], bankMovements: [] });
  };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { globalThis.fetch = originalFetch; delete globalThis.IS_REACT_ACT_ENVIRONMENT; await vite.close(); });
const nodeText = node => node.children.map(child => typeof child === 'string' ? child : nodeText(child)).join('');
const button = label => renderer.root.findAllByType('button').find(node => nodeText(node).includes(label));
async function mount() {
  await act(async () => { renderer = create(React.createElement(FinanceWorkspace, { organizationId: 'org-a', transactions: [], tab: 'notas', fiscalOnly: true, invoicesEnabled: true, onTabChange() {}, onStatus() {}, onOpenEntry() {}, onReconciled() {}, onPurchasePayable() {}, onFiscalSettings: () => configured++ })); });
}

test('the dedicated invoice workspace loads fiscal records without banking calls or finance tabs', async () => {
  await mount(); assert.equal(requests.length, 1); assert.equal(new Headers(requests[0].init.headers).get('x-organization-id'), 'org-a');
  assert.equal(renderer.root.findAllByProps({ role: 'tablist' }).length, 0);
  const content = JSON.stringify(renderer.toJSON()); assert.match(content, /Cliente fiscal A/); assert.match(content, /Asaas/); assert.match(content, /NF 123/);
  const urls = renderer.root.findAllByType('a').map(node => node.props.href);
  assert.ok(urls.includes(invoice.pdfUrl)); assert.ok(urls.includes(invoice.xmlUrl));
  await act(async () => button('Configurar emissão').props.onClick()); assert.equal(configured, 1);
});

test('refreshing invoices retains organization scope and does not submit an invoice', async () => {
  await mount(); invoices = [{ ...invoice, id: 'nf-b', customerName: 'Cliente atualizado' }];
  await act(async () => button('Atualizar notas').props.onClick());
  assert.equal(requests.length, 2); assert.ok(requests.every(request => new Headers(request.init.headers).get('x-organization-id') === 'org-a'));
  assert.match(JSON.stringify(renderer.toJSON()), /Cliente atualizado/);
  await act(async () => button('Preparar nota fiscal').props.onClick());
  assert.equal(renderer.root.findAllByType('form').length, 1); assert.equal(requests.length, 2);
});
test('service drafts use Asaas while product invoices keep their authorized portal path', async () => {
  invoices = [{ ...invoice, id: 'draft-service', status: 'rascunho', provider: '', providerReference: '' }, { ...invoice, id: 'draft-product', type: 'nfe', status: 'rascunho', provider: '', providerReference: '' }];
  await mount(); const rows = renderer.root.findAllByType('tr');
  const service = rows.find(row => nodeText(row).includes('NFS-e'));
  const product = rows.find(row => nodeText(row).includes('NF-e'));
  assert.match(nodeText(service), /Enviar pela Asaas/); assert.doesNotMatch(nodeText(service), /Emitir no portal/);
  assert.match(nodeText(product), /Emitir no portal/); assert.doesNotMatch(nodeText(product), /Enviar pela Asaas/);
  assert.equal(requests.length, 1);
});

test('the Gestão submenu offers invoices only on Pro with finance permission', () => {
  const organization = { id: 'org-a', name: 'Empresa A', slug: 'a', role: 'member', permissions: ['finance'], moduleAccess: ['finance'], plan: 'inicial', planStatus: 'active', billingEnabled: false, blockOnExpiry: false };
  const offersInvoices = org => workspaceNavigationGroupsFor(org).find(group => group.id === 'management')?.items.some(item => item.id === 'invoices') ?? false;
  assert.equal(offersInvoices(organization), false);
  assert.equal(offersInvoices({ ...organization, plan: 'intermediario' }), false);
  assert.equal(offersInvoices({ ...organization, plan: 'profissional' }), true);
  assert.equal(offersInvoices({ ...organization, plan: 'profissional', role: 'owner', moduleAccess: ['agenda'] }), false);
  assert.equal(offersInvoices({ ...organization, plan: 'profissional', permissions: [], moduleAccess: undefined }), false);
});


test('historical intermediary invoices keep PDF and XML links without provider controls', async () => {
  invoices = [{ ...invoice, provider: 'notaas', customerName: 'Cliente histórico' }];
  await mount();
  const urls = renderer.root.findAllByType('a').map(node => node.props.href);
  assert.ok(urls.includes(invoice.pdfUrl)); assert.ok(urls.includes(invoice.xmlUrl));
  assert.equal(button('Atualizar status'), undefined); assert.equal(button('Solicitar cancelamento'), undefined);
  assert.equal(button('Enviar pela Notaas'), undefined); assert.equal(requests.length, 1);
});
