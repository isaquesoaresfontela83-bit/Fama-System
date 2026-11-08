import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './test-support.mjs';
import {consumeRateLimit} from './rate-limit.mjs';

test('durable quota cannot be bypassed by parallel calls or a fresh handler',async()=>{
  const f=await fixture();
  const results=await Promise.allSettled(Array.from({length:12},()=>consumeRateLimit(f.db,'org','user','mutation',3,60_000)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
  assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
  await assert.rejects(consumeRateLimit(f.db,'org','user','mutation',3,60_001),e=>e.status===429);
  await consumeRateLimit(f.db,'org','user','mutation',3,120_000);
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM sales_order_rate_limits').get().n,1);
});
test('quotas isolate verified organizations, users and actions and store hashes only',async()=>{
  const f=await fixture();
  for(const [org,user,action] of [['a','a','a'],['b','a','a'],['a','b','a'],['a','a','b']])await consumeRateLimit(f.db,org,user,action,1,0);
  const rows=f.db.raw.prepare('SELECT * FROM sales_order_rate_limits').all();
  assert.equal(rows.length,4);assert(rows.every(r=>/^[a-f0-9]{64}$/.test(r.key_hash)));
  await consumeRateLimit(f.db,'a','a','a');
});
