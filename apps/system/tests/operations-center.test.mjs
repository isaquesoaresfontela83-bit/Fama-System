import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Renderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {operationOverview}=await vite.ssrLoadModule('/lib/operation-overview.js');
const {OperationsCenter}=await vite.ssrLoadModule('/app/operations-center.jsx');
const {OperationMap}=await vite.ssrLoadModule('/app/operation-map.jsx');
const {OperationalMapView}=await vite.ssrLoadModule('/app/operational-map-view.jsx');
const {emptyData}=await vite.ssrLoadModule('/app/data-model.js');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
after(async()=>{delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
const fixture=()=>({...structuredClone(emptyData),appointments:[
 {id:'completed',title:'Limpeza',clientName:'Cliente concluído',startAt:'2026-10-14T10:00:00Z',technician:'Lucas',kind:'Manutenção',address:'Brasília',status:'concluido',notes:''},
 {id:'upcoming',title:'Visita',clientName:'Cliente agendado',startAt:'2026-10-14T17:30:00Z',technician:'Lucas',kind:'Diagnóstico',address:'Brasília',status:'agendado',notes:''},
 {id:'cancelled',title:'Cancelado',clientName:'Cliente cancelado',startAt:'2026-10-14T17:00:00Z',technician:'Lucas',kind:'Visita',address:'Brasília',status:'cancelado',notes:''},
 ],transactions:[{id:'income',description:'Receita paga',type:'receita',amountCents:20000,status:'pago',dueDate:'2026-10-14',category:''},{id:'overdue',description:'Cobrança privada',type:'receita',amountCents:8000,status:'pendente',dueDate:'2026-10-13',category:''},{id:'expense',description:'Despesa',type:'despesa',amountCents:5000,status:'pago',dueDate:'2026-10-14',category:''}],inventory:[{id:'low',name:'Cloro',sku:'1',unit:'un',quantity:1,minimumQuantity:2,costCents:400}]});
test('overview computes actual month income, receivables, overdue and paid flow',()=>{
 const view=operationOverview(fixture(),['finance','agenda','inventory'],0,new Date('2026-10-14T17:00:00Z'));
 assert.equal(view.revenue,20000);assert.equal(view.receivable,8000);assert.equal(view.overdue.length,1);assert.equal(view.inventory.length,1);
 assert.equal(view.flow.at(-1).income,20000);assert.equal(view.flow.at(-1).expense,5000);
 assert.equal(view.next.id,'upcoming');assert.equal(view.completed,1);
});
test('Brazil day boundaries do not count tomorrow or completed/cancelled events as next',()=>{
 const data=fixture();data.appointments.push({...data.appointments[1],id:'brazil-yesterday',startAt:'2026-10-15T01:00:00Z'});
 const view=operationOverview(data,['agenda'],0,new Date('2026-10-15T02:00:00Z'));
 assert.equal(view.todayKey,'2026-10-14');assert.equal(view.today.length,4);assert.equal(view.next,undefined);
});
test('hidden modules cannot contribute sensitive indicators or records',()=>{
 const data=fixture();const view=operationOverview(data,['dashboard'],0,new Date('2026-10-14T17:00:00Z'));
 assert.equal(view.revenue,0);assert.equal(view.receivable,0);assert.deepEqual(view.overdue,[]);assert.deepEqual(view.today,[]);assert.deepEqual(view.inventory,[]);
 const html=renderToStaticMarkup(React.createElement(OperationsCenter,{organizationId:"org",data,allowed:['dashboard'],lowStock:0,onNavigate(){},onSelect(){}}));
 assert.doesNotMatch(html,/Cobrança privada|Receita do mês|A receber|Cliente agendado|Pipeline comercial/);
});
test('commercial workspace opens the correct saved quote and finance remains permission gated',async()=>{
 const data=fixture();data.quotes=[{id:'quote-1',quoteNumber:'1042',clientName:'Cliente da proposta',service:'Manutenção',status:'enviado',totalCents:15000,createdAt:'2026-10-14T12:00:00Z',validUntil:'2026-11-01',materialsCents:0,laborCents:0,discountCents:0,notes:''}];
 let view,selected;
 await act(async()=>{view=Renderer.create(React.createElement(OperationsCenter,{organizationId:"org",data,allowed:['dashboard','crm','quotes'],lowStock:0,onNavigate(){},onSelect:value=>selected=value}));});
 const tabs=view.root.findAllByProps({role:'tab'});
 assert.equal(tabs.length,2);
 await act(async()=>tabs[1].props.onClick());
 assert.match(JSON.stringify(view.toJSON()),/Propostas em aberto/);
 const row=view.root.findAllByType('button').find(node=>node.findAllByType('strong').some(child=>child.children.includes('Cliente da proposta')));
 await act(async()=>row.props.onClick());
 assert.equal(selected.entity,'quotes');assert.equal(selected.record.id,'quote-1');
 await act(async()=>view.unmount());
});

test('map automatically locates the next visit and never asks customers for an API key',async()=>{
 const {FieldConditions}=await vite.ssrLoadModule('/app/field-conditions.jsx');
 const {CompanyWeatherSettings}=await vite.ssrLoadModule('/app/company-weather-settings.jsx');
 const originalFetch=globalThis.fetch;let view;const requests=[];
 globalThis.fetch=async(input)=>{const url=String(input);requests.push(url);if(url.startsWith('/api/operation-weather'))return Response.json({configured:false,provider:'open-meteo',location:null});return Response.json({cep:'70040010',lat:'-15.8',lng:'-47.9',city:'Brasília',state:'DF',address:'Rua do atendimento'});};
 try{
  const appointment={...fixture().appointments[1],address:'Rua, CEP 70040-010',startAt:new Date(Date.now()+3600000).toISOString()};
  await act(async()=>{view=Renderer.create(React.createElement(FieldConditions,{organizationId:'org',appointments:[appointment],canConfigure:true,onConfigure(){},onSelect(){}}));});
  const map=view.root.findByType(OperationalMapView);assert.equal(map.props.point.latitude,-15.8);assert.equal(map.props.point.longitude,-47.9);assert.ok(requests.some(url=>url.includes('/json/70040010')));
  assert.doesNotMatch(JSON.stringify(view.toJSON()),/chave|Configurar previsão|Clima para o trabalho/);
  const html=renderToStaticMarkup(React.createElement(CompanyWeatherSettings,{organizationId:'org'}));assert.doesNotMatch(html,/password|API|OpenWeather|Provedor|Modo de uso/);
 }finally{if(view)await act(async()=>view.unmount());globalThis.fetch=originalFetch;}
});

test('manual map confirmation updates the selected visit and persists separately from other companies',async()=>{
 const {FieldConditions}=await vite.ssrLoadModule('/app/field-conditions.jsx');
 const {LocationPointPicker}=await vite.ssrLoadModule('/app/location-point-picker.jsx');
 const {readConfirmedPoint}=await vite.ssrLoadModule('/lib/confirmed-map-point.js');
 const originalFetch=globalThis.fetch,originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});let view;
 globalThis.fetch=async()=>Response.json({configured:false,provider:'open-meteo',location:null});
 try{
  const appointment={...fixture().appointments[1],address:'Sem CEP',startAt:new Date(Date.now()+3600000).toISOString()};
  await act(async()=>{view=Renderer.create(React.createElement(FieldConditions,{organizationId:'org-manual',appointments:[appointment],canConfigure:true,onConfigure(){},onSelect(){}}));});
  const visit=view.root.findAllByType('button').find(node=>node.findAllByType('strong').some(child=>child.children.includes(appointment.clientName)));await act(async()=>visit.props.onClick());
  const adjust=view.root.findAllByType('button').find(node=>node.children.includes('Ajustar ponto'));await act(async()=>adjust.props.onClick());
  const picker=view.root.findByType(LocationPointPicker);await act(async()=>picker.props.onConfirm({latitude:-15.81,longitude:-47.91,source:'manual',address:'Ponto confirmado por você no mapa'}));
  assert.equal(view.root.findByType(OperationalMapView).props.point.latitude,-15.81);assert.equal(view.root.findByType(OperationalMapView).props.point.longitude,-47.91);assert.equal(readConfirmedPoint(storage,'org-manual',appointment.id).latitude,-15.81);assert.equal(readConfirmedPoint(storage,'other',appointment.id),null);assert.equal(readConfirmedPoint(storage,'org-manual'),null);
  assert.match(JSON.stringify(view.toJSON()),/não medido pelo GPS/);
 }finally{if(view)await act(async()=>view.unmount());globalThis.fetch=originalFetch;if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else delete globalThis.localStorage;}
});

test('searching another CEP does not reuse an unrelated manually saved company point',async()=>{
 const {FieldConditions}=await vite.ssrLoadModule('/app/field-conditions.jsx');
 const {saveConfirmedPoint}=await vite.ssrLoadModule('/lib/confirmed-map-point.js');
 const originalFetch=globalThis.fetch,originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});let view;
 saveConfirmedPoint(storage,'org-cep',{latitude:-16,longitude:-48,source:'manual',address:'Base'});
 globalThis.fetch=async input=>String(input).startsWith('/api/operation-weather')?Response.json({configured:false,location:null}):Response.json({cep:'71000000',lat:-15.7,lng:-47.7,city:'Brasília',state:'DF',address:'Outro CEP'});
 const props={organizationId:'org-cep',appointments:[],canConfigure:false,onConfigure(){},onSelect(){}};
 try{await act(async()=>{view=Renderer.create(React.createElement(FieldConditions,props));});assert.equal(view.root.findByType(OperationalMapView).props.point.latitude,-16);
  await act(async()=>view.update(React.createElement(FieldConditions,{...props,mapRequest:{cep:'71000000',revision:1}})));
  assert.equal(view.root.findByType(OperationalMapView).props.point.latitude,-15.7);assert.equal(view.root.findByType(OperationalMapView).props.point.source,'cep');
 }finally{if(view)await act(async()=>view.unmount());globalThis.fetch=originalFetch;if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else delete globalThis.localStorage;}
});

test('overview replaces the map with actionable visits and services and respects permissions',async()=>{
 const {DailyWorkPanel}=await vite.ssrLoadModule('/app/daily-work-panel.jsx');
 const data=fixture(); data.workOrders=[{id:'order-active',clientName:'Cliente em serviço',service:'Limpeza técnica',status:'em_execucao',scheduledAt:new Date().toISOString(),technician:'Lucas'}];
 const props={organizationId:'org-map',data,allowed:['dashboard','agenda','orders'],lowStock:0,onNavigate(){},onSelect(){}};
 let view;
 try{
  await act(async()=>{view=Renderer.create(React.createElement(OperationsCenter,props));});
  assert.equal(view.root.findAllByType(OperationMap).length,0);assert.equal(view.root.findAllByType('iframe').length,0);
  assert.equal(view.root.findAllByType(DailyWorkPanel).length,1);assert.match(JSON.stringify(view.toJSON()),/Seu dia de trabalho|Cliente em serviço/);
  await act(async()=>view.update(React.createElement(OperationsCenter,{...props,allowed:['dashboard']})));
  assert.equal(view.root.findAllByType(DailyWorkPanel).length,0);
  assert.doesNotMatch(JSON.stringify(view.toJSON()),/Cliente em serviço|Seu dia de trabalho/);
 }finally{if(view)await act(async()=>view.unmount());}
});
test('daily work sorts active and overdue records and excludes completed, canceled and forbidden modules',async()=>{
 const {dailyWork}=await vite.ssrLoadModule('/lib/daily-work.js');
 const data=fixture(); data.workOrders=[{id:'active',status:'em_execucao',scheduledAt:'2026-10-14T11:00:00Z'},{id:'cancelled',status:'cancelada',scheduledAt:'2026-10-14T10:00:00Z'},{id:'done',status:'concluida',scheduledAt:'2026-10-14T10:00:00Z'}];
 data.appointments.push({...data.appointments[1],id:'late',startAt:'2026-10-13T11:00:00Z'});
 const now=new Date('2026-10-14T17:00:00Z'); const view=dailyWork(data,['agenda','orders'],now);
 assert.deepEqual(view.priority.map(item=>item.record.id),['active','late','upcoming']);
 assert.equal(view.completedToday,1);assert.equal(view.totalToday,2);
 assert.deepEqual(dailyWork(data,['dashboard'],now).priority,[]);
 assert.equal(dailyWork(data,['agenda'],now).active.length,0);
});
