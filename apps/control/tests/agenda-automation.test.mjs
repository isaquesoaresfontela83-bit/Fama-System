import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname),route=await f.load('/app/api/admin/agenda-automation/route.js');
let requests;
beforeEach(()=>{f.reset();requests=[];f.runtime.FAMA_DATA_BRIDGE_SECRET='bridge-fixture';f.runtime.FAMA_SYSTEM={fetch:async(url,init)=>{requests.push({url,init});return Response.json({schedulerConfigured:true,enabledCompanies:1,deliveries:[{status:'sent'}]});}};});
after(()=>f.close());
test('only an authenticated platform administrator can query agenda delivery status',async()=>{globalThis.__operationUser=null;assert.equal((await route.GET()).status,401);assert.equal(requests.length,0);globalThis.__operationUser={id:'ordinary',email:'ordinary@example.test'};assert.equal((await route.GET()).status,403);assert.equal(requests.length,0);});
test('administrative status uses the authenticated private System bridge and fails closed',async()=>{const response=await route.GET();assert.equal(response.status,200);assert.equal((await response.json()).enabledCompanies,1);assert.equal(requests[0].init.headers.Authorization,'Bearer bridge-fixture');assert.equal(requests[0].init.redirect,'manual');f.runtime.FAMA_SYSTEM.fetch=async()=>new Response(null,{status:503});assert.equal((await route.GET()).status,503);});
