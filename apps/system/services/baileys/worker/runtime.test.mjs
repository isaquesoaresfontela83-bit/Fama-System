import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../package.json',import.meta.url)),{Miniflare}=require('miniflare');
const directory=fileURLToPath(new URL('./dist/',import.meta.url)),token='runtime-test-token-'.repeat(4);
// The pinned local workerd supports dates through May; production targets October.
const mf=new Miniflare({modulesRoot:directory,modules:[{type:'ESModule',path:directory+'index.js'},{type:'CompiledWasm',path:directory+'rust-bridge.wasm'}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],bindings:{BAILEYS_API_TOKEN:token,BAILEYS_ENCRYPTION_KEY:'a'.repeat(64)},durableObjects:{WHATSAPP:{className:'WhatsAppCompany',useSQLite:true}},durableObjectsPersist:false});
const org='11111111-1111-4111-8111-111111111111';
const request=(path,method='GET',body)=>mf.dispatchFetch('https://baileys.test'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
after(async()=>await mf.dispose());
test('real Worker imports original WASM and rejects unauthenticated access',async()=>{
    assert.equal((await mf.dispatchFetch('https://baileys.test/health')).status,401);
    const response=await request('/health');assert.equal(response.status,200);assert.equal((await response.json()).runtime,'cloudflare-durable-objects');
});
test('Durable Object storage starts isolated and rejects invalid company paths',async()=>{
    const response=await request('/v1/companies/'+org+'/session');assert.equal(response.status,200);assert.equal((await response.json()).status,'disconnected');
    const conversations=await request('/v1/companies/22222222-2222-4222-8222-222222222222/conversations');assert.deepEqual(await conversations.json(),{conversations:[]});
    assert.equal((await request('/v1/companies/invalid/session')).status,404);
});
test('validation status survives RPC and does not initiate a WhatsApp send',async()=>{
    const response=await request('/v1/companies/'+org+'/messages','POST',{phone:'invalid',text:'Test',clientId:org});assert.equal(response.status,400);
    assert.equal((await request('/v1/companies/'+org+'/messages','POST',{phone:'5561999999999',text:'Test',clientId:org})).status,409);
    assert.equal((await request('/v1/companies/'+org+'/messages','POST',{phone:'5561999999999',text:'Test',clientId:org,providerToken:'forged'})).status,400);
});
