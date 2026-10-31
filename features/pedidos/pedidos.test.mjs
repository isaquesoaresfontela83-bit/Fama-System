import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOrders } from './api.mjs';
import { normalizeOrder, installments, addMonths, today, resolvePolicy, policyDefaults, VERSION, RELEASE } from './model.mjs';
import { withOrders } from './entry.mjs';
import { fixture } from './test-support.mjs';

test('centavos, divisão de parcelas e datas no fim do mês',()=>{
  const value=normalizeOrder({clientName:'Cliente',address:'Endereço',seller:'Vendedor',items:[{name:'Piscina',quantity:1,unitPriceCents:100001}],depositCents:10000,installmentCount:3,firstDueDate:'2026-01-31'});
  const payments=installments(value);assert.equal(payments.reduce((sum,p)=>sum+p.amountCents,0),100001);
  assert.equal(payments[1].dueDate,'2026-02-28');assert.equal(payments[2].dueDate,'2026-03-31');
  assert.equal(addMonths('2028-01-31',1),'2028-02-29');assert.throws(()=>normalizeOrder({...value,discountCents:100002}));
});
test('cadastro criptografado, total autoritativo e criação idempotente',async()=>{
  const f=await fixture();const input=f.input({totalCents:1});
  const first=await f.request('/api/pedidos','POST',input),second=await f.request('/api/pedidos','POST',input);
  assert.equal(first.status,201);assert.equal(first.data.order.totalCents,101000);assert.equal(second.data.order.id,first.data.order.id);
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM sales_orders').get().n,1);
  const stored=f.db.raw.prepare('SELECT payload FROM sales_orders').get().payload;assert(!stored.includes('Rua de teste'));assert(stored.startsWith('fama:v1:'));
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);
});
test('isolamento entre empresas, autenticação, origem e permissões',async()=>{
  const f=await fixture(),order=await f.create();
  assert.equal((await f.request(`/api/pedidos/${order.id}`,'GET',undefined,'owner','org-b')).status,404);
  assert.equal((await f.request('/api/pedidos','GET',undefined,'denied')).status,401);
  assert.equal((await f.request('/api/pedidos','GET',undefined,'no-quotes')).status,403);
  assert.equal((await f.request('/api/pedidos','GET',undefined,'expired')).status,402);
  assert.equal((await f.request('/api/pedidos','POST',f.input(),'owner','org-a','https://attacker.test')).status,403);
  assert.equal((await f.request('/api/pedidos','POST',f.input({customerId:'other-company-customer'}))).status,400);
  assert.equal((await f.request('/api/pedidos','POST',f.input(),'technician')).status,403);
  const hidden=await f.request(`/api/pedidos/${order.id}`,'GET',undefined,'no-finance');assert.equal(hidden.status,200);assert.equal(hidden.data.order.payments,undefined);assert.equal(hidden.data.order.depositCents,undefined);
});
test('confirmação interrompida pode ser retomada sem duplicar ou alterar parcelas',async()=>{
  const f=await fixture();const order=await f.create();let inserts=0;
  f.db.beforeRun=sql=>{if(sql.startsWith('INSERT INTO transactions')&&++inserts===2)throw new Error('Simulação de indisponibilidade');};
  const failed=await f.action(order,{action:'confirm'});assert.equal(failed.status,503);
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM transactions').get().n,1);
  const edited=await f.action(order,{action:'edit',order:{items:[{name:'Outro produto',quantity:1,unitPriceCents:50000}]}});assert.equal(edited.status,409);
  f.db.beforeRun=null;
  const retried=await f.action(order,{action:'confirm'});assert.equal(retried.status,200);assert.equal(retried.data.order.status,'confirmado');
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM transactions').get().n,4);assert.equal(retried.data.order.receivedCents,0);
});
test('edição comercial não altera condições de pagamento sem permissão financeira',async()=>{
  const f=await fixture();const order=await f.create();
  const result=await f.request(`/api/pedidos/${order.id}`,'PATCH',{revision:order.revision,action:'edit',order:{notes:'Ajuste comercial',depositCents:1,installmentCount:1}},'no-finance');
  assert.equal(result.status,200,JSON.stringify(result.data));
  const after=await f.request(`/api/pedidos/${order.id}`);assert.equal(after.data.order.depositCents,order.depositCents);assert.equal(after.data.order.installmentCount,order.installmentCount);
});
test('confirmação gera parcelas pendentes e pagamento só muda por confirmação',async()=>{
  const f=await fixture();let order=await f.create();
  const confirmed=await f.action(order,{action:'confirm'});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));order=confirmed.data.order;
  assert.equal(order.status,'confirmado');assert.equal(order.receivedCents,0);assert.equal(order.balanceCents,101000);assert.equal(order.payments.length,4);
  assert(order.payments.every(p=>p.status==='pendente'));
  const repeated=await f.action(order,{action:'confirm'});assert.equal(repeated.status,409);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM transactions').get().n,4);
  const paid=await f.action(order,{action:'pay',paymentId:order.payments[0].id});assert.equal(paid.status,200);order=paid.data.order;assert.equal(order.receivedCents,10000);assert.equal(order.balanceCents,91000);
  const cancelled=await f.action(order,{action:'cancel',reason:'Teste'});assert.equal(cancelled.status,409);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM transactions').get().n,4);
  const list=await f.request('/api/pedidos');assert.equal(list.data.orders[0].receivedCents,10000);
});
test('fluxo completo de preparação, agenda, reagendamento e entrega manual',async()=>{
  const f=await fixture();let order=await f.create();
  for(const action of [{action:'confirm'},{action:'stage',status:'preparacao'},{action:'stage',status:'pronto'}]){const r=await f.action(order,action);assert.equal(r.status,200,JSON.stringify(r.data));order=r.data.order;}
  const due=addMonths(today(),1);
  const scheduled=await f.action(order,{action:'schedule',deliveryDate:due,deliveryTime:'10:30',carrier:'Transportador',instructions:'Portão lateral'});assert.equal(scheduled.status,200,JSON.stringify(scheduled.data));order=scheduled.data.order;
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM appointments').get().n,1);assert.equal(order.status,'agendado');
  const rescheduled=await f.action(order,{action:'schedule',deliveryDate:due,deliveryTime:'11:00',carrier:'Transportador',reason:'Cliente pediu novo horário'});assert.equal(rescheduled.status,200);order=rescheduled.data.order;
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM appointments').get().n,1);
  assert.equal((await f.action(order,{action:'deliver',receivedBy:'Cliente'})).status,409);
  order=(await f.action(order,{action:'stage',status:'transporte'})).data.order;
  assert.equal(order.deliveredAt,undefined);assert.equal((await f.action(order,{action:'deliver'})).status,400);
  const delivered=await f.action(order,{action:'deliver',receivedBy:'Maria',receipt:'Entregue no endereço combinado'});assert.equal(delivered.status,200,JSON.stringify(delivered.data));order=delivered.data.order;
  assert.equal(order.status,'entregue');assert.equal(order.receivedBy,'Maria');assert(order.deliveredAt);assert.equal(order.receivedCents,0);
  assert.equal(f.db.raw.prepare('SELECT status FROM appointments').get().status,'concluido');
});
test('orçamento aprovado gera um único pedido mesmo com cliques distintos',async()=>{
  const f=await fixture();const first=await f.create({sourceQuoteId:'quote-a'}),second=await f.create({sourceQuoteId:'quote-a'});
  assert.equal(first.id,second.id);assert.equal((await f.request('/api/pedidos','POST',f.input({sourceQuoteId:'foreign-quote'}))).status,400);
});
test('orçamento vinculado ao pedido não pode gerar outra receita via OS',async()=>{
  const f=await fixture();await f.create({sourceQuoteId:'quote-a'});
  const blocked=await f.request('/api/quotes/quote-a/convert','POST',{});assert.equal(blocked.status,409);assert(blocked.data.error.includes('Pedidos'));
  assert.equal((await f.request('/api/quotes/unrelated/convert','POST',{})).status,404);
});
test('orçamento já convertido em OS é excluído das conversões para pedido',async()=>{
  const f=await fixture(),original=f.app.fetch;
  f.app.fetch=async request=>{const response=await original(request);if(new URL(request.url).pathname!=='/api/bootstrap')return response;const data=await response.json();data.quotes[0].notes=JSON.stringify({details:{convertedWorkOrderId:'existing-work-order'}});return Response.json(data);};
  assert.equal((await f.request('/api/pedidos','POST',f.input({sourceQuoteId:'quote-a'}))).status,409);
  assert.equal((await f.request('/api/pedidos/context')).data.quotes.length,0);
});
test('cancelamento preserva o pedido e remove somente seus vínculos pendentes',async()=>{
  const f=await fixture();let order=await f.create();order=(await f.action(order,{action:'confirm'})).data.order;
  const cancelled=await f.action(order,{action:'cancel',reason:'Desistência do cliente'});assert.equal(cancelled.status,200);assert.equal(cancelled.data.order.status,'cancelado');
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM sales_orders').get().n,1);
  assert(cancelled.data.order.history.at(-1).message.includes('Desistência'));
});
test('revisão impede ações simultâneas e evita perda de histórico',async()=>{
  const f=await fixture();const order=await f.create();
  const responses=await Promise.all([f.action(order,{action:'note',note:'Primeira'}),f.action(order,{action:'note',note:'Segunda'})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const detail=await f.request(`/api/pedidos/${order.id}`);assert.equal(detail.data.order.history.length,2);
});
test('anexos são criptografados e downloads exigem a empresa correta',async()=>{
  const f=await fixture();let order=await f.create();
  const attachment=await f.request(`/api/pedidos/${order.id}/attachments`,'POST',{revision:order.revision,name:'comprovante.pdf',type:'application/pdf',data:btoa('%PDF-1.7\nDocumento de teste')});
  assert.equal(attachment.status,201,JSON.stringify(attachment.data));order=attachment.data.order;
  const id=order.attachments[0].id;
  const downloaded=await f.request(`/api/pedidos/${order.id}/attachments/${id}`);assert.equal(downloaded.status,200);assert.equal(new TextDecoder().decode(downloaded.data),'%PDF-1.7\nDocumento de teste');
  assert.equal((await f.request(`/api/pedidos/${order.id}/attachments/${id}`,'GET',undefined,'owner','org-b')).status,404);
  assert(!f.db.raw.prepare('SELECT payload FROM sales_order_attachments').get().payload.includes('Documento de teste'));
  const bad=await f.request(`/api/pedidos/${order.id}/attachments`,'POST',{revision:order.revision,name:'falso.pdf',type:'application/pdf',data:btoa('<script>alert(1)</script>')});assert.equal(bad.status,400);
});
test('regras administrativas respeitam herança, planos e permissões existentes',()=>{
  const access={organizationId:'a',plan:'inicial',role:'owner',moduleAccess:['quotes','finance','agenda']};
  const row=(scope,value)=>({scope,policy:JSON.stringify({...policyDefaults(),...value})});
  assert(resolvePolicy([],access,'u').enabled);
  assert(!resolvePolicy([row('global',{enabled:false})],access,'u').enabled);
  assert(resolvePolicy([row('global',{enabled:false}),row('organization:a',{enabled:true})],access,'u').enabled);
  assert(!resolvePolicy([row('organization:a',{enabled:true})],{...access,moduleAccess:[]},'u').enabled);
  assert(resolvePolicy([],{...access,moduleAccess:['quotes','financeBasic']},'u').finance);
  assert(!resolvePolicy([row('organization:matrix',{enabled:false})],{...access,parentOrganizationId:'matrix'},'u').enabled);
});
test('Control autentica o administrador e salva regras por serviço assinado',async()=>{
  const f=await fixture();f.env.FAMA_SYSTEM={fetch:request=>handleOrders(f.app,request,f.env,{},'system')};
  const request=(cookie,method='GET',input)=>handleOrders(f.app,new Request('https://example.test/api/pedidos-admin',{method,headers:{cookie,origin:'https://example.test','Content-Type':'application/json'},body:input?JSON.stringify(input):undefined}),f.env,{},'control');
  assert.equal((await request('owner')).status,403);
  const input={scope:'organization:org-a',revision:0,policy:{...policyDefaults(),enabled:false}};
  const saved=await request('admin','POST',input);assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await f.request('/api/pedidos')).status,403);
  assert.equal((await request('admin','POST',input)).status,409);
  const enabled=await request('admin','POST',{...input,revision:1,policy:policyDefaults()});assert.equal(enabled.status,200);
  assert.equal((await f.request('/api/pedidos')).status,200);
  const unsigned=await handleOrders(f.app,new Request('https://example.test/api/internal/pedidos-policy'),f.env,{},'system');assert.equal(unsigned.status,403);
});
test('entrada preserva o aplicativo e informa o mesmo lançamento nos dois sistemas',async()=>{
  const f=await fixture();
  for(const kind of ['system','control']){
    const wrapped=withOrders(f.app,{'/assets/new.mjs':{type:'application/javascript',body:'export{}'}},kind);
    const response=await wrapped.fetch(new Request('https://example.test/api/health'),f.env,{});const data=await response.json();assert.equal(data.version,VERSION);assert.equal(data.releaseId,RELEASE);assert.equal(data.baselineVersion,'15.20.0');
    const asset=await wrapped.fetch(new Request('https://example.test/assets/new.mjs'),f.env,{});assert.equal(await asset.text(),'export{}');
    const unauth=await wrapped.fetch(new Request('https://example.test/api/bootstrap'),f.env,{});assert.equal(unauth.status,401);
  }
});
