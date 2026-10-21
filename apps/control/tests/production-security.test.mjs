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
for await(const file of glob('app/api/**/route.js',{cwd:root})){
  const path='/'+file.replace(/^app\//,'').replace(/\/route\.js$/,'').replace(/\[id\]/g,'fixture');
  if(path==='/api/admin/integrations/google/callback'||/^\/api\/(?:auth|public)(?:\/|$)/.test(path)||path.endsWith('/webhook')||path.endsWith('/asaas-webhook')||path==='/api/privacy/public'||path==='/api/health')continue;
  const source=await readFile(new URL(file,new URL('..',import.meta.url)),'utf8');
  // The AI preferences GET is intentionally public and contains no credentials.
  const methods=[...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g)].map(match=>match[1]).filter(method=>!(path==='/api/ai-settings'&&method==='GET'));
  for(const method of methods)test(`compiled private route ${method} ${path} rejects anonymous access`,async()=>{
    const response=await worker.fetch(new Request('http://localhost'+path,{method,headers:{'x-organization-id':'org-fixture','Content-Type':'application/json'},...(['POST','PATCH','PUT'].includes(method)?{body:'{}'}:{})}),env,ctx);
    assert.equal(response.status,path==='/api/assistant/connection-test'?403:401,`${method} ${path}: ${await response.clone().text()}`);
  });
}
for(const [method,path] of [['POST','/api/records'],['PATCH','/api/records/fixture'],['DELETE','/api/records/fixture?entity=leads'],['POST','/api/warranties/fixture/schedule']])test(`compiled ${method} ${path} rejects a foreign origin before tenant authentication`,async()=>{
  const response=await worker.fetch(new Request('http://localhost'+path,{method,headers:{Origin:'https://attacker.example.test','Content-Type':'application/json','x-organization-id':'org-fixture'},...(['POST','PATCH'].includes(method)?{body:'{}'}:{})}),env,ctx);
  assert.equal(response.status,403);
});

test("public availability probe exposes only a small uncached service status",async()=>{const response=await worker.fetch(new Request("https://fama.example.test/api/health"),env,ctx);assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");const payload=await response.json();assert.deepEqual(Object.keys(payload).sort(),["checkedAt","releaseId","service","status","version"]);assert.equal(payload.status,"ok");assert.match(payload.releaseId,/^\d{4}-\d{2}-\d{2}-[a-z]+-\d+$/);});

test('anonymous OAuth callback returns only a fixed failure redirect without provider calls', async () => {
  const response = await worker.fetch(new Request('http://localhost/api/admin/integrations/google/callback?code=fixture-code&state=fixture-state'), env, ctx);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/?drive=failed#integrations');
  assert.equal(response.headers.get('cache-control'), 'private,no-store');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(await response.text(), '');
});
