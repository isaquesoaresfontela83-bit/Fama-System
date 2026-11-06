import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withLiquidGlass,CSS_PATH,VERSION,RELEASE} from './entry.mjs';

test('styles bypass application only for GET/HEAD; HEAD has no body',async()=>{
 let calls=0;const wrapped=withLiquidGlass({fetch(){calls++;return new Response('original',{status:405});}},'body{}');
 const get=await wrapped.fetch(new Request('https://f.test'+CSS_PATH));assert.equal(await get.text(),'body{}');assert.match(get.headers.get('cache-control'),/immutable/);
 const head=await wrapped.fetch(new Request('https://f.test'+CSS_PATH,{method:'HEAD'}));assert.equal(await head.text(),'');assert.equal(calls,0);
 const post=await wrapped.fetch(new Request('https://f.test'+CSS_PATH,{method:'POST'}));assert.equal(post.status,405);assert.equal(calls,1);
});
test('health retains diagnostics and release fields match both apps',async()=>{
 const wrapped=withLiquidGlass({fetch:()=>Response.json({ok:true,version:'15.21.0',checks:{database:'ok'}},{headers:{'x-diagnostic':'kept'}})},'');
 const r=await wrapped.fetch(new Request('https://f.test/api/health'));const j=await r.json();assert.equal(j.version,VERSION);assert.equal(j.releaseId,RELEASE);assert.equal(j.glassBaselineVersion,'15.21.0');assert.equal(j.checks.database,'ok');assert.equal(r.headers.get('x-diagnostic'),'kept');
});
test('auth, redirects, API errors, cookies and other handlers remain unchanged',async()=>{
 const original=new Response('denied',{status:401,headers:{'set-cookie':'session=; HttpOnly','content-type':'application/json'}});
 const scheduled=()=>{};const wrapped=withLiquidGlass({fetch:()=>original,scheduled},'');
 assert.equal(await wrapped.fetch(new Request('https://f.test/api/private')),original);assert.equal(wrapped.scheduled,scheduled);
});
test('HTML streams through rewriter and retains security headers',async()=>{
 const operations=[];
 globalThis.HTMLRewriter=class {on(selector,handler){operations.push(selector);handler.element({append(html){if(selector==='head'){assert.match(html,/data-fama-glass-style/);assert.ok(html.includes(CSS_PATH));}else assert.match(html,/type="module"/);}});return this;}transform(r){return r;}};
 const wrapped=withLiquidGlass({fetch:()=>new Response('<html><head></head><body>unchanged</body></html>',{headers:{'content-type':'text/html','content-security-policy':"default-src 'self'",'set-cookie':'session=existing; HttpOnly','etag':'old'}})},'');
 const r=await wrapped.fetch(new Request('https://f.test/'));assert.deepEqual(operations,['head','body']);assert.equal(r.headers.get('etag'),null);assert.equal(r.headers.get('content-security-policy'),"default-src 'self'");assert.match(r.headers.get('set-cookie'),/existing/);assert.match(await r.text(),/unchanged/);
});
test('dock modules are immutable assets with empty HEAD and no POST interception',async()=>{
 let calls=0;const wrapped=withLiquidGlass({fetch(){calls++;return new Response('original',{status:401});}},'',{'/assets/dock.mjs':'export default true;'});
 const r=await wrapped.fetch(new Request('https://f.test/assets/dock.mjs'));assert.match(r.headers.get('content-type'),/javascript/);assert.match(r.headers.get('cache-control'),/immutable/);assert.equal(await r.text(),'export default true;');
 const head=await wrapped.fetch(new Request('https://f.test/assets/dock.mjs',{method:'HEAD'}));assert.equal(await head.text(),'');
 assert.equal((await wrapped.fetch(new Request('https://f.test/assets/dock.mjs',{method:'POST'}))).status,401);assert.equal(calls,1);
});
