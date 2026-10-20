import assert from 'node:assert/strict';
import test from 'node:test';
test('the production Worker routes reject unsigned webhooks and anonymous configuration access',async()=>{
  const url=new URL('../dist/server/index.js',import.meta.url);url.searchParams.set('test',`whatsapp-${process.pid}`);const {default:worker}=await import(url.href);
  const env={ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},ctx={waitUntil(){},passThroughOnException(){}};
  const hook=await worker.fetch(new Request('http://localhost/api/whatsapp/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({object:'whatsapp_business_account',entry:[]})}),env,ctx);
  assert.equal(hook.status,401);assert.match(hook.headers.get('cache-control'),/no-store/);
  const settings=await worker.fetch(new Request('http://localhost/api/whatsapp/assistant',{headers:{'x-organization-id':'org-fixture'}}),env,ctx);assert.equal(settings.status,401);
});
