import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname,'system-auth');
const data=await f.load('/lib/supabase.js');
beforeEach(f.reset);after(f.close);
test('paged reads return all 5000 advertised Pro customers without truncation or duplicate rows',async()=>{
 f.tables.customers=Array.from({length:5000},(_,i)=>({id:`customer-${String(i).padStart(5,'0')}`,organization_id:'org-one',name:`Client ${i}`}));
 const rows=await data.selectRows('customers',{organization_id:'org-one'},{select:'id',order:'created_at.asc'});
 assert.equal(rows.length,5000);assert.equal(new Set(rows.map(row=>row.id)).size,5000);
 assert.equal(f.calls.filter(call=>call.url.pathname==='/rest/v1/customers').length,51);
});
