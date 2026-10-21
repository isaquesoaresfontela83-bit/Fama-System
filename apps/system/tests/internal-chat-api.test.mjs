import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const fixture=await operationalFixture(new URL('../',import.meta.url).pathname);
const {internalChatGET:GET,internalChatPOST:POST}=await fixture.load('/lib/internal-chat-server.js');
const {encryptPlainText,decryptText}=await fixture.load('/lib/crypto.js');
const thread='cccccccc-cccc-4ccc-8ccc-cccccccccccc',client='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let calls;
beforeEach(()=>{fixture.reset();calls=[];fixture.member().display_name='Admin';fixture.tables.fama_internal_threads=[{id:thread,organization_id:'org-one',kind:'direct'}];fixture.tables.fama_internal_participants=[{organization_id:'org-one',thread_id:thread,member_id:'member-one'},{organization_id:'org-one',thread_id:thread,member_id:'tech'}];fixture.tables.organization_members.push({id:'tech',organization_id:'org-one',user_id:'tech-user',user_email:'tech@fixture.test',display_name:'Marcos',role:'technician',status:'active',permissions:['chat']});const fetchFixture=globalThis.fetch;globalThis.fetch=async(input,init={})=>{const url=new URL(String(input));if(url.pathname==='/rest/v1/rpc/fama_internal_chat'){const body=JSON.parse(init.body);calls.push(body);if(body.p_operation==='inbox')return Response.json([{id:thread,kind:'direct',title:'',participant_ids:['member-one','tech'],announcements:false,preview_ciphertext:await encryptPlainText('Olá'),last_at:'2026-10-06T12:00:00Z',unread:1}]);if(body.p_operation==='page'||body.p_operation==='pinned'){if(body.p_thread_id===client)return Response.json({message:'chat_private',code:'42501'},{status:403});return Response.json(body.p_operation==='pinned'?[]:[{id:client,sequence:1,sender_id:'tech',author:'Marcos',body_ciphertext:await encryptPlainText('Texto seguro'),created_at:'2026-10-06T12:00:00Z',read_count:0}]);}return Response.json(body.p_operation==='send'?{id:client,sequence:2,sender_id:'member-one',author:'Admin',body_ciphertext:body.p_body,created_at:'2026-10-06T12:00:00Z'}:{id:thread});}return fetchFixture(input,init);};});
after(fixture.close);
test('inbox binds the authenticated membership, exposes no email and decrypts only scoped message text',async()=>{const r=await GET(fixture.request('GET',`/api/internal-chat?thread=${thread}`)),payload=await r.json();assert.equal(r.status,200);assert.equal(payload.selfId,'member-one');assert.equal(payload.messages[0].text,'Texto seguro');assert.doesNotMatch(JSON.stringify(payload),/tech@fixture|body_ciphertext|user_email/);assert.ok(calls.every(call=>call.p_member_id==='member-one'&&call.p_organization_id==='org-one'));assert.match(r.headers.get('cache-control'),/no-store/);});
test('send uses the authenticated author and encrypts text before passing it to the database',async()=>{const r=await POST(fixture.request('POST','/api/internal-chat',{action:'send',threadId:thread,text:'Orientação privada',clientId:client,urgent:true}));assert.equal(r.status,200);const args=calls.find(c=>c.p_operation==='send');assert.notEqual(args.p_body,'Orientação privada');assert.equal(await decryptText(args.p_body),'Orientação privada');assert.equal(args.p_member_id,'member-one');assert.equal(args.p_urgent,true);assert.equal((await r.json()).message.text,'Orientação privada');});
test('blocked Chat access, forged recipients, foreign tenants and private-thread denials fail closed',async()=>{fixture.rules.global.overrides.chat=false;assert.equal((await GET(fixture.request('GET','/api/internal-chat'))).status,403);assert.equal(calls.length,0);fixture.rules.global.overrides.chat=true;assert.equal((await POST(fixture.request('POST','/api/internal-chat',{action:'direct',recipientId:'foreign-user'}))).status,400);assert.equal((await GET(fixture.request('GET','/api/internal-chat?organization_id=foreign',undefined,{'x-organization-id':'foreign'}))).status,403);assert.equal((await GET(fixture.request('GET',`/api/internal-chat?thread=${client}`))).status,403);});
test('oversized text, spoofed author fields and cross-origin writes never reach the chat RPC',async()=>{assert.equal((await POST(fixture.request('POST','/api/internal-chat',{action:'send',threadId:thread,text:'x'.repeat(4001),clientId:client,urgent:false}))).status,400);assert.equal((await POST(fixture.request('POST','/api/internal-chat',{action:'send',threadId:thread,text:'Olá',clientId:client,urgent:false,senderId:'other'}))).status,400);assert.equal((await POST(fixture.request('POST','/api/internal-chat',{action:'read',threadId:thread,sequence:1},{origin:'https://evil.fixture.test'}))).status,403);assert.equal(calls.length,0);});


test('a removed recipient or nonparticipant cannot send to a private thread',async()=>{
 fixture.tables.organization_members[1].status='suspended';
 assert.equal((await POST(fixture.request('POST','/api/internal-chat',{action:'send',threadId:thread,text:'Blocked',clientId:client,urgent:false}))).status,403);
 assert.equal(calls.length,0);
 fixture.tables.organization_members[1].status='active';fixture.tables.fama_internal_participants[0].member_id='somebody-else';
 assert.equal((await POST(fixture.request('POST','/api/internal-chat',{action:'send',threadId:thread,text:'Blocked',clientId:client,urgent:false}))).status,403);
 assert.equal(calls.length,0);
});


test('global unread indicator returns only a count and no people or message content',async()=>{
 const r=await GET(fixture.request('GET','/api/internal-chat?summary=1'));assert.equal(r.status,200);assert.deepEqual(await r.json(),{unread:1});
});
