import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { memoryCacheStorage } from './fama-ai-cache-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const originalCaches = globalThis.caches;
const originalFetch = globalThis.fetch;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { installLocalAiFiles } = await vite.ssrLoadModule('/lib/fama-ai-downloads.js');
const { createLocalAiCache, inspectLocalAiInstallation, localAiModelCache } = await vite.ssrLoadModule('/lib/fama-ai-storage.js');
const { localAiModels } = await vite.ssrLoadModule('/lib/fama-ai-local.js');
const { getModelFile } = await vite.ssrLoadModule('/node_modules/@huggingface/transformers/src/utils/hub.js');
const { env } = await vite.ssrLoadModule('/node_modules/@huggingface/transformers/src/env.js');
const origin = 'https://fama.example.test';
let requests, unavailable;
const download = async (url, init) => {
  requests.push({ url, init });
  if (url.endsWith('generation_config.json')) return new Response(null, { status: 404 });
  if (url.endsWith(unavailable || 'never-match')) throw new Error('Connection interrupted');
  if (url.endsWith('config.json')) return Response.json({ 'transformers.js_config': { use_external_data_format: { 'model_q4f16.onnx': 2 } } });
  const bytes = new TextEncoder().encode(`asset:${url}`);
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes.subarray(0, 5)); controller.enqueue(bytes.subarray(5)); controller.close(); } }), { headers: { 'Content-Length': String(bytes.length) } });
};
beforeEach(() => { globalThis.caches = memoryCacheStorage(); requests = []; unavailable = ''; });
after(async () => { await vite.close(); globalThis.fetch = originalFetch; if (originalCaches === undefined) delete globalThis.caches; else globalThis.caches = originalCaches; });

test('background installation streams every weight chunk and the real model loader reopens it without downloading', async () => {
  const progress = [];
  await installLocalAiFiles('language', origin, createLocalAiCache(origin, download), (file, percent) => progress.push({ file, percent }));
  assert.deepEqual(await inspectLocalAiInstallation('language', origin), { saved: true });
  assert.equal(requests.some(item => item.url.endsWith('model_q4f16.onnx_data_1')), true);
  assert.ok(progress.some(item => item.percent === 100));
  assert.ok(requests.every(item => item.init.credentials === 'omit' && item.init.referrerPolicy === 'no-referrer' && !item.init.body));
  const count = requests.length;
  const restored = createLocalAiCache(origin, download); restored.begin('language', true);
  env.useCustomCache = true; env.customCache = restored.modelCache; env.useFSCache = false; env.allowLocalModels = false; env.allowRemoteModels = true;
  globalThis.fetch = (url, init = {}) => restored.fetch(String(url), { ...init, method: 'GET' });
  const model = localAiModels.language;
  for (const file of ['onnx/model_q4f16.onnx', 'onnx/model_q4f16.onnx_data', 'onnx/model_q4f16.onnx_data_1']) {
    const bytes = await getModelFile(model.id, file, true, { revision: model.revision }); assert.match(new TextDecoder().decode(bytes), /asset:/);
  }
  await installLocalAiFiles('language', origin, createLocalAiCache(origin, download), () => {});
  assert.equal(requests.length, count, 'another app opening reuses model files, optional 404 and runtime');
});

test('an interrupted installation resumes only missing files and publishes no incomplete installation', async () => {
  unavailable = 'decoder_model_merged_quantized.onnx';
  await assert.rejects(() => installLocalAiFiles('speech', origin, createLocalAiCache(origin, download), () => {}), /Connection interrupted/);
  assert.equal((await inspectLocalAiInstallation('speech', origin)).saved, false);
  unavailable = '';
  await installLocalAiFiles('speech', origin, createLocalAiCache(origin, download), () => {});
  assert.equal((await inspectLocalAiInstallation('speech', origin)).saved, true);
  assert.equal(requests.filter(item => item.url.endsWith('/onnx/encoder_model_quantized.onnx')).length, 1);
  const model = localAiModels.speech;
  await (await caches.open(localAiModelCache)).delete(`https://huggingface.co/${model.id}/resolve/${model.revision}/onnx/decoder_model_merged_quantized.onnx`);
  const count = requests.length;
  await installLocalAiFiles('speech', origin, createLocalAiCache(origin, download), () => {});
  assert.equal(requests.length, count + 1, 'eviction triggers only the missing weight download');
});

test('denied storage fails before downloading any large model', async () => {
  caches.failWrites = true;
  await assert.rejects(() => installLocalAiFiles('speech', origin, createLocalAiCache(origin, download), () => {}), /não conseguiu salvar/);
  assert.equal(requests.length, 0);
});
