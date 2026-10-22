import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { memoryCacheStorage } from './fama-ai-cache-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const originals = Object.fromEntries(['caches', 'fetch', 'window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { createLocalAiCache, inspectLocalAiInstallation, localAiModelCache, localAiAssetCache, readLocalAiEnabled, writeLocalAiEnabled, protectLocalAiStorage } = await vite.ssrLoadModule('/lib/fama-ai-storage.js');
const { localAiModels } = await vite.ssrLoadModule('/lib/fama-ai-local.js');
// Exercise the actual pinned library's match/put contract, rather than a copy.
const { getModelFile } = await vite.ssrLoadModule('/node_modules/@huggingface/transformers/src/utils/hub.js');
const { env } = await vite.ssrLoadModule('/node_modules/@huggingface/transformers/src/env.js');
const origin = 'https://fama.example.test';
const model = localAiModels.language;
const prefix = `https://huggingface.co/${model.id}/resolve/${model.revision}/`;
const files = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_q4f16.onnx', 'onnx/model_q4f16.onnx_data'];
const runtime = `${origin}/fama-ai-runtime/ort-wasm-simd-threaded.jsep.wasm`;
let storage, requests, preferences, persistenceRequests;
const download = async (url, init) => {
  requests.push({ url, init });
  if (url.endsWith('generation_config.json')) return new Response(null, { status: 404 });
  return new Response(`bytes:${url}`);
};
function activate(onlySaved = false, legacyRuntime = false) {
  const cache = createLocalAiCache(origin, download);
  cache.begin('language', onlySaved, legacyRuntime);
  env.useCustomCache = true; env.customCache = cache.modelCache;
  env.allowLocalModels = false; env.allowRemoteModels = true; env.useFSCache = false;
  globalThis.fetch = (url, init = {}) => cache.fetch(String(url), { ...init, method: 'GET' });
  env.fetch = globalThis.fetch;
  return cache;
}
async function loadModels() {
  return Promise.all(files.map(file => getModelFile(model.id, file, true, { revision: model.revision })));
}
beforeEach(() => {
  storage = memoryCacheStorage(); requests = []; preferences = new Map(); persistenceRequests = 0;
  Object.defineProperty(globalThis, 'caches', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: { localStorage: { getItem: key => preferences.get(key) ?? null, setItem: (key, value) => preferences.set(key, value) } }, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Chrome', storage: { persisted: async () => false, persist: async () => { persistenceRequests++; return true; } } }, configurable: true });
});
after(async () => {
  await vite.close();
  for (const [key, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
});

test('runtime installation consumes the download once instead of retaining a cloned unread body', async () => {
  let clones=0;let fetched=0;let original;
  const cache=createLocalAiCache(origin,async()=>{
    fetched++;let chunks=0;
    original=new Response(new ReadableStream({pull(controller){if(chunks++<32)controller.enqueue(new Uint8Array(64*1024).fill(7));else controller.close();}}));
    original.clone=()=>{clones++;throw new Error('A large runtime must not be cloned');};return original;
  });
  cache.begin('language');const response=await cache.fetch(runtime,{method:'GET'});
  assert.equal(clones,0);assert.equal(original.bodyUsed,true);
  const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes.length,32*64*1024);assert.equal(bytes[bytes.length-1],7);
  await (await cache.fetch(runtime,{method:'GET'})).arrayBuffer();assert.equal(fetched,1);
});

test('checking installed model metadata cancels unread asset streams', async () => {
  const cache=activate();await loadModels();await globalThis.fetch(runtime);assert.equal(await cache.complete(),true);
  const open=storage.open.bind(storage);let cancelled=0;let inspected=0;
  storage.open=async name=>{const cache=await open(name);const match=cache.match.bind(cache);cache.match=async url=>{
    const response=await match(url);if(!response||String(url).includes('/installed/'))return response;
    void response.body?.cancel().catch(()=>undefined);inspected++;
    return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));},cancel(){cancelled++;}}),{status:response.status});
  };return cache;};
  assert.equal((await inspectLocalAiInstallation('language',origin)).saved,true);
  assert.ok(inspected>0);assert.equal(cancelled,inspected);
});

test('closing and reopening reuses complete model, external weights and WASM with zero downloads', async () => {
  const first = activate(); const bytes = await loadModels();
  await first.fetch(runtime, { method: 'GET' });
  assert.equal(await getModelFile(model.id, 'generation_config.json', false, { revision: model.revision }), null);
  assert.equal(await first.complete(), true);
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: true });
  const count = requests.length;
  // A new worker has no loaded pipeline, but sees the same durable CacheStorage.
  const reopened = activate(true);
  assert.deepEqual(await loadModels(), bytes);
  assert.match(await (await reopened.fetch(runtime, { method: 'GET' })).text(), /bytes:/);
  assert.equal(await getModelFile(model.id, 'generation_config.json', false, { revision: model.revision }), null);
  assert.equal(await reopened.complete(), true);
  assert.equal(requests.length, count, 'restoration must not access the network');
  assert.equal(storage.stores.get(localAiModelCache).size, files.length, 'large models have one copy');
});

test('legacy model downloads stay reusable and are adopted without a second model download', async () => {
  const old = await storage.open(localAiModelCache);
  for (const file of files) await old.put(prefix + file, new Response(`old:${file}`));
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: true, legacy: true });
  const upgraded = activate(true, true);
  const bytes = await loadModels();
  assert.match(new TextDecoder().decode(bytes[0]), /old:config/);
  await upgraded.fetch(runtime, { method: 'GET' });
  assert.equal(await upgraded.complete(), true);
  assert.equal(requests.length, 1, 'only the previously unmanaged runtime needs saving');
  assert.equal(requests[0].url, runtime);
});

test('an interrupted download is never labelled installed and resumes using saved files', async () => {
  const partial = activate();
  await getModelFile(model.id, files[0], true, { revision: model.revision });
  assert.equal(await partial.complete(), false);
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: false, partial: true });
  const resumed = activate(); await loadModels(); await resumed.fetch(runtime, { method: 'GET' });
  assert.equal(await resumed.complete(), true);
  assert.equal(requests.filter(item => item.url === prefix + files[0]).length, 1);
});

test('evicted weights invalidate the marker, restoration avoids downloads and explicit repair only fills missing files', async () => {
  const first = activate(); await loadModels(); await first.fetch(runtime, { method: 'GET' });
  assert.equal(await first.complete(), true);
  await (await storage.open(localAiModelCache)).delete(prefix + files.at(-1));
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: false, partial: true });
  const count = requests.length;
  activate(true);
  await assert.rejects(() => loadModels());
  assert.equal(requests.length, count, 'no automatic redownload after cache loss');
  const repair = activate(); await loadModels(); await repair.fetch(runtime, { method: 'GET' });
  assert.equal(await repair.complete(), true);
  assert.equal(requests.length, count + 1);
  assert.equal(requests.at(-1).url, prefix + files.at(-1));
});

test('quota failures and denied storage do not produce a false installed state', async () => {
  storage.failWrites = true;
  const quota = activate(); await loadModels();
  assert.equal(await quota.complete(), false);
  assert.equal((await inspectLocalAiInstallation('language', origin)).saved, false);
  storage.deny = true;
  const denied = activate(); await loadModels();
  assert.equal(await denied.complete(), false);
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: false, unavailable: true });
});

test('a stale revision marker cannot claim that the current model is installed', async () => {
  const first = activate(); await loadModels(); await first.fetch(runtime, { method: 'GET' });
  assert.equal(await first.complete(), true);
  const meta = await storage.open(localAiAssetCache);
  const key = (await meta.keys()).find(key => key.url.includes('/installed/'));
  const manifest = await (await meta.match(key)).json(); manifest.revision = 'different-revision';
  await meta.put(key, Response.json(manifest));
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: false, partial: true });
});

test('explicit on and off preferences persist separately from models and conversations', async () => {
  assert.equal(readLocalAiEnabled(), false); writeLocalAiEnabled(true); assert.equal(readLocalAiEnabled(), true);
  writeLocalAiEnabled(false); assert.equal(readLocalAiEnabled(), false);
  assert.equal(preferences.size, 1); assert.deepEqual([...preferences.values()], ['false']);
  assert.equal(await protectLocalAiStorage(), true); assert.equal(persistenceRequests, 1);
  navigator.storage.persisted = async () => true;
  assert.equal(await protectLocalAiStorage(), true); assert.equal(persistenceRequests, 1);
  window.localStorage.getItem = window.localStorage.setItem = () => { throw new Error('disabled'); };
  assert.equal(readLocalAiEnabled(), false); assert.doesNotThrow(() => writeLocalAiEnabled(true));
  navigator.storage.persisted = async () => { throw new Error('disabled'); };
  assert.equal(await protectLocalAiStorage(), false);
});
