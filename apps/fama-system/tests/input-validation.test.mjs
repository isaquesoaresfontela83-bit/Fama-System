import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname, 'system-auth');
const [records,bodyReader]=await Promise.all(['/app/api/records/route.js','/lib/request-body.js'].map(f.load));
beforeEach(f.reset);after(f.close);

const inputs={
  quotes:{entity:'quotes',clientName:'Cliente',service:'Limpeza'},
  transactions:{entity:'transactions',description:'Serviço'},
  warranties:{entity:'warranties',clientName:'Cliente',item:'Bomba',purchaseDate:'2028-01-01',expiresAt:'2028-12-31'},
  contracts:{entity:'contracts',clientName:'Cliente',service:'Limpeza',startDate:'2028-01-01',endDate:'2028-12-31'},
};
const moneyInputs=[
  ['leads','estimatedValue','estimatedValueCents',{entity:'leads',name:'Cliente',phone:'11999999999',interest:'Piscina'}],
  ['quotes','labor','laborCents',inputs.quotes],
  ['workOrders','amount','amountCents',{entity:'workOrders',clientName:'Cliente',service:'Limpeza'}],
  ['inventory','cost','costCents',{entity:'inventory',name:'Cloro'}],
  ['transactions','amount','amountCents',inputs.transactions],
  ['contracts','monthly','monthlyCents',inputs.contracts],
];
for(const [entity,key,resultKey,input] of moneyInputs){
  for(const [value,expected] of [['R$ 1.234,56',123456],['1234.56',123456],[1234.56,123456],['0,01',1]])test(`${entity}: monetary input ${JSON.stringify(value)} is persisted in exact cents`,async()=>{
    const response=await records.POST(f.request('POST','/api/records',{...input,[key]:value}));assert.equal(response.status,201);assert.equal((await response.json()).record[resultKey],expected);
  });
  for(const value of ['-100,50','invalid','1,2,3',100000000000000])test(`${entity}: invalid monetary input ${JSON.stringify(value)} is rejected`,async()=>{
    const response=await records.POST(f.request('POST','/api/records',{...input,[key]:value}));assert.equal(response.status,400);assert.equal(f.businessWrites().length,0);
  });
}
for(const [entity,field] of [['quotes','validUntil'],['transactions','dueDate'],['warranties','purchaseDate'],['warranties','expiresAt'],['contracts','startDate'],['contracts','endDate']]) {
  for(const value of ['not-a-date','2027-02-29','2028-02-30','2028-04-31','2028-13-01']) test(`${entity}.${field}: invalid calendar date ${value} cannot be saved`,async()=>{
    const response=await records.POST(f.request('POST','/api/records',{...inputs[entity],[field]:value}));assert.equal(response.status,400);assert.equal(f.businessWrites().length,0);
  });
  test(`${entity}.${field}: a real leap day is accepted`,async()=>{
    const response=await records.POST(f.request('POST','/api/records',{...inputs[entity],[field]:'2028-02-29'}));assert.equal(response.status,201);
  });
}
for(const entity of ['warranties','contracts'])test(`${entity}: a reversed date interval is rejected`,async()=>{
  const input=entity==='warranties'?{...inputs[entity],purchaseDate:'2028-12-31',expiresAt:'2028-01-01'}:{...inputs[entity],startDate:'2028-12-31',endDate:'2028-01-01'};
  assert.equal((await records.POST(f.request('POST','/api/records',input))).status,400);assert.equal(f.businessWrites().length,0);
});
test('a chunked oversized JSON body is cancelled before its complete transfer',async()=>{
  let chunks=0,cancelled=false;
  const stream=new ReadableStream({pull(controller){chunks++;controller.enqueue(new Uint8Array(32768));if(chunks===100)controller.close();},cancel(){cancelled=true;}});
  const request=new Request('https://fama.example.test/api/records',{method:'POST',headers:{'x-organization-id':'org-one','Content-Type':'application/json'},body:stream,duplex:'half'});
  assert.equal((await records.POST(request)).status,413);assert.ok(chunks<100);assert.equal(cancelled,true);assert.equal(f.businessWrites().length,0);
});
test('a JSON request with invalid UTF-8 is rejected',async()=>{
  const request=new Request('https://fama.example.test/api/records',{method:'POST',headers:{'x-organization-id':'org-one','Content-Type':'application/json'},body:new Uint8Array([123,34,120,34,58,34,255,34,125])});
  assert.equal((await records.POST(request)).status,400);assert.equal(f.businessWrites().length,0);
});
test('a stalled upload expires and releases the body stream',async()=>{
  let cancelled=false;
  const request=new Request('https://fama.example.test/api/records',{method:'POST',body:new ReadableStream({cancel(){cancelled=true;}}),duplex:'half'});
  await assert.rejects(()=>bodyReader.readLimitedBody(request,1024,15),error=>error.status===408);assert.equal(cancelled,true);
});
for(const type of ['text/plain','application/x-www-form-urlencoded','multipart/form-data'])test(`record mutations reject unsupported media type ${type}`,async()=>{
  assert.equal((await records.POST(f.request('POST','/api/records',inputs.transactions,{'Content-Type':type}))).status,415);assert.equal(f.businessWrites().length,0);
});
