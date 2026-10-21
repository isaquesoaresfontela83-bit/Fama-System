import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {normalizeOperationForecast,appointmentWeatherRisk}=await vite.ssrLoadModule('/lib/operation-weather-model.js');
const {normalizeOpenMeteo}=await vite.ssrLoadModule('/lib/open-meteo.js');
const {osmEmbed,osmDirections,osmSearch,addressCep}=await vite.ssrLoadModule('/lib/operation-geo.js');
after(()=>vite.close());
const now=new Date('2026-10-14T23:00:00Z');
const slot=(at,temp,pop,wind,id=800)=>({dt:Date.parse(at)/1000,main:{temp},pop,wind:{speed:wind},weather:[{id,description:'condição'}]});
const raw=()=>({city:{name:'Brasília',coord:{lat:-15.8,lon:-47.9},timezone:-10800},list:[slot('2026-10-15T00:00:00Z',25,.7,5),slot('2026-10-15T03:00:00Z',20,2,12,201),slot('2026-10-15T06:00:00Z',18,-1,2)]});
test('forecast aggregates local dates, clamps rainfall and converts wind to km/h',()=>{
 const result=normalizeOperationForecast(raw(),now);
 assert.equal(result.days[0].date,'2026-10-14');assert.equal(result.days[1].date,'2026-10-15');
 assert.equal(result.days[1].min,18);assert.equal(result.days[1].max,20);
 assert.equal(result.days[1].rainChance,100);assert.equal(result.days[1].windKmh,43);assert.equal(result.days[1].storm,true);
 assert.equal(result.slots[2].rainChance,0);assert.equal(result.slots[0].windKmh,18);
});
test('appointment advice uses nearest forecast slot and rejects unavailable dates',()=>{
 const result=normalizeOperationForecast(raw(),now);
 assert.equal(appointmentWeatherRisk('2026-10-15T00:30:00Z',result).risk,'rain');
 assert.equal(appointmentWeatherRisk('2026-10-15T03:30:00Z',result).risk,'storm');
 assert.equal(appointmentWeatherRisk('2026-10-20T12:00:00Z',result),null);
 assert.equal(appointmentWeatherRisk('invalid',result),null);
});
test('invalid and outdated provider responses do not become a valid forecast',()=>{
 assert.throws(()=>normalizeOperationForecast({},now));
 assert.throws(()=>normalizeOperationForecast(raw(),new Date('2026-11-01')));
});
test('OSM links preserve fixed origins, coordinates and encoded address queries',()=>{
 const point={latitude:-15.8,longitude:-47.9,address:'Rua & nº 20'};
 const embed=new URL(osmEmbed(point));assert.equal(embed.origin,'https://www.openstreetmap.org');assert.equal(embed.searchParams.get('marker'),'-15.8,-47.9');
 assert.equal(new URL(osmSearch(point.address)).searchParams.get('query'),point.address);
 assert.equal(new URL(osmDirections(point,null)).searchParams.get('route'),';-15.8,-47.9');
 assert.equal(addressCep('Rua 20, CEP 70040-010'),'70040010');assert.equal(addressCep('123456789'),'');
});

test('Open-Meteo keeps future hourly slots with local dates and rejects null temperatures',()=>{
 const result=normalizeOpenMeteo({latitude:-15.8,longitude:-47.9,utc_offset_seconds:-10800,hourly:{time:[Date.parse('2026-10-15T00:00Z')/1000,Date.parse('2026-10-15T03:00Z')/1000,Date.parse('2026-10-15T04:00Z')/1000],temperature_2m:[25,22,null],precipitation_probability:[80,30,0],wind_speed_10m:[10,45,0],weather_code:[95,3,0]}},'Empresa',now);
 assert.equal(result.slots.length,2);assert.equal(result.slots[0].date,'2026-10-14');assert.equal(result.slots[1].date,'2026-10-15');assert.equal(result.slots[0].storm,true);assert.equal(result.slots[1].windKmh,45);
 assert.throws(()=>normalizeOpenMeteo({hourly:{time:[]}},'Empresa',now));
});
