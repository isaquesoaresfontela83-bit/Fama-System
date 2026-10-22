import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('../',import.meta.url).pathname);
const sql=new DatabaseSync(':memory:');const d1={prepare(query){let values=[];const statement=sql.prepare(query),result={bind(...next){values=next;return result;},async first(){return statement.get(...values)??null;},async all(){return {results:statement.all(...values)};},async run(){return {meta:{changes:Number(statement.run(...values).changes)}};}};return result;}};
const brasil=await f.load('/lib/brasil-data.js'),route=await f.load('/app/api/brasil-data/route.js'),push=await f.load('/app/api/push/route.js'),pushServer=await f.load('/lib/firebase-push.js');
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
let providerCalls,sent,oauthCalls;
function configure(){f.runtime.FIREBASE_WEB_CONFIG=JSON.stringify({apiKey:'public-fixture-key',projectId:'fama-fixture',appId:'1:fixture:web:fixture',messagingSenderId:'123456789'});f.runtime.FIREBASE_VAPID_KEY='fixture-vapid-public';f.runtime.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'fama-fixture',client_email:'fixture@fama-fixture.iam.gserviceaccount.com',private_key:pem});}
beforeEach(async()=>{f.reset();f.runtime.DB=d1;for(const key of ['FIREBASE_WEB_CONFIG','FIREBASE_VAPID_KEY','FIREBASE_SERVICE_ACCOUNT_JSON'])delete f.runtime[key];await pushServer.pushTables();sql.exec('DELETE FROM fama_push_devices;DELETE FROM fama_push_deliveries;');providerCalls=0;sent=[];oauthCalls=0;const delegated=globalThis.fetch;globalThis.fetch=async(input,init={})=>{const url=new URL(String(input));if(url.hostname==='brasilapi.com.br'){providerCalls++;assert.equal(init.redirect,'manual');assert.equal(new Headers(init.headers).get('authorization'),null);return Response.json([{date:'2026-12-25',name:'Natal'}]);}if(url.hostname==='oauth2.googleapis.com'){oauthCalls++;const jwt=new URLSearchParams(init.body).get('assertion');const parts=jwt.split('.');assert.equal(JSON.parse(Buffer.from(parts[1],'base64url')).scope,'https://www.googleapis.com/auth/firebase.messaging');assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1])));return Response.json({access_token:'fixture-access-token',expires_in:3600});}if(url.hostname==='fcm.googleapis.com'){assert.equal(new Headers(init.headers).get('authorization'),'Bearer fixture-access-token');sent.push(JSON.parse(init.body).message);return Response.json({name:'projects/fama-fixture/messages/fixture'});}return delegated(input,init);};});
after(async()=>{sql.close();await f.close();});
test('all documented BrasilAPI GET operations are reachable only through a fixed allowlist',()=>{
 assert.equal(brasil.brasilCatalog.length,88);for(const entry of brasil.brasilCatalog){const parameters=Object.fromEntries(entry.parameters.filter(p=>p.required).map(p=>[p.name,String(p.options[0]??'123')]));const {url}=brasil.brasilEndpoint(entry.id,parameters);assert.equal(url.origin,'https://brasilapi.com.br');assert.ok(url.pathname.startsWith('/api/'));assert.doesNotMatch(url.href,/\{/);}
 const entry=brasil.brasilCatalog.find(e=>e.path==='/feriados/v1/{ano}');assert.throws(()=>brasil.brasilEndpoint(entry.id,{ano:'../other'}));assert.throws(()=>brasil.brasilEndpoint(entry.id,{ano:'2026',url:'https://evil.test'}));assert.throws(()=>brasil.brasilEndpoint('https://evil.test',{}));
});
test('BrasilAPI requires tenant permissions and coalesces/caches repeated holiday queries',async()=>{
 const id=brasil.brasilCatalog.find(e=>e.path==='/feriados/v1/{ano}').id;const body={id,parameters:{ano:'2098'}};
 const first=await route.POST(f.request('POST','/api/brasil-data',body));assert.equal(first.status,200);assert.equal((await first.json()).data[0].name,'Natal');assert.equal((await route.POST(f.request('POST','/api/brasil-data',body))).status,200);assert.equal(providerCalls,1);
 f.member().role='member';f.member().permissions=[];assert.equal((await route.POST(f.request('POST','/api/brasil-data',body))).status,403);
});
test('Firebase status exposes no server secrets and does not pretend delivery is configured',async()=>{
 const status=await push.GET(f.request('GET','/api/push'));assert.equal((await status.json()).configured,false);
 assert.equal((await push.POST(f.request('POST','/api/push',{action:'subscribe',token:'x'.repeat(40),categories:['agenda']}))).status,503);
 configure();const publicStatus=await push.GET(f.request('GET','/api/push'));const text=await publicStatus.text();assert.doesNotMatch(text,/PRIVATE KEY|client_email|private_key/);assert.equal(JSON.parse(text).configured,true);
});
test('FCM subscriptions encrypt tokens, scope recipients, respect categories, deduplicate and allow removal',async()=>{
 configure();const token='fixture-device-token-1234567890123456789';const response=await push.POST(f.request('POST','/api/push',{action:'subscribe',token,categories:['agenda']}));assert.equal(response.status,200);const stored=sql.prepare('SELECT * FROM fama_push_devices').get();assert.notEqual(stored.token,token);assert.ok(stored.token.startsWith('fama:v1:'));assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await pushServer.deliverPush('other-org','user-one','event','agenda','Fama','Atualização')).sent,0);
 assert.equal((await pushServer.deliverPush('org-one','user-one','event','inventory','Fama','Atualização')).sent,0);
 assert.equal((await pushServer.deliverPush('org-one','user-one','event','agenda','Fama','Atualização')).sent,1);assert.equal(sent[0].token,token);assert.equal(sent[0].data.organizationId,'org-one');
 assert.equal((await pushServer.deliverPush('org-one','user-one','event','agenda','Fama','Atualização')).sent,0);assert.equal(sent.length,1);
 await pushServer.removePushDevice('other-user',stored.token_hash);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM fama_push_devices').get().n,1);
 await pushServer.removePushDevice('user-one',stored.token_hash);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM fama_push_devices').get().n,0);
});

test('server reminders only include upcoming visits and respect daytime for other alerts',async()=>{
 const {dueReminders}=await f.load('/lib/push-reminders.js');const now=new Date('2026-10-14T16:00:00Z');
 const alerts=dueReminders({agenda:[{id:'next',start_at:'2026-10-14T17:00:00Z',status:'agendado'},{id:'later',start_at:'2026-10-14T20:00:00Z',status:'agendado'},{id:'cancelled',start_at:'2026-10-14T17:00:00Z',status:'cancelado'}],inventory:[{id:'stock',quantity:1,minimum_quantity:2}],finance:[{id:'paid',status:'pago',due_date:'2026-10-13'},{id:'late',status:'pendente',due_date:'2026-10-13'}]},now);
 assert.deepEqual(alerts.map(a=>a.category),['agenda','inventory','finance']);assert.ok(alerts[0].id.includes('next'));
 assert.equal(dueReminders({inventory:[{id:'stock',quantity:0,minimum_quantity:1}]},new Date('2026-10-15T02:00:00Z')).length,0);
});
test('unattended reminder writer requires a service token and rechecks membership and plan',async()=>{
 const route=await f.load('/app/api/internal/push-reminders/route.js');const {reminderPermissions}=await f.load('/lib/push-reminders.js');f.runtime.FAMA_BACKUP_SERVICE_TOKEN='fixture-reminder-service-token';
 assert.equal((await route.POST(f.request('POST','/api/internal/push-reminders'))).status,401);
 const inactive=await route.POST(f.request('POST','/api/internal/push-reminders',undefined,{authorization:'Bearer fixture-reminder-service-token'}));assert.equal(inactive.status,200);assert.equal((await inactive.json()).configured,false);
 assert.ok((await reminderPermissions('org-one','user-one')).includes('agenda'));
 f.member().role='member';f.member().permissions=[];assert.deepEqual(await reminderPermissions('org-one','user-one'),[]);
 f.member().role='owner';f.tables.organizations[0].billing_enabled=true;f.tables.organizations[0].block_on_expiry=true;f.tables.organizations[0].plan_status='expired';assert.deepEqual(await reminderPermissions('org-one','user-one'),[]);
});

test('test push targets only the current tenant device regardless of its selected categories',async()=>{
 configure();
 const first=await pushServer.registerPushDevice('org-one','user-one','test-device-one-12345678901234567890',['inventory']);
 const second=await pushServer.registerPushDevice('org-one','user-one','test-device-two-12345678901234567890',['agenda']);
 const foreign=await pushServer.registerPushDevice('another-org','user-one','foreign-device-12345678901234567890',['agenda']);
 const start=sent.length;
 const result=await push.POST(f.request('POST','/api/push',{action:'test'},{cookie:'fama_push_device='+first}));
 assert.equal(result.status,200);assert.equal((await result.json()).sent,1);
 assert.equal(sent.length,start+1);assert.equal(sent.at(-1).token,'test-device-one-12345678901234567890');
 assert.equal((await push.POST(f.request('POST','/api/push',{action:'test'}))).status,400);
 assert.equal((await pushServer.deliverPush('org-one','user-one','foreign-device-test','agenda','Test','Test',foreign)).sent,0);
 for(const hash of [first,second,foreign])await pushServer.removePushDevice('user-one',hash);
});
test('foreground reception displays a system notification and rejects another company',async()=>{
 const {displayForegroundPush}=await f.load('/lib/push-display.js');const displayed=[];
 const environment={permission:()=> 'granted',registration:async()=>({showNotification:async(...args)=>displayed.push(args)})};
 const data={organizationId:'org-one',title:'Fama System',body:'Teste recebido',eventId:'test-event'};
 assert.equal(await displayForegroundPush(data,'org-one',environment),true);
 assert.equal(displayed.length,1);assert.equal(displayed[0][1].tag,'test-event');assert.equal(displayed[0][1].body,'Teste recebido');
 assert.equal(await displayForegroundPush(data,'another-org',environment),false);assert.equal(displayed.length,1);
 await assert.rejects(displayForegroundPush(data,'org-one',{...environment,permission:()=> 'denied'}),/não estão permitidas/);
 await assert.rejects(displayForegroundPush(data,'org-one',{...environment,registration:async()=>undefined}),/não está ativo/);
});

test('reminder tools require server credentials and reject forged identity headers',async()=>{
 const mcp=await f.load('/app/mcp/route.js');
 const call=(name,args={},headers={})=>mcp.POST(f.request('POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},headers)).then(r=>r.json());
 f.runtime.FAMA_REMINDER_OWNER_ACCOUNT_EMAIL='owner@example.test';
 f.runtime.FAMA_BACKUP_SERVICE_TOKEN='fixture-private-server-credential';
 const authorized={Authorization:'Bearer '+f.runtime.FAMA_BACKUP_SERVICE_TOKEN};
 assert.equal((await call('dispatch_due_reminders')).error.code,-32001);
 for(const name of ['dispatch_due_reminders','integration_status','reminder_status','check_weather_connection']) {
  assert.equal((await call(name,{}, {'oai-authenticated-user-email':'owner@example.test'})).error.code,-32001);
  assert.equal((await call(name,{}, {Authorization:'Bearer wrong-credential'})).error.code,-32001);
 }
 const result=await call('dispatch_due_reminders',{},authorized);
 assert.equal(JSON.parse(result.result.content[0].text).configured,false);
 assert.equal((await call('dispatch_due_reminders',{cursor:'\u0000'},authorized)).error.code,-32602);
 const status=await call('reminder_status',{},authorized);assert.deepEqual(JSON.parse(status.result.content[0].text),{configured:false});
 const discovery=await mcp.POST(f.request('POST','/mcp',{jsonrpc:'2.0',id:2,method:'tools/list'})).then(r=>r.json());assert.equal(discovery.result.tools.length,4);assert.doesNotMatch(JSON.stringify(discovery),/owner@example|PRIVATE KEY|token/);
 delete f.runtime.FAMA_REMINDER_OWNER_ACCOUNT_EMAIL;
 delete f.runtime.FAMA_BACKUP_SERVICE_TOKEN;
});
