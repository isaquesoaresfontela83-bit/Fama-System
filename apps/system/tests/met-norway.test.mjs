import assert from 'node:assert/strict';import test,{after} from 'node:test';import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('../',import.meta.url).pathname);after(()=>f.close());const {normalizeMetNorway,metNorwayForecast}=await f.load('/lib/met-norway.js');const {proposeWeek}=await f.load('/lib/weekly-planner.js');
const raw={properties:{meta:{updated_at:'2026-10-19T10:00:00Z'},timeseries:[{time:'2026-10-19T11:00:00Z',data:{instant:{details:{air_temperature:25,wind_speed:4}},next_1_hours:{summary:{symbol_code:'rainandthunder_day'},details:{precipitation_amount:2}}}}]}};
test('MET forecast preserves rainfall volume without inventing a probability and uses actual period coverage',()=>{
 const forecast=normalizeMetNorway(raw,-15.79,-47.88,'Empresa',new Date('2026-10-19T10:00:00Z'));const s=forecast.slots[0];assert.equal(s.rainChanceKnown,false);assert.equal(s.precipitationMm,2);assert.equal(s.periodHours,1);assert.equal(s.storm,true);assert.equal(forecast.days[0].rainChanceKnown,false);
 const input={week:'2026-10-19',start:480,end:600,lunchStart:600,lunchEnd:600,buffer:0,fixedDuration:60,fixedTravel:0,jobs:[{id:'a',duration:60,travel:0,outdoor:true,earliest:480,latest:540,priority:1}]};
 const proposal=proposeWeek([{id:'a',startAt:'2026-10-19T08:00:00-03:00',technician:'Lucas',status:'agendado'}],input,forecast,new Date('2026-10-18T12:00:00Z'));assert.notEqual(proposal.suggestions[0].startAt.slice(0,10),'2026-10-19');
});
test('MET fetch identifies Fama, rounds coordinates, coalesces calls and respects provider expiry',async()=>{
 f.reset();let calls=0;const actual=globalThis.fetch;
 const liveRaw=structuredClone(raw);liveRaw.properties.meta.updated_at=new Date().toISOString();liveRaw.properties.timeseries[0].time=new Date(Date.now()+3600000).toISOString();
 globalThis.fetch=async(input,init)=>{const u=new URL(String(input));if(u.hostname==='api.met.no'){calls++;assert.match(new Headers(init.headers).get('user-agent'),/FamaSystem.*famasystem.online/);assert.ok(u.searchParams.get('lat').split('.')[1].length<=4);return Response.json(liveRaw,{headers:{Expires:new Date(Date.now()+3600000).toUTCString(),'Last-Modified':new Date().toUTCString()}});}return actual(input,init);};
 try{await Promise.all([metNorwayForecast(-15.7939123,-47.8828123),metNorwayForecast(-15.7939123,-47.8828123)]);await metNorwayForecast(-15.7939123,-47.8828123);assert.equal(calls,1);}finally{globalThis.fetch=actual;}
});
