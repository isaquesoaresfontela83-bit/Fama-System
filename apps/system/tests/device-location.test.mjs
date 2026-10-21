import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const root=new URL('../',import.meta.url).pathname;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {searchDeviceLocation}=await vite.ssrLoadModule('/lib/device-location.js');
after(()=>vite.close());
function fixture(){let receive,failure,options;const positions=[],errors=[],cleared=[];let completed=0;const stop=searchDeviceLocation({watchPosition(success,error,opts){receive=success;failure=error;options=opts;return 7;},clearWatch(id){cleared.push(id);}},{onPosition:p=>positions.push(p),onError:e=>errors.push(e),onComplete:()=>completed++});return {stop,positions,errors,cleared,get options(){return options;},get completed(){return completed;},emit(accuracy,timestamp=Date.now()){receive({timestamp,coords:{latitude:-15.8,longitude:-47.9,accuracy}});},fail(code){failure({code});}};}
test('coarse and old device readings never become an exact pin; fresh GPS improves and stops',()=>{
 const f=fixture();try{assert.equal(f.options.maximumAge,0);assert.equal(f.options.enableHighAccuracy,true);f.emit(12000);f.emit(10,Date.now()-60000);assert.equal(f.positions.length,0);f.emit(80);f.emit(9000);assert.equal(f.positions.length,1);f.emit(12);assert.equal(f.positions.at(-1).accuracy,12);assert.equal(f.completed,1);assert.deepEqual(f.cleared,[7]);f.emit(5);assert.equal(f.positions.length,2);}finally{f.stop();}
});
test('denied permission and cancellation clear the watcher and prevent later updates',()=>{
 const f=fixture();f.fail(1);assert.match(f.errors[0],/Permita/);assert.deepEqual(f.cleared,[7]);f.emit(10);assert.equal(f.positions.length,0);
 const cancelled=fixture();cancelled.stop();cancelled.emit(10);assert.equal(cancelled.positions.length,0);assert.deepEqual(cancelled.cleared,[7]);
});
test('deadline rejects a ten kilometre network estimate instead of displaying it',()=>{
 const original=globalThis.setTimeout;let deadline;globalThis.setTimeout=callback=>{deadline=callback;return 0;};let f;try{f=fixture();f.emit(12000);deadline();assert.equal(f.positions.length,0);assert.match(f.errors[0],/imprecisa/);assert.equal(f.completed,0);}finally{f?.stop();globalThis.setTimeout=original;}
});
