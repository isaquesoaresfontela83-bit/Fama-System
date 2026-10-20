import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('../',import.meta.url).pathname);after(()=>f.close());
const places=await f.load('/lib/nearby-places.js');
const calendar=await f.load('/lib/google-calendar.js');
const planner=await f.load('/lib/weekly-planner.js');
test('nearby search rejects injection, invalid coordinates, categories and unbounded radii',()=>{
 const input={latitude:-15.7939,longitude:-47.8828,category:'fuel',radius:3000};assert.equal(places.nearbyInput(input).latitude,-15.794);
 for(const patch of [{latitude:NaN},{longitude:181},{category:'fuel];out;('},{radius:999999},{latitude:'-15'}])assert.throws(()=>places.nearbyInput({...input,...patch}));
});
test('nearby results reject invalid geometry, discard remote points, sort and cap results',()=>{
 const point=places.nearbyInput({latitude:0,longitude:0,category:'parking',radius:1000});
 const raw={elements:[{type:'node',id:1,lat:20,lon:20},{type:'way',id:2,center:{lat:0,lon:.002},tags:{name:'B'}},{type:'node',id:3,lat:0,lon:.001,tags:{name:'A'}},{type:'node',id:3,lat:0,lon:.001},{type:'script',id:4,lat:0,lon:0},{type:'node',id:5,lat:NaN,lon:0}]};
 const v=places.normalizePlaces(raw,point);assert.deepEqual(v.map(x=>x.name),['A','B']);assert.equal(v[0].url,'https://www.openstreetmap.org/node/3');
 assert.throws(()=>places.normalizePlaces({elements:[],remark:'timeout'},point));
 assert.equal(places.normalizePlaces({elements:Array.from({length:30},(_,id)=>({type:'node',id,lat:0,lon:0}))},point).length,20);
});
test('nearby route and Google configuration require module permission',async()=>{
 f.reset();f.member().role='member';f.member().permissions=[];
 const nearby=await f.load('/app/api/nearby-places/route.js'),google=await f.load('/app/api/agenda/google-calendar/route.js');
 assert.equal((await nearby.POST(f.request('POST','/api/nearby-places',{}))).status,403);
 assert.equal((await google.GET(f.request('GET','/api/agenda/google-calendar'))).status,403);
 f.member().role='owner';delete f.runtime.FAMA_GOOGLE_CALENDAR_CLIENT_ID;
 let r=await google.GET(f.request('GET','/api/agenda/google-calendar'));assert.deepEqual(await r.json(),{configured:false,clientId:null});
 f.runtime.FAMA_GOOGLE_CALENDAR_CLIENT_ID='123-fixture.apps.googleusercontent.com';r=await google.GET(f.request('GET','/api/agenda/google-calendar'));assert.equal((await r.json()).configured,true);assert.equal(f.businessWrites().length,0);
});
test('Google freebusy errors never masquerade as an available calendar',()=>{
 assert.throws(()=>calendar.readGoogleBusy({calendars:{primary:{errors:[{reason:'forbidden'}],busy:[]}}},'2026-10-19','Lucas'));
 assert.throws(()=>calendar.readGoogleBusy({calendars:{primary:{busy:[{start:'bad',end:'bad'}]}}},'2026-10-19','Lucas'));
 const v=calendar.readGoogleBusy({calendars:{primary:{busy:[]}}},'2026-10-19','Lucas');assert.equal(v.intervals.length,0);assert.equal(v.technician,'Lucas');
});
test('Google export uses stable tenant-specific event IDs and safe ICS escaping with explicit timezone',async()=>{
 const a={id:'a',title:'Manutenção\nBEGIN:VEVENT',clientName:'Cliente, nome',technician:'Lucas',address:'Rua; 1',startAt:'2026-10-19T08:00:00'};
 const e=calendar.appointmentEvent(a,90);assert.equal(e.start.dateTime,'2026-10-19T11:00:00.000Z');assert.equal(e.end.dateTime,'2026-10-19T12:30:00.000Z');assert.equal(e.attendees,undefined);
 assert.equal(await calendar.calendarEventId('org','a'),await calendar.calendarEventId('org','a'));assert.notEqual(await calendar.calendarEventId('org','a'),await calendar.calendarEventId('other','a'));
 const ics=calendar.calendarIcs([a],'org',90);assert.equal((ics.match(/\r\nBEGIN:VEVENT/g)||[]).length,1);assert.match(ics,/Rua\\; 1/);assert.match(ics,/DTSTART:20261019T110000Z/);assert.throws(()=>calendar.appointmentEvent(a,0));
});
test('weekly planning respects Google busy periods only for selected technician and rejects stale data',()=>{
 const a={id:'a',startAt:'2026-10-19T08:00:00-03:00',technician:'Lucas',status:'agendado'};
 const googleBusy={week:'2026-10-19',technician:'Lucas',checkedAt:Date.now(),intervals:[{from:'2026-10-19T00:00:00-03:00',to:'2026-10-20T00:00:00-03:00'}]};
 const rules={week:'2026-10-19',start:480,end:1080,lunchStart:720,lunchEnd:780,buffer:15,fixedDuration:60,fixedTravel:30,jobs:[{id:'a',duration:60,travel:30,outdoor:false,earliest:480,latest:1080,priority:2}],googleBusy};
 const now=new Date('2026-10-18T12:00:00Z');assert.equal(planner.proposeWeek([a],rules,null,now).suggestions[0].startAt.slice(0,10),'2026-10-20');
 assert.equal(planner.proposeWeek([a],{...rules,googleBusy:{...googleBusy,technician:'Maria'}},null,now).suggestions[0].startAt.slice(0,10),'2026-10-19');
 assert.throws(()=>planner.validateWeeklyRules({...rules,googleBusy:{...googleBusy,checkedAt:Date.now()-600000}}));
});
