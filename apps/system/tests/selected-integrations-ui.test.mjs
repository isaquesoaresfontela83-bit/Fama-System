import assert from 'node:assert/strict';
import test,{after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
const descriptors=Object.fromEntries(['window','IS_REACT_ACT_ENVIRONMENT','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {DocumentIntegrationActions}=await vite.ssrLoadModule('/app/document-integration-actions.jsx');
const {SelectedIntegrationsPanel}=await vite.ssrLoadModule('/app/selected-integrations-panel.jsx');
const {selectedIntegrations}=await vite.ssrLoadModule('/lib/selected-integrations.js');
let renderer,calls;
const attachment={id:'file-one',fileName:'documento.pdf',mimeType:'application/pdf',sizeBytes:100};
beforeEach(()=>{calls=[];globalThis.window={location:{origin:'https://fama.example.test'}};});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
after(async()=>{await vite.close();for(const[key,value]of Object.entries(descriptors)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
const label=node=>(node.children||[]).map(child=>typeof child==='string'||typeof child==='number'?String(child):label(child)).join(' ');
async function openDocuments(){await act(async()=>{renderer=Renderer.create(React.createElement(React.StrictMode,null,React.createElement(DocumentIntegrationActions,{organizationId:'org-one',attachments:[attachment]})));});await act(async()=>{renderer.root.findByType('details').props.onToggle({currentTarget:{open:true}});});}
test('Drive posts only an attachment ID to the local backend without browser OAuth credentials',async()=>{
 globalThis.fetch=async(url,init={})=>{calls.push({url,init});assert.ok(!init.signal?.aborted);return Response.json(init.method==='POST'?{url:'https://drive.google.com/file/d/fixture/view'}:{drive:{configured:true},resend:{configured:false},ocrspace:{configured:false}});};
 await openDocuments();await act(async()=>{renderer.root.findAllByType('button').find(node=>label(node).includes('Copiar para o Drive')).props.onClick();});
 const write=calls.find(call=>call.init.method==='POST');assert.ok(write);assert.deepEqual(JSON.parse(write.init.body),{provider:'drive',attachmentId:'file-one'});assert.equal(write.init.headers['x-fama-google-token'],undefined);assert.ok(calls.every(call=>call.url==='/api/integrations/documents'));assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Trocar conta Google/);
});
test('missing connections leave document actions disabled and never trigger a send on load',async()=>{
 globalThis.fetch=async(url,init={})=>{calls.push({url,init});return Response.json({drive:{configured:false},resend:{configured:false},ocrspace:{configured:false}});};
 await openDocuments();assert.equal(calls.length,1);assert.equal(calls[0].init.method,undefined);
 for(const text of ['Copiar para o Drive','Extrair texto'])assert.equal(renderer.root.findAllByType('button').find(node=>label(node).includes(text)).props.disabled,true);
});
test('System settings contain only three operational services and never ask users for provider credentials',async()=>{
 globalThis.fetch=async()=>Response.json({integrations:selectedIntegrations.map(({id})=>({provider:id,configured:false,managedBy:'platform'}))});
 await act(async()=>{renderer=Renderer.create(React.createElement(SelectedIntegrationsPanel,{organizationId:'org-one'}));});
 const rendered=JSON.stringify(renderer.toJSON());assert.match(rendered,/Google Drive/);assert.match(rendered,/OCR.space/);assert.doesNotMatch(rendered,/IPinfo|GitHub|Resend|Conectada|Conectado/);assert.equal(renderer.root.findAllByType('input').length,0);assert.equal(renderer.root.findAllByType('article').length,3);
});
