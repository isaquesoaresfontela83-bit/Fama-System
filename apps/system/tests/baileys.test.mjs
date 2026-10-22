import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const root=new URL('..',import.meta.url).pathname,f=await operationalFixture(root),api=await f.load('/app/api/whatsapp/baileys/route.js');
const org='11111111-1111-4111-8111-111111111111';let calls;
beforeEach(()=>{
    f.reset();calls=[];f.tables.organizations[0].id=org;f.tables.organization_members[0].organization_id=org;f.runtime.FAMA_DATA_BRIDGE_SECRET='internal-fixture';
    f.runtime.FAMA_CONTROL={fetch:async(url,init)=>{const body=JSON.parse(init.body);calls.push({url,init,body});if(body.action==='configured')return Response.json({configured:true});return Response.json({provider:'baileys',status:'qr',qr:'data:image/png;base64,Zml4dHVyZQ==',qrExpiresAt:Date.now()+50000});}};
});
after(async()=>await f.close());
const request=(method='GET',body,orgId=org)=>new Request('https://fama.example.test/api/whatsapp/baileys',{method,headers:{'x-organization-id':orgId,Origin:'https://fama.example.test','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('company is taken from the authenticated membership, never the request body',async()=>{
    const response=await api.POST(request('POST',{action:'connect'}));assert.equal(response.status,200);assert.equal(calls[0].body.organizationId,org);assert.equal(calls[0].body.action,'connect');
    calls=[];assert.equal((await api.POST(request('POST',{action:'connect',organizationId:'other-company'}))).status,400);assert.equal(calls.length,0);
    assert.equal((await api.GET(request('GET',null,'other-company'))).status,403);assert.equal(calls.length,0);
});
test('only owner or admin can see QR or change the session',async()=>{
    f.tables.organization_members[0].role='member';
    const response=await api.GET(request());assert.equal(response.status,200);const value=await response.json();assert.equal(value.qr,null);assert.equal(value.canManage,false);
    calls=[];assert.equal((await api.POST(request('POST',{action:'disconnect'}))).status,403);assert.equal(calls.length,0);
});
test('unconfigured status is explicit and no fake QR is provided',async()=>{
    f.runtime.FAMA_CONTROL.fetch=async()=>Response.json({configured:false});const response=await api.GET(request());assert.equal(response.status,200);const data=await response.json();assert.equal(data.status,'not_configured');assert.equal(data.configured,false);assert.equal(data.qr,undefined);
});
test('only administrators can renew the QR and the operation stays scoped to the company',async()=>{
    assert.equal((await api.POST(request('POST',{action:'reconnect'}))).status,200);assert.equal(calls[0].body.action,'reconnect');assert.equal(calls[0].body.organizationId,org);
    calls=[];f.member().role='technician';f.member().permissions=['chat'];assert.equal((await api.POST(request('POST',{action:'reconnect'}))).status,403);assert.equal(calls.length,0);
});
test('cross-origin sends and invalid payloads never call the provider',async()=>{
    const cross=request('POST',{action:'connect'});cross.headers.set('Origin','https://evil.test');assert.equal((await api.POST(cross)).status,403);assert.equal(calls.length,0);
    assert.equal((await api.POST(request('POST',{action:'send',phone:'123',text:'Olá',clientId:crypto.randomUUID()}))).status,400);assert.equal(calls.length,0);
});
test('valid send keeps idempotency key and normalizes the Brazilian phone in the backend',async()=>{
    const clientId=crypto.randomUUID();assert.equal((await api.POST(request('POST',{action:'send',phone:'(61) 99123-4567',text:'Olá',clientId}))).status,200);
    assert.deepEqual(calls[0].body,{phone:'5561991234567',text:'Olá',clientId,organizationId:org,action:'send'});
});
