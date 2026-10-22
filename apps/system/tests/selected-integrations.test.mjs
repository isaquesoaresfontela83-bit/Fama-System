import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { operationalFixture } from './operational-fixture.mjs';
const f = await operationalFixture(new URL('../', import.meta.url).pathname);
const sql = new DatabaseSync(':memory:');
const d1 = { prepare(query) { let values=[]; const statement=sql.prepare(query); const api={ bind(...args){values=args;return api;}, async first(){return statement.get(...values)||null;}, async all(){return {results:statement.all(...values)};}, async run(){return {meta:{changes:Number(statement.run(...values).changes)}};} };return api;} };
const server=await f.load('/lib/selected-integrations-server.js');
const settings=await f.load('/app/api/integrations/route.js');
const documents=await f.load('/app/api/integrations/documents/route.js');
const github=await f.load('/app/api/integrations/github/route.js');
const ipinfo=await f.load('/app/api/integrations/ipinfo/route.js');
const sentry=await f.load('/app/api/integrations/sentry/route.js');
const bridge=await f.load('/lib/integration-backend.js');
const pdf=new TextEncoder().encode('%PDF-1.4\nfixture');
let backend,mode,gate,releaseGate;
beforeEach(async()=>{
 f.reset();delete globalThis.__operationAccessToken;f.runtime.DB=d1;await server.integrationTables();sql.exec('DELETE FROM fama_integration_operations');
 backend=[];mode='';gate=null;
 f.tables.attachments=[{id:'file-one',organization_id:'org-one',entity_type:'workOrders',object_path:'org-one/workOrders/order-one/documento.pdf',file_name:'documento.pdf',mime_type:'application/pdf',size_bytes:pdf.length}];
 const delegated=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  assert.equal(url.origin,'https://operation.fixture.test','the Worker must not call a provider directly');
  if(url.pathname==='/functions/v1/fama-system-integrations'){
   const body=JSON.parse(init.body),headers=new Headers(init.headers);backend.push({url,body,headers});assert.equal(init.redirect,'manual');
   if(mode==='redirect')return new Response(null,{status:307,headers:{location:'https://foreign.example'}});
   if(mode==='invalid')return new Response('not-json');
   if(mode==='unconfigured')return Response.json({ok:false,message:'Configuração pendente.'},{status:424});
   if(body.action==='integration_status')return Response.json({ok:true,data:Object.fromEntries(['google_drive','resend','ocr_space','sentry'].map(key=>[key,{configured:true}]))});
   if(body.action==='drive_upload')return Response.json({ok:true,data:{id:'fixture-drive-file',web_view_link:'https://foreign.example/ignored'}});
   if(body.action==='ocr_extract')return Response.json({ok:true,data:{text:'Texto para revisar',partial:mode==='partial'}});
   if(body.action==='sentry_capture')return Response.json({ok:true,data:{event_id:'fixture-event'}});
   if(body.action==='resend_send'){
    if(gate)await gate;
    if(mode==='timeout')throw new TypeError('fixture timeout');
    if(mode==='server-error')return Response.json({ok:false,message:'Serviço indisponível.'},{status:502});
    return Response.json({ok:true,data:{id:'fixture-email'}});
   }
   throw new Error('Unexpected backend action');
  }
  if(url.pathname.startsWith('/storage/v1/object/sign/'))return init.method==='POST'?Response.json({signedURL:'/object/sign/fama-documents/org-one/workOrders/order-one/documento.pdf?token=fixture'}):new Response(pdf);
  return delegated(input,init);
 };
});
after(async()=>{delete globalThis.__operationAccessToken;sql.close();await f.close();});
const action=(provider,more={},headers={})=>documents.POST(f.request('POST','/api/integrations/documents',{provider,attachmentId:'file-one',...more},headers));
const mail=()=>({recipient:'client@example.test',subject:'Documento solicitado',message:'Segue o documento.',operationId:crypto.randomUUID()});

test('System exposes only the three operational integrations and gets their status from the protected backend',async()=>{
 const response=await settings.GET(f.request('GET','/api/integrations'));assert.equal(response.status,200);
 const data=await response.json();assert.deepEqual(data.integrations.map(item=>item.provider),['drive','sentry','ocrspace']);
 assert.ok(data.integrations.every(item=>item.configured&&item.managedBy==='platform'));assert.equal(backend.length,1);
 assert.equal(backend[0].headers.get('authorization'),'Bearer fixture-user-access-token');assert.equal(backend[0].body.organization_id,'org-one');
 assert.doesNotMatch(JSON.stringify(data),/access-token|client_secret|refresh_token|api_key/);
});
test('configuration cannot receive or persist provider keys from the browser',async()=>{
 const response=await settings.POST(f.request('POST','/api/integrations',{provider:'resend',secret:'re_do_not_store'}));assert.equal(response.status,405);assert.equal(backend.length,0);assert.equal(f.businessWrites().length,0);
});
test('GitHub and IPinfo are unavailable through the System API',async()=>{
 for(const route of [github,ipinfo])assert.equal((await route.GET(f.request('GET','/api/integrations/legacy'))).status,410);
 assert.equal(backend.length,0);
});
test('ordinary members, foreign origins, and other companies cannot reach an integration',async()=>{
 f.member().role='member';f.member().permissions=['orders'];assert.equal((await action('ocrspace')).status,403);assert.equal((await settings.GET(f.request('GET','/api/integrations'))).status,403);
 f.member().role='owner';assert.equal((await action('drive',{}, {origin:'https://foreign.example'})).status,403);assert.equal((await documents.POST(f.request('POST','/api/integrations/documents',{provider:'drive',attachmentId:'file-one'},{'x-organization-id':'another-org'}))).status,403);assert.equal(backend.length,0);
});
test('cross-company files and revoked module access are rejected before any backend operation',async()=>{
 f.tables.attachments[0].organization_id='another-org';assert.equal((await action('ocrspace')).status,404);
 f.tables.attachments[0].organization_id='org-one';f.member().role='admin';f.member().permissions=[];assert.equal((await action('ocrspace')).status,403);assert.equal(backend.length,0);
});
test('Drive uses the backend OAuth connection and never forwards a browser Google token',async()=>{
 const response=await action('drive',{}, {'x-fama-google-token':'browser-token-must-not-forward'});assert.equal(response.status,200);assert.equal((await response.json()).url,'https://drive.google.com/file/d/fixture-drive-file/view');
 assert.equal(backend[0].body.action,'drive_upload');assert.equal(backend[0].body.file.base64,Buffer.from(pdf).toString('base64'));assert.doesNotMatch(JSON.stringify(backend[0].body),/browser-token|access_token/);
});
test('OCR enforces size and signature before sending a partial result for review',async()=>{
 mode='partial';const response=await action('ocrspace');assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:'Texto para revisar',partial:true});assert.equal(backend[0].body.language,'por');
 f.tables.attachments[0].size_bytes=2*1024*1024;assert.equal((await action('ocrspace')).status,413);assert.equal(backend.length,1);
 await assert.rejects(server.extractDocumentText('org-one',new Uint8Array([1,2,3]),'image/png'),/válido/);
});
test('retired Resend document actions fail before loading an attachment or calling the backend',async()=>{
 assert.equal((await action('resend',mail())).status,400);assert.equal(backend.length,0);assert.equal(f.businessWrites().length,0);assert.ok(f.calls.every(call=>!call.url.pathname.endsWith('/attachments')&&!call.url.pathname.startsWith('/storage/')));
 await assert.rejects(bridge.integrationBackend('fama-system-integrations','resend_send'),error=>error.status===400);assert.equal(backend.length,0);
});
test('Sentry sends a fixed technical message without client data or stack URLs',async()=>{
 const response=await sentry.POST(f.request('POST','/api/integrations/sentry',{kind:'browser_error',message:'customer@example.test',frames:[{filename:'https://foreign.example/private?token=secret'}]}));assert.equal(response.status,200);assert.equal((await response.json()).eventId,'fixture-event');assert.doesNotMatch(JSON.stringify(backend[0].body),/customer@example|foreign.example|token=secret|frames/);
});
test('missing credentials, redirects, invalid JSON and missing sessions fail clearly without provider calls',async()=>{
 mode='unconfigured';assert.equal((await settings.GET(f.request('GET','/api/integrations'))).status,424);
 mode='redirect';assert.equal((await settings.GET(f.request('GET','/api/integrations'))).status,502);
 mode='invalid';assert.equal((await settings.GET(f.request('GET','/api/integrations'))).status,502);
 mode='';globalThis.__operationAccessToken='';assert.equal((await settings.GET(f.request('GET','/api/integrations'))).status,401);
 const count=backend.length;await assert.rejects(bridge.integrationBackend('foreign-service','integration_status'),/inválida/);assert.equal(backend.length,count);
});

test('System uses the protected Control bridge and merges central settings with existing connections',async()=>{
 const secret='private-control-bridge-fixture';f.runtime.FAMA_DATA_BRIDGE_SECRET=secret;
 const calls=[];f.runtime.FAMA_CONTROL={async fetch(url,init){calls.push({url,init});assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+secret);return Response.json({handled:true,integrations:[{provider:'drive',managed:true,configured:false},{provider:'resend',managed:false,configured:false}]});}};
 try {
  const response=await settings.GET(f.request('GET','/api/integrations'));assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.integrations.find(item=>item.provider==='drive').configured,false);assert.equal(data.integrations.some(item=>item.provider==='resend'),false);assert.equal(backend.length,1);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://control.famasystem.online/api/internal/integrations');assert.doesNotMatch(JSON.stringify(data),/private-control|access-token/);
 } finally {delete f.runtime.FAMA_CONTROL;delete f.runtime.FAMA_DATA_BRIDGE_SECRET;}
});
test('a central operation replaces the legacy backend, while a paused central integration fails closed',async()=>{
 f.runtime.FAMA_DATA_BRIDGE_SECRET='private-control-bridge-fixture';let paused=false;
 f.runtime.FAMA_CONTROL={async fetch(){return paused?Response.json({error:'Integração pausada.'},{status:424}):Response.json({handled:true,data:{text:'Texto da central',partial:false}});}};
 try {
  const response=await action('ocrspace');assert.equal(response.status,200);assert.equal((await response.json()).text,'Texto da central');assert.equal(backend.length,0);
  paused=true;assert.equal((await action('ocrspace')).status,424);assert.equal(backend.length,0);
 } finally {delete f.runtime.FAMA_CONTROL;delete f.runtime.FAMA_DATA_BRIDGE_SECRET;}
});
test('an older Control without the bridge keeps the previously configured backend usable',async()=>{
 f.runtime.FAMA_DATA_BRIDGE_SECRET='private-control-bridge-fixture';f.runtime.FAMA_CONTROL={async fetch(){return new Response(null,{status:404});}};
 try {assert.equal((await action('ocrspace')).status,200);assert.equal(backend.length,1);}
 finally{delete f.runtime.FAMA_CONTROL;delete f.runtime.FAMA_DATA_BRIDGE_SECRET;}
});
