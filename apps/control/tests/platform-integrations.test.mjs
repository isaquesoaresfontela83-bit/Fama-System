import assert from 'node:assert/strict';
import test, { beforeEach, after } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { operationalFixture } from './operational-fixture.mjs';
const f = await operationalFixture(new URL('../', import.meta.url).pathname), sql = new DatabaseSync(':memory:');
const d1 = { prepare(query) { const stmt = sql.prepare(query); let args=[]; const api={bind(...values){args=values;return api;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}};}};return api;} };
const server = await f.load('/lib/platform-integrations.js'), config = await f.load('/app/api/admin/integrations/config/route.js'), actions = await f.load('/app/api/admin/integrations/actions/route.js'), internal = await f.load('/app/api/internal/integrations/route.js'), oauth = await f.load('/lib/integration-google-oauth.js');
const fields = { drive:{clientId:'fixture-client',clientSecret:'private-google-secret',refreshToken:'private-refresh-token',folderId:'fixture-folder'},resend:{apiKey:'private-resend-key',from:'sender@example.test'},ocrspace:{apiKey:'private-ocr-key'},sentry:{dsn:'https://abcdef123@o123.ingest.sentry.io/456',apiToken:'private-sentry-read',organization:'fixture',projectId:'456'},ipinfo:{token:'private-ipinfo-token'},github:{token:'private-github-token',repository:'owner/repo'} };
const file = { name:'documento.pdf',mime_type:'application/pdf',base64:Buffer.from('%PDF-1.4\nfixture document').toString('base64') };
let calls, mode;
beforeEach(async()=>{
 f.reset();f.runtime.DB=d1;f.runtime.PLATFORM_OWNER_EMAIL=f.user.email;f.runtime.FAMA_DATA_BRIDGE_SECRET='private-internal-token';
 await server.integrationStore();sql.exec('DELETE FROM fama_platform_integrations;DELETE FROM fama_provider_activity;DROP TABLE IF EXISTS fama_integration_oauth');calls=[];mode='';
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init={})=>{
  const target=new URL(String(url));if(target.origin==='https://operation.fixture.test')return original(url,init);
  calls.push({url:String(url),init});assert.equal(init.redirect,'manual');
  if(mode==='redirect')return new Response(null,{status:307,headers:{Location:'https://foreign.example'}});
  if(mode==='timeout')throw new TypeError('fixture timeout');
  if(target.hostname==='oauth2.googleapis.com')return Response.json({access_token:'private-access-token',refresh_token:'private-new-refresh'});
  if(target.hostname==='www.googleapis.com'&&target.pathname.includes('/upload/')){assert.match(init.headers['Content-Type'],/^multipart\/related/);assert.ok(init.body instanceof Blob);assert.match(await init.body.text(),/%PDF/);return Response.json({id:'fixture-file',name:'documento.pdf'});}
  if(target.hostname==='www.googleapis.com'&&target.searchParams.get('alt')==='media')return new Response(Buffer.from(file.base64,'base64'));
  if(target.hostname==='www.googleapis.com'&&target.pathname.includes('/files/'))return Response.json(target.pathname.endsWith('/fixture-folder')?{id:'fixture-folder',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}:{id:'fixture-file',name:'documento.pdf',mimeType:'application/pdf',size:100,parents:[mode==='foreign-file'?'another-folder':'fixture-folder']});
  if(target.hostname==='www.googleapis.com'&&init.method==='POST')return Response.json({id:'fixture-new-folder'});
  if(target.hostname==='www.googleapis.com')return Response.json({files:[{id:'fixture-file',name:'documento.pdf',mimeType:'application/pdf'}]});
  if(target.hostname==='api.resend.com')return Response.json(target.pathname==='/domains'?{data:[]}:init.method==='POST'?{id:'fixture-email-id'}:{id:'fixture-email-id',last_event:'delivered'});
  if(target.hostname==='api.ocr.space')return Response.json({ParsedResults:[{ParsedText:'Texto revisável'}],IsErroredOnProcessing:false});
  if(target.hostname==='o123.ingest.sentry.io')return Response.json({id:'fixture-event'});
  if(target.hostname==='sentry.io')return Response.json([{id:'issue',title:'Falha técnica',count:'2'}]);
  if(target.hostname==='api.github.com')return Response.json([]);
  if(target.hostname==='api.ipinfo.io')return Response.json({ip:'8.8.8.8',country:'Brazil',country_code:'BR',asn:'AS123',as_name:'Network'});
  throw new Error('Unexpected provider destination: '+target.origin);
 };
});
after(async()=>{sql.close();delete globalThis.__operationAccessToken;await f.close();});
const save=(provider,more={})=>server.savePlatformIntegration({provider,enabled:true,expectedRevision:0,fields:fields[provider],...more});
const request=(body,token='private-internal-token')=>new Request('https://control.example.test/api/internal/integrations',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('configuration encrypts every credential, never returns secrets, preserves blank inputs and rejects stale changes',async()=>{
 const first=await save('resend');assert.equal(first.configured,true);assert.equal(first.fields.apiKey,undefined);assert.equal(first.present.apiKey,true);
 const row=sql.prepare('SELECT encrypted_config FROM fama_platform_integrations').get();assert.match(row.encrypted_config,/^fama:v1:/);assert.ok(!row.encrypted_config.includes(fields.resend.apiKey));assert.equal(calls.length,0);
 const next=await save('resend',{expectedRevision:1,fields:{apiKey:'',from:'new@example.test'}});assert.equal(next.revision,2);assert.equal((await server.readPlatformIntegration('resend')).fields.apiKey,fields.resend.apiKey);
 await assert.rejects(save('resend'),error=>error.status===409);
 await assert.rejects(save('github',{fields:{token:'bad\r\nheader'}}),error=>error.status===400);
 delete f.runtime.FAMA_DATA_ENCRYPTION_KEY;await assert.rejects(save('github'),error=>error.status===503);
});
test('only platform administrators with trusted origins can read or change configurations and execute operations',async()=>{
 f.runtime.PLATFORM_OWNER_EMAIL='other@example.test';f.runtime.PLATFORM_OWNER_USER_ID='other';
 assert.equal((await config.GET()).status,403);assert.equal((await config.PATCH(f.request('PATCH','/api/admin/integrations/config',{provider:'resend'}))).status,403);
 assert.equal((await actions.POST(f.request('POST','/api/admin/integrations/actions',{action:'test',provider:'resend'}))).status,403);
 f.runtime.PLATFORM_OWNER_EMAIL=f.user.email;assert.equal((await config.PATCH(f.request('PATCH','/api/admin/integrations/config',{}, {origin:'https://foreign.example'}))).status,403);assert.equal(calls.length,0);
});
test('provider configuration and summaries make no provider calls, and draft setup preserves the previous connection',async()=>{
 await save('drive',{fields:{clientId:'fixture-client',clientSecret:'private-google-secret'}});
 assert.equal(await server.runPlatformIntegration('drive_upload',{file}),null);
 const summary=await (await config.GET()).json();assert.equal(summary.integrations.length,6);assert.doesNotMatch(JSON.stringify(summary),/private-google-secret|encrypted_config/);assert.equal(calls.length,0);
});
test('internal operations reject missing authentication and non-operational administrative actions',async()=>{
 assert.equal((await internal.POST(request({action:'integration_status',organization_id:'org-one'},'wrong'))).status,401);
 assert.equal((await internal.POST(request({action:'github_rest_get',organization_id:'org-one',path:'repos/owner/repo/commits'}))).status,400);
 assert.equal((await internal.POST(request({action:'drive_upload',organization_id:'https://foreign.example',file}))).status,400);assert.equal(calls.length,0);
});
test('pausing a configured integration blocks the System bridge instead of falling back to an older connection',async()=>{
 await save('ocrspace',{enabled:false});
 const status=await(await internal.POST(request({action:'integration_status',organization_id:'org-one'}))).json();const item=status.integrations.find(item=>item.provider==='ocrspace');assert.equal(item.managed,true);assert.equal(item.configured,false);
 assert.equal((await internal.POST(request({action:'ocr_extract',organization_id:'org-one',file}))).status,424);assert.equal(calls.length,0);
});
test('Drive uses refreshed backend tokens and a correct multipart upload without exposing tokens',async()=>{
 await save('drive');const result=await server.runPlatformIntegration('drive_upload',{file});assert.equal(result.data.id,'fixture-file');assert.equal(calls.length,2);assert.doesNotMatch(JSON.stringify(result),/private-access-token|refresh/);
 const list=await server.runPlatformIntegration('drive_list');assert.equal(list.data.files[0].name,'documento.pdf');
});
test('Drive verifies folder write permission and downloads only files inside the configured folder',async()=>{
 await save('drive');assert.equal((await server.testPlatformIntegration('drive')).verified,true);
 const result=await server.downloadPlatformDriveFile('fixture-file');assert.equal(result.mime,'application/pdf');assert.match(new TextDecoder().decode(result.bytes),/%PDF/);
 mode='foreign-file';const count=calls.length;await assert.rejects(server.downloadPlatformDriveFile('fixture-file'),error=>error.status===403);assert.equal(calls.length,count+2);
});
test('OCR validates real file signatures and size before any provider call',async()=>{
 await save('ocrspace');assert.equal((await server.runPlatformIntegration('ocr_extract',{file})).data.text,'Texto revisável');const count=calls.length;
 await assert.rejects(server.runPlatformIntegration('ocr_extract',{file:{...file,base64:Buffer.from('not a PDF').toString('base64')}}),error=>error.status===400);
 await assert.rejects(server.runPlatformIntegration('ocr_extract',{file:{...file,base64:Buffer.alloc(1024*1024+1).toString('base64')}}),error=>error.status===413);assert.equal(calls.length,count);
 const testResult=await server.testPlatformIntegration('ocrspace');assert.equal(testResult.verified,false);assert.equal(calls.length,count);
});
test('Resend keeps idempotency across retries, prevents changed content, and isolates tenant receipts',async()=>{
 await save('resend');const body={file,to:'client@example.test',subject:'Documento',text:'Segue o documento',request_id:crypto.randomUUID()};
 const first=await server.runPlatformIntegration('resend_send',body,'org-one');assert.equal(first.data.id,'fixture-email-id');
 assert.equal((await server.runPlatformIntegration('resend_send',body,'org-one')).data.alreadySent,true);assert.equal(calls.length,1);
 await assert.rejects(server.runPlatformIntegration('resend_send',{...body,to:'another@example.test'},'org-one'),error=>error.status===409);
 await assert.rejects(server.runPlatformIntegration('resend_status',{id:first.data.id},'another-org'),error=>error.status===404);
 assert.equal((await server.runPlatformIntegration('resend_status',{id:first.data.id},'org-one')).data.status,'delivered');
});
test('uncertain e-mail requests stay blocked after provider timeouts and never send an automatic duplicate',async()=>{
 await save('resend');mode='timeout';const body={file,to:'client@example.test',subject:'Documento',text:'Segue',request_id:crypto.randomUUID()};
 await assert.rejects(server.runPlatformIntegration('resend_send',body));await assert.rejects(server.runPlatformIntegration('resend_send',body),error=>error.status===409);assert.equal(calls.length,1);assert.equal(sql.prepare('SELECT status FROM fama_provider_activity').get().status,'uncertain');
});
test('Sentry rejects arbitrary ingestion hosts and sends a fixed message with no user content',async()=>{
 for(const dsn of ['https://key@127.0.0.1/1','https://key@foreign.example/1','https://key:secret@o123.ingest.sentry.io/1'])await assert.rejects(save('sentry',{fields:{dsn}}),error=>error.status===400);
 await save('sentry');await server.runPlatformIntegration('sentry_capture',{message:'customer@example.test',frames:['private-data']});assert.doesNotMatch(calls[0].init.body,/customer@example|private-data/);
 assert.equal((await server.runPlatformIntegration('sentry_issues')).data.issues[0].title,'Falha técnica');
});
test('provider redirects and invalid GitHub/IPinfo destinations cannot forward credentials',async()=>{
 await save('github');await save('ipinfo');await assert.rejects(server.runPlatformIntegration('github_rest_get',{path:'https://foreign.example'}),error=>error.status===400);await assert.rejects(server.runPlatformIntegration('ipinfo_lookup',{ip:'https://foreign.example'}),error=>error.status===400);assert.equal(calls.length,0);
 mode='redirect';await assert.rejects(server.runPlatformIntegration('github_rest_get',{path:'repos/owner/repo/commits'}));assert.equal(calls.length,1);
});
test('Google authorization binds the state to the actor, rejects replay and saves refreshed credentials encrypted',async()=>{
 await save('drive',{fields:{clientId:'fixture-client',clientSecret:'private-google-secret'}});
 const started=await oauth.beginDriveAuthorization('admin-one','https://control.example.test'), target=new URL(started.authorizationUrl);
 assert.equal(target.origin,'https://accounts.google.com');assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.doesNotMatch(started.authorizationUrl,/private-google-secret/);
 const callback=new URL(started.redirectUri);callback.searchParams.set('state',target.searchParams.get('state'));callback.searchParams.set('code','private-auth-code');
 await assert.rejects(oauth.completeDriveAuthorization('other-admin',callback),error=>error.status===400);assert.equal(calls.length,0);
 const saved=await oauth.completeDriveAuthorization('admin-one',callback);assert.equal(saved.configured,true);assert.equal(saved.fields.refreshToken,undefined);assert.equal(saved.fields.folderId,'fixture-new-folder');
 await assert.rejects(oauth.completeDriveAuthorization('admin-one',callback),error=>error.status===400);assert.equal(calls.length,2);assert.equal((await server.readPlatformIntegration('drive')).fields.refreshToken,'private-new-refresh');
});
test('expired Google consent and configuration changes prevent any token exchange',async()=>{
 await save('drive');let started=await oauth.beginDriveAuthorization('admin-one','https://control.example.test');
 const callback=()=>{const url=new URL(started.redirectUri);url.searchParams.set('state',new URL(started.authorizationUrl).searchParams.get('state'));url.searchParams.set('code','fixture-code');return url;};
 sql.prepare('UPDATE fama_integration_oauth SET expires_at=?').run('2000-01-01');await assert.rejects(oauth.completeDriveAuthorization('admin-one',callback()),error=>error.status===400);
 started=await oauth.beginDriveAuthorization('admin-one','https://control.example.test');await save('drive',{expectedRevision:1,fields:{clientId:'replacement-client'}});await assert.rejects(oauth.completeDriveAuthorization('admin-one',callback()),error=>error.status===409);assert.equal(calls.length,0);
});
