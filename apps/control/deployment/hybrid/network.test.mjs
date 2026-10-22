import assert from 'node:assert/strict';
import test from 'node:test';
import { installHybridNetwork } from './network.js';

test('cold-start HTML becomes a clear error; mutations are sent exactly once and downloads stay intact', async () => {
 const calls=[],events=[];
 const scope={location:new URL('https://fama.example/'),dispatchEvent:event=>events.push(event.detail),setTimeout:()=>1,clearTimeout:()=>{},
  fetch:async(input,init)=>{calls.push({input,init});return new Response('<html>Starting</html>',{status:200,headers:{'content-type':'text/html'}});}};
 const restore=installHybridNetwork(scope);
 const body=JSON.stringify({operation:'fixture'});
 const result=await scope.fetch('/api/records',{method:'POST',body,headers:{'Content-Type':'application/json'}});
 assert.equal(result.status,503);
 assert.match((await result.json()).error,/iniciando/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].init.body,body);
 assert.deepEqual(events,['ready']);
 restore();
 const binary=new Uint8Array([0,12,255]);
 scope.fetch=async()=>new Response(binary,{headers:{'content-type':'application/pdf'}});
 installHybridNetwork(scope);
 assert.deepEqual(new Uint8Array(await (await scope.fetch('/api/documents/fixture')).arrayBuffer()),binary);
});

test('third-party requests are not rewritten and failures are not retried',async()=>{
 let count=0;
 const scope={location:new URL('https://fama.example/'),dispatchEvent:()=>{},setTimeout:()=>1,clearTimeout:()=>{},fetch:async()=>{count++;throw Error('offline');}};
 installHybridNetwork(scope);
 await assert.rejects(scope.fetch('https://other.example/api/resource'),/offline/);
 assert.equal(count,1);
 await assert.rejects(scope.fetch('/api/records',{method:'POST',body:'fixture'}),/offline/);
 assert.equal(count,2);
});
