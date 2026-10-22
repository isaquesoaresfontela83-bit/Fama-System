import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { chatFixture } from './fama-chat-fixture.mjs';
const root = new URL('..', import.meta.url).pathname;
const originalFetch = globalThis.fetch;
globalThis.__waRuntime = { DATA_BACKEND:'supabase',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',FAMA_DATA_ENCRYPTION_KEY:'a'.repeat(64) };
const vite = await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false},plugins:[{name:'whatsapp-fixtures',enforce:'pre',resolveId(id){if(id==='cloudflare:workers')return '\0wa-env';if(id.endsWith('/app/system-auth')||id.endsWith('/app/system-auth.js'))return '\0wa-auth';},load(id){if(id==='\0wa-env')return 'export const env=globalThis.__waRuntime';if(id==='\0wa-auth')return 'export async function getFamaUser(){return globalThis.__waUser}';}}]});
const settingsAPI=await vite.ssrLoadModule('/app/api/whatsapp/assistant/route.js');
const webhook=await vite.ssrLoadModule('/app/api/whatsapp/webhook/route.js');
const manual=await vite.ssrLoadModule('/app/api/whatsapp/route.js');
const chat=await vite.ssrLoadModule('/app/api/whatsapp/chat/route.js');
const {encryptText,decryptText}=await vite.ssrLoadModule('/lib/crypto.js');
const {sha256}=await vite.ssrLoadModule('/lib/security.js');
const {defaultAssistantSettings}=await vite.ssrLoadModule('/lib/fama-ai-settings.js');
const {limitedWhatsappBody,whatsappPhone,whatsappPhoneInput,whatsappChatUrl}=await vite.ssrLoadModule('/lib/fama-whatsapp.js');
const {whatsappGraph}=await vite.ssrLoadModule('/lib/fama-whatsapp-transport.js');
const userId='11111111-1111-4111-8111-111111111111',connectionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sender='5511999999999',secret='b'.repeat(32),providerToken='fixture-meta-access-token-1234567890';
let state;
function selected(rows,url){return rows.filter(row=>[...url.searchParams].every(([key,value])=>['select','order','limit'].includes(key)||value==='is.null'&&row[key]==null||value===`eq.${String(row[key])}`)).slice(0,Number(url.searchParams.get('limit')||1000));}
beforeEach(async()=>{
  globalThis.__waUser={id:userId,email:'owner@fixture.test',displayName:'Owner'};
  state={platform_settings:[],calls:[],messages:[],fama_chat_conversations:[],fama_chat_messages:[],providerReads:0,rate:true,preferences:true,settings:structuredClone(defaultAssistantSettings),sendFails:false,onData:null,banned:false,deleted:false,
    organizations:[{id:'org-a',name:'Empresa A',slug:'a',status:'active',plan:'profissional',plan_status:'active',plan_expires_at:'2030-01-01'},{id:'org-b',name:'Empresa B',slug:'b',status:'active',plan:'profissional',plan_status:'active',plan_expires_at:'2030-01-01'}],
    organization_members:[{id:'member-a',organization_id:'org-a',user_id:userId,user_email:'owner@fixture.test',display_name:'Owner',role:'owner',status:'active',permissions:['finance','agenda','crm','team']},{id:'member-b',organization_id:'org-b',user_id:'22222222-2222-4222-8222-222222222222',user_email:'b@fixture.test',display_name:'Other',role:'owner',status:'active',permissions:[]}],
    fama_whatsapp_connections:[{id:connectionId,organization_id:'org-a',phone_number_id:'11111',display_phone:'+5511000000000',token_ciphertext:await encryptText(providerToken),app_secret_ciphertext:await encryptText(secret),verify_token_ciphertext:await encryptText('verify-fixture'),assistant_enabled:true,verified_at:new Date().toISOString(),webhook_verified_at:new Date().toISOString()}],
    fama_whatsapp_links:[{id:'link-a',organization_id:'org-a',member_id:'member-a',phone_hash:await sha256(`org-a:${sender}`),phone_ciphertext:await encryptText(sender),active:true,context_ciphertext:''}],fama_whatsapp_events:[],
    transactions:[{id:'finance-a',organization_id:'org-a',description:'Empresa A',type:'receita',status:'pago',amount_cents:45000,due_date:'2026-10-03'},{id:'finance-b',organization_id:'org-b',description:'PRIVATE_COMPANY_B',type:'receita',status:'pago',amount_cents:98765400,due_date:'2026-10-03'}],appointments:[],employees:[],warranties:[],work_orders:[],customers:[],quotes:[],leads:[],inventory_items:[],contracts:[]};
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(String(input)),method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
    state.calls.push({path:url.pathname,method,query:url.searchParams,body,headers:new Headers(init.headers)});
    assert.ok(['fixture.supabase.co','graph.facebook.com'].includes(url.host),'unexpected external inference or media request');
    if(url.host==='graph.facebook.com'){
      assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal);
      if(method==='GET'){state.providerReads++;return Response.json({id:url.pathname.split('/').at(-1),display_phone_number:'+5511000000000'});}
      state.messages.push(body);if(state.sendFails)throw new TypeError('connection lost after submission');return Response.json({messages:[{id:'wamid.sent'}]});
    }
    if(url.pathname.startsWith('/auth/v1/admin/users/'))return state.deleted?Response.json({error:'not found'},{status:404}):Response.json({id:url.pathname.split('/').at(-1),banned_until:state.banned?'2030-01-01T00:00:00Z':null});
    if(url.pathname==='/rest/v1/rpc/fama_get_block_rules') return Response.json(state.blockRules || {global:{overrides:{},revision:0,updatedAt:null},organization:{overrides:{},revision:0,updatedAt:null},member:{overrides:{},revision:0,updatedAt:null}});
    if(url.pathname==='/rest/v1/rpc/fama_consume_rate_limit')return Response.json(state.rate);
    if(url.pathname.startsWith('/rest/v1/rpc/fama_chat_')) return chatFixture(state,body,url.pathname);
    if(url.pathname==='/rest/v1/rpc/fama_whatsapp_member_access'){
      const member=state.organization_members.find(m=>m.id===body.p_member_id&&m.organization_id===body.p_organization_id&&m.status==='active');
      const organization=state.organizations.find(o=>o.id===body.p_organization_id&&o.status==='active');
      return Response.json(member&&organization?{member,organization}:null);
    }
    if(url.pathname==='/rest/v1/rpc/fama_whatsapp_claim_event'){
      let event=state.fama_whatsapp_events.find(e=>e.connection_id===body.p_connection_id&&e.message_hash===body.p_message_hash);
      if(event&&event.status!=='failed')return Response.json(false);
      if(event)event.status='processing';else state.fama_whatsapp_events.push({connection_id:body.p_connection_id,message_hash:body.p_message_hash,status:'processing'});
      return Response.json(true);
    }
    if(url.pathname==='/rest/v1/fama_ai_settings')return Response.json(state.preferences?[{config:state.settings,revision:1,updated_at:'2026-10-03T10:00:00Z'}]:[]);
    const table=url.pathname.split('/').at(-1);assert.ok(Array.isArray(state[table]),`unexpected table ${table}`);
    const rows=selected(state[table],url);
    if(method==='POST'){if(state[table].some(row=>row.id===body.id||(table==='fama_whatsapp_connections'&&row.phone_number_id===body.phone_number_id)))return Response.json({code:'23505',message:'duplicate'},{status:409});state[table].push(body);return Response.json([body]);}
    if(method==='PATCH'){rows.forEach(row=>Object.assign(row,body));return Response.json(rows);}
    if(method==='DELETE'){state[table]=state[table].filter(row=>!rows.includes(row));return Response.json(rows);}
    if(['transactions','appointments','customers'].includes(table)&&state.onData)state.onData(table);
    return Response.json(rows);
  };
});
after(async()=>{globalThis.fetch=originalFetch;await vite.close();delete globalThis.__waRuntime;delete globalThis.__waUser;});
const settingsRequest=(body,extra={})=>new Request('https://fama.example.test/api/whatsapp/assistant',{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a',...extra}});
const incoming=(overrides={})=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'11111'},messages:[{id:'wamid.incoming',from:sender,timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'Resumo financeiro'},...overrides}]}}]}]});
async function hook(body=incoming(),signature=true){const raw=JSON.stringify(body);let value='';if(signature){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);value='sha256='+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))),x=>x.toString(16).padStart(2,'0')).join('');}return webhook.POST(new Request(`https://fama.example.test/api/whatsapp/webhook?connection=${connectionId}`,{method:'POST',headers:{'Content-Type':'application/json',...(signature?{'x-hub-signature-256':value}:{})},body:raw}));}
const post=body=>settingsAPI.POST(settingsRequest(body));
const queried=table=>state.calls.some(call=>call.path===`/rest/v1/${table}`&&call.method==='GET');

test('configuration requires owner or administrator of the exact company and never returns provider secrets',async()=>{
  const response=await settingsAPI.GET(settingsRequest());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);const data=await response.json();assert.equal(data.currentMemberId,'member-a');assert.equal(data.connection.verifyToken,'verify-fixture');assert.doesNotMatch(JSON.stringify(data),new RegExp(`${providerToken}|${secret}|token_ciphertext|app_secret_ciphertext`));
  globalThis.__waUser=null;assert.equal((await settingsAPI.GET(settingsRequest())).status,401);globalThis.__waUser={id:userId,email:'owner@fixture.test'};
  assert.equal((await settingsAPI.GET(settingsRequest(undefined,{'x-organization-id':'org-b'}))).status,403);state.organization_members[0].role='member';assert.equal((await post({action:'enable',enabled:false})).status,403);
});
test('connection validates the exact Meta number and stores only encrypted secrets with the IA paused',async()=>{
  state.fama_whatsapp_connections=[];const response=await post({action:'save',phoneNumberId:'54321',accessToken:providerToken,appSecret:secret});assert.equal(response.status,200);
  const connection=state.fama_whatsapp_connections[0];assert.equal(connection.phone_number_id,'54321');assert.equal(connection.assistant_enabled,false);assert.equal(connection.webhook_verified_at,null);assert.match(connection.token_ciphertext,/^fama:v1:/);assert.equal(await decryptText(connection.token_ciphertext),providerToken);assert.equal(state.providerReads,1);assert.equal(state.messages.length,0);
  assert.equal((await post({action:'save',phoneNumberId:'https://evil.test',accessToken:providerToken,appSecret:secret})).status,400);
  assert.equal((await settingsAPI.POST(settingsRequest({action:'save',phoneNumberId:'11111'},{Origin:'https://evil.test'}))).status,403);
  assert.equal((await post({action:'enable',enabled:true,organizationId:'org-b'})).status,400);
});
test('activation requires a verified callback and authorized company member; foreign and self numbers cannot be linked',async()=>{
  state.fama_whatsapp_connections[0].webhook_verified_at=null;assert.equal((await post({action:'enable',enabled:true})).status,409);
  assert.equal((await post({action:'link',memberId:'member-b',phone:'5511888888888'})).status,403);
  assert.equal((await post({action:'link',memberId:'member-a',phone:'5511000000000'})).status,400);
  const response=await webhook.GET(new Request(`https://fama.example.test/api/whatsapp/webhook?connection=${connectionId}&hub.mode=subscribe&hub.verify_token=verify-fixture&hub.challenge=12345`));assert.equal(response.status,200);assert.equal(await response.text(),'12345');
  assert.equal((await post({action:'link',memberId:'member-a',phone:'55 (11) 88888-8888'})).status,200);assert.equal((await post({action:'enable',enabled:true})).status,200);assert.equal(state.messages.length,0);
});
test('unsigned, tampered and mismatched-number events cannot reach records or outgoing messages',async()=>{
  assert.equal((await hook(incoming(),false)).status,401);
  const forged=new Request(`https://fama.example.test/api/whatsapp/webhook?connection=${connectionId}`,{method:'POST',headers:{'x-hub-signature-256':'sha256='+'0'.repeat(64)},body:JSON.stringify(incoming())});assert.equal((await webhook.POST(forged)).status,401);
  const wrong=incoming();wrong.entry[0].changes[0].value.metadata.phone_number_id='22222';assert.equal((await hook(wrong)).status,200);
  assert.equal(state.messages.length,0);assert.equal(queried('transactions'),false);assert.equal(state.fama_whatsapp_events.length,0);
});
test('local Brazilian phone input creates one authorization shared with the full international form',async()=>{
  const first=await post({action:'link',memberId:'member-a',phone:'(61) 99123-4567'});assert.equal(first.status,200);
  const rows=state.fama_whatsapp_links.filter(link=>link.phone_hash);assert.equal(rows.length,2);
  assert.equal(await decryptText(rows.at(-1).phone_ciphertext),'5561991234567');
  assert.equal((await post({action:'link',memberId:'member-a',phone:'+55 61 99123-4567'})).status,200);
  assert.equal(state.fama_whatsapp_links.length,2);assert.equal(state.messages.length,0);
  assert.equal((await post({action:'link',memberId:'member-a',phone:'(11) 00000-0000'})).status,400);
});
test('phone input preserves explicit international prefixes and rejects malformed chat destinations',()=>{
  assert.equal(whatsappPhoneInput('(11) 99999-9999'),sender);
  assert.equal(whatsappPhoneInput('5511999999999'),sender);
  assert.equal(whatsappPhoneInput('+1 (415) 555-0123'),'14155550123');
  assert.equal(whatsappPhoneInput('+44 20 7946 0958'),'442079460958');
  assert.equal(whatsappChatUrl('https://evil.test/5511999999999'),'');
  assert.throws(()=>whatsappPhoneInput('abc61991234567'));assert.throws(()=>whatsappPhoneInput('123'));
});
test('an explicit international country prefix is retained in the encrypted team authorization',async()=>{
  const response=await post({action:'link',memberId:'member-a',phone:'+14155550123'});assert.equal(response.status,200);
  const link=state.fama_whatsapp_links.at(-1);assert.equal(await decryptText(link.phone_ciphertext),'14155550123');
  assert.equal(link.phone_hash,await sha256('org-a:14155550123'));assert.equal(state.messages.length,0);
});
test('signed native queries read only company A, with no inference API, and duplicates send once even concurrently',async()=>{
  const replies=await Promise.all([hook(),hook()]);assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.equal(state.messages.length,1);assert.match(state.messages[0].text.body,/450,00/);assert.doesNotMatch(state.messages[0].text.body,/PRIVATE_COMPANY_B|987\.654/);
  assert.equal((await hook()).status,200);assert.equal(state.messages.length,1);assert.equal(state.fama_whatsapp_events[0].status,'sent');assert.match(state.fama_whatsapp_links[0].context_ciphertext,/^fama:v1:/);
  assert.ok(state.calls.filter(c=>c.path==='/rest/v1/transactions').every(c=>c.query.get('organization_id')==='eq.org-a'));
});
test('permissions and disabled modules are checked before selecting any forbidden collection',async()=>{
  Object.assign(state.organization_members[0],{role:'admin',permissions:['agenda']});assert.equal((await hook()).status,200);assert.equal(queried('transactions'),false);assert.doesNotMatch(state.messages[0].text.body,/450,00|finance-a/);
  state.messages=[];state.fama_whatsapp_events=[];state.settings.enabled=false;assert.equal((await hook()).status,200);assert.equal(state.messages.length,0);assert.equal(state.fama_whatsapp_events[0].status,'ignored');
});
test('unknown phone, inactive or banned identity, suspended organization and expired paid plan do not receive business data',async()=>{
  assert.equal((await hook(incoming({from:'5511777777777'}))).status,200);
  state.banned=true;assert.equal((await hook()).status,200);state.banned=false;state.deleted=true;assert.equal((await hook()).status,200);state.deleted=false;
  state.organization_members[0].status='inactive';assert.equal((await hook()).status,200);state.organization_members[0].status='active';state.organizations[0].status='suspended';assert.equal((await hook()).status,200);state.organizations[0].status='active';state.organizations[0].plan_status='expired';assert.equal((await hook()).status,200);
  assert.equal(state.messages.length,0);assert.equal(queried('transactions'),false);
});
test('pause or permission revocation during a query stops the response before sending',async()=>{
  state.onData=()=>{state.fama_whatsapp_connections[0].assistant_enabled=false;};assert.equal((await hook()).status,200);assert.equal(state.messages.length,0);assert.equal(state.fama_whatsapp_events[0].status,'ignored');
  state.onData=()=>{state.organization_members[0].permissions=[];state.organization_members[0].role='member';};state.fama_whatsapp_connections[0].assistant_enabled=true;state.fama_whatsapp_events=[];assert.equal((await hook()).status,200);assert.equal(state.messages.length,0);
});
test('provider uncertainty never automatically resends; failures before sending can recover on Meta retry',async()=>{
  state.sendFails=true;assert.equal((await hook()).status,502);assert.equal(state.fama_whatsapp_events[0].status,'uncertain');state.sendFails=false;assert.equal((await hook()).status,200);assert.equal(state.messages.length,1);
  state.messages=[];state.fama_whatsapp_events=[];state.preferences=false;assert.equal((await hook()).status,503);assert.equal(state.messages.length,0);assert.equal(state.fama_whatsapp_events[0].status,'failed');state.preferences=true;assert.equal((await hook()).status,200);assert.equal(state.messages.length,1);
});
test('old messages, status notifications and rate-limited queries do not produce automatic sends',async()=>{
  assert.equal((await hook(incoming({timestamp:String(Math.floor(Date.now()/1000)-86400)}))).status,200);
  const status=incoming();delete status.entry[0].changes[0].value.messages;status.entry[0].changes[0].value.statuses=[{status:'sent'}];assert.equal((await hook(status)).status,200);
  state.rate=false;assert.equal((await hook()).status,429);assert.equal(state.messages.length,0);
});
test('audio asks an authorized user for a written query without downloading media or allocating a model',async()=>{
  assert.equal((await hook(incoming({type:'audio',text:undefined,audio:{id:'private-media'}}))).status,200);assert.equal(state.messages.length,1);assert.match(state.messages[0].text.body,/por escrito/);assert.equal(queried('transactions'),false);
});
test('manual sends use the exact company connection and reject cross-origin, malformed and unauthenticated operations',async()=>{
  const req=(body,extra={})=>new Request('https://fama.example.test/api/whatsapp',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a',...extra},body:JSON.stringify(body)});
  assert.equal((await manual.POST(req({to:sender,text:'Olá'},{Origin:'https://evil.test'}))).status,403);assert.equal((await manual.POST(req({object:'whatsapp_business_account'}))).status,401);
  assert.equal((await manual.POST(req({to:sender,text:'Olá'}))).status,200);assert.equal(state.messages[0].to,sender);
  const send=state.calls.find(c=>c.path==='/v23.0/11111/messages');assert.ok(send);assert.equal(send.headers.get('authorization'),`Bearer ${providerToken}`);
  globalThis.__waUser=null;assert.equal((await manual.GET(req({action:'status'}))).status,401);
});
test('daily agenda uses Sao Paulo dates and omits warranties and orders the administrator cannot access',async()=>{
  Object.assign(state.organization_members[0],{role:'admin',permissions:['crm','agenda','team']});state.employees=[{id:'employee',organization_id:'org-a',name:'Técnico',phone:sender,active:true}];state.appointments=[{id:'appointment',organization_id:'org-a',client_name:'Cliente A',title:'Visita',technician:'Técnico',start_at:'2026-10-04T01:00:00Z',kind:'servico',status:'agendado'}];
  const req=date=>new Request('https://fama.example.test/api/whatsapp',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a'},body:JSON.stringify({action:'dailyAgenda',date})});
  assert.equal((await manual.POST(req('2026-10-03'))).status,200);assert.equal(state.messages.length,1);assert.match(state.messages[0].text.body,/22:00/);assert.equal(queried('warranties'),false);assert.equal(queried('work_orders'),false);
  assert.equal((await manual.POST(req('2026-02-30'))).status,400);
});
test('bounded stream readers cancel oversized or stalled bodies; provider redirects fail without forwarding credentials',async()=>{
  let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(200));},cancel(){cancelled=true;}});
  await assert.rejects(limitedWhatsappBody({headers:new Headers(),body},100,50),/body_limit/);assert.equal(cancelled,true);
  const stalled=new ReadableStream({cancel(){cancelled=true;}});cancelled=false;await assert.rejects(limitedWhatsappBody({headers:new Headers(),body:stalled},100,20),/body_timeout/);assert.equal(cancelled,true);
  assert.equal(whatsappPhone('+55 (11) 99999-9999'),sender);assert.throws(()=>whatsappPhone('https://evil.test/5511999999999'));
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://evil.test'}});await assert.rejects(whatsappGraph('11111',providerToken),e=>e.status===502);
});


test('central block rules apply to owners and keep removed finance records out of WhatsApp answers',async()=>{
  state.blockRules={global:{overrides:{finance:false},revision:1,updatedAt:'2026-10-03T12:00:00Z'},organization:{overrides:{},revision:0,updatedAt:null},member:{overrides:{},revision:0,updatedAt:null}};
  assert.equal((await hook()).status,200);assert.equal(state.messages.length,1);assert.equal(queried('transactions'),false);assert.doesNotMatch(JSON.stringify(state.messages),/450,00|Empresa A.*Valor/);
});
test('removing Fama IA stops WhatsApp before data reads, rate consumption or delivery',async()=>{
  state.blockRules={global:{overrides:{assistant:false},revision:1,updatedAt:'2026-10-03T12:00:00Z'},organization:{overrides:{},revision:0,updatedAt:null},member:{overrides:{},revision:0,updatedAt:null}};
  assert.equal((await hook()).status,200);assert.equal(state.messages.length,0);assert.equal(queried('transactions'),false);assert.equal(state.fama_whatsapp_events.length,0);
});
test('a block removed while preparing a WhatsApp response cancels delivery and old conversation reuse',async()=>{
  state.onData=()=>{state.blockRules={global:{overrides:{finance:false},revision:1,updatedAt:'2026-10-03T12:00:00Z'},organization:{overrides:{},revision:0,updatedAt:null},member:{overrides:{},revision:0,updatedAt:null}};};
  assert.equal((await hook()).status,200);assert.equal(state.messages.length,0);assert.equal(state.fama_whatsapp_events[0].status,'ignored');
});

const chatRequest=(body,extra={},search='')=>new Request('https://fama.example.test/api/whatsapp/chat'+search,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a',...extra}});
async function customerChat(text='Olá, preciso de atendimento'){
  state.fama_whatsapp_connections[0].assistant_enabled=false;
  assert.equal((await hook(incoming({from:'5511777777777',text:{body:text}}))).status,200);
  return state.fama_chat_conversations[0].id;
}
test('internal Chat receives customer messages with AI paused and encrypts text that resembles ciphertext',async()=>{
  await customerChat('fama:v1:este é um texto literal');
  assert.equal(state.messages.length,0);assert.equal(queried('transactions'),false);
  assert.equal(state.fama_chat_messages.length,1);
  assert.equal(await decryptText(state.fama_chat_messages[0].body_ciphertext),'fama:v1:este é um texto literal');
  assert.equal(await decryptText(state.fama_chat_conversations[0].phone_ciphertext),'5511777777777');
  assert.equal((await hook(incoming({from:'5511777777777'}))).status,200);
  assert.equal(state.fama_chat_messages.length,1);
});
test('inbox requires the exact active company and Chat permission and returns no API credentials',async()=>{
  const conversationId=await customerChat();
  const response=await chat.GET(chatRequest(undefined,{},'?conversation='+conversationId));
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
  const data=await response.json();assert.equal(data.messages[0].text,'Olá, preciso de atendimento');
  assert.doesNotMatch(JSON.stringify(data),/verify-fixture|token_ciphertext|app_secret_ciphertext|fixture-meta-access-token/);
  assert.equal((await chat.GET(chatRequest(undefined,{'x-organization-id':'org-b'}))).status,403);
  Object.assign(state.organization_members[0],{role:'member',permissions:['agenda']});
  assert.equal((await chat.GET(chatRequest())).status,403);
  state.organization_members[0].permissions=['chat'];assert.equal((await chat.GET(chatRequest())).status,200);
  assert.equal((await chat.POST(chatRequest({action:'text',conversationId,clientId:crypto.randomUUID(),text:'Olá'},{Origin:'https://evil.test'}))).status,403);
  globalThis.__waUser=null;assert.equal((await chat.GET(chatRequest())).status,401);
});
test('concurrent repeated Chat sends reserve one message and send to Meta exactly once',async()=>{
  const conversationId=await customerChat(),body={action:'text',conversationId,clientId:crypto.randomUUID(),text:'Olá, vamos atender'};
  const responses=await Promise.all([chat.POST(chatRequest(body)),chat.POST(chatRequest(body))]);
  assert.deepEqual(responses.map(response=>response.status),[200,200]);
  assert.equal(state.messages.length,1);assert.equal(state.messages[0].to,'5511777777777');
  assert.equal(state.fama_chat_messages.filter(row=>row.direction==='out').length,1);
  assert.equal((await chat.POST(chatRequest(body))).status,200);assert.equal(state.messages.length,1);
  assert.equal((await chat.POST(chatRequest({...body,text:'Texto diferente'}))).status,409);assert.equal(state.messages.length,1);
});
test('uncertain Chat delivery preserves the original message and never resends on retry',async()=>{
  const conversationId=await customerChat(),body={action:'text',conversationId,clientId:crypto.randomUUID(),text:'Mensagem única'};
  state.sendFails=true;assert.equal((await chat.POST(chatRequest(body))).status,502);
  assert.equal(state.fama_chat_messages.at(-1).status,'uncertain');
  state.sendFails=false;const retry=await chat.POST(chatRequest(body));assert.equal(retry.status,200);
  assert.equal((await retry.json()).message.status,'uncertain');assert.equal(state.messages.length,1);
});
test('removing the Chat block after reservation cancels delivery before exposing any company data',async()=>{
  const conversationId=await customerChat();
  state.onReserve=()=>{state.blockRules={global:{overrides:{chat:false},revision:1,updatedAt:new Date().toISOString()},organization:{overrides:{},revision:0,updatedAt:null},member:{overrides:{},revision:0,updatedAt:null}};};
  assert.equal((await chat.POST(chatRequest({action:'text',conversationId,clientId:crypto.randomUUID(),text:'Não deve sair'}))).status,403);
  assert.equal(state.messages.length,0);assert.equal(state.fama_chat_messages.at(-1).status,'failed');
});
test('closed reply windows require a template and new conversations use the official template payload',async()=>{
  const conversationId=await customerChat();state.fama_chat_conversations[0].last_inbound_at=new Date(Date.now()-86400_001).toISOString();
  assert.equal((await chat.POST(chatRequest({action:'text',conversationId,clientId:crypto.randomUUID(),text:'Fora do prazo'}))).status,409);
  assert.equal(state.messages.length,0);
  const response=await chat.POST(chatRequest({action:'template',conversationId:'',clientId:crypto.randomUUID(),phone:'(61) 99123-4567',templateName:'atendimento',language:'pt_BR',parameters:['Maria']}));
  assert.equal(response.status,200);assert.equal(state.messages[0].to,'5561991234567');
  assert.deepEqual(state.messages[0].template,{name:'atendimento',language:{code:'pt_BR'},components:[{type:'body',parameters:[{type:'text',text:'Maria'}]}]});
});
test('delivery notifications check the recipient and never downgrade a read message',async()=>{
  const conversationId=await customerChat();
  assert.equal((await chat.POST(chatRequest({action:'text',conversationId,clientId:crypto.randomUUID(),text:'Boa tarde'}))).status,200);
  const status=incoming();delete status.entry[0].changes[0].value.messages;
  const item={id:'wamid.sent',recipient_id:'5511888888888',status:'read'};
  status.entry[0].changes[0].value.statuses=[item];assert.equal((await hook(status)).status,200);
  assert.equal(state.fama_chat_messages.at(-1).status,'sent');
  item.recipient_id='5511777777777';assert.equal((await hook(status)).status,200);assert.equal(state.fama_chat_messages.at(-1).status,'read');
  item.status='sent';assert.equal((await hook(status)).status,200);assert.equal(state.fama_chat_messages.at(-1).status,'read');
});
test('Chat paginates histories, marks actual reads and hides the previous business number',async()=>{
  const conversationId=await customerChat(),prototype=state.fama_chat_messages[0];
  for(let i=1;i<=104;i++)state.fama_chat_messages.push({...prototype,id:crypto.randomUUID(),provider_message_id:'wamid.older.'+i,occurred_at:new Date(Date.now()-i*1000).toISOString()});
  const page=await (await chat.GET(chatRequest(undefined,{},'?conversation='+conversationId))).json();
  assert.equal(page.messages.length,100);assert.equal(page.hasMore,true);assert.equal(page.conversations[0].unread,true);
  const older=await (await chat.GET(chatRequest(undefined,{},'?conversation='+conversationId+'&before='+page.messages[0].id))).json();
  assert.equal(older.messages.length,5);assert.equal(older.hasMore,false);
  assert.equal((await chat.POST(chatRequest({action:'read',conversationId}))).status,200);
  assert.ok(state.fama_chat_conversations[0].last_read_at);
  assert.equal((await (await chat.GET(chatRequest())).json()).conversations[0].unread,false);
  assert.equal((await chat.GET(chatRequest(undefined,{},'?conversation='+crypto.randomUUID()))).status,404);
  state.fama_whatsapp_connections[0].phone_number_id='22222';
  assert.equal((await (await chat.GET(chatRequest())).json()).conversations.length,0);
  assert.equal((await chat.POST(chatRequest({action:'text',conversationId,clientId:crypto.randomUUID(),text:'Número anterior'}))).status,409);
  assert.equal(state.messages.length,0);
});

 test('daily agenda without Meta prepares manual drafts without sending and preserves tenant boundaries',async()=>{
  state.fama_whatsapp_connections=[];
  state.employees=[{id:'employee',organization_id:'org-a',name:'Técnico',phone:sender,active:true}];
  state.appointments=[{id:'a',organization_id:'org-a',client_name:'Cliente A',title:'Visita',technician:'Técnico',start_at:'2026-10-03T09:00:00',kind:'servico',status:'agendado'},{id:'b',organization_id:'org-b',client_name:'PRIVATE_COMPANY_B',title:'Privado',technician:'Técnico',start_at:'2026-10-03T09:00:00',kind:'servico',status:'agendado'}];
  const req=()=>new Request('https://fama.example.test/api/whatsapp',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a'},body:JSON.stringify({action:'dailyAgenda',date:'2026-10-03'})});
  const response=await manual.POST(req());assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.manualShare,true);assert.equal(result.sent.length,0);assert.equal(result.drafts.length,1);assert.match(result.drafts[0].text,/Cliente A/);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_COMPANY_B/);assert.equal(state.messages.length,0);
  state.appointments=[];const empty=await (await manual.POST(req())).json();assert.equal(empty.sent.length,0);assert.equal(empty.drafts.length,0);assert.equal(state.messages.length,0);
 });
