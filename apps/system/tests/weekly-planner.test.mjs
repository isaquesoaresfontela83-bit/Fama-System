import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('../',import.meta.url).pathname);after(()=>f.close());
const {proposeWeek,validateWeeklyRules}=await f.load('/lib/weekly-planner.js');
const appointment=(id,at,technician='Lucas')=>({id,startAt:at,technician,title:id,status:'agendado',address:'',notes:'',kind:'Manutenção',clientName:'Cliente'});
const job=id=>({id,duration:60,travel:30,outdoor:true,earliest:480,latest:1080,priority:2});
const rules=jobs=>({week:'2026-10-19',start:480,end:1080,lunchStart:720,lunchEnd:780,buffer:15,fixedDuration:60,fixedTravel:30,jobs});
const now=new Date('2026-10-18T12:00:00Z');
test('selected visits fit work hours, travel, lunch and a fixed appointment, without modifying records',()=>{
 const data=[appointment('fixed','2026-10-19T08:00:00-03:00'),appointment('move','2026-10-21T08:00:00-03:00')];const original=JSON.stringify(data);
 const input=rules([job('move')]);input.jobs[0].earliest=540;input.jobs[0].latest=720;
 const p=proposeWeek(data,input,null,now);assert.equal(p.suggestions.length,1);const s=p.suggestions[0];
 assert.ok(Date.parse(s.startAt)-30*60000>=Date.parse('2026-10-19T09:15:00-03:00'));assert.equal(JSON.stringify(data),original);assert.match(p.warnings.join(' '),/Sem previsão/);
});
test('multiple selected visits never overlap their service, travel and buffer for the same technician',()=>{
 const data=['a','b','c','d'].map(id=>appointment(id,'2026-10-19T08:00:00-03:00'));const p=proposeWeek(data,rules(data.map(a=>job(a.id))),null,now);assert.equal(p.suggestions.length,4);
 for(let i=0;i<p.suggestions.length;i++)for(let j=i+1;j<p.suggestions.length;j++){const a=p.suggestions[i],b=p.suggestions[j];assert.ok(Date.parse(a.endAt)+15*60000<=Date.parse(b.startAt)-b.travel*60000||Date.parse(b.endAt)+15*60000<=Date.parse(a.startAt)-a.travel*60000);}
});
test('storm hours are rejected for outdoor visits and missing forecast remains explicitly unknown',()=>{
 const forecast={city:'Empresa',slots:[{at:'2026-10-19T11:00:00Z',storm:true,rainChance:90,windKmh:45}]};const input=rules([job('a')]);input.jobs[0].latest=660;
 const p=proposeWeek([appointment('a','2026-10-19T08:00:00-03:00')],input,forecast,now);assert.equal(p.suggestions.length,1);assert.notEqual(p.suggestions[0].startAt.slice(0,10),'2026-10-19');assert.equal(p.suggestions[0].weather,'unknown');
});
test('no fit, past slots, invalid windows and duplicate appointment IDs are never silently accepted',()=>{
 const input=rules([{...job('a'),duration:480,earliest:540,latest:600}]);assert.equal(proposeWeek([appointment('a','2026-10-19T08:00:00-03:00')],input,null,now).unplaced.length,1);
 assert.equal(proposeWeek([appointment('a','2026-10-19T08:00:00-03:00')],rules([job('a')]),null,new Date('2026-11-01T12:00:00Z')).suggestions.length,0);
 assert.throws(()=>validateWeeklyRules(rules([job('a'),job('a')])));assert.throws(()=>validateWeeklyRules({...rules([job('a')]),lunchEnd:400}));
});
test('planner API requires agenda permission and never accepts foreign appointment IDs',async()=>{
 f.reset();const route=await f.load('/app/api/agenda/weekly-plan/route.js');f.member().role='member';f.member().permissions=[];
 assert.equal((await route.POST(f.request('POST','/api/agenda/weekly-plan',rules([job('foreign')])))).status,403);
 f.member().role='owner';assert.equal((await route.POST(f.request('POST','/api/agenda/weekly-plan',rules([job('foreign')])))).status,409);
});
test('authorized weekly planning reads server appointments and never writes business records',async()=>{
 f.reset();f.tables.appointments=[{id:'job-one',organization_id:'org-one',title:'Manutenção',client_name:'Cliente',start_at:'2026-10-19T08:00:00-03:00',technician:'Lucas',address:'',kind:'Manutenção',notes:'',status:'agendado'}];f.tables.employees=[{id:'tech-one',organization_id:'org-one',name:'Lucas',active:true,color:'blue'}];
 const route=await f.load('/app/api/agenda/weekly-plan/route.js');const response=await route.POST(f.request('POST','/api/agenda/weekly-plan',rules([job('job-one')])));
 assert.equal(response.status,200,await response.clone().text());const proposal=await response.json();assert.equal(proposal.suggestions.length,1);assert.equal(proposal.engine,'rules');assert.match(proposal.warnings.join(' '),/Sem previsão/);assert.equal(f.businessWrites().length,0);
});
