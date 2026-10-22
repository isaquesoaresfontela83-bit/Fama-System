import assert from 'node:assert/strict';
import test,{after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {PlanningWorkspace}=await vite.ssrLoadModule('/app/planning-workspace.jsx');
const {OperationalMapView}=await vite.ssrLoadModule('/app/operational-map-view.jsx');
const {FieldConditions}=await vite.ssrLoadModule('/app/field-conditions.jsx');
const {ConsultationWorkspace}=await vite.ssrLoadModule('/app/consultation-workspace.jsx');
const {AgendaWeeklyPlanner}=await vite.ssrLoadModule('/app/agenda-weekly-planner.jsx');
const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let view,requests,scrolled;
beforeEach(()=>{requests=[];scrolled='';globalThis.document={getElementById:id=>({scrollIntoView(){scrolled=id;}})};globalThis.fetch=async(url,init={})=>{
 requests.push({url:String(url),method:init.method||'GET'});
 if(String(url).startsWith('https://cep.awesomeapi.com.br/json/'))return Response.json({cep:String(url).split('/').at(-1),lat:-15.8,lng:-47.9,city:'Brasília',state:'DF',address:'Rua de teste'});
 if(url==='/api/operation-weather')return Response.json({configured:true,provider:'met-norway',location:null});
 if(String(url).startsWith('/api/operation-weather?'))return Response.json({forecast:null});
 if(url==='/api/freight')return Response.json({originCep:'72505101',rateCentsPerKm:1000,routingConfigured:true});
 if(url==='/api/agenda/google-calendar')return Response.json({configured:false,clientId:null});
 if(url==='/api/brasil-data')return Response.json({data:[]});
 throw new Error('Unexpected sandbox destination: '+url);
};});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;});
after(async()=>{globalThis.fetch=originalFetch;globalThis.document=originalDocument;delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
const props=()=>({organizationId:'org-planning',appointments:[],employees:[],plan:'profissional',canConsult:true,canConfigure:false,onOpen(){},onAgenda(){}});
async function mount(extra={}){await act(async()=>{view=Renderer.create(React.createElement(PlanningWorkspace,{...props(),...extra}));});}
test('one workspace presents location, weather, travel and weekly planning with one map',async()=>{
 await mount();const text=JSON.stringify(view.toJSON());assert.match(text,/Mapa dos atendimentos/);assert.match(text,/Clima para o trabalho/);assert.match(text,/Deslocamento e frete/);assert.match(text,/Google Calendar/);assert.match(text,/Planejar semana com IA/);assert.equal(view.root.findAllByType(OperationalMapView).length,1);assert.equal(view.root.findAllByType('iframe').length,0);
 assert.equal(view.root.findByType(ConsultationWorkspace).props.mode,'travel');
 assert.equal(requests.filter(r=>r.url==='/api/freight').length,1);assert.equal(requests.filter(r=>r.url==='/api/agenda/weekly-plan').length,0);
});
test('selected destination fills travel and selected reference is used for weekly weather',async()=>{
 await mount();const field=view.root.findByType(FieldConditions);
 await act(async()=>{field.props.onDestinationCep('01311000');field.props.onReferenceChange({latitude:-15.81,longitude:-47.91,address:'Ponto confirmado',source:'manual'});});
 assert.equal(view.root.findByType(ConsultationWorkspace).props.presetDestinationCep,'01311000');
 const label=view.root.findAllByType('label').find(n=>n.children.includes('CEP de destino'));const input=view.root.findAllByType('input').find(n=>n.props.id===label.props.htmlFor);assert.equal(input.props.value,'01311-000');
 assert.equal(view.root.findByType(AgendaWeeklyPlanner).props.weatherPoint.latitude,-15.81);
 await act(async()=>field.props.onDestinationCep(''));assert.equal(input.props.value,'');
});
test('view destination returns to the shared map and calendar navigation stays in whole weeks',async()=>{
 let agenda=0;await mount({onAgenda(){agenda++;}});const travel=view.root.findByType(ConsultationWorkspace);
 await act(async()=>travel.props.onLocateDestination('70000000'));assert.equal(scrolled,'planning-location');assert.equal(view.root.findByType(FieldConditions).props.mapRequest.cep,'70000000');
 const before=view.root.findByType(AgendaWeeklyPlanner).props.week;assert.equal(new Date(before+'T12:00:00Z').getUTCDay(),1);
 await act(async()=>view.root.findAllByType('button').find(n=>n.props['aria-label']==='Próxima semana').props.onClick());const next=view.root.findByType(AgendaWeeklyPlanner).props.week;assert.equal(Date.parse(next)-Date.parse(before),7*86400000);
 await act(async()=>view.root.findAllByType('button').find(n=>n.children.includes('Abrir agenda')).props.onClick());assert.equal(agenda,1);
});
test('travel is absent without customer consultation permission and makes no freight request',async()=>{
 await mount({canConsult:false});assert.equal(view.root.findAllByType(ConsultationWorkspace).length,0);assert.equal(requests.filter(r=>r.url==='/api/freight').length,0);assert.match(JSON.stringify(view.toJSON()),/permissões de consulta/);
});
