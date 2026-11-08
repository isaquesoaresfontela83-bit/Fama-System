import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './test-support.mjs';
import {handleOrders} from './api.mjs';
import {policyDefaults,today,addMonths} from './model.mjs';
import {uuidFor} from './storage.mjs';

test('route and method allowlists never forward unknown order operations',async()=>{
  const f=await fixture();
  for(const [path,method,status] of [['/api/pedidos/unknown','GET',404],['/api/pedidos','DELETE',405],['/api/pedidos','PATCH',405],['/api/pedidos-admin','GET',404]])assert.equal((await f.request(path,method,method==='PATCH'?{}:undefined)).status,status);
  assert.equal(await handleOrders(f.app,new Request('https://fixture.test/unrelated'),f.env,{}),null);
  assert.equal((await handleOrders(f.app,new Request('https://fixture.test/api/internal/pedidos-policy'),f.env,{},'control')).status,404);
});
test('mutations require exact origin, valid JSON and valid identifiers',async()=>{
  const f=await fixture();
  const send=(headers,body)=>handleOrders(f.app,new Request('https://example.test/api/pedidos',{method:'POST',headers:{cookie:'owner','x-organization-id':'org-a','content-type':'application/json',...headers},body}),f.env,{});
  assert.equal((await send({},'{}')).status,403);
  assert.equal((await send({origin:'https://example.test','sec-fetch-site':'cross-site'},'{}')).status,403);
  for(const raw of ['null','[]','{'])assert.equal((await send({origin:'https://example.test'},raw)).status,400);
  assert.equal((await f.request('/api/pedidos','POST',f.input({requestId:'bad'}))).status,400);
  assert.equal((await f.request('/api/pedidos','GET',undefined,'owner','')).status,400);
});
test('access, consent and selected company must agree with the authenticated session',async()=>{
  const variants=[['/api/access',d=>{d.access.organizationId='foreign';},403],['/api/auth/session',d=>{d.consent=false;},403],['/api/auth/session',d=>{d.authenticated=false;},403],['/api/auth/session',d=>{d.currentUser=null;},403],['/api/access',d=>{Object.assign(d.access,{planStatus:'suspended'});},402],['/api/access',d=>{Object.assign(d.access,{planStatus:'trial',planExpiresAt:'invalid'});},402],['/api/access',d=>{Object.assign(d.access,{planStatus:'active',planExpiresAt:'2099-01-01'});},200],['/api/access',d=>{Object.assign(d.access,{planStatus:'suspended',billingEnabled:false});},200]];
  for(const [path,change,status] of variants){const f=await fixture(),original=f.app.fetch;f.app.fetch=async r=>{const response=await original(r);if(new URL(r.url).pathname!==path)return response;const data=await response.json();change(data);return Response.json(data);};assert.equal((await f.request('/api/pedidos')).status,status);}
});
test('non-financial sales can be registered without exposing payment terms',async()=>{
  const f=await fixture();
  const r=await f.request('/api/pedidos','POST',f.input({depositCents:0,installmentCount:1}),'no-finance');
  assert.equal(r.status,201);assert.equal(r.data.order.depositCents,undefined);
  assert.equal((await f.request('/api/pedidos','POST',f.input(),'no-finance')).status,403);
  assert.equal((await f.request(`/api/pedidos/${r.data.order.id}`,'PATCH',{revision:1,action:'confirm'},'no-finance')).status,403);
});
test('financial synchronization is resumable and refuses inconsistent prior records',async()=>{
  const f=await fixture();let order=await f.create({sourceQuoteId:'quote-a'});
  assert.equal((await f.action(order,{action:'sync'})).status,409);
  f.db.raw.prepare('INSERT INTO transactions(id,organization_id,status) VALUES (?,?,?)').run('auto-sale:quote:quote-a','org-a','pendente');
  assert.equal((await f.action(order,{action:'confirm'})).status,409);
  f.db.raw.prepare('DELETE FROM transactions').run();
  const id=await uuidFor(`pedidos:org-a:${order.id}:parcela:0`);
  f.db.raw.prepare('INSERT INTO transactions(id,organization_id,status,amount_cents,due_date) VALUES (?,?,?,?,?)').run(id,'org-a','pendente',1,'2026-11-30');
  assert.equal((await f.action(order,{action:'confirm'})).status,409);
  f.db.raw.prepare('DELETE FROM transactions').run();
  order=(await f.action(order,{action:'confirm'})).data.order;
  const sync=await f.action(order,{action:'sync'});assert.equal(sync.status,200);order=sync.data.order;
  assert.equal((await f.action(order,{action:'edit',order:{notes:'invalid after confirmation'}})).status,409);
  assert.equal((await f.action(order,{action:'stage',status:'forged'})).status,400);
  assert.equal((await f.action(order,{action:'pay',paymentId:'foreign'})).status,404);
  order=(await f.action(order,{action:'pay',paymentId:order.payments[0].id})).data.order;
  assert.equal((await f.action(order,{action:'pay',paymentId:order.payments[0].id})).status,200);
});
test('notes, revision validation and unknown actions do not lose the audit history',async()=>{
  const f=await fixture();let order=await f.create();
  assert.equal((await f.action(order,{action:'forged'})).status,400);
  assert.equal((await f.request(`/api/pedidos/${order.id}`,'PATCH',{action:'note',note:'test',revision:0})).status,400);
  const updated=await f.action(order,{action:'note',note:'Anotação interna'});assert.equal(updated.status,200);order=updated.data.order;
  assert.match(order.history.at(-1).message,/Anotação/);
  const missing=await f.request(`/api/pedidos/${crypto.randomUUID()}`,'PATCH',{action:'note',note:'test',revision:1});assert.equal(missing.status,404);
});
test('scheduling validates dates, time, agenda rights and linked delivery existence',async()=>{
  const f=await fixture();let order=await f.create();for(const action of [{action:'confirm'},{action:'stage',status:'preparacao'},{action:'stage',status:'pronto'}])order=(await f.action(order,action)).data.order;
  const valid={action:'schedule',deliveryDate:addMonths(today(),1),deliveryTime:'10:00',carrier:'Fixture'};
  assert.equal((await f.action(order,{...valid,deliveryDate:'2020-01-01'})).status,400);
  assert.equal((await f.action(order,{...valid,deliveryTime:'25:00'})).status,400);
  order=(await f.action(order,valid)).data.order;
  assert.equal((await f.action(order,valid)).status,400);
  order=(await f.action(order,{action:'stage',status:'transporte'})).data.order;
  f.db.raw.prepare('DELETE FROM appointments').run();
  assert.equal((await f.action(order,{action:'deliver',receivedBy:'Fixture'})).status,409);
});
test('attachment validation, limits and cross-company downloads leave no cleartext payload',async()=>{
  const f=await fixture();let order=await f.create();
  const input={revision:1,name:'file.pdf',type:'application/pdf',data:btoa('%PDF-1.7 fixture')};
  for(const changed of [{data:'%%%'},{data:btoa('x')},{type:'text/html'}])assert.equal((await f.request(`/api/pedidos/${order.id}/attachments`,'POST',{...input,...changed})).status,400);
  f.db.raw.prepare('DELETE FROM sales_order_rate_limits').run();
  for(let i=0;i<10;i++){const r=await f.request(`/api/pedidos/${order.id}/attachments`,'POST',{...input,revision:order.revision});assert.equal(r.status,201);order=r.data.order;}
  assert.equal((await f.request(`/api/pedidos/${order.id}/attachments`,'POST',{...input,revision:order.revision})).status,429);
  f.db.raw.prepare('DELETE FROM sales_order_rate_limits').run();
  assert.equal((await f.request(`/api/pedidos/${order.id}/attachments`,'POST',{...input,revision:order.revision})).status,400);
  assert.equal((await f.request(`/api/pedidos/${order.id}/attachments/${crypto.randomUUID()}`)).status,404);
  assert.equal((await f.request(`/api/pedidos/${order.id}/attachments`)).status,405);
  assert.equal((await f.request(`/api/pedidos/${order.id}`,'POST',{})).status,405);
});
test('admin policies validate target membership, method, service availability and internal signatures',async()=>{
  const f=await fixture();const input={scope:'global',revision:0,policy:policyDefaults()};
  const send=(method,body,cookie='admin')=>handleOrders(f.app,new Request('https://example.test/api/pedidos-admin',{method,headers:{cookie,origin:'https://example.test','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),f.env,{},'control');
  assert.equal((await send('GET')).status,503);
  f.env.FAMA_SYSTEM={fetch:r=>handleOrders(f.app,r,f.env,{},'system')};
  assert.equal((await send('POST',{...input,scope:'organization:foreign'})).status,404);
  assert.equal((await send('POST',{...input,scope:'member:foreign:u'})).status,404);
  const original=f.app.fetch;f.app.fetch=r=>new URL(r.url).pathname==='/api/admin/organizations/org-a/members'?Response.json({members:[]}):original(r);
  assert.equal((await send('POST',{...input,scope:'member:org-a:foreign'})).status,404);
  f.app.fetch=r=>new URL(r.url).pathname==='/api/admin/organizations/org-a/members'?Response.json({members:[{user_id:'user-a'}]}):original(r);
  assert.equal((await send('POST',{...input,scope:'member:org-a:user-a'})).status,200);
  assert.equal((await send('POST',{...input,scope:'plan:forged'})).status,400);
  assert.equal((await send('DELETE')).status,404);
  const forged=new Request('https://example.test/api/internal/pedidos-policy',{headers:{'x-pedidos-time':String(Date.now()),'x-pedidos-signature':'forged'}});
  assert.equal((await handleOrders(f.app,forged,f.env,{})).status,403);
  const missing={...f.env,FAMA_DATA_BRIDGE_SECRET:''};
  assert.equal((await handleOrders(f.app,new Request('https://example.test/api/internal/pedidos-policy',{headers:{'x-pedidos-time':String(Date.now())}}),missing,{})).status,403);
});
