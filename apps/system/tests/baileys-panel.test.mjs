import assert from 'node:assert/strict';
import test,{after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {createServer} from 'vite';
const root=new URL('..',import.meta.url).pathname,vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {BaileysPanel}=await vite.ssrLoadModule('/app/baileys-panel.jsx');
const originalFetch=globalThis.fetch;let renderer,state,calls;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=()=>JSON.stringify(renderer.toJSON());
const content=node=>node.children.map(child=>typeof child==='string'?child:content(child)).join('');
const button=value=>renderer.root.findAllByType('button').find(node=>content(node).includes(value));
async function mount(canManage=true){await act(async()=>{renderer=create(React.createElement(BaileysPanel,{organizationId:'company-a',canManage}));await new Promise(resolve=>setTimeout(resolve,10));});}
beforeEach(()=>{state={configured:false,status:'not_configured',canManage:true};calls=[];globalThis.fetch=async(url,init={})=>{calls.push({url,init});return Response.json(state);};});
afterEach(async()=>{if(renderer){await act(async()=>renderer.unmount());renderer=null;}});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
test('unconfigured service explains the next step without displaying a fake QR',async()=>{await mount();assert.match(text(),/Servidor pendente/);assert.match(text(),/Fama Control/);assert.equal(renderer.root.findAllByType('img').length,0);assert.equal(button('Conectar WhatsApp'),undefined);});
test('owner can request one QR session and service credentials never appear in the form',async()=>{state={configured:true,status:'disconnected',canManage:true};await mount();let done;globalThis.fetch=(url,init)=>{calls.push({url,init});return new Promise(resolve=>{done=resolve;});};await act(async()=>{button('Conectar WhatsApp').props.onClick();button('Conectar WhatsApp').props.onClick();});assert.equal(calls.filter(item=>item.init.method==='POST').length,1);await act(async()=>done(Response.json({configured:true,status:'qr',qr:'data:image/png;base64,Zml4dHVyZQ==',qrExpiresAt:Date.now()+50000})));assert.equal(renderer.root.findAllByType('img').length,1);assert.doesNotMatch(text(),/API_TOKEN|ENCRYPTION_KEY/);});
test('regular chat members cannot request a connection or see expired QR codes',async()=>{state={configured:true,status:'qr',canManage:false,qr:'data:image/png;base64,Zml4dHVyZQ==',qrExpiresAt:Date.now()-1};await mount(false);assert.equal(button('Desconectar'),undefined);assert.equal(renderer.root.findAllByType('img').length,0);});
