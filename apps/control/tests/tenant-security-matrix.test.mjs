import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';
const f = await operationalFixture(new URL('..', import.meta.url).pathname, 'system-auth');
const [tenant, create, records, bootstrap, warranty, attachments, deleteAttachment] = await Promise.all(['/lib/tenant.js','/app/api/records/route.js','/app/api/records/[id]/route.js','/app/api/bootstrap/route.js','/app/api/warranties/[id]/schedule/route.js','/app/api/attachments/route.js','/app/api/attachments/[id]/route.js'].map(f.load));
beforeEach(f.reset); after(f.close);
const entities = [
  ['leads','leads','crm',{name:'Cliente',phone:'11999999999',interest:'Piscina'}],
  ['quotes','quotes','quotes',{clientName:'Cliente',service:'Limpeza'}],
  ['appointments','appointments','agenda',{title:'Visita',clientName:'Cliente',startAt:'2028-02-29T08:30'}],
  ['workOrders','work_orders','orders',{clientName:'Cliente',service:'Limpeza'}],
  ['customers','customers','customers',{name:'Cliente',phone:'11999999999'}],
  ['inventory','inventory_items','inventory',{name:'Cloro',quantity:2}],
  ['transactions','transactions','finance',{description:'Manutenção',amount:'100,50'}],
  ['employees','employees','team',{name:'Técnico',role:'Técnico'}],
  ['warranties','warranties','warranties',{clientName:'Cliente',item:'Bomba',expiresAt:'2028-02-29'}],
  ['contracts','contracts','contracts',{clientName:'Cliente',service:'Limpeza',startDate:'2027-03-01',endDate:'2028-02-29'}],
];
for (const [entity,table,permission,input] of entities) {
  test(`${entity}: server assigns record identity and company; reload remains isolated`, async () => {
    f.tables[table] = [{id:'foreign',organization_id:'org-two',status:'foreign'}];
    const response = await create.POST(f.request('POST','/api/records',{entity,...input,id:'forged',organization_id:'org-two'})); assert.equal(response.status,201);
    const record = (await response.json()).record; assert.notEqual(record.id,'forged'); assert.equal(f.tables[table][1].organization_id,'org-one');
    const body = await (await bootstrap.GET(f.request('GET','/api/bootstrap'))).json(); assert.equal(body[entity].length,1); assert.equal(body[entity][0].id,record.id);
  });
  for (const role of ['admin','member','technician']) test(`${entity}: ${role} with an explicit empty access list cannot create or read data`, async () => {
    f.member().role=role;f.member().permissions=[];
    assert.equal((await create.POST(f.request('POST','/api/records',{entity,...input}))).status,403);
    assert.deepEqual((await (await bootstrap.GET(f.request('GET','/api/bootstrap'))).json())[entity],[]); assert.equal(f.businessWrites().length,0);
  });
  test(`${entity}: central denial prevents owner operations and bootstrap reads`, async () => {
    f.rules.organization.overrides[permission]=false;f.tables[table]=[{id:'private',organization_id:'org-one'}];
    assert.equal((await create.POST(f.request('POST','/api/records',{entity,...input}))).status,403);
    assert.deepEqual((await (await bootstrap.GET(f.request('GET','/api/bootstrap'))).json())[entity],[]);
    assert.equal(f.calls.filter(call=>call.url.pathname===`/rest/v1/${table}`).length,0);
  });
  test(`${entity}: foreign company deletion leaves the record untouched`, async () => {
    f.tables[table]=[{id:'foreign',organization_id:'org-two'}];
    assert.equal((await records.DELETE(f.request('DELETE',`/api/records/foreign?entity=${entity}`),f.context('foreign'))).status,404); assert.equal(f.tables[table].length,1);
    assert.ok(f.businessWrites().every(call=>call.url.searchParams.get('organization_id')==='eq.org-one'));
  });
  for(const method of ['GET','POST','DELETE'])test(`${entity}: central denial protects attachment ${method}`,async()=>{
    f.rules.organization.overrides[permission]=false;
    const path=`/api/attachments/one?entity=${entity}&entityId=one`;
    let response;
    if(method==='POST'){const form=new FormData();form.set('entity',entity);form.set('entityId','one');response=await attachments.POST(new Request('https://fama.example.test/api/attachments',{method:'POST',headers:{'x-organization-id':'org-one'},body:form}));}
    else response=method==='GET'?await attachments.GET(f.request('GET',path)):await deleteAttachment.DELETE(f.request('DELETE',path),f.context('one'));
    assert.equal(response.status,403);assert.equal(f.calls.some(call=>call.url.pathname==='/rest/v1/attachments'),false);
  });
}
for (const status of ['active','invited']) test(`same email with a different Auth ID cannot reuse an ${status} membership`, async () => {
  f.member().user_id='previous-identity';f.member().status=status;
  assert.deepEqual(await tenant.getUserOrganizations(f.user),[]);
  await assert.rejects(()=>tenant.requireTenant(f.request('GET','/api/bootstrap')),error=>error.status===403);assert.equal(f.businessWrites().length,0);
});
test('an unclaimed invitation is bound to the current identity before granting access', async () => {
  f.member().user_id='';f.member().status='invited';
  assert.equal((await tenant.getUserOrganizations(f.user)).length,1); assert.equal(f.member().user_id,f.user.id);assert.equal(f.member().status,'active');
});
for (const [name,change] of [['inactive membership',()=>f.member().status='disabled'],['suspended company',()=>f.tables.organizations[0].status='suspended'],['missing membership',()=>f.tables.organization_members=[]]]) test(`${name} cannot enter a tenant`,async()=>{
  change();await assert.rejects(()=>tenant.requireTenant(f.request('GET','/api/bootstrap')),error=>error.status===403);
});
for(const method of ['POST','PATCH']) for(const body of [null,[],false,123,'text']) test(`${method}: JSON ${JSON.stringify(body)} is a client error`,async()=>{
  const request=f.request(method,'/api/records',body);assert.equal((await (method==='POST'?create.POST(request):records.PATCH(request,f.context('one')))).status,400);assert.equal(f.businessWrites().length,0);
});
for (const method of ['POST','PATCH','DELETE']) for(const headers of [{Origin:'https://attacker.test'},{Origin:'null'},{'Sec-Fetch-Site':'cross-site'}]) test(`${method}: forged origin ${JSON.stringify(headers)} stops before database access`,async()=>{
  const request=f.request(method,'/api/records/one?entity=leads',{entity:'leads',...entities[0][3],status:'contato'},headers);
  const response=method==='POST'?await create.POST(request):method==='PATCH'?await records.PATCH(request,f.context('one')):await records.DELETE(request,f.context('one'));
  assert.equal(response.status,403);assert.equal(f.calls.length,0);
});
for(const value of ['not-a-date','2027-02-29T08:30','2028-02-30T08:30','2028-13-01T08:30','2028-02-29T25:00']) test(`invalid calendar timestamp ${value} is rejected before persistence`,async()=>{
  const response=await create.POST(f.request('POST','/api/records',{entity:'appointments',...entities[2][3],startAt:value}));assert.equal(response.status,400);assert.equal(f.businessWrites().length,0);
});
test('warranty scheduling cannot bypass central agenda denial',async()=>{
  f.rules.global.overrides.agenda=false;
  assert.equal((await warranty.POST(f.request('POST','/api/warranties/one/schedule',{scheduledAt:'2028-02-29T08:30'}),f.context('one'))).status,403);
  assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/schedule_warranty')),false);
});
for(const entity of ['customers','quotes','workOrders','contracts','employees'])test(`an allowed finance module cannot delete a ${entity} attachment using a forged entity parameter`,async()=>{
  f.member().role='admin';f.member().permissions=['finance'];
  f.tables.attachments=[{id:'private',organization_id:'org-one',entity_type:entity,object_path:'org-one/private.pdf'}];
  const response=await deleteAttachment.DELETE(f.request('DELETE','/api/attachments/private?entity=transactions'),f.context('private'));
  assert.equal(response.status,404);assert.equal(f.tables.attachments.length,1);assert.equal(f.businessWrites().length,0);
});

test('a regular project user cannot bypass Control login through an operational API', async () => {
  delete f.runtime.PLATFORM_OWNER_USER_ID;
  const response = await create.POST(f.request('POST', '/api/records', {entity:'customers',name:'Unauthorized'}));
  assert.equal(response.status,403); assert.equal(f.calls.length,0);
  await assert.rejects(()=>tenant.requireUser(),error=>error.status===403);
});

test('an enrolled administrator needs an aal2 session even when cookies are forged directly', async () => {
  f.user.mfaRequired=true; f.user.aal='aal1';
  await assert.rejects(()=>tenant.requireUser(),error=>error.status===403);
  assert.equal(f.calls.length,0);
  f.user.aal='aal2'; assert.equal((await tenant.requireUser()).id,'user-one');
});
