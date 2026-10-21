import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

test('the released runtime fits the hosting limit and preserves the real WASM bytes', async () => {
  const root = new URL('../dist/', import.meta.url);
  const paths = await readdir(root, { recursive: true });
  for (const path of paths) {
    const url = new URL(path, root);
    const info = await stat(url);
    if (info.isFile()) assert.ok(info.size <= 25 * 1024 * 1024, path + ' exceeds the hosting limit');
  }
  const name = 'ort-wasm-simd-threaded.asyncify.wasm';
  const encoded = await readFile(new URL('../dist/client/fama-ai-runtime/' + name + '.gz', import.meta.url));
  const original = await readFile(new URL('../node_modules/onnxruntime-web/dist/' + name, import.meta.url));
  assert.deepEqual(gunzipSync(encoded), original);
});

test('the published Worker serves the decoded WASM bytes through the hosting proxy', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  const body = await readFile(new URL('../dist/client/fama-ai-runtime/ort-wasm-simd-threaded.asyncify.wasm.gz', import.meta.url));
  const requests = [];
  const response = await worker.fetch(new Request('https://fama.example.test/fama-ai-runtime/ort-wasm-simd-threaded.asyncify.wasm'), {
    ASSETS: { fetch: async request => { requests.push(new URL(request.url).pathname); return new Response(body, { headers: { 'Content-Type': 'application/gzip' } }); } },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/wasm');
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('content-length'), null);
  const decoded = Buffer.from(await response.arrayBuffer());
  assert.equal(decoded.length, 26861777);
  assert.deepEqual(decoded.subarray(0, 4), Buffer.from([0, 97, 115, 109]));
  assert.deepEqual(requests, ['/fama-ai-runtime/ort-wasm-simd-threaded.asyncify.wasm.gz']);
});
