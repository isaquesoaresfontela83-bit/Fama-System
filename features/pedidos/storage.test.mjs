import test from 'node:test';
import assert from 'node:assert/strict';
import {seal,unseal,legacyStore,uuidFor,decode,encode} from './storage.mjs';
import {fixture} from './test-support.mjs';

test('encryption has random IVs, detects tampering and supports both key encodings',async()=>{
  const hex={FAMA_DATA_ENCRYPTION_KEY:'a'.repeat(64)},b64={FAMA_DATA_ENCRYPTION_KEY:encode(new Uint8Array(32).fill(170))};
  const first=await seal('private fixture',hex),second=await seal('private fixture',hex);
  assert.notEqual(first,second);assert.equal(await unseal(first,b64,false),'private fixture');
  const [iv,data]=first.slice(8).split('.'),bytes=decode(data);bytes[0]^=1;
  await assert.rejects(unseal('fama:v1:'+iv+'.'+encode(bytes),hex,false));
  await assert.rejects(seal('value',{FAMA_DATA_ENCRYPTION_KEY:'YQ=='}),e=>e.status===503);
  assert.deepEqual(await unseal(await seal({value:'fixture'},hex),hex),{value:'fixture'});
});
test('batch lookup keeps a tenant predicate and uses one database read for 37 payments',async()=>{
  const f=await fixture(),order=await f.create({installmentCount:36});
  let reads=0;const original=f.db.prepare;
  f.db.prepare=(sql,...args)=>{if(sql.startsWith('SELECT * FROM transactions'))reads++;return original(sql,...args);};
  const r=await f.request('/api/pedidos/'+order.id);
  assert.equal(r.status,200);assert.equal(r.data.order.payments.length,37);assert.equal(reads,1);
  const store=legacyStore(f.env),id=await uuidFor('own');
  assert.deepEqual(await store.readMany('transactions',[], 'org-a'),[]);
  for(const [table,ids] of [['__proto__',[id]],['transactions',['bad']],['transactions',Array(51).fill(id)]])await assert.rejects(store.readMany(table,ids,'org-a'));
  await store.insert('transactions',{id,organization_id:'org-b',amount_cents:999});
  assert.deepEqual(await store.readMany('transactions',[id],'org-a'),[]);
  assert.equal((await store.readMany('transactions',[id],'org-b'))[0].amount_cents,999);
});
test('remote finance operations use bounded same-provider requests and tenant filters',async()=>{
  const original=globalThis.fetch,env={DATA_BACKEND:'supabase',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture'},calls=[];
  const id=await uuidFor('fixture');
  globalThis.fetch=async(url,init)=>{calls.push({url:new URL(url),init});return Response.json([{id,organization_id:'a'}]);};
  try{
    const store=legacyStore(env);
    assert.equal((await store.read('transactions',id,'a')).id,id);
    await store.readMany('transactions',[id],'a');
    assert.equal(calls.at(-1).url.searchParams.get('id'),`in.(${id})`);
    for(const call of calls){assert.equal(call.url.origin,'https://fixture.supabase.co');assert.equal(call.url.searchParams.get('organization_id'),'eq.a');assert.equal(call.init.redirect,'error');assert(call.init.signal instanceof AbortSignal);}
    await store.insert('transactions',{id,organization_id:'a'});assert.equal(calls.at(-1).url.searchParams.get('on_conflict'),'id');
    await store.patch('transactions',id,'a',{status:'pago'},'pendente');assert.equal(calls.at(-1).url.searchParams.get('status'),'eq.pendente');
    await store.remove('transactions',id,'a','pendente');assert.equal(calls.at(-1).init.method,'DELETE');
    globalThis.fetch=async()=>new Response(null,{status:204});assert.deepEqual(await store.remove('transactions',id,'a'),[]);
    globalThis.fetch=async()=>new Response('provider fixture',{status:503});await assert.rejects(store.read('transactions',id,'a'),e=>e.status===503);
    await assert.rejects(legacyStore({...env,SUPABASE_SECRET_KEY:''}).read('transactions',id,'a'),e=>e.status===503);
    globalThis.fetch=async(url,init)=>{assert.equal(init.headers.Authorization,'Bearer eyJfixture');return Response.json([]);};
    assert.equal(await legacyStore({...env,SUPABASE_SECRET_KEY:'eyJfixture'}).read('transactions',id,'a'),null);
    for(const method of ['read','insert','patch','remove'])await assert.rejects(store[method]('not_a_table',id,'a',{}));
    await assert.rejects(store.insert('transactions',{forged:'column'}));
    await assert.rejects(store.patch('transactions',id,'a',{forged:'column'}));
  }finally{globalThis.fetch=original;}
});
