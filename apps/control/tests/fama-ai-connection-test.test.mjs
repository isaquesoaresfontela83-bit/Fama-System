import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
globalThis.__connectionTestEnv = {};
globalThis.__connectionTestCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => { assert.equal(new URL(url).hostname, 'python.example.test'); globalThis.__connectionTestCalls++; return Response.json({ state: 'ready', response: 'Conexão confirmada.' }); };
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false },
  plugins: [{ name: 'connection-test-fixtures', resolveId(id) {
    if (id === 'cloudflare:workers') return '\0connection-test-env';
  }, load(id) {
    if (id === '\0connection-test-env') return 'export const env = globalThis.__connectionTestEnv;';
  } }] });
const { POST } = await vite.ssrLoadModule('/app/api/assistant/connection-test/route.js');
after(async () => { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__connectionTestEnv; delete globalThis.__connectionTestCalls; });
const post = (token, overrides = {}) => POST(new Request('https://fama.example.test/api/assistant/connection-test', {
  method: 'POST', headers: { Origin: 'https://fama.example.test', 'Content-Type': 'application/json', ...(token ? { 'x-fama-ai-test-token': token } : {}), ...overrides }, body: '{}',
}));

test('connection diagnostics deny missing, invalid, cross-origin and removed credentials before any inference, and rate limit authorized probes', async () => {
  const secret = 'a'.repeat(64);
  assert.equal((await post(secret)).status, 403);
  Object.assign(globalThis.__connectionTestEnv, { FAMA_AI_CONNECTION_TEST_SECRET: secret, FAMA_AI_PYTHON_TOKEN: 'server-token-fixture-32-characters-long', FAMA_AI_PYTHON_URL: 'https://python.example.test', FAMA_AI_GENERATIVE_ENABLED: 'true' });
  assert.equal((await post(secret)).status, 403);
  globalThis.__connectionTestEnv.FAMA_AI_CONNECTION_TEST_ENABLED = 'false';
  assert.equal((await post(secret)).status, 403);
  assert.equal(globalThis.__connectionTestCalls, 0);
  globalThis.__connectionTestEnv.FAMA_AI_CONNECTION_TEST_ENABLED = 'true';
  assert.equal((await post()).status, 403);
  assert.equal((await post('b'.repeat(64))).status, 403);
  assert.equal((await post(secret, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(secret, { 'Content-Length': '1001' })).status, 400);
  assert.equal(globalThis.__connectionTestCalls, 0);
  const response = await post(secret);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json(); assert.equal(payload.ok, true); assert.doesNotMatch(JSON.stringify(payload), /aaaaaaaa|token|secret/i);
  assert.equal((await post(secret)).status, 429); assert.equal(globalThis.__connectionTestCalls, 1);
  delete globalThis.__connectionTestEnv.FAMA_AI_CONNECTION_TEST_SECRET;
  assert.equal((await post(secret)).status, 403); assert.equal(globalThis.__connectionTestCalls, 1);
});
