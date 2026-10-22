import assert from 'node:assert/strict';
import test,{after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
const original=globalThis.fetch;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {ControlIntegrationManager}=await vite.ssrLoadModule('/app/control-integration-manager.jsx');
let renderer,calls,items;
const label=node=>(node.children||[]).map(child=>typeof child==='string'||typeof child==='number'?String(child):label(child)).join(' ');
beforeEach(()=>{
 calls=[];items=['drive','resend','sentry','ocrspace','ipinfo','github'].map(provider=>({provider,managed:true,enabled:true,available:true,configured:true,revision:1,fields:{},present:{apiKey:true}}));
 globalThis.fetch=async(url,init={})=>{
  calls.push({url,init});assert.ok(String(url).startsWith('/api/admin/integrations'));
  if(url==='/api/admin/integrations/config'&&init.method==='PATCH'){
   const body=JSON.parse(init.body);items=items.map(item=>item.provider===body.provider?{...item,revision:2,present:{apiKey:true}}:item);return Response.json({integration:items.find(item=>item.provider===body.provider)});
  }
  if(url==='/api/admin/integrations/actions')return Response.json({text:'Texto extraído para revisão',partial:false});
  return Response.json({integrations:items,activity:[]});
 };
});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
after(async()=>{globalThis.fetch=original;delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
async function open(){await act(async()=>{renderer=Renderer.create(React.createElement(ControlIntegrationManager));});}
test('the central exposes five protected configuration forms and performs no sends or connection tests on load',async()=>{
 await open();assert.equal(renderer.root.findAllByType('article').length,5);assert.ok(calls.every(call=>!call.init.method));
 assert.equal(renderer.root.findAllByType('a').length,0);const output=JSON.stringify(renderer.toJSON());assert.match(output,/Documentos e monitoramento/);assert.match(output,/Atividade no Fama/);assert.doesNotMatch(output,/supabase.com|Resend|Enviar documento por e-mail|Abrir Sentry/);
});
test('saving a replacement key sends it only to the local protected route and clears it from the form',async()=>{
 await open();const field=renderer.root.findByProps({'aria-label':'OCR.space: Chave de leitura de documentos'});
 await act(async()=>field.props.onChange({target:{value:'replacement-private-fixture'}}));
 const article=renderer.root.findAllByType('article').find(node=>label(node).includes('OCR.space'));
 await act(async()=>article.findByType('form').props.onSubmit({preventDefault(){}}));
 const write=calls.find(call=>call.init.method==='PATCH');assert.equal(write.url,'/api/admin/integrations/config');const body=JSON.parse(write.init.body);assert.equal(body.fields.apiKey,'replacement-private-fixture');assert.equal(body.expectedRevision,1);
 assert.equal(renderer.root.findByProps({'aria-label':'OCR.space: Chave de leitura de documentos'}).props.value,'');assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/replacement-private-fixture/);
});
test('selecting a document never uploads it until an action is clicked, and OCR results stay inside the central',async()=>{
 await open();const bytes=new TextEncoder().encode('%PDF-1.4\nfixture');
 await act(async()=>renderer.root.findAllByType('input').find(node=>node.props.type==='file').props.onChange({target:{files:[{name:'fixture.pdf',type:'application/pdf',size:bytes.length,async arrayBuffer(){return bytes.buffer;}}]}}));
 assert.ok(calls.every(call=>!call.init.method));
 await act(async()=>renderer.root.findAllByType('button').find(node=>label(node).includes('Extrair texto')).props.onClick());
 const write=calls.find(call=>call.init.method==='POST');assert.equal(write.url,'/api/admin/integrations/actions');assert.equal(JSON.parse(write.init.body).action,'ocr_extract');assert.ok(renderer.root.findAllByType('textarea').some(node=>node.props.readOnly&&node.props.value==='Texto extraído para revisão'));
});
