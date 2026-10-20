import assert from 'node:assert/strict';
import test,{after,afterEach} from 'node:test';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
const original=globalThis.fetch;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {ControlIntegrations}=await vite.ssrLoadModule('/app/control-integrations.jsx');
let renderer;
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
after(async()=>{globalThis.fetch=original;delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
test('Control shows integrations and joint-release evidence with server-only provider credentials',async()=>{
 const calls=[];globalThis.fetch=async(url,init={})=>{calls.push({url,init});if(url==='/api/admin/baileys')return Response.json({configured:false,url:''});return Response.json({providers:['drive','resend','sentry','ocrspace','ipinfo','github'].map(id=>({id,configured:id==='github',available:['github','ipinfo'].includes(id)})),backendAvailable:true,release:{synchronized:true,control:{version:'15.3',releaseId:'joint'},system:{version:'15.3',releaseId:'joint'}}});};
 await act(async()=>{renderer=Renderer.create(React.createElement(ControlIntegrations));});
 const output=JSON.stringify(renderer.toJSON());for(const name of ['Google Drive','Resend','Sentry','OCR.space','IPinfo Lite','GitHub REST API'])assert.ok(output.includes(name));assert.match(output,/mesma atualização/);assert.ok(renderer.root.findByProps({id:'integration-repository'}));assert.ok(renderer.root.findByProps({id:'integration-ip'}));assert.match(output,/WhatsApp Baileys/);const passwords=renderer.root.findAllByType('input').filter(node=>node.props.type==='password');assert.equal(passwords.length,1);assert.equal(passwords[0].props.value,'');assert.ok(calls.every(call=>['/api/admin/integrations','/api/admin/baileys'].includes(call.url)&&!call.init.method));
});
