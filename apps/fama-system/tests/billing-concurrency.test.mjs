import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname);
const state=await f.load('/lib/billing-state.js'); const data=await f.load('/lib/supabase.js');
beforeEach(f.reset);after(f.close);
test('concurrent payment confirmation and polling grant exactly one validity extension',async()=>{
 const row=f.tables.organizations[0];Object.assign(row,{plan:'inicial',billing_cycle:'monthly',billing_payment_id:'pay_same',pending_plan:'inicial',pending_billing_cycle:'monthly',plan_expires_at:'2030-01-31T00:00:00Z'});
 const observed=structuredClone(row);const values=state.confirmedBillingUpdate(observed);
 const results=await Promise.all([state.applyBillingUpdate(observed,values),state.applyBillingUpdate(observed,values)]);
 assert.deepEqual(results.sort(),[false,true]);assert.equal(row.plan_expires_at,'2030-02-28T00:00:00.000Z');
});
test('paged reads return all 5000 advertised Pro customers without truncation or duplicate rows',async()=>{
 f.tables.customers=Array.from({length:5000},(_,i)=>({id:`customer-${String(i).padStart(5,'0')}`,organization_id:'org-one',name:`Client ${i}`}));
 const rows=await data.selectRows('customers',{organization_id:'org-one'},{select:'id',order:'created_at.asc'});
 assert.equal(rows.length,5000);assert.equal(new Set(rows.map(row=>row.id)).size,5000);
 assert.equal(f.calls.filter(call=>call.url.pathname==='/rest/v1/customers').length,51);
});
