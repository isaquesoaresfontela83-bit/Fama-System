import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
import {FAMA_VERSION,FAMA_RELEASE_ID} from '../lib/fama-release.js';
const f=await operationalFixture(new URL('../',import.meta.url).pathname);
const route=await f.load('/app/api/admin/integrations/route.js');
let backend,systemVersion,systemRelease,mode;
beforeEach(()=>{
 f.reset();delete globalThis.__operationAccessToken;f.runtime.PLATFORM_OWNER_EMAIL=f.user.email;backend=[];mode='';systemVersion=FAMA_VERSION;systemRelease=FAMA_RELEASE_ID;
 f.runtime.FAMA_SYSTEM={async fetch(url){assert.equal(url,'https://famasystem.online/api/health');if(mode==='system-down')throw new Error('Fixture down');return Response.json({service:'Fama System',version:systemVersion,releaseId:systemRelease});}};
 const delegated=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://operation.fixture.test');
  if(url.pathname==='/functions/v1/fama-control-admin'){
   const body=JSON.parse(init.body),headers=new Headers(init.headers);backend.push({url,body,headers});assert.equal(headers.get('authorization'),'Bearer fixture-user-access-token');assert.equal(init.redirect,'manual');
   if(mode==='backend-down')throw new TypeError('Fixture down');
   if(body.action==='integration_status')return Response.json({ok:true,data:{google_drive:{configured:false},resend:{configured:false},sentry:{configured:false},ocr_space:{configured:false},ipinfo:{available:true,mode:'public_legacy'},ipinfo_lite:{available:false},github_rest:{available:true,mode:'read_only_public'},secret:'must-not-reach-browser'}});
   if(body.action==='github_rest_get')return Response.json({ok:true,data:body.path.endsWith('/commits')?[{sha:'a'.repeat(40),commit:{message:'Atualização conjunta\nprivate detail',committer:{date:'2026-10-20T12:00:00Z'}}}]:[]});
   if(body.action==='ipinfo_lookup')return Response.json({ok:true,data:{ip:body.ip,country:'Brazil',country_code:'BR',asn:'AS123',as_name:'Fixture network',token:'must-not-reach-browser'},source:'ipinfo_public',cached:true});
   throw new Error('Unexpected backend action');
  }
  return delegated(input,init);
 };
});
after(async()=>{delete globalThis.__operationAccessToken;await f.close();});
const post=(body,headers={})=>route.POST(f.request('POST','/api/admin/integrations',body,headers));
test('Control reports all six services, safe missing-credential states, and actual companion synchronization',async()=>{
 const response=await route.GET();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);const data=await response.json();assert.equal(data.providers.length,6);assert.equal(data.release.synchronized,true);
 assert.equal(data.providers.find(item=>item.id==='drive').configured,false);assert.equal(data.providers.find(item=>item.id==='ipinfo').configured,false);assert.equal(data.providers.find(item=>item.id==='ipinfo').available,true);assert.equal(data.providers.find(item=>item.id==='github').available,true);assert.doesNotMatch(JSON.stringify(data),/must-not-reach-browser|access-token/);
});
test('older and unreachable System releases are never reported as synchronized',async()=>{
 systemRelease='older';assert.equal((await (await route.GET()).json()).release.synchronized,false);mode='system-down';const data=await (await route.GET()).json();assert.equal(data.release.system,null);assert.equal(data.release.synchronized,false);
});
test('a failed backend produces unavailable status instead of a made-up configured connection',async()=>{
 mode='backend-down';const data=await (await route.GET()).json();assert.equal(data.backendAvailable,false);assert.ok(data.providers.every(item=>item.configured===null&&!item.available));assert.match(data.backendMessage,/Não foi possível/);
});
test('GitHub uses only a validated repository and omits extra caller input from backend requests',async()=>{
 const response=await post({provider:'github',repository:'owner/repo',path:'repos/other/private',secret:'never-forward'});assert.equal(response.status,200);const data=await response.json();assert.equal(data.repository,'owner/repo');assert.equal(data.release,null);assert.equal(data.commits[0].message,'Atualização conjunta');assert.equal(backend.length,2);
 assert.ok(backend.every(call=>call.body.action==='github_rest_get'&&call.body.path.startsWith('repos/owner/repo/')));assert.doesNotMatch(JSON.stringify(backend.map(call=>call.body)),/never-forward|other\/private/);
 assert.equal((await post({provider:'github',repository:'owner/repo/../secrets'})).status,400);assert.equal(backend.length,2);
});
test('IPinfo validates IP addresses and never trusts a browser forwarded-IP header',async()=>{
 assert.equal((await post({provider:'ipinfo',ip:'https://foreign.example'})).status,400);assert.equal((await post({provider:'ipinfo'},{'x-forwarded-for':'8.8.8.8'})).status,400);assert.equal(backend.length,0);
 const response=await post({provider:'ipinfo'},{'cf-connecting-ip':'8.8.8.8'});assert.equal(response.status,200);const data=await response.json();assert.equal(data.ip,'8.8.8.8');assert.equal(data.source,'IPinfo público');assert.equal(data.cached,true);assert.doesNotMatch(JSON.stringify(data),/must-not-reach-browser|token/);
});
test('ordinary users and foreign origins cannot read or invoke administrative integrations',async()=>{
 f.runtime.PLATFORM_OWNER_EMAIL='another@example.test';f.runtime.PLATFORM_OWNER_USER_ID='different-user';assert.equal((await route.GET()).status,403);assert.equal((await post({provider:'github'})).status,403);assert.equal(backend.length,0);
 f.runtime.PLATFORM_OWNER_EMAIL=f.user.email;assert.equal((await post({provider:'github'},{origin:'https://foreign.example'})).status,403);assert.equal((await post({provider:'resend',action:'resend_send'})).status,400);assert.equal(backend.length,0);
});
test('administrative queries require an actual server-side user session',async()=>{
 globalThis.__operationAccessToken='';assert.equal((await post({provider:'github'})).status,401);assert.equal(backend.length,0);
});
