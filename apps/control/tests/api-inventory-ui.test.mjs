import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { apiCatalog } from '../lib/api-catalog.js';
const original = globalThis.fetch; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = new URL('../', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { ControlApis } = await vite.ssrLoadModule('/app/control-apis.jsx');
let renderer, calls, navigate, payload;
const label = node => (node.children || []).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : label(child)).join(' ');
beforeEach(() => {
    calls = []; navigate = [];
    payload = { apis: apiCatalog.map(item => ({ ...item, status: item.id === 'ocrspace' ? 'unconfigured' : 'configured', instances: item.scopes.map(scope => ({ scope, status: item.id === 'ocrspace' ? 'unconfigured' : 'configured', detail: 'Configuração cadastrada; não testada.', checkedAt: null })) })), checkedAt: '2026-10-21T12:00:00Z', release: { control: { version: '15.5.1' }, system: { version: '15.5.1' }, synchronized: true } };
    globalThis.fetch = async (url, init = {}) => {
        assert.equal(url, '/api/admin/apis'); calls.push({ url, init });
        if (init.method === 'POST') { const input = JSON.parse(init.body); return Response.json({ ...input, observation: { status: 'verified', detail: 'Consulta confirmada.', checkedAt: '2026-10-21T12:02:00Z' } }); }
        return Response.json(payload);
    };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { globalThis.fetch = original; delete globalThis.IS_REACT_ACT_ENVIRONMENT; await vite.close(); });
async function open() { await act(async () => { renderer = Renderer.create(React.createElement(ControlApis, { onNavigate: value => navigate.push(value) })); }); }
test('all APIs load through one local read and management stays inside the Control', async () => {
    await open(); assert.equal(renderer.root.findAllByType('article').length, apiCatalog.length); assert.equal(calls.length, 1); assert.ok(!calls[0].init.method); assert.equal(renderer.root.findAllByType('a').length, 0);
    assert.match(label(renderer.root), /Gerenciar APIs/); assert.match(label(renderer.root), /Configurada · não testada/); const article = renderer.root.findByProps({ 'data-api-id': 'drive' });
    await act(async () => article.findAllByType('button').find(node => label(node).includes('Configurar integração')).props.onClick()); assert.deepEqual(navigate, ['integrations']); assert.equal(calls.length, 1);
});
test('search, area and status filters compose and provide an empty state', async () => {
    await open(); await act(async () => renderer.root.findByProps({ 'aria-label': 'Buscar API' }).props.onChange({ target: { value: 'assinaturas' } })); assert.equal(renderer.root.findAllByType('article').length, 1); assert.match(label(renderer.root.findByType('article')), /Asaas/);
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Filtrar por área' }).props.onChange({ target: { value: 'Clima' } })); assert.equal(renderer.root.findAllByType('article').length, 0); assert.match(label(renderer.root), /Nenhuma API/);
    await act(async () => { renderer.root.findByProps({ 'aria-label': 'Buscar API' }).props.onChange({ target: { value: '' } }); renderer.root.findByProps({ 'aria-label': 'Filtrar por área' }).props.onChange({ target: { value: 'all' } }); renderer.root.findByProps({ 'aria-label': 'Filtrar por status' }).props.onChange({ target: { value: 'attention' } }); }); assert.equal(renderer.root.findAllByType('article').length, 1); assert.equal(renderer.root.findByType('article').props['data-api-id'], 'ocrspace');
});
test('a diagnostic runs only after clicking and updates only the requested scope', async () => {
    await open(); assert.ok(calls.every(call => !call.init.method));
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Testar Cloudflare D1 no Fama Control' }).props.onClick());
    const request = calls.find(call => call.init.method === 'POST'); assert.deepEqual(JSON.parse(request.init.body), { id: 'cloudflare-d1', scope: 'control' });
    const card = renderer.root.findByProps({ 'data-api-id': 'cloudflare-d1' }); assert.match(label(card), /Conexão verificada/); assert.match(label(card), /Configurada · não testada/); assert.match(label(card), /Resposta conferida em/);
});
