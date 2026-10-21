import assert from 'node:assert/strict';
import test, {after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {createServer} from 'vite';
const root=new URL('..',import.meta.url).pathname,originalFetch=globalThis.fetch;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {FamaBlocksPanel}=await vite.ssrLoadModule('/app/fama-blocks-panel.jsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const base={companies:[{id:'org-a',name:'Empresa A',status:'active',plan:'profissional'},{id:'org-b',name:'Empresa B',status:'active',plan:'profissional'}],members:[{id:'owner-a',organizationId:'org-a',displayName:'Responsável',email:'a@fixture.test',role:'owner',permissions:[],status:'active'},{id:'member-b',organizationId:'org-b',displayName:'Equipe B',email:'b@fixture.test',role:'member',permissions:['crm'],status:'active'}],available:true};
const rules=()=>Object.fromEntries(['global','organization','member'].map(scope=>[scope,{overrides:{},revision:0,updatedAt:null}]));
let renderer,requests,current,pendingWrite;
const flush=async()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});
beforeEach(()=>{requests=[];current=rules();pendingWrite=null;globalThis.fetch=async(url,init={})=>{requests.push({url,init});if(init.method==='POST'){const body=JSON.parse(init.body);current[body.scope]={overrides:body.overrides,revision:body.revision+1,updatedAt:'2026-10-03T12:00:00Z'};if(pendingWrite)return pendingWrite();return Response.json({rules:current,verified:true});}return Response.json({rules:current});};});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
const text=node=>node.children.map(child=>typeof child==='string'?child:text(child)).join('');
const button=label=>renderer.root.findAllByType('button').find(node=>text(node).includes(label));
const selects=()=>renderer.root.findAllByType('select');
const content=()=>text(renderer.root);
const mount=async(props=base)=>{await act(async()=>{renderer=create(React.createElement(FamaBlocksPanel,props));});await flush();};

test('all blocks start inherited; bulk removal and restoration update preview and confirm one save',async()=>{
  await mount();assert.match(content(),/14 de 14/);assert.equal(button('Aplicar blocos').props.disabled,true);
  await act(async()=>button('Remover todos').props.onClick());assert.match(content(),/0 de 14/);
  await act(async()=>button('Aplicar blocos').props.onClick());await flush();assert.equal(requests.filter(r=>r.init.method==='POST').length,1);assert.equal(button('Aplicar blocos').props.disabled,true);
  await act(async()=>button('Seguir os perfis').props.onClick());assert.match(content(),/14 de 14/);assert.equal(button('Aplicar blocos').props.disabled,false);
});
test('person target includes the owner and applies only that exact company membership',async()=>{
  current.global.overrides={finance:false};await mount();
  await act(async()=>selects()[0].props.onChange({target:{value:'member'}}));assert.doesNotMatch(content(),/Aplicar blocos/);
  await act(async()=>selects()[1].props.onChange({target:{value:'org-a'}}));await flush();
  assert.match(content(),/Proprietário/);assert.doesNotMatch(text(selects()[2]),/Equipe B/);
  await act(async()=>selects()[2].props.onChange({target:{value:'owner-a'}}));await flush();assert.match(content(),/13 de 14/);
  const finance=selects().find(node=>node.props['aria-label']==='Regra de Financeiro');await act(async()=>finance.props.onChange({target:{value:'add'}}));assert.match(content(),/14 de 14/);
  await act(async()=>button('Aplicar blocos').props.onClick());await flush();const saved=JSON.parse(requests.find(r=>r.init.method==='POST').init.body);assert.deepEqual(saved,{scope:'member',organizationId:'org-a',memberId:'owner-a',revision:0,overrides:{finance:true}});
});
test('double save clicks produce one mutation; changing target cannot reuse previous rules',async()=>{
  await mount();await act(async()=>button('Remover todos').props.onClick());let complete;pendingWrite=()=>new Promise(resolve=>{complete=resolve;});
  await act(async()=>{button('Aplicar blocos').props.onClick();button('Aplicar blocos').props.onClick();});assert.equal(requests.filter(r=>r.init.method==='POST').length,1);assert.equal(selects()[0].props.disabled,true);
  await act(async()=>complete(Response.json({rules:current,verified:true})));await flush();
  await act(async()=>selects()[0].props.onChange({target:{value:'organization'}}));assert.doesNotMatch(content(),/Aplicar blocos/);
  await act(async()=>selects()[1].props.onChange({target:{value:'org-b'}}));await flush();assert.match(content(),/Empresa B/);
});
test('unavailable destinations and rule read errors keep saving disabled',async()=>{
  await mount({...base,available:false});assert.equal(requests.length,0);assert.doesNotMatch(content(),/Aplicar blocos/);
  globalThis.fetch=async()=>Response.json({error:'Regras indisponíveis'},{status:503});await act(async()=>renderer.update(React.createElement(FamaBlocksPanel,base)));await flush();assert.match(content(),/Regras indisponíveis/);assert.doesNotMatch(content(),/Aplicar blocos/);assert.ok(button('Recarregar regras'));
});
test('a late read from a previous target cannot replace current company rules',async()=>{
  await mount();let complete;const normal=globalThis.fetch;globalThis.fetch=async(url,init)=>String(url).includes('organizationId=org-a')?new Promise(resolve=>{complete=resolve;}):normal(url,init);
  await act(async()=>selects()[0].props.onChange({target:{value:'organization'}}));await act(async()=>selects()[1].props.onChange({target:{value:'org-a'}}));await flush();
  await act(async()=>selects()[1].props.onChange({target:{value:'org-b'}}));await flush();assert.match(content(),/Empresa B/);
  const old=rules();old.organization.overrides={finance:false};await act(async()=>complete(Response.json({rules:old})));await flush();assert.match(content(),/Empresa B/);assert.match(content(),/14 de 14/);
});

test('Basic preview and bulk additions remain bounded by the company plan',async()=>{
  current.member.overrides={assistant:true,contracts:true,finance:true};
  await mount({...base,companies:base.companies.map(company=>({...company,plan:'inicial'}))});
  await act(async()=>selects()[0].props.onChange({target:{value:'member'}}));
  await act(async()=>selects()[1].props.onChange({target:{value:'org-a'}}));
  await act(async()=>selects()[2].props.onChange({target:{value:'owner-a'}}));await flush();
  assert.match(content(),/6 de 14/);assert.match(content(),/A partir do Pro/);assert.match(content(),/Plano de Empresa A: Basic/);
  assert.match(content(),/A partir do Plus/);
  const finance=selects().find(node=>node.props['aria-label']==='Regra de Financeiro');
  assert.equal(finance.findAllByType('option').find(option=>option.props.value==='add').props.disabled,true);
  const assistant=selects().find(node=>node.props['aria-label']==='Regra de Fama IA');
  assert.equal(assistant.findAllByType('option').find(option=>option.props.value==='add').props.disabled,true);
  await act(async()=>button('Adicionar todos').props.onClick());assert.match(content(),/6 de 14/);
  await act(async()=>button('Aplicar blocos').props.onClick());await flush();
  const saved=JSON.parse(requests.find(request=>request.init.method==='POST').init.body);
  assert.equal(saved.overrides.assistant,undefined);assert.equal(saved.overrides.contracts,undefined);assert.equal(saved.overrides.finance,undefined);
});
