import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withSEO,metadata,sitemap,llms,robots,structuredData} from './entry.mjs';
const inner={fetch:async()=>Response.json({ok:true})};
test('public discovery resources support GET/HEAD without invoking application',async()=>{
 const app=withSEO({fetch(){throw Error('unexpected');}},'system');
 for(const path of ['/sitemap.xml','/robots.txt','/llms.txt']){
  const r=await app.fetch(new Request('https://watersystem.online'+path));assert.equal(r.status,200);assert.ok((await r.text()).length>100);
  const head=await app.fetch(new Request('https://watersystem.online'+path,{method:'HEAD'}));assert.equal(await head.text(),'');
 }
});
test('sitemap and machine-readable summary contain only public official URLs',()=>{
 assert.equal((sitemap.match(/<loc>/g)||[]).length,4);
 for(const p of ['/api/','/entrar','/proposta/','control.famasystem'])assert.ok(!sitemap.includes(p));
 assert.match(llms,/disponibilidade de cada recurso depende/);assert.match(robots('control'),/Disallow: \//);
 assert.match(robots('system'),/Allow: \/\$/);assert.match(robots('system'),/Disallow: \//);
});
test('metadata contains canonical URL and parseable JSON-LD without invented ratings/prices',()=>{
 assert.match(metadata('/'),/<link rel="canonical" href="https:\/\/watersystem.online\/">/);
 const data=structuredData('/');assert.equal(data['@graph'].length,4);
 assert.ok(!JSON.stringify(data).includes('aggregateRating'));assert.ok(!JSON.stringify(data).includes('offers'));
});
test('API payloads and status stay intact with robots protection',async()=>{
 const r=await withSEO(inner,'system').fetch(new Request('https://watersystem.online/api/records'));
 assert.deepEqual(await r.json(),{ok:true});assert.match(r.headers.get('x-robots-tag'),/noindex/);
});
test('Control always excludes responses and preserves upstream authorization',async()=>{
 const r=await withSEO({fetch:async()=>new Response('forbidden',{status:403})},'control').fetch(new Request('https://control.watersystem.online/api/admin'));
 assert.equal(r.status,403);assert.equal(await r.text(),'forbidden');assert.match(r.headers.get('x-robots-tag'),/noindex/);
});
test('joint release health reflects SEO wrapper without losing fields',async()=>{
 const r=await withSEO(inner,'system').fetch(new Request('https://watersystem.online/api/health'));
 const data=await r.json();assert.equal(data.version,'15.23.4');assert.equal(data.ok,true);
});
// Exercise selection and response preservation without replacing the runtime parser.
class RewriterProbe {
 static calls=[];
 on(selector,handler){RewriterProbe.calls.push({selector,handler});return this;}
 transform(response){return response;}
}
test('only anonymous exact public pages receive public metadata; private/error/query pages stay noindex',async()=>{
 const previous=globalThis.HTMLRewriter;globalThis.HTMLRewriter=RewriterProbe;
 try {
  const app=withSEO({fetch:async()=>new Response('<html><head></head></html>',{headers:{'content-type':'text/html','content-security-policy':"default-src 'self'",'set-cookie':'test=1'}})},'system');
  for(const [path,headers,index] of [['/',{},true],['/?x=1',{},false],['/',{cookie:'fama_session=test'},false],['/entrar',{},false],['/private',{},false]]){
   RewriterProbe.calls=[];const r=await app.fetch(new Request('https://watersystem.online'+path,{headers}));
   assert.equal(r.headers.get('x-robots-tag'),index?'index, follow':'noindex, nofollow, noarchive');
   assert.equal(r.headers.get('content-security-policy'),"default-src 'self'");assert.equal(r.headers.get('set-cookie'),'test=1');
   let added='';const h=RewriterProbe.calls.find(c=>c.selector==='head');h.handler.element({append(s){added=s;}});
   assert.equal(added.includes('rel="canonical"'),index);
  }
  const error=withSEO({fetch:async()=>new Response('error',{status:404,headers:{'content-type':'text/html'}})},'system');
  const r=await error.fetch(new Request('https://watersystem.online/manual'));assert.equal(r.status,404);assert.match(r.headers.get('x-robots-tag'),/noindex/);
 } finally {globalThis.HTMLRewriter=previous;}
});
