import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {CustomerContactFields} = await vite.ssrLoadModule('/app/customer-contact-fields.jsx');
const saved = Object.fromEntries(['fetch','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let renderer, calls, response;
const result = (type='cnpj',provider='brasilapi') => ({type,provider,value:type==='cep'?'01001000':'19131243000197',consultedAt:new Date().toISOString(),cached:false,cep:'01001000',street:'Praça da Sé',neighborhood:'Sé',city:'São Paulo',state:'SP',address:'Praça da Sé — Sé — São Paulo/SP',name:type==='cnpj'?'Empresa consultada':'',tradeName:'',phone:'',email:'',situation:'ATIVA'});
beforeEach(()=>{
  renderer=null; calls=[]; response=body=>Response.json(result(body.type,body.type==='cep'?'brasilapi':'receitaws'));
  globalThis.fetch=async(url,init)=>{assert.equal(url,'/api/registration-lookup');const body=JSON.parse(init.body);calls.push({body,headers:new Headers(init.headers),signal:init.signal});return response(body);};
});
const flush = () => new Promise(resolve=>setTimeout(resolve,0));
async function mount(props={}) {await act(async()=>{renderer=Renderer.create(React.createElement(CustomerContactFields,{organizationId:'org-one',...props}));await flush();});}
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());});
after(async()=>{await vite.close();for(const[key,value]of Object.entries(saved)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
const input=id=>renderer.root.findAllByType('input').find(node=>node.props.id===id);
const content=node=>typeof node==='string'?node:node.children.map(content).join('');
const button=label=>renderer.root.findAllByType('button').find(node=>content(node)===label);
const tree=()=>JSON.stringify(renderer.toJSON());
async function change(id,value) {await act(async()=>input(id).props.onChange({target:{value}}));}
async function click(label) {await act(async()=>{button(label).props.onClick();await flush();});}

test('Fixed CEP consultation previews the address and changes only the address after explicit application',async()=>{
  await mount({initialValues:{name:'Nome digitado',phone:'11999999999',email:'manual@example.test',address:'Endereço digitado'}});
  await change('customer-cep','01001-000'); await click('Consultar CEP');
  assert.equal(calls[0].body.provider,undefined); assert.equal(calls[0].headers.get('x-organization-id'),'org-one');
  assert.match(tree(),/Endereço encontrado/);assert.equal(input('customer-address').props.value,'Endereço digitado');
  assert.equal(button('Usar endereço').props.type,'button'); await click('Usar endereço');
  assert.equal(input('customer-address').props.value,result('cep').address); assert.equal(input('customer-name').props.value,'Nome digitado');
  assert.equal(input('customer-phone').props.value,'11999999999');assert.equal(input('customer-email').props.value,'manual@example.test');
  assert.equal(renderer.root.findAllByProps({role:'status'}).length,0);
});

test('CNPJ consultations use the fixed service and preserve manual contacts when the service has none',async()=>{
  await mount({initialValues:{phone:'11999999999',email:'manual@example.test'},requireDocument:true});
  assert.equal(input('customer-document').props.required,true);
  await change('customer-document','19131243000197'); assert.equal(input('customer-document').props.value,'19.131.243/0001-97');
  await click('Consultar CNPJ'); assert.equal(calls[0].body.provider,undefined); assert.equal(input('customer-name').props.value,'');
  await click('Usar dados no cadastro'); assert.equal(input('customer-name').props.value,'Empresa consultada');
  assert.equal(input('customer-phone').props.value,'11999999999');assert.equal(input('customer-email').props.value,'manual@example.test');
  assert.equal(renderer.root.findAllByType('select').length,0);
  assert.doesNotMatch(tree(),/ViaCEP|Consultar CNPJ com|Consultar CEP com/);
});

test('changing a document discards late results and double clicking consult sends one request',async()=>{
  let complete; response=()=>new Promise(resolve=>complete=resolve);
  await mount(); await change('customer-document','19131243000197');
  await act(async()=>{const consult=button('Consultar CNPJ');consult.props.onClick();consult.props.onClick();await flush();});
  assert.equal(calls.length,1);
  await change('customer-document','12345678000199'); assert.equal(calls[0].signal.aborted,true);
  await act(async()=>{complete(Response.json({...result(),name:'OLD_REGISTRATION'}));await flush();});
  assert.doesNotMatch(tree(),/OLD_REGISTRATION/); assert.equal(input('customer-name').props.value,'');
  assert.equal(input('customer-document').props.value,'12.345.678/0001-99'); assert.equal(button('Consultar CNPJ').props.disabled,false);
});

test('limits leave manual registration available and changing the document clears the error',async()=>{
  response=()=>Response.json({error:'Aguarde um minuto.'},{status:429});
  await mount({initialValues:{name:'Cliente manual',phone:'11999999999'}});
  await change('customer-document','19131243000197');await click('Consultar CNPJ');
  assert.match(tree(),/Aguarde um minuto/);assert.equal(input('customer-name').props.value,'Cliente manual');
  await change('customer-document','00000000000191');
  assert.equal(renderer.root.findAllByProps({role:'alert'}).length,0);assert.equal(input('customer-phone').props.disabled,undefined);
});

test('alphanumeric documents keep their characters and consultation does not submit or save a customer',async()=>{
  await mount();await change('customer-document','12abc34501de35');
  assert.equal(input('customer-document').props.value,'12.ABC.345/01DE-35');assert.equal(button('Consultar CNPJ').props.disabled,false);
  await click('Consultar CNPJ');assert.equal(calls[0].body.value,'12.ABC.345/01DE-35');
  assert.ok(renderer.root.findAllByType('button').every(node=>node.props.type==='button'));
  assert.equal(renderer.root.findAllByType('form').length,0);assert.equal(calls.length,1);
});

test('CPF remains a manual document without a consultation button',async()=>{
 await mount();await change('customer-document','40442820135');
 assert.equal(input('customer-document').props.value,'404.428.201-35');
 assert.equal(button('Consultar CNPJ').props.disabled,true);
 assert.equal(renderer.root.findAllByType('iframe').length,0);assert.equal(calls.length,0);
});
