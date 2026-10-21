import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../dist/server/index.js';

const ctx = { waitUntil() {}, passThroughOnException() {} };
for (const method of ['GET', 'HEAD']) {
  test(`public CSS ${method} reaches the asset binding with security headers`, async () => {
    const calls = [];
    const response = await worker.fetch(new Request('https://fama.example.test/assets/panel.css', { method }), {
      ASSETS: { async fetch(request) {
        calls.push([new URL(request.url).pathname, request.method]);
        return new Response(method === 'HEAD' ? null : 'body{color:blue}', { headers: { 'Content-Type': 'text/css' } });
      } },
    }, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/css');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await response.text(), method === 'HEAD' ? '' : 'body{color:blue}');
    assert.deepEqual(calls, [['/assets/panel.css', method]]);
  });
}

test('a missing public asset falls through to the application router', async () => {
  let calls = 0;
  const response = await worker.fetch(new Request('https://fama.example.test/missing-asset-routing-fixture'), {
    ASSETS: { async fetch() { calls++; return new Response('fixture asset miss', { status: 404 }); } },
  }, ctx);
  assert.equal(calls, 1);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.notEqual(await response.text(), 'fixture asset miss');
});

test('asset lookup cannot bypass private API authentication', async () => {
  const response = await worker.fetch(new Request('https://fama.example.test/api/admin/health'), {
    ASSETS: { async fetch() { assert.fail('Private APIs must not use the asset binding'); } },
  }, ctx);
  assert.equal(response.status, 401);
  await response.body?.cancel();
});
