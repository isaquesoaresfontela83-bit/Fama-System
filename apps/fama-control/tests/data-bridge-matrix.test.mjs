import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname,'system-auth');
const bridge=await f.load('/app/api/internal/data/route.js');
let calls, responseStatus;
beforeEach(()=>{
  f.reset();Object.assign(f.runtime,{FAMA_DATA_BRIDGE_SECRET:'fixture-bridge-secret'});calls=[];responseStatus=200;
  globalThis.fetch=async(input,init)=>{const url=new URL(input);assert.equal(url.origin,'https://operation.fixture.test');calls.push({url,init});return Response.json({fixture:true},{status:responseStatus,headers:{Location:'https://attacker.example.test'}});};
});
after(f.close);
const request=(path,method='GET',options={})=>new Request('https://control.example.test/api/internal/data',{method:'POST',headers:{Authorization:'Bearer fixture-bridge-secret','x-fama-data-path':path,'x-fama-data-method':method,...options.headers},...(options.body!==undefined?{body:options.body,duplex:'half'}:{})});
const rejected=[
  '/rest/v1/arbitrary_table','/rest/v1/rpc/arbitrary_function','/rest/v1/rpc/fama_save_block_rule','/auth/v1/admin/users','/auth/v1/admin/users/11111111-1111-4111-8111-111111111111?include=all',
  'https://attacker.example.test/rest/v1/leads','//attacker.example.test/rest/v1/leads','/rest/v1/leads#secret','/rest/v1/../v1/leads','/rest/v1/./leads',
  '/storage/v1/object/other-bucket/one.pdf','/storage/v1/object/fama-documents/../secret.pdf','/storage/v1/object/fama-documents/%2e%2e/secret.pdf','/storage/v1/object/fama-documents/org%2Fother/one.pdf','/storage/v1/object/fama-documents/org%5Cother/one.pdf','/storage/v1/object/fama-documents/%252e%252e/secret.pdf','/storage/v1/object/fama-documents/file%00.pdf','/storage/v1/object/fama-documents/file%0a.pdf','/storage/v1/object/fama-documents/file%zz.pdf',
];
for(const path of rejected)test(`bridge rejects destination ${path} before forwarding credentials`,async()=>{
  assert.equal((await bridge.POST(request(path))).status,400);assert.equal(calls.length,0);
});
for(const name of ['fama_consume_rate_limit','schedule_warranty','fama_whatsapp_member_access','fama_whatsapp_claim_event','fama_get_block_rules']) for(const method of ['GET','PATCH','DELETE'])test(`RPC ${name} rejects ${method}`,async()=>{
  assert.equal((await bridge.POST(request(`/rest/v1/rpc/${name}`,method))).status,400);assert.equal(calls.length,0);
});
for(const method of ['PUT','OPTIONS','HEAD','TRACE','get'])test(`bridge rejects unsupported method ${method}`,async()=>{
  assert.equal((await bridge.POST(request('/rest/v1/leads',method))).status,400);assert.equal(calls.length,0);
});
for(const method of ['GET','POST','PATCH','DELETE'])test(`allowed table ${method} forwards only backend credentials and controlled headers`,async()=>{
  const response=await bridge.POST(request('/rest/v1/leads?organization_id=eq.fixture',method,{headers:{Cookie:'must-not-forward=1','x-organization-id':'forged',Prefer:'return=representation','Content-Type':'application/json'},body:method==='GET'?undefined:'{}'}));
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(calls.length,1);
  const {init}=calls[0];assert.equal(init.method,method);assert.equal(init.redirect,'manual');assert.equal(init.headers.get('apikey'),'sb_secret_fixture');assert.equal(init.headers.has('cookie'),false);assert.equal(init.headers.has('x-organization-id'),false);assert.equal(init.headers.has('authorization'),false);assert.equal(init.headers.get('prefer'),'return=representation');
});
for(const status of [301,302,307,308])test(`provider redirect ${status} stops without following the destination`,async()=>{
  responseStatus=status;assert.equal((await bridge.POST(request('/rest/v1/leads'))).status,502);assert.equal(calls.length,1);assert.equal(calls[0].init.redirect,'manual');
});
test('chunked oversized bridge payload is stopped while streaming',async()=>{
  let emitted=0,cancelled=false;
  const body=new ReadableStream({pull(controller){emitted++;controller.enqueue(new Uint8Array(1024*1024));if(emitted===30)controller.close();},cancel(){cancelled=true;}});
  assert.equal((await bridge.POST(request('/rest/v1/leads','POST',{body}))).status,413);assert.equal(calls.length,0);assert.ok(emitted<30);assert.equal(cancelled,true);
});
test('missing or incorrect internal credential cannot consume the request body',async()=>{
  for(const Authorization of ['','Bearer wrong','Basic fixture-bridge-secret'])assert.equal((await bridge.POST(request('/rest/v1/leads','POST',{headers:{Authorization},body:'{}'}))).status,401);
  assert.equal(calls.length,0);
});
test('a network timeout or provider failure returns a controlled unavailable response',async()=>{
  globalThis.fetch=async()=>{throw new DOMException('Timed out','TimeoutError');};const response=await bridge.POST(request('/rest/v1/leads'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/sb_secret_fixture/);
});


test('internal chat allows its server-only RPC and read-only recipient checks',()=>{
 assert.equal(bridge.allowedDataPath('/rest/v1/rpc/fama_internal_chat','POST'),true);
 assert.equal(bridge.allowedDataPath('/rest/v1/rpc/fama_internal_chat','GET'),false);
 for(const table of ['fama_internal_threads','fama_internal_participants']){
  assert.equal(bridge.allowedDataPath('/rest/v1/'+table,'GET'),true);
  assert.equal(bridge.allowedDataPath('/rest/v1/'+table,'POST'),false);
  assert.equal(bridge.allowedDataPath('/rest/v1/'+table,'PATCH'),false);
 }
 assert.equal(bridge.allowedDataPath('/rest/v1/fama_internal_messages','GET'),false);
});
