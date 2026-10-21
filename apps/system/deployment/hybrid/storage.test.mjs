import test from 'node:test';
import assert from 'node:assert/strict';
import { HybridBucket } from '../../server/hybrid-bucket.mjs';
test('private backups preserve bytes, authenticate only to configured origin and reject traversal', async()=>{
 const original=globalThis.fetch;const requests=[];
 const bucket=new HybridBucket({SUPABASE_URL:'https://storage.example.test',SUPABASE_SECRET_KEY:'private-test-key',FAMA_BACKUP_BUCKET:'private-backups'});
 globalThis.fetch=async(url,options)=>{requests.push({url:String(url),options});if(options.method==='POST'&&String(url).includes('/object/list/'))return Response.json([{id:'one',name:'a.enc',metadata:{size:3},created_at:'2026-10-21T00:00:00Z'}]);return new Response(new Uint8Array([0,255,128]));};
 try{
  await bucket.put('backups/a.enc',new Uint8Array([0,255,128]));
  assert.deepEqual([...requests[0].options.body],[0,255,128]);
  const file=await bucket.get('backups/a.enc');assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[0,255,128]);
  const list=await bucket.list({prefix:'backups/'});assert.equal(list.objects[0].key,'backups/a.enc');
  await bucket.delete('backups/a.enc');
  for(const request of requests){assert.equal(new URL(request.url).origin,'https://storage.example.test');assert.equal(request.options.headers.apikey,'private-test-key');assert.equal(request.options.redirect,'manual');}
  await assert.rejects(bucket.put('../outside','no'),/inválido/);
  globalThis.fetch=async()=>new Response('',{status:404});assert.equal(await bucket.get('missing.enc'),null);
  globalThis.fetch=async()=>new Response('',{status:302,headers:{Location:'https://other.example.test'}});await assert.rejects(bucket.get('secret.enc'),/não confirmou/);
  assert.throws(()=>new HybridBucket({SUPABASE_URL:'https://user:pass@example.test',SUPABASE_SECRET_KEY:'x',FAMA_BACKUP_BUCKET:'private'}),/inválido/);
 }finally{globalThis.fetch=original;}
});
