import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {geoapifyTiles,osmTiles,installMapTiles}=await vite.ssrLoadModule('/lib/map-tiles.js');
after(()=>vite.close());
test('invalid public keys always use OSM; fixed provider URLs and all required credits',()=>{
 for(const key of [null,undefined,'','x','https://evil.test/?key=123456789'])assert.equal(geoapifyTiles(key),osmTiles);
 const key='a'.repeat(32),light=geoapifyTiles(key),dark=geoapifyTiles(key,true);
 assert.ok(light.url.startsWith('https://maps.geoapify.com/v1/tile/positron/'));
 assert.ok(dark.url.includes('/dark-matter/'));
 for(const credit of ['Geoapify','OpenMapTiles','OpenStreetMap'])assert.ok(light.attribution.includes(credit));
});
test('three failed Geoapify tiles switch once to OSM without replacing the map, then clean up',async()=>{
 const originalFetch=globalThis.fetch,originalDocument=globalThis.document,layers=[],map={};
 globalThis.document={documentElement:{classList:{contains:()=>true}}};
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/map-config');assert.equal(options.headers['x-organization-id'],'org');return Response.json({publicKey:'a'.repeat(32)});};
 const L={tileLayer(url,options){const layer={url,options,handlers:{},removed:false,remove(){this.removed=true;},addTo(target){assert.equal(target,map);return this;},on(type,callback){this.handlers[type]=callback;return this;}};layers.push(layer);return layer;}};
 let dispose;
 try{
  dispose=installMapTiles(L,map,'org',()=>{});await new Promise(r=>setImmediate(r));
  assert.equal(layers.length,1);assert.ok(layers[0].url.includes('dark-matter'));
  for(let i=0;i<3;i++)layers[0].handlers.tileerror();
  assert.equal(layers.length,2);assert.equal(layers[0].removed,true);assert.equal(layers[1].url,osmTiles.url);
  for(let i=0;i<5;i++)layers[1].handlers.tileerror();assert.equal(layers.length,2);
 }finally{dispose?.();globalThis.fetch=originalFetch;globalThis.document=originalDocument;}
 assert.equal(layers[1].removed,true);
});
