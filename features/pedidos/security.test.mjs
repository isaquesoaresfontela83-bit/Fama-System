import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './test-support.mjs';
import { handleOrders } from './api.mjs';

test('malformed product entries are validation errors, without writes', async () => {
  const f = await fixture();
  for (const item of [null, 42, [], 'pool']) {
    const r = await f.request('/api/pedidos', 'POST', f.input({items:[item]}));
    assert.equal(r.status, 400);
  }
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM sales_orders').get().n, 0);
});

test('object and array values cannot become customer or seller names', async () => {
  const f = await fixture();
  for (const field of ['seller', 'address']) {
    for (const value of [{forged:true}, ['forged']]) {
      const r = await f.request('/api/pedidos', 'POST', f.input({[field]:value}));
      assert.equal(r.status, 400);
    }
  }
});

test('JSON lookalike media types are rejected before a write', async () => {
  const f = await fixture();
  const r = await handleOrders(f.app, new Request('https://example.test/api/pedidos', {
    method:'POST', headers:{cookie:'owner',origin:'https://example.test','x-organization-id':'org-a','content-type':'application/json-seq'},
    body:JSON.stringify(f.input()),
  }), f.env, {}, 'system');
  assert.equal(r.status, 415);
});

test('truncated image signatures are rejected', async () => {
  const f = await fixture(), order = await f.create();
  for (const [type, bytes] of [['image/jpeg',[255,216,60,62]], ['image/png',[137,80,78,71]]]) {
    const r = await f.request(`/api/pedidos/${order.id}/attachments`, 'POST', {
      revision:order.revision, name:'forged', type, data:btoa(String.fromCharCode(...bytes)),
    });
    assert.equal(r.status, 400);
  }
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM sales_order_attachments').get().n, 0);
});

test('session refresh reaches later authorization checks and the browser', async () => {
  const f = await fixture(), original = f.app.fetch;
  f.app.fetch = async request => {
    const path = new URL(request.url).pathname;
    if (path !== '/api/auth/session' && !request.headers.get('cookie')?.includes('session=fresh')) {
      return Response.json({error:'Session needs refresh'}, {status:401});
    }
    const headers = new Headers(request.headers); headers.set('cookie','owner');
    const response = await original(new Request(request, {headers}));
    if (path === '/api/auth/session') response.headers.append('set-cookie','session=fresh; Path=/; HttpOnly; Secure; SameSite=Lax');
    return response;
  };
  const result = await f.request('/api/pedidos', 'GET', undefined, 'session=old');
  assert.equal(result.status,200);
  assert.match(result.response.headers.get('set-cookie'),/session=fresh/);
});
