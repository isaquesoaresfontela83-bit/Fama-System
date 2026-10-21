import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { glob, readFile } from 'node:fs/promises';
const root=new URL('..',import.meta.url).pathname;
const bundle=new URL('../dist/server/index.js',import.meta.url);bundle.searchParams.set('test',`security-${process.pid}`);
const {default:worker}=await import(bundle.href);
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error('Production route test attempted a network request');};
after(()=>{globalThis.fetch=originalFetch;});
const env={ASSETS:{fetch:async()=>new Response('Not found',{status:404})}};
const ctx={waitUntil(){},passThroughOnException(){}};
for(const method of ['GET','POST','PATCH'])test(`compiled freight ${method} requires tenant authentication`,async()=>{
  const response=await worker.fetch(new Request('http://localhost/api/freight',{method,headers:{'Content-Type':'application/json'},...(method!=='GET'?{body:JSON.stringify({originCep:'72505-101',rateCentsPerKm:1000,destinationCep:'01311-000'})}:{})}),env,ctx);
  assert.equal(response.status,401);
});
test('production headers allow the real map and device geolocation without delegating GPS to other origins',async()=>{
  const response=await worker.fetch(new Request('http://localhost/api/records',{method:'POST',headers:{Origin:'https://attacker.example.test','Content-Type':'application/json'},body:'{}'}),env,ctx);
  assert.equal(response.status,403);
  assert.equal(response.headers.get('permissions-policy'),'camera=(self), microphone=(self), geolocation=(self), payment=()');
  const directives=new Map(response.headers.get('content-security-policy').split(';').map(value=>value.trim().split(/\s+/)).map(([name,...values])=>[name,values]));
  assert.deepEqual(directives.get('frame-src'),["'self'",'https://www.openstreetmap.org','https://accounts.google.com','https://embed.waze.com']);
  assert.deepEqual(directives.get('frame-ancestors'),["'none'"]);
  assert.equal(response.headers.get('x-frame-options'),'DENY');
});
for await(const file of glob('app/api/**/route.js',{cwd:root})){
  const path='/'+file.replace(/^app\//,'').replace(/\/route\.js$/,'').replace(/\[id\]/g,'fixture');
  if(/^\/api\/(?:auth|public)(?:\/|$)/.test(path)||path.endsWith('/webhook')||path.endsWith('/asaas-webhook')||path==='/api/privacy/public'||path==='/api/health')continue;
  const source=await readFile(new URL(file,new URL('..',import.meta.url)),'utf8');
  // The AI preferences GET is intentionally public and contains no credentials.
  const methods=[...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g)].map(match=>match[1]).filter(method=>!(path==='/api/ai-settings'&&method==='GET'));
  for(const method of methods)test(`compiled private route ${method} ${path} rejects anonymous access`,async()=>{
    const response=await worker.fetch(new Request('http://localhost'+path,{method,headers:{'x-organization-id':'org-fixture','Content-Type':'application/json'},...(['POST','PATCH','PUT'].includes(method)?{body:'{}'}:{})}),env,ctx);
    // Owner-only connection checks intentionally return 403 before tenant selection.
    assert.equal(response.status,path==='/api/assistant/connection-test'?403:401,`${method} ${path}: ${await response.clone().text()}`);
  });
}
for(const [method,path] of [['POST','/api/records'],['PATCH','/api/records/fixture'],['DELETE','/api/records/fixture?entity=leads'],['POST','/api/warranties/fixture/schedule']])test(`compiled ${method} ${path} rejects a foreign origin before tenant authentication`,async()=>{
  const response=await worker.fetch(new Request('http://localhost'+path,{method,headers:{Origin:'https://attacker.example.test','Content-Type':'application/json','x-organization-id':'org-fixture'},...(['POST','PATCH'].includes(method)?{body:'{}'}:{})}),env,ctx);
  assert.equal(response.status,403);
});

test('reader refresh clears only cache and reopens a fresh document without deleting login or records',async()=>{
 const response=await worker.fetch(new Request('https://www.famasystem.online/atualizar-leitor'),env,ctx);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('clear-site-data'),'"cache"');
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(response.headers.get('set-cookie'),null);
 const html=await response.text();
 assert.match(html,/window\.location\.replace\("\/\?leitor=camera-foto&atualizacao=/);
 assert.match(html,/registration\.unregister\(\)/);
 assert.doesNotMatch(html,/localStorage\.clear|sessionStorage\.clear|indexedDB\.deleteDatabase/);
});

test("public availability probe exposes only a small uncached service status",async()=>{const response=await worker.fetch(new Request("https://fama.example.test/api/health"),env,ctx);assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");const payload=await response.json();assert.deepEqual(Object.keys(payload).sort(),["checkedAt","releaseId","service","status","version"]);assert.equal(payload.status,"ok");assert.ok(Number.isFinite(Date.parse(payload.checkedAt)));});
