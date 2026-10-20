import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const names = ['window', 'document', 'navigator', 'fetch', 'BroadcastChannel', 'IS_REACT_ACT_ENVIRONMENT'];
const saved = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const events = new Map();
const add = (name, fn) => { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); };
const remove = (name, fn) => events.get(name)?.delete(fn);
globalThis.window = { addEventListener: add, removeEventListener: remove, setInterval, clearInterval };
globalThis.document = { hidden: false, addEventListener: add, removeEventListener: remove };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
globalThis.BroadcastChannel = undefined;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__famaStability = { errors: [] };
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, ssr: { noExternal: ['sonner'] }, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{
  name: 'stability-notifications', enforce: 'pre',
  resolveId(id) { if (id === '\0stability-toast' || id === 'sonner') return '\0stability-toast'; },
  load(id) { if (id === '\0stability-toast') return 'export const toast={error:message=>globalThis.__famaStability.errors.push(message)};'; },
}] });
const { requestJson, ClientRequestError } = await vite.ssrLoadModule('/lib/client-request.js');
const { useFamaAiSettings } = await vite.ssrLoadModule('/hooks/use-fama-ai-settings.js');
const { useClientMutation } = await vite.ssrLoadModule('/hooks/use-client-mutation.js');
const { defaultAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.js');
const envelope = { settings: defaultAssistantSettings, revision: 3, updatedAt: '2026-10-03T00:00:00Z' };
let renderer, api, calls;
beforeEach(() => { calls = []; globalThis.__famaStability.errors = []; });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { await vite.close(); delete globalThis.__famaStability; for (const [name, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });

test('a stalled JSON body expires even if the transport ignores cancellation', async () => {
  let signal;
  globalThis.fetch = async (_url, init) => { signal = init.signal; return { ok: true, json: () => new Promise(() => {}) }; };
  await assert.rejects(requestJson('/api/bootstrap', {}, 20), error => error instanceof ClientRequestError && error.kind === 'timeout');
  assert.equal(signal.aborted, true);
});

test('parent cancellation bounds a stalled request and a failed write is never repeated', async () => {
  globalThis.fetch = (_url, init) => { calls.push(init); return new Promise(() => {}); };
  const controller = new AbortController();
  const pending = requestJson('/api/bootstrap', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.kind === 'aborted');
  assert.equal(calls.length, 1);
  globalThis.fetch = async (_url, init) => { calls.push(init); return Response.json({ error: 'Acesso negado' }, { status: 403 }); };
  await assert.rejects(requestJson('/api/records', { method: 'POST', body: '{}' }), error => error.status === 403 && error.message === 'Acesso negado');
  assert.equal(calls.filter(init => init.method === 'POST').length, 1);
});

test('simultaneous configuration refreshes share one request and temporary failure retains the valid settings', async () => {
  let complete;
  globalThis.fetch = (url, init) => { calls.push({ url, init }); return new Promise(resolve => { complete = resolve; }); };
  function Harness() { api = useFamaAiSettings(); return null; }
  await act(async () => { renderer = Renderer.create(React.createElement(Harness)); });
  const first = api.refresh(); assert.equal(api.refresh(), first);
  await act(async () => { for (const event of ['focus', 'online', 'visibilitychange']) for (const handler of events.get(event) ?? []) handler(); });
  assert.equal(calls.length, 1);
  await act(async () => { complete(Response.json(envelope)); await first; });
  const previous = api.value;
  globalThis.fetch = async () => Response.json({ error: 'Indisponível por um instante' }, { status: 503 });
  await act(async () => { await assert.rejects(api.refresh(), error => error.status === 503); });
  assert.equal(api.value, previous); assert.match(api.error, /instante/);
  globalThis.fetch = async () => Response.json({ error: 'Entre novamente' }, { status: 401 });
  await act(async () => { await assert.rejects(api.refresh(), error => error.status === 401); });
  assert.equal(api.value, null, 'authorization failure cannot retain privileged configuration');
});

test('unmount cancels configuration requests and malformed configuration fails closed', async () => {
  let signal;
  globalThis.fetch = (_url, init) => { signal = init.signal; return new Promise(() => {}); };
  function Harness() { api = useFamaAiSettings(); return null; }
  await act(async () => { renderer = Renderer.create(React.createElement(Harness)); });
  const pending = api.refresh();
  await act(async () => renderer.unmount()); renderer = null;
  await assert.rejects(pending, error => error.kind === 'aborted'); assert.equal(signal.aborted, true);
  globalThis.fetch = async () => Response.json(null);
  await act(async () => { renderer = Renderer.create(React.createElement(Harness)); });
  assert.equal(api.value, null); assert.match(api.error, /indisponível/);
});

test('repeated write clicks cannot duplicate a pending mutation or place a late reply in another company', async () => {
  let complete;
  globalThis.fetch = (url, init) => { calls.push({ url, init }); return new Promise(resolve => { complete = resolve; }); };
  function Harness({ scope }) { api = useClientMutation(scope); return null; }
  await act(async () => { renderer = Renderer.create(React.createElement(Harness, { scope: 'company-one' })); });
  const oldWrite = api; const first = api('/api/records/one', { method: 'PATCH' });
  assert.equal(await api('/api/records/one', { method: 'PATCH' }), null); assert.equal(calls.length, 1);
  await act(async () => renderer.update(React.createElement(Harness, { scope: 'company-two' })));
  assert.equal(await first, null); assert.equal(calls[0].init.signal.aborted, true);
  complete(Response.json({ record: { id: 'old-company' } }));
  assert.equal(await oldWrite('/api/records/one', { method: 'PATCH' }), null); assert.equal(calls.length, 1);
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); throw new TypeError('Offline'); };
  assert.equal(await api('/api/records/two', { method: 'PATCH' }), null);
  assert.equal(calls.length, 2); assert.match(globalThis.__famaStability.errors[0], /Atualize os registros antes/);
});
