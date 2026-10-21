import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {createServer} from 'vite';

const root=new URL('..',import.meta.url).pathname;
const originalFetch=globalThis.fetch;
globalThis.__recoveryEmailFixture={runtime:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},events:[]};
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},ssr:{noExternal:['next']},server:{hmr:false,middlewareMode:true,ws:false},plugins:[{
  name:'recovery-email-fixtures',enforce:'pre',
  resolveId(id){
    if(id==='cloudflare:workers')return '\0recovery-email-env';
    if(id==='next/headers')return '\0recovery-email-cookies';
    if(/\/lib\/security(?:\.js)?$/.test(id))return '\0recovery-email-limit';
    if(/\/lib\/operation-events(?:\.js)?$/.test(id))return '\0recovery-email-events';
  },
  load(id){
    if(id==='\0recovery-email-env')return 'export const env=globalThis.__recoveryEmailFixture.runtime;';
    if(id==='\0recovery-email-cookies')return 'export async function cookies(){throw new Error("Cookies should not be accessed by recovery requests");}';
    if(id==='\0recovery-email-limit')return 'export async function assertRateLimit(){}';
    if(id==='\0recovery-email-events')return 'export async function recordOperation(...args){globalThis.__recoveryEmailFixture.events.push(args);}';
  }
}]});
const {POST}=await vite.ssrLoadModule('/app/api/auth/recover/route.js');
beforeEach(()=>{globalThis.__recoveryEmailFixture.events=[];});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.__recoveryEmailFixture;await vite.close();});
const request=(email='fixture@example.test')=>new Request('https://famasystem.online/api/auth/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});

test('recovery validates email and uses the production recovery destination',async()=>{
  let calls=0;globalThis.fetch=async(input,init)=>{
    calls++;assert.equal(new URL(input).searchParams.get('redirect_to'),'https://famasystem.online/auth/recuperar');
    assert.deepEqual(JSON.parse(init.body),{email:'fixture@example.test'});return Response.json({});
  };
  assert.equal((await POST(request('invalid'))).status,400);assert.equal(calls,0);
  const response=await POST(request(' Fixture@Example.test '));assert.equal(response.status,200);assert.equal((await response.json()).sent,true);
  assert.deepEqual(globalThis.__recoveryEmailFixture.events,[['email','ok','recovery_requested']]);
});

test('SMTP recipient restrictions and provider quotas return actionable recovery messages',async()=>{
  for(const [code,status,expected] of [['email_address_not_authorized',400,/temporariamente indisponível/],['over_email_send_rate_limit',429,/limite de envio de e-mails/]]){
    globalThis.fetch=async()=>Response.json({code,message:'Provider message'},{status});
    const response=await POST(request());assert.equal(response.status,status);assert.match((await response.json()).error,expected);
  }
});

test('a recovery provider outage remains a failed operation and never reports an email as sent',async()=>{
  globalThis.fetch=async()=>{throw new TypeError('Network failure');};
  const response=await POST(request());assert.equal(response.status,503);
  const payload=await response.json();assert.equal(payload.sent,undefined);assert.match(payload.error,/Não foi possível enviar/);
  assert.deepEqual(globalThis.__recoveryEmailFixture.events,[['email','error','recovery_provider_error']]);
});
