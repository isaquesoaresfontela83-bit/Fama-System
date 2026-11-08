import test from 'node:test';
import assert from 'node:assert/strict';
import {withOrders} from './entry.mjs';
import {VERSION} from './model.mjs';

test('HTML rewriting preserves status, cookies and security headers while removing stale validators',async()=>{
  const selectors=[];
  globalThis.HTMLRewriter=class {
    on(selector,handler){selectors.push(selector);handler.element({append(value){assert(value.includes(VERSION));}});return this;}
    transform(response){return response;}
  };
  const app={fetch:()=>new Response('<html>fixture</html>',{status:201,headers:{'content-type':'text/html','content-security-policy':"default-src 'self'",'set-cookie':'fixture=1; HttpOnly','etag':'old','content-length':'20'}})};
  const r=await withOrders(app,{},'system').fetch(new Request('https://fixture.test/'),{},{});
  assert.equal(r.status,201);assert.equal(r.headers.get('etag'),null);assert.equal(r.headers.get('content-length'),null);
  assert.equal(r.headers.get('content-security-policy'),"default-src 'self'");assert.match(r.headers.get('set-cookie'),/fixture=1/);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(selectors,['head','body']);
  delete globalThis.HTMLRewriter;
});
test('resource lookups ignore prototypes and HEAD responses have no body',async()=>{
  const resources=Object.create({'/inherited':{type:'text/html',body:'forged'}});resources['/known']={type:'text/plain',body:'fixture'};
  const wrapped=withOrders({fetch:()=>new Response('base',{status:404})},resources,'system');
  const head=await wrapped.fetch(new Request('https://fixture.test/known',{method:'HEAD'}));assert.equal(await head.text(),'');
  assert.equal((await wrapped.fetch(new Request('https://fixture.test/inherited'))).status,404);
  assert.equal((await wrapped.fetch(new Request('https://fixture.test/known',{method:'POST'}))).status,404);
});
