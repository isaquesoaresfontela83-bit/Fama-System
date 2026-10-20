import assert from 'node:assert/strict';
import test,{after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {memoryCacheStorage} from './fama-ai-cache-fixture.mjs';
const saved=Object.fromEntries(['navigator','window','document','Worker','MediaRecorder','AudioContext','OfflineAudioContext','caches','IS_REACT_ACT_ENVIRONMENT'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
const voices=[{lang:'pt-BR',localService:true}];
const preferences=new Map();
const onlineHandlers=new Set();const visibilityHandlers=new Set();
globalThis.window={location:{origin:'https://fama.example.test'},addEventListener(name,handler){if(name==='online')onlineHandlers.add(handler);},removeEventListener(name,handler){if(name==='online')onlineHandlers.delete(handler);},localStorage:{getItem:key=>preferences.get(key)??null,setItem:(key,value)=>preferences.set(key,value)},speechSynthesis:{getVoices:()=>voices,addEventListener(){},removeEventListener(){},cancel(){},speak(){}}};
globalThis.document={hidden:false,addEventListener(name,handler){if(name==='visibilitychange')visibilityHandlers.add(handler);},removeEventListener(name,handler){if(name==='visibilitychange')visibilityHandlers.delete(handler);}};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const instances=[];let fixtureSaved=false;let deferLoad=false;let deferInstall='';
class DeviceWorker {
 constructor(){this.messages=[];instances.push(this);}
 postMessage(message){this.messages.push(message);if(message.operation==='load'&&!deferLoad)queueMicrotask(()=>this.onmessage?.({data:{id:message.id,type:'done',text:'',saved:fixtureSaved}}));if(message.operation==='install'&&message.kind!==deferInstall)queueMicrotask(async()=>{await saveModel(message.kind);this.onmessage?.({data:{id:message.id,type:'done',saved:true}});});}
 terminate(){this.terminated=true;}
}
globalThis.Worker=DeviceWorker;globalThis.MediaRecorder=class {};
Object.defineProperty(globalThis,'navigator',{value:{gpu:{requestAdapter:async()=>({features:{has:()=>true}})},mediaDevices:{}},configurable:true});
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {useFamaLocalAi,FamaLocalAiProvider}=await vite.ssrLoadModule('/hooks/use-fama-local-ai.js');
const storageApi=await vite.ssrLoadModule('/lib/fama-ai-storage.js');
const {localAiModels}=await vite.ssrLoadModule('/lib/fama-ai-local.js');
let api,renderer;
beforeEach(()=>{preferences.clear();fixtureSaved=false;deferLoad=false;deferInstall='';for(const field of ['userAgent','userAgentData','deviceMemory','maxTouchPoints'])delete navigator[field];globalThis.caches=memoryCacheStorage();});
async function saveModel(kind){const cache=storageApi.createLocalAiCache(window.location.origin,async()=>{throw new Error('No download permitted');});cache.begin(kind);const model=localAiModels[kind];const file=kind==='language'?'onnx/model_q4f16.onnx':'onnx/encoder_model_quantized.onnx';for(const name of ['config.json',file])await cache.modelCache.put(`https://huggingface.co/${model.id}/resolve/${model.revision}/${name}`,new Response('cached'));assert.equal(await cache.complete(),true);}
async function mount(shared=false){function Harness(){api=useFamaLocalAi();return null;}await act(async()=>{renderer=Renderer.create(shared?React.createElement(FamaLocalAiProvider,null,React.createElement(Harness)):React.createElement(Harness));});}
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;instances.length=0;});
after(async()=>{await vite.close();for(const [name,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});

test('cancelling local generation clears busy state and discards late results',async()=>{
 await mount();await act(async()=>{assert.equal(await api.load('language'),true);});
 let reply;await act(async()=>{reply=api.generate('Agenda',{source:'agenda',text:'Agenda: 2',actions:[]},[]);});assert.equal(api.generating,true);
 const worker=instances.at(-1);const message=worker.messages.at(-1);
 await act(async()=>api.terminate('language'));assert.equal(worker.terminated,true);assert.equal(api.generating,false);
 await act(async()=>{worker.onmessage({data:{id:message.id,type:'done',text:'late data'}});assert.equal(await reply,'');});assert.equal(api.models.language.status,'idle');
});
test('cancelled microphone permission closes a stream granted afterward',async()=>{
 let grant;let stops=0;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{grant=resolve;});
 await mount();await act(async()=>{assert.equal(await api.load('speech'),true);});
 let pending;let result;await act(async()=>{pending=api.startVoice(text=>{result=text;});});assert.equal(api.voice,'preparing');
 await act(async()=>api.stopVoice(true));
 await act(async()=>{grant({getTracks:()=>[{stop(){stops++;}}]});await pending;});assert.equal(stops,1);assert.equal(result,undefined);assert.equal(api.voice,'idle');assert.equal(instances.flatMap(worker=>worker.messages).filter(x=>x.operation==='transcribe').length,0);
});
test('duplicate model preparation creates one download task',async()=>{
 await mount();let a,b;await act(async()=>{a=api.load('language');b=api.load('language');await Promise.all([a,b]);});assert.equal(instances.length,1);assert.equal(instances[0].messages.filter(x=>x.operation==='load').length,1);
});
test('unmount releases workers and rejects pending replies',async()=>{
 await mount();await act(async()=>api.load('language'));let pending;await act(async()=>{pending=api.generate('Agenda',{source:'agenda',text:'Agenda',actions:[]},[]);});const worker=instances[0];await act(async()=>renderer.unmount());renderer=null;assert.equal(worker.terminated,true);assert.equal(await pending,'');
});


test('reopening recognises saved voice and model and restores the chosen mode without preparing or downloading',async()=>{
 await saveModel('language');await saveModel('speech');fixtureSaved=true;
 await mount();assert.equal(api.models.language.status,'saved');assert.equal(api.models.speech.status,'saved');
 await act(async()=>api.setEnabled(true));assert.equal(api.enabled,true);
 await act(async()=>renderer.unmount());renderer=null;instances.length=0;
 await mount();assert.equal(api.enabled,true);assert.equal(api.models.language.status,'saved');assert.equal(api.models.speech.status,'saved');assert.equal(instances.length,0,'restore status without loading large models into memory');
 let reply;await act(async()=>{reply=api.generate('Agenda',{source:'agenda',text:'Agenda: 2',actions:[]},[]);});
 const worker=instances[0];assert.equal(worker.messages[0].operation,'load');assert.equal(worker.messages[0].cacheOnly,true);
 const request=worker.messages.at(-1);assert.equal(request.operation,'generate');
 await act(async()=>{worker.onmessage({data:{id:request.id,type:'done',text:'Confira a agenda.',saved:true}});assert.equal(await reply,'Confira a agenda.');});
 await act(async()=>api.terminate('language'));assert.equal(api.models.language.status,'saved');assert.equal(api.enabled,true);
 assert.equal((await storageApi.inspectLocalAiInstallation('language',window.location.origin)).saved,true,'unloading memory never deletes downloaded files');
});

test('saved voice opens on Ditar from cached files and never requests a microphone on mount',async()=>{
 await saveModel('speech');fixtureSaved=true;let grant;let permissions=0;let stops=0;
 navigator.mediaDevices.getUserMedia=()=>{permissions++;return new Promise(resolve=>{grant=resolve;});};
 await mount();assert.equal(api.models.speech.status,'saved');assert.equal(permissions,0);assert.equal(instances.length,0);
 let recording;await act(async()=>{recording=api.startVoice(()=>{});});
 assert.equal(permissions,1);assert.equal(instances[0].messages[0].cacheOnly,true);
 await act(async()=>api.stopVoice(true));
 await act(async()=>{grant({getTracks:()=>[{stop(){stops++;}}]});await recording;});assert.equal(stops,1);assert.equal(api.voice,'idle');
});

test('choosing only the Fama core remains off after reopening without removing saved models',async()=>{
 await saveModel('language');await mount();
 await act(async()=>{api.setEnabled(true);api.setEnabled(false);});
 await act(async()=>renderer.unmount());renderer=null;instances.length=0;
 await mount();assert.equal(api.enabled,false);assert.equal(api.models.language.status,'saved');assert.equal(instances.length,0);
});


test('a remembered preference cannot trigger another download when the saved files are missing',async()=>{
 await mount();await act(async()=>api.setEnabled(true));
 await act(async()=>{assert.equal(await api.generate('Agenda',{source:'agenda',text:'Agenda',actions:[]},[]),'');});
 assert.equal(instances.length,0);assert.match(api.error,/precisa ser preparado/);assert.equal(api.generating,false);
});

test('opening the app prepares voice then conversation once and reopening reuses saved assets',async()=>{
 let microphoneRequests=0;navigator.mediaDevices.getUserMedia=()=>{microphoneRequests++;throw new Error('Not authorized');};
 await mount(true);
 assert.deepEqual(instances.flatMap(worker=>worker.messages).map(message=>[message.kind,message.operation]),[['speech','install'],['language','install']]);
 assert.equal(api.models.speech.status,'saved');assert.equal(api.models.language.status,'saved');assert.equal(api.enabled,false,'downloading never silently enables expensive local inference');
 assert.equal(instances.every(worker=>worker.terminated),true,'background download releases workers without loading inference');
 assert.equal(microphoneRequests,0);
 await act(async()=>renderer.unmount());renderer=null;instances.length=0;
 await mount(true);assert.equal(instances.length,0,'opening again does not download complete installations');
 assert.equal(api.models.speech.saved,true);assert.equal(api.models.language.saved,true);
});

test('signup storage refusal persists and prevents automatic download even after reconnecting',async()=>{
 storageApi.writeLocalAiAutomatic(false);await mount(true);
 assert.equal(api.automatic,false);assert.equal(instances.length,0);
 await act(async()=>{for(const handler of onlineHandlers)handler();});assert.equal(instances.length,0);
 await act(async()=>api.setAutomatic(true));assert.equal(api.automatic,true);
 assert.deepEqual(instances.flatMap(worker=>worker.messages).map(message=>message.operation),['install','install']);
});

test('resuming the app repairs an evicted model without preparing the model that remains saved',async()=>{
 await saveModel('speech');await saveModel('language');await mount(true);assert.equal(instances.length,0);
 const model=localAiModels.speech;await (await caches.open(storageApi.localAiModelCache)).delete(`https://huggingface.co/${model.id}/resolve/${model.revision}/onnx/encoder_model_quantized.onnx`);
 await act(async()=>{document.hidden=false;for(const handler of visibilityHandlers)handler();});
 assert.deepEqual(instances.flatMap(worker=>worker.messages).map(message=>[message.kind,message.operation]),[['speech','install']]);
 assert.equal(api.models.speech.saved,true);assert.equal(api.models.language.saved,true);
});

test('pausing while a resumed cache check is pending prevents a late automatic download',async()=>{
 await saveModel('speech');await saveModel('language');await mount(true);assert.equal(instances.length,0);
 const model=localAiModels.speech;
 await (await caches.open(storageApi.localAiModelCache)).delete(`https://huggingface.co/${model.id}/resolve/${model.revision}/onnx/encoder_model_quantized.onnx`);
 const open=caches.open.bind(caches);let release;
 const gate=new Promise(resolve=>{release=resolve;});
 caches.open=async(...args)=>{await gate;return open(...args);};
 await act(async()=>{document.hidden=false;for(const handler of visibilityHandlers)handler();api.setAutomatic(false);});
 await act(async()=>release());
 assert.equal(api.automatic,false);assert.equal(instances.length,0,'revoked preparation is checked again after the asynchronous cache inspection');
});

test('voice can start again after cancellation during cached model loading',async()=>{
 await saveModel('speech');fixtureSaved=true;deferLoad=true;let requests=0;
 navigator.mediaDevices.getUserMedia=async()=>{requests++;throw new DOMException('Denied','NotAllowedError');};
 await mount();let first;
 await act(async()=>{first=api.startVoice(()=>{});});assert.equal(api.voice,'preparing');
 const old=instances.at(-1);
 await act(async()=>{api.stopVoice(true);await first;});assert.equal(old.terminated,true);assert.equal(api.voice,'idle');
 deferLoad=false;
 await act(async()=>api.startVoice(()=>{}));
 assert.equal(requests,1,'a new voice load reaches the permission step instead of keeping the previous loading lock');
 assert.equal(instances.length,2);assert.equal(api.voice,'idle');assert.match(api.error,/Permita o microfone/);
});

test('idle local models release memory while keeping installed files',async(t)=>{
 await saveModel('language');fixtureSaved=true;await mount();
 t.mock.timers.enable({apis:['setTimeout']});
 await act(async()=>api.load('language',true));const worker=instances.at(-1);
 assert.equal(api.models.language.status,'ready');
 await act(async()=>t.mock.timers.tick(30_000));
 assert.equal(worker.terminated,true);assert.equal(api.models.language.status,'saved');
 assert.equal((await storageApi.inspectLocalAiInstallation('language',window.location.origin)).saved,true);
 t.mock.timers.reset();
});

test('waiting for microphone permission protects the active voice model from idle disposal',async(t)=>{
 await saveModel('speech');fixtureSaved=true;await mount();let deny;let requests=0;
 navigator.mediaDevices.getUserMedia=()=>{requests++;return new Promise((_,reject)=>{deny=reject;});};
 t.mock.timers.enable({apis:['setTimeout']});let pending;
 await act(async()=>{pending=api.startVoice(()=>{});await api.startVoice(()=>{});});
 assert.equal(requests,1,'the permission step has an immediate lock');const worker=instances.at(-1);
 await act(async()=>t.mock.timers.tick(30_000));
 assert.notEqual(worker.terminated,true);assert.equal(api.voice,'preparing');
 await act(async()=>{deny(new DOMException('Denied','NotAllowedError'));await pending;});
 assert.equal(api.voice,'idle');
 await act(async()=>t.mock.timers.tick(30_000));assert.equal(worker.terminated,true);
 t.mock.timers.reset();
});

test('an Android phone with cached models and a previously enabled preference cannot start the large model',async()=>{
 navigator.userAgent='Mozilla/5.0 (Linux; Android 12; SM-G970F) Mobile';navigator.deviceMemory=8;
 await saveModel('language');await saveModel('speech');storageApi.writeLocalAiEnabled(true);
 await mount(true);
 assert.equal(api.enabled,false);assert.equal(api.models.language.status,'unsupported');assert.equal(api.models.language.saved,true);
 await act(async()=>{api.setEnabled(true);assert.equal(await api.load('language'),false);assert.equal(await api.generate('Agenda',{source:'agenda',text:'Agenda',actions:[]},[]),'');});
 await act(async()=>{for(const handler of onlineHandlers)handler();for(const handler of visibilityHandlers)handler();});
 assert.equal(api.enabled,false);assert.equal(api.generating,false);assert.equal(instances.length,0,'neither resume nor an old preference bypasses the mobile limit');
 assert.equal((await storageApi.inspectLocalAiInstallation('language',window.location.origin)).saved,true,'switching to light mode keeps previously installed files');
});

test('opening voice cancels another model download before allocating its inference worker',async()=>{
 deferInstall='language';fixtureSaved=true;await mount(true);
 const downloading=instances.find(worker=>worker.messages.some(message=>message.kind==='language'&&message.operation==='install'));
 assert.ok(downloading);assert.notEqual(downloading.terminated,true);
 await act(async()=>assert.equal(await api.load('speech',true),true));
 assert.equal(downloading.terminated,true);assert.equal(instances.filter(worker=>!worker.terminated).length,1);
 assert.equal(api.models.speech.status,'ready');assert.equal(api.preparingAutomatic,false);
});

test('a failed model load releases its partially allocated worker and allows a fresh attempt',async()=>{
 await mount();deferLoad=true;let pending;
 await act(async()=>{pending=api.load('language');});const worker=instances.at(-1);const request=worker.messages.at(-1);
 await act(async()=>{worker.onmessage({data:{id:request.id,type:'error',message:'Model failed'}});assert.equal(await pending,false);});
 assert.equal(worker.terminated,true);assert.equal(api.models.language.status,'error');
 deferLoad=false;await act(async()=>assert.equal(await api.load('language'),true));assert.equal(instances.length,2);
});

test('mobile dictation still returns Portuguese text and releases the inference worker afterward',async()=>{
 navigator.userAgent='Android 12 Mobile';navigator.deviceMemory=4;fixtureSaved=true;await saveModel('speech');
 let stopped;let tracksClosed=0;let transcription;
 navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){tracksClosed++;}}]});
 globalThis.MediaRecorder=class {state='inactive';mimeType='audio/webm';start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['fixture recording'])});stopped=this.onstop?.();}};
 globalThis.AudioContext=class {async decodeAudioData(){return {duration:1};}async close(){}};
 globalThis.OfflineAudioContext=class {destination={};createBufferSource(){return {connect(){},start(){}};}async startRendering(){return {getChannelData:()=>new Float32Array(16000)};}};
 await mount();await act(async()=>api.startVoice(text=>{transcription=text;}));assert.equal(api.voice,'recording');
 await act(async()=>api.stopVoice());const worker=instances.at(-1);const request=worker.messages.at(-1);assert.equal(request.operation,'transcribe');
 await act(async()=>{worker.onmessage({data:{id:request.id,type:'done',text:'Agenda de amanhã',saved:true}});await stopped;});
 assert.equal(transcription,'Agenda de amanhã');assert.equal(api.voice,'idle');assert.equal(worker.terminated,true);assert.equal(tracksClosed,1);assert.equal(api.models.speech.status,'saved');
 assert.equal((await storageApi.inspectLocalAiInstallation('speech',window.location.origin)).saved,true);
});
