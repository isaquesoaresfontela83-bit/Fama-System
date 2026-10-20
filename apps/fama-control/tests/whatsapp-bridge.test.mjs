import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {createServer} from 'vite';
const root=new URL('..',import.meta.url).pathname,originalFetch=globalThis.fetch;
globalThis.__waBridge={FAMA_DATA_BRIDGE_SECRET:'bridge-secret-fixture',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture'};
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false},plugins:[{name:'bridge-env',enforce:'pre',resolveId(id){if(id==='cloudflare:workers')return '\0bridge-env';},load(id){if(id==='\0bridge-env')return 'export const env=globalThis.__waBridge';}}]});
const api=await vite.ssrLoadModule('/app/api/internal/data/route.js');
const userPath='/auth/v1/admin/users/11111111-1111-4111-8111-111111111111';let calls;
beforeEach(()=>{calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json({id:'11111111-1111-4111-8111-111111111111'});};});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.__waBridge;await vite.close();});
const request=(path,method='GET',token='bridge-secret-fixture')=>new Request('https://control.example.test/api/internal/data',{method:'POST',headers:{Authorization:`Bearer ${token}`,'x-fama-data-path':path,'x-fama-data-method':method}});
test('WhatsApp data and two fixed procedures are allowed without exposing arbitrary tables or RPCs',()=>{
  for(const name of ['fama_whatsapp_connections','fama_whatsapp_links','fama_whatsapp_events'])assert.equal(api.allowedDataPath(`/rest/v1/${name}?organization_id=eq.fixture`),true);
  assert.equal(api.allowedDataPath('/rest/v1/rpc/fama_whatsapp_member_access','POST'),true);assert.equal(api.allowedDataPath('/rest/v1/rpc/fama_whatsapp_claim_event','POST'),true);
  for(const path of ['/rest/v1/rpc/arbitrary_function','/auth/v1/admin/users','https://evil.test/data','//evil.test/data',userPath+'?include=all'])assert.equal(api.allowedDataPath(path),false);
});

test('internal Chat permits only its fixed tables and POST procedures and keeps credentials private',async()=>{
  for(const table of ['fama_chat_conversations','fama_chat_messages']) assert.equal(api.allowedDataPath('/rest/v1/'+table),true);
  for(const name of ['fama_chat_record_message','fama_chat_reserve_send','fama_chat_message_page','fama_chat_delivery']){
    assert.equal(api.allowedDataPath('/rest/v1/rpc/'+name,'POST'),true);
    assert.equal(api.allowedDataPath('/rest/v1/rpc/'+name,'GET'),false);
  }
  assert.equal(api.allowedDataPath('/rest/v1/rpc/arbitrary_chat_function','POST'),false);
  assert.equal((await api.POST(request('/rest/v1/fama_chat_messages','GET','wrong-token'))).status,401);
  assert.equal(calls.length,0);
});

test('database recovery is a fixed POST procedure and arbitrary recovery functions stay blocked',()=>{
  assert.equal(api.allowedDataPath('/rest/v1/rpc/fama_recovery_payload','POST'),true);
  assert.equal(api.allowedDataPath('/rest/v1/rpc/fama_recovery_payload','GET'),false);
  assert.equal(api.allowedDataPath('/rest/v1/rpc/fama_control_restore_snapshot','POST'),false);
});
test('a single Auth identity can only be read and requires the internal credential',async()=>{
  assert.equal((await api.POST(request(userPath,'GET','wrong-token'))).status,401);assert.equal(calls.length,0);
  assert.equal((await api.POST(request(userPath))).status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://fixture.supabase.co'+userPath);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.headers.get('apikey'),'sb_secret_fixture');
  for(const method of ['POST','PATCH','DELETE'])assert.equal((await api.POST(request(userPath,method))).status,400);assert.equal(calls.length,1);
});
test('Auth enumeration and forged destinations stop before fetch; provider redirects do not forward the secret',async()=>{
  assert.equal((await api.POST(request('/auth/v1/admin/users'))).status,400);assert.equal((await api.POST(request('//evil.test'+userPath))).status,400);assert.equal(calls.length,0);
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://evil.test'}});assert.equal((await api.POST(request(userPath))).status,502);
});
