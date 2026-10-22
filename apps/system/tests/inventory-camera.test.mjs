import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import React from 'react';
import Renderer, {act} from 'react-test-renderer';
import {createServer} from 'vite';
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {InventoryCamera}=await vite.ssrLoadModule('/app/inventory-camera.jsx');
const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
after(async()=>{await vite.close();if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('denied camera explains permission and does not register stock',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}}}});
 let view,reads=0;
 await act(async()=>{view=Renderer.create(React.createElement(InventoryCamera,{onRead:()=>reads++,onClose(){}}));await flush();});
 assert.match(JSON.stringify(view.toJSON()),/Permita o acesso/);assert.equal(reads,0);
 await act(async()=>view.unmount());
});
test('closing while permission is pending stops the late camera stream',async()=>{
 let resolve,stops=0,reads=0,view;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(done=>resolve=done)}}});
 await act(async()=>{view=Renderer.create(React.createElement(InventoryCamera,{onRead:()=>reads++,onClose(){}}));});
 await act(async()=>view.unmount());
 await act(async()=>{resolve({getTracks:()=>[{stop:()=>stops++}]});await flush();});
 assert.equal(stops,1);assert.equal(reads,0);
});

test('new item scanner fills the submitted SKU and keeps it editable',async()=>{
 const {InventoryBarcodeField}=await vite.ssrLoadModule('/app/inventory-barcode-field.jsx');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(()=>{})}}});
 let view;
 await act(async()=>{view=Renderer.create(React.createElement(InventoryBarcodeField,{initialValue:'initial'}));});
 const input=()=>view.root.findByType('input');
 assert.equal(input().props.name,'sku');assert.equal(input().props.value,'initial');
 const button=view.root.findByType('button');assert.equal(button.props.type,'button');
 await act(async()=>button.props.onClick());
 const camera=view.root.findByType(InventoryCamera);
 await act(async()=>camera.props.onRead('7891234567890'));
 assert.equal(input().props.value,'7891234567890');assert.equal(view.root.findAllByType(InventoryCamera).length,0);
 await act(async()=>input().props.onChange({target:{value:'manual-code'}}));
 assert.equal(input().props.value,'manual-code');
 await act(async()=>view.unmount());
});

test('native detection produces one reading and releases the camera',async()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 let stops=0,reads=[],requested,view,currentZoom=4.9;
 const track={stop(){stops++;},getCapabilities:()=>({focusMode:['continuous'],zoom:{min:1,max:8,step:0.1}}),applyConstraints:async value=>{if(value.advanced?.[0]?.zoom!==undefined)currentZoom=value.advanced[0].zoom;},getSettings:()=>({zoom:currentZoom})};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async constraints=>{requested=constraints;return {getTracks:()=>[track],getVideoTracks:()=>[track]};},enumerateDevices:async()=>[]}}});
 globalThis.document={visibilityState:'visible',createElement:()=>({})};
 globalThis.window={BarcodeDetector:class {static async getSupportedFormats(){return ['ean_13'];}async detect(){return [{rawValue:'7891234567890'}];}}};
 try {
  await act(async()=>{view=Renderer.create(React.createElement(InventoryCamera,{onRead:value=>reads.push(value),onClose(){}}),{createNodeMock:element=>element.type==='video'?{play:async()=>{},readyState:4,videoWidth:1920,videoHeight:1080}:null});await flush();});
  for(let attempt=0;attempt<20&&!reads.length;attempt++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,100));});
  assert.deepEqual(reads,['7891234567890']);assert.ok(stops>=1);
  assert.equal(currentZoom,1);assert.equal(requested.video.width.ideal,1920);assert.equal(requested.video.facingMode.ideal,'environment');
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,150));});assert.equal(reads.length,1);
 } finally {
  if(view)await act(async()=>view.unmount());
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
 }
});


test('live camera pixels are decoded by the actual WASM reader without native detection',async()=>{
 const {readFile}=await import('node:fs/promises');
 const writer=await import('zxing-wasm/writer');
 await writer.prepareZXingModule({overrides:{wasmBinary:await readFile(new URL('../node_modules/zxing-wasm/dist/writer/zxing_writer.wasm',import.meta.url))},fireImmediately:true});
 const barcode=await writer.writeBarcode('7891234567895',{format:'EAN-13',scale:3,addQuietZones:true});
 const {width,height,data}=barcode.symbol;
 const rgba=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=data[i];rgba[i*4+3]=255;}
 const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
 let view,reads=[],stops=0,draws=0;
 const track={stop(){stops++;},getCapabilities:()=>({}),getSettings:()=>({})};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getVideoTracks:()=>[track]}),enumerateDevices:async()=>[]}}});
 globalThis.window={};
 globalThis.document={visibilityState:'visible',createElement:()=>({getContext:()=>({drawImage(){draws++;},getImageData:()=>({width,height,data:rgba})})})};
 globalThis.fetch=async input=>{
  assert.equal(String(input),'/barcode-runtime/zxing-reader-3.0.1.wasm');
  return new Response(await readFile(new URL('../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',import.meta.url)),{headers:{'Content-Type':'application/wasm'}});
 };
 try {
  await act(async()=>{view=Renderer.create(React.createElement(InventoryCamera,{onRead:code=>reads.push(code),onClose(){}}),{createNodeMock:element=>element.type==='video'?{play:async()=>{},readyState:4,videoWidth:1920,videoHeight:1080}:null});await flush();});
  for(let attempt=0;attempt<20&&!reads.length;attempt++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,100));});
  assert.deepEqual(reads,['7891234567895']);assert.ok(draws>0);assert.ok(stops>0);
 } finally {
  if(view)await act(async()=>view.unmount());
  globalThis.fetch=old.fetch;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.window===undefined)delete globalThis.window;else globalThis.window=old.window;
 }
});


test('opening the scanner reuses the camera chosen on this device',async()=>{
 const oldWindow=globalThis.window;
 let requested,view;
 globalThis.window={localStorage:{getItem:key=>key==='fama-inventory-camera'?'camera-0-id':null}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:constraints=>{requested=constraints;return new Promise(()=>{});}}}});
 try {
  await act(async()=>{view=Renderer.create(React.createElement(InventoryCamera,{onRead(){},onClose(){}}));});
  assert.deepEqual(requested.video.deviceId,{exact:'camera-0-id'});
 } finally {
  if(view)await act(async()=>view.unmount());
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
 }
});
