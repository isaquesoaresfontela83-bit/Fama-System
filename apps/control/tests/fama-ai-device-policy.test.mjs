import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({configFile:false,root,server:{middlewareMode:true,hmr:false,ws:false}});
const {localAiDevicePolicy}=await vite.ssrLoadModule('/lib/fama-ai-device.js');
const {localAssistantMessages}=await vite.ssrLoadModule('/lib/fama-ai-local.js');
after(()=>vite.close());
test('phone, tablet and memory limits take precedence over a capable GPU',()=>{
 for(const device of [{userAgent:'Android 12',deviceMemory:8},{userAgentData:{mobile:true},deviceMemory:8},{userAgent:'iPad'},{userAgent:'Macintosh',maxTouchPoints:5,deviceMemory:8},{userAgent:'Windows',deviceMemory:4}])assert.equal(localAiDevicePolicy(device).language,false);
 assert.equal(localAiDevicePolicy({userAgent:'Windows',deviceMemory:8}).language,true);
 assert.equal(localAiDevicePolicy({userAgent:'Android',deviceMemory:2}).speech,false);
 assert.equal(localAiDevicePolicy({userAgent:'Android',deviceMemory:4}).speech,true);
});
test('local prose receives a bounded excerpt even with long or heavily escaped record text',()=>{
 for(const value of ['Long question '.repeat(10000),'"\\\u0000'.repeat(10000)]){
  const messages=localAssistantMessages(value,{source:'overview',text:value,note:value,actions:[]},[value,value,value]);
  assert.ok(messages.reduce((size,item)=>size+item.content.length,0)<=6000);assert.match(messages[1].content,/FIM_DADOS/);
 }
});
