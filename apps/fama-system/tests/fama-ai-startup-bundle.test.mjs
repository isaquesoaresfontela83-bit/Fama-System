import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('an old open tab gets the current worker instead of a missing previous release hash', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  const bundle = await readFile(new URL('../dist/client/fama-ai-runtime/fama-local-ai.worker.js', import.meta.url), 'utf8');
  const requests = [];
  const assets = { fetch: async request => {
    const path = new URL(request.url).pathname; requests.push(path);
    return path === '/fama-ai-runtime/fama-local-ai.worker.js' ? new Response(bundle, { headers: { 'Content-Type': 'text/javascript' } }) : new Response('Missing', { status: 404 });
  } };
  const response = await worker.fetch(new Request('https://fama.example.test/assets/fama-local-ai.worker-oldRelease.js'), { ASSETS: assets }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /javascript/);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.match(response.headers.get('content-security-policy'), /worker-src 'self'/);
  assert.equal(await response.text(), bundle);
  assert.deepEqual(requests, ['/assets/fama-local-ai.worker-oldRelease.js', '/fama-ai-runtime/fama-local-ai.worker.js']);
});

test('a current worker asset is served directly without replacing it', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  const requests = [];
  const response = await worker.fetch(new Request('https://fama.example.test/assets/fama-local-ai.worker-current.js'), { ASSETS: { fetch: async request => { requests.push(request.url); return new Response('current', { headers: { 'Content-Type': 'text/javascript' } }); } } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(await response.text(), 'current'); assert.equal(requests.length, 1);
});

test('the real bundled mobile worker installs voice and refuses the large model without WebGPU or inference', () => {
  const bundle = fileURLToPath(new URL('../dist/client/fama-ai-runtime/fama-local-ai.worker.js', import.meta.url));
  const fixture = new URL('./fama-ai-cache-fixture.mjs', import.meta.url).href;
  const script = `
    import vm from 'node:vm';
    import { readFile } from 'node:fs/promises';
    import { memoryCacheStorage } from ${JSON.stringify(fixture)};
    const messages = []; const downloads = [];
    const sandbox = { URL, Request, Response, Headers, Blob, TextEncoder, TextDecoder, AbortController, ReadableStream, TransformStream, setTimeout, clearTimeout, console, caches: memoryCacheStorage(), location: { origin: 'https://fama.example.test' }, navigator: { userAgent: 'Android 12 SM-G970F Mobile', deviceMemory: 4 }, postMessage: message => messages.push(message), fetch: async (url, init) => { downloads.push({ url, init }); return url.endsWith('generation_config.json') ? new Response(null, { status: 404 }) : Response.json({}); } };
    sandbox.self = sandbox;
    const context = vm.createContext(sandbox);
    const module = new vm.SourceTextModule(await readFile(process.argv[1], 'utf8'), { context, initializeImportMeta(meta) { meta.url = 'https://fama.example.test/fama-ai-runtime/fama-local-ai.worker.js'; } });
    await module.link(() => { throw new Error('Unexpected static import'); }); await module.evaluate();
    if (typeof sandbox.onmessage !== 'function') throw new Error('Worker failed to start');
    await sandbox.onmessage({ data: { id: 1, kind: 'speech', operation: 'install' } });
    const reply = messages.at(-1);
    if (reply?.type !== 'done' || !reply.saved) throw new Error(JSON.stringify(reply));
    if (!downloads.length || downloads.some(item => item.init.credentials !== 'omit')) throw new Error('Invalid downloads');
    const count = downloads.length;
    await sandbox.onmessage({ data: { id: 2, kind: 'speech', operation: 'install' } });
    if (downloads.length !== count) throw new Error('Repeated downloads');
    for (const operation of ['install', 'load', 'generate']) {
      await sandbox.onmessage({ data: { id: 3, kind: 'language', operation, messages: [{ role: 'user', content: 'Agenda' }] } });
      if (messages.at(-1)?.type !== 'error' || !messages.at(-1).message.includes('Modo leve')) throw new Error('Mobile guard failed');
    }
    if (downloads.length !== count) throw new Error('A mobile large model request triggered a download');
    console.log(JSON.stringify({ saved: reply.saved, downloads: count, noWebGPU: !sandbox.navigator.gpu }));
  `;
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', script, bundle], { encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { saved: true, downloads: 9, noWebGPU: true });
});
