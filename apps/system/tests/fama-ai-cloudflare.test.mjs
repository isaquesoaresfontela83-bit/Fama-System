import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const originalFetch = globalThis.fetch;
globalThis.__cloudflareRuntime = {};
const vite = await createServer({ configFile:false, root, server:{middlewareMode:true,hmr:false,ws:false}, plugins:[{
  name:'python-ai-fixture',resolveId(id){if(id==='cloudflare:workers')return '\0python-env';},
  load(id){if(id==='\0python-env')return 'export const env=globalThis.__cloudflareRuntime;';}
}]});
const {enrichWithCloudflare,cloudflareConnectionStatus,testCloudflareConnection}=await vite.ssrLoadModule('/lib/fama-ai-cloudflare.js');
const token='fixture-python-service-token-at-least-32-characters';
const endpoint='https://python.example.test';
const input={question:'Como priorizar os recebimentos?',source:'finance',history:['Financeiro deste mês'],timeZone:'America/Sao_Paulo'};
const native={source:'finance',text:'A receber: R$ 450,00. Um lançamento pendente.',actions:[{label:'Ver financeiro',section:'finance'}],engine:'internal'};
const activate=()=>Object.assign(globalThis.__cloudflareRuntime,{FAMA_AI_PYTHON_URL:endpoint,FAMA_AI_PYTHON_TOKEN:token,FAMA_AI_GENERATIVE_ENABLED:'true'});
const reply=response=>Response.json({state:'ready',response,runtime:'python'});
let calls;
beforeEach(()=>{
  Object.keys(globalThis.__cloudflareRuntime).forEach(key=>delete globalThis.__cloudflareRuntime[key]);
  calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init});return reply('Priorize os recebimentos pendentes e confira o vencimento no financeiro.');};
});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.__cloudflareRuntime;await vite.close();});

test('missing, paused and invalid Python configuration preserve internal answers without a model call',async()=>{
  assert.equal(cloudflareConnectionStatus().cloud.state,'awaiting_key');assert.equal(await enrichWithCloudflare(input,native),native);
  activate();delete globalThis.__cloudflareRuntime.FAMA_AI_PYTHON_URL;
  assert.equal(cloudflareConnectionStatus().cloud.state,'awaiting_account');assert.equal(await enrichWithCloudflare(input,native),native);
  activate();globalThis.__cloudflareRuntime.FAMA_AI_GENERATIVE_ENABLED='false';assert.equal(cloudflareConnectionStatus().cloud.state,'disabled');assert.equal(await enrichWithCloudflare(input,native),native);
  assert.equal(calls.length,0);
});
test('status never infers or exposes service credentials',()=>{
  activate();const status=cloudflareConnectionStatus();assert.equal(status.cloud.state,'ready');
  assert.doesNotMatch(JSON.stringify(status),/fixture-python|python.example|token|secret/i);assert.equal(calls.length,0);
});
test('Python receives only bounded authorized evidence; records and actions remain unchanged',async()=>{
  activate();globalThis.__cloudflareRuntime.FAMA_AI_MAX_TOKENS='999999';const answer=await enrichWithCloudflare(input,native);
  assert.equal(answer.engine,'cloudflare');assert.equal(answer.cloudState,'ready');assert.equal(answer.text,native.text);assert.equal(answer.actions,native.actions);
  assert.equal(calls.length,1);const {url,init}=calls[0];assert.equal(url,endpoint+'/v1/generate');assert.equal(init.redirect,'manual');assert.equal(init.headers.Authorization,'Bearer '+token);
  const body=JSON.parse(init.body);assert.equal(body.maxTokens,2048);assert.equal(body.evidence.text,native.text);assert.deepEqual(body.history,input.history);
  assert.equal(body.model,undefined);assert.equal(body.messages,undefined);assert.doesNotMatch(init.body,/fixture-python|Ver financeiro/);
});
test('unsupported numbers, execution claims, tool replies and echoed credentials are rejected',async()=>{
  activate();for(const raw of ['O saldo é R$ 999,00.','Enviei a cobrança.',{type:'tool_use'},token]){
    globalThis.fetch=async()=>reply(raw);const result=await enrichWithCloudflare(input,native);assert.equal(result.cloudState,'invalid_response');assert.equal(result.engine,'internal');assert.equal(result.text,native.text);
  }
});
test('Python errors, redirects, malformed and oversized responses fall back without retrying or leaking content',async()=>{
  activate();for(const response of [new Response(token,{status:401}),new Response(null,{status:307,headers:{Location:'https://evil.example'}}),Response.json({state:'unavailable'},{status:429}),new Response('bad json',{headers:{'Content-Type':'application/json'}}),new Response('x'.repeat(64001),{headers:{'Content-Type':'application/json'}})]){
    let count=0;globalThis.fetch=async()=>{count++;return response;};const result=await enrichWithCloudflare(input,native);
    assert.equal(count,1);assert.equal(result.cloudState,'unavailable');assert.equal(result.engine,'internal');assert.doesNotMatch(JSON.stringify(result),/fixture-python|bad json/);
  }
});
test('cancellation aborts in-flight requests and skips already cancelled requests',async()=>{
  activate();const controller=new AbortController();let upstream;
  globalThis.fetch=async(url,init)=>{upstream=init.signal;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));};
  const pending=enrichWithCloudflare(input,native,controller.signal);controller.abort();assert.equal((await pending).cloudState,'unavailable');assert.equal(upstream.aborted,true);
  globalThis.fetch=async()=>{throw new Error('must not infer');};assert.equal(await enrichWithCloudflare(input,native,controller.signal),native);
});
test('deadline bounds a stalled Python service',async()=>{
  activate();globalThis.__cloudflareRuntime.FAMA_AI_TIMEOUT_MS='1000';let count=0;
  globalThis.fetch=async(url,init)=>{count++;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));};
  assert.equal((await enrichWithCloudflare(input,native)).cloudState,'unavailable');assert.equal(count,1);
});
test('unsafe origins and invalid tokens cannot receive the service credential',async()=>{
  for(const url of ['http://python.example.test','https://u:p@python.example.test','https://python.example.test/path','https://python.example.test/?key=x','not-a-url']){
    activate();globalThis.__cloudflareRuntime.FAMA_AI_PYTHON_URL=url;assert.equal(cloudflareConnectionStatus().cloud.state,'invalid_configuration');assert.equal(await enrichWithCloudflare(input,native),native);
  }
  activate();globalThis.__cloudflareRuntime.FAMA_AI_PYTHON_TOKEN='short';assert.equal(cloudflareConnectionStatus().cloud.state,'invalid_configuration');assert.equal(calls.length,0);
});
test('diagnostics send no records to Python and sanitize errors',async()=>{
  activate();const result=await testCloudflareConnection();assert.equal(result.ok,true);assert.equal(calls[0].url,endpoint+'/v1/connection-test');assert.deepEqual(JSON.parse(calls[0].init.body),{});
  globalThis.fetch=async()=>Response.json({state:'unavailable',error:token},{status:403});const error=await testCloudflareConnection();assert.equal(error.ok,false);assert.equal(error.httpStatus,403);assert.doesNotMatch(JSON.stringify(error),/fixture-python/);
});
