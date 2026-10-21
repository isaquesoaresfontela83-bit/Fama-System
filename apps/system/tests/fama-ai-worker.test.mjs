import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {memoryCacheStorage} from './fama-ai-cache-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const nativeFetch=globalThis.fetch;const nativeSelf=globalThis.self;const nativeCaches=globalThis.caches;globalThis.caches=memoryCacheStorage();
const nativeNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
const responses=[];const downloads=[];globalThis.__localFixture={calls:[],generated:'Confira a agenda.'};
globalThis.self={location:{origin:'https://fama.example.test'},postMessage:message=>responses.push(message)};
const mockDownload=async(url,init)=>{downloads.push({url,init});return Response.json({});};globalThis.fetch=mockDownload;
const openVite=()=>createServer({configFile:false,root,ssr:{noExternal:['@huggingface/transformers']},resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false},plugins:[{name:'local-model-fixture',enforce:'pre',resolveId(id){if(id==='@huggingface/transformers')return '\0local-pipeline';},load(id){if(id==='\0local-pipeline')return `export const env={backends:{onnx:{wasm:{}}}};export async function pipeline(task,id,options){globalThis.__localFixture.calls.push({task,id,options});const files=task==='text-generation'?['config.json','onnx/model_q4f16.onnx']:['config.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'];for(const file of files){const url='https://huggingface.co/'+id+'/resolve/'+options.revision+'/'+file;let response=await env.customCache.match(url);if(!response){response=await fetch(url);if(response.status!==200)throw new Error('Missing model');const bytes=await response.arrayBuffer();await env.customCache.put(url,new Response(bytes));}}await fetch(env.backends.onnx.wasm.wasmPaths.wasm);const callable=async(input,settings)=>{globalThis.__localFixture.calls.push({input,settings});return task==='text-generation'?[{generated_text:globalThis.__localFixture.generated}]:{text:'Agenda de amanhã'};};callable.tokenizer={apply_chat_template:(messages,options)=>{globalThis.__localFixture.template={messages,options};return JSON.stringify(messages);}};return callable;}`;}}]});
let vite=await openVite();
await vite.ssrLoadModule('/workers/fama-local-ai.worker.js');
const send=async(message)=>{responses.length=0;await globalThis.self.onmessage({data:message});return responses.at(-1);};
after(async()=>{globalThis.fetch=nativeFetch;globalThis.self=nativeSelf;if(nativeNavigator)Object.defineProperty(globalThis,'navigator',nativeNavigator);else delete globalThis.navigator;if(nativeCaches===undefined)delete globalThis.caches;else globalThis.caches=nativeCaches;delete globalThis.__localFixture;await vite.close();});
test('invalid inference input is rejected before allocating any pipeline',async()=>{
 const count=globalThis.__localFixture.calls.length;
 for(const request of [{id:90,kind:'language',operation:'generate',messages:[{role:'user',content:'x'.repeat(6001)}]},{id:91,kind:'language',operation:'generate',messages:[null]},{id:92,kind:'speech',operation:'transcribe',audio:new Float32Array(480001)}])assert.equal((await send(request)).type,'error');
 assert.equal(globalThis.__localFixture.calls.length,count);assert.equal(downloads.length,0);
});
test('local worker prepares a model with only fixed public downloads and no credentials',async()=>{
 const reply=await send({id:1,kind:'language',operation:'load'});assert.equal(reply.type,'done',JSON.stringify({calls:globalThis.__localFixture.calls.map(x=>({task:x.task,id:x.id})),downloads:downloads.map(x=>x.url),reply}));assert.equal(downloads.length,3);assert.equal(reply.saved,true);assert.equal(downloads[0].init.credentials,'omit');assert.equal(downloads[0].init.referrerPolicy,'no-referrer');assert.equal(downloads[0].init.body,undefined);
 await assert.rejects(()=>globalThis.fetch('https://api.openai.com/v1/responses',{method:'POST',body:'private question'}));
});
test('generation happens in the worker without a network request and disables thinking',async()=>{
 const count=downloads.length;const result=await send({id:2,kind:'language',operation:'generate',messages:[{role:'user',content:'Pergunta particular'}]});assert.equal(result.text,'Confira a agenda.');assert.equal(downloads.length,count);assert.equal(globalThis.__localFixture.template.options.enable_thinking,false);
});
test('voice uses Portuguese inference and rejects an overlong audio buffer',async()=>{
 const audio=new Float32Array(16000);const result=await send({id:3,kind:'speech',operation:'transcribe',audio});assert.equal(result.text,'Agenda de amanhã');assert.equal(globalThis.__localFixture.calls.at(-1).settings.language,'portuguese');
 const count=downloads.length;const invalid=await send({id:4,kind:'speech',operation:'transcribe',audio:new Float32Array(480001)});assert.equal(invalid.type,'error');assert.equal(downloads.length,count);
});


test('a fresh worker reopens voice and text from saved files without contacting the download host',async()=>{
 const count=downloads.length;await vite.close();globalThis.fetch=mockDownload;vite=await openVite();await vite.ssrLoadModule('/workers/fama-local-ai.worker.js');
 for(const [id,kind] of [[5,'language'],[6,'speech']]){const reply=await send({id,kind,operation:'load',cacheOnly:true});assert.equal(reply.type,'done');assert.equal(reply.saved,true);}
 assert.equal(downloads.length,count,'no repeat model or runtime downloads after closing');
});

test('worker warns when storage cannot retain the download instead of claiming it is installed',async()=>{
 await vite.close();globalThis.fetch=mockDownload;globalThis.caches=memoryCacheStorage();globalThis.caches.failWrites=true;vite=await openVite();await vite.ssrLoadModule('/workers/fama-local-ai.worker.js');
 const reply=await send({id:7,kind:'speech',operation:'load'});assert.equal(reply.type,'done');assert.equal(reply.saved,false);assert.match(reply.warning,/não conseguiu salvar/);
});

test('the worker also refuses a large model request from an older open mobile tab',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 (Linux; Android 12) Mobile',deviceMemory:8}});
 const count=globalThis.__localFixture.calls.length;const fetched=downloads.length;
 for(const operation of ['install','load','generate']){const reply=await send({id:93,kind:'language',operation,messages:[{role:'user',content:'Agenda'}]});assert.equal(reply.type,'error');assert.match(reply.message,/Modo leve/);}
 assert.equal(globalThis.__localFixture.calls.length,count);assert.equal(downloads.length,fetched);
});
