import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname);
const [create,edit,history]=await Promise.all(['/app/api/records/route.js','/app/api/records/[id]/route.js','/lib/workspace-insights.js'].map(f.load));
beforeEach(()=>{f.reset();f.tables.customers=[{id:'customer-a',organization_id:'org-one',name:'Nome cadastrado',phone:'61999999999',address:'Endereço cadastrado',notes:JSON.stringify({text:'',details:{clientDocument:'12345678901'}})},{id:'foreign',organization_id:'other',name:'PRIVATE OTHER COMPANY',phone:'61988888888'}];});
after(()=>f.close());
test('all five operational forms save the selected customer ID and registered name within the company',async()=>{
    for(const [entity,table,fields] of [['quotes','quotes',{service:'Limpeza',materials:'20'}],['appointments','appointments',{title:'Visita',startAt:'2026-10-22T09:00'}],['workOrders','work_orders',{service:'Execução'}],['warranties','warranties',{item:'Bomba',expiresAt:'2027-10-22'}],['contracts','contracts',{service:'Manutenção',startDate:'2026-10-22',endDate:'2027-10-22'}]]){
        const response=await create.POST(f.request('POST','/api/records',{entity,customerId:'customer-a',clientName:'forged',...fields}));
        assert.equal(response.status,201,entity+': '+await response.clone().text());const {record}=await response.json();
        assert.equal(record.customerId,'customer-a');assert.equal(record.clientName,'Nome cadastrado');assert.equal(f.tables[table][0].customer_id,'customer-a');
        if(entity==='appointments')assert.equal(record.address,'Endereço cadastrado');
        if(entity==='contracts'){assert.equal(record.clientAddress,'Endereço cadastrado');assert.equal(record.clientDocument,'12345678901');}
    }
});
test('foreign and missing selected customer IDs fail before an operational write',async()=>{
    for(const customerId of ['foreign','missing','']){const response=await create.POST(f.request('POST','/api/records',{entity:'workOrders',customerId,clientName:'fake',service:'fake'}));assert.equal(response.status,customerId?404:400);assert.equal(f.businessWrites().length,0);}
});
test('legacy edits can link a customer and foreign IDs cannot replace the link',async()=>{
    f.tables.appointments=[{id:'visit-a',organization_id:'org-one',client_name:'Nome anterior',title:'Visita',notes:'',updated_at:'2026-10-21T10:00:00Z'}];
    const response=await edit.PATCH(f.request('PATCH','/api/records/visit-a',{entity:'appointments',action:'edit',expected:{id:'visit-a',clientName:'Nome anterior'},customerId:'customer-a',clientName:'fake'}),f.context('visit-a'));
    assert.equal(response.status,200);const {record}=await response.json();assert.equal(record.customerId,'customer-a');assert.equal(record.clientName,'Nome cadastrado');
    assert.equal((await edit.PATCH(f.request('PATCH','/api/records/visit-a',{entity:'appointments',action:'edit',expected:{id:'visit-a'},customerId:'foreign',clientName:'fake'}),f.context('visit-a'))).status,404);
});
test('same-name customers have separate linked histories and renamed customers keep their records',()=>{
    const a={id:'a',name:'Ana'},b={id:'b',name:'Ana'},data={customers:[a,b],quotes:[{id:'q-a',customerId:'a',clientName:'Nome anterior',quoteNumber:'1',service:'A'},{id:'q-b',customerId:'b',clientName:'Ana',quoteNumber:'2',service:'B'},{id:'legacy',clientName:'Ana',quoteNumber:'3',service:'antigo'}]};
    assert.deepEqual(history.customerHistory(data,a,['quotes']).map(item=>item.record.id),['q-a']);assert.deepEqual(history.customerHistory(data,b,['quotes']).map(item=>item.record.id),['q-b']);
});
