import { VERSION, RELEASE, STAGES, OrderError, text, required, date, integer, today, normalizeOrder, installments, transition, resolvePolicy, validatePolicy } from './model.mjs';
import { seal, unseal, uuidFor, legacyStore, encode, decode } from './storage.mjs';

const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie, x-organization-id' };
export function json(value, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
function trusted(request) {
  if (['GET', 'HEAD'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new OrderError('Origem da solicitação inválida.', 403);
}
async function body(request, limit = 70_000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new OrderError('Envie os dados em JSON.', 415);
  const raw=await boundedText(request,limit);
  try { const result = JSON.parse(raw); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result; }
  catch { throw new OrderError('Os dados enviados são inválidos.'); }
}
async function boundedText(request,limit){
  if (Number(request.headers.get('content-length') || 0) > limit) throw new OrderError('Arquivo ou pedido muito grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OrderError('Dados ausentes.');
  const parts = []; let size = 0;
  for (;;) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.byteLength; if (size > limit) { await reader.cancel(); throw new OrderError('Arquivo ou pedido muito grande.', 413); } parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of parts) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
async function original(app, request, env, ctx, path) {
  const url = new URL(path, request.url);
  const headers = new Headers(request.headers); headers.delete('content-length'); headers.delete('content-type');
  return app.fetch(new Request(url, {method:'GET', headers}), env, ctx);
}
async function parsedOriginal(app, request, env, ctx, path) {
  const response = await original(app, request, env, ctx, path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new OrderError(data.error || 'Entre na sua conta e selecione uma empresa.', response.status);
  return data;
}
async function tenant(app, request, env, ctx) {
  const organizationId = request.headers.get('x-organization-id');
  if (!organizationId || organizationId.length > 128) throw new OrderError('Selecione uma empresa para continuar.', 400);
  const [accessData, session] = await Promise.all([
    parsedOriginal(app, request, env, ctx, '/api/access'),
    parsedOriginal(app, request, env, ctx, '/api/auth/session'),
  ]);
  const access = accessData.access;
  const user = session.currentUser;
  if (!access || access.organizationId !== organizationId || !user?.id || !session.authenticated || !session.consent) throw new OrderError('Não foi possível validar a empresa e a sessão.', 403);
  const expiry=access.planExpiresAt?Date.parse(access.planExpiresAt):null;
  if (access.billingEnabled !== false && access.blockOnExpiry !== false && (['suspended','expired','blocked','cancelled','payment_attention'].includes(access.planStatus) || (['trial','active','pending_payment'].includes(access.planStatus) && expiry!==null && (!Number.isFinite(expiry)||expiry<=Date.now())))) throw new OrderError('Regularize o acesso da empresa para continuar.', 402);
  const rows = (await env.DB.prepare('SELECT scope,policy FROM sales_order_policies').all()).results;
  const permissions = resolvePolicy(rows, access, user.id);
  if (!permissions.enabled) throw new OrderError('Pedidos não estão liberados para este acesso.', 403);
  return { organizationId, user, access, permissions, organization: session.organizations?.find(o => o.id === organizationId) };
}
function assertPermission(context, permission) {
  if (!context.permissions[permission]) throw new OrderError('Seu perfil não permite esta ação nos pedidos.', 403);
}
async function catalog(app, request, env, ctx) { return parsedOriginal(app, request, env, ctx, '/api/bootstrap'); }
function quoteConverted(quote){try{return Boolean(JSON.parse(String(quote.notes||'')).details?.convertedWorkOrderId);}catch{return false;}}
async function quoteLock(db,org,quoteId,callback){
  const token=crypto.randomUUID();
  const acquired=await db.prepare('INSERT INTO sales_order_quote_locks(organization_id,quote_id,token,lock_until) VALUES (?,?,?,?) ON CONFLICT(organization_id,quote_id) DO UPDATE SET token=excluded.token,lock_until=excluded.lock_until WHERE sales_order_quote_locks.lock_until<?').bind(org,quoteId,token,Date.now()+180000,Date.now()).run();
  if(!acquired.meta.changes)throw new OrderError('Este orçamento está sendo convertido em outra janela. Atualize e tente novamente.',409);
  try{return await callback();}finally{await db.prepare('UPDATE sales_order_quote_locks SET token=\'\',lock_until=0 WHERE organization_id=? AND quote_id=? AND token=?').bind(org,quoteId,token).run();}
}
async function readOrder(db, env, id, org) {
  const row = await db.prepare('SELECT * FROM sales_orders WHERE id=? AND organization_id=?').bind(id, org).first();
  if (!row) throw new OrderError('Pedido não encontrado.', 404);
  return { ...await unseal(row.payload, env), id: row.id, number: row.order_number, status: row.status, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function financials(order, env, org) {
  const store = legacyStore(env);
  return Promise.all(installments(order).map(async payment => {
    const id = await uuidFor(`pedidos:${org}:${order.id}:parcela:${payment.sequence}`);
    const row = await store.read('transactions', id, org);
    return { ...payment, id, status: row?.status ?? 'nao_gerada', paid: row?.status === 'pago', amountCents: Number(row?.amount_cents ?? payment.amountCents), dueDate: row?.due_date ?? payment.dueDate };
  }));
}
async function publicOrder(order, context, env, details = false) {
  const result = { ...order };
  if (context.permissions.finance && details) {
    result.payments = await financials(order, env, context.organizationId);
    result.receivedCents = result.payments.filter(p => p.paid).reduce((sum,p) => sum + p.amountCents,0);
    result.balanceCents = order.status === 'cancelado' ? 0 : order.totalCents - result.receivedCents;
  }
  if (!context.permissions.finance) {
    delete result.depositCents; delete result.installmentCount; delete result.firstDueDate; delete result.paymentMethod;
    result.history = result.history.filter(event => !event.financial);
  }
  if (!details) delete result.history;
  return result;
}
function recordEvent(order, actor, message, financial = false) {
  order.history = [...(order.history ?? []), { at: new Date().toISOString(), actor: actor.displayName || actor.email || actor.id, message, financial }].slice(-1000);
}
async function confirmFinancial(order, context, env) {
  if (order.sourceQuoteId && await legacyStore(env).read('transactions', `auto-sale:quote:${order.sourceQuoteId}`, context.organizationId)) throw new OrderError('Este orçamento já possui uma receita gerada por uma ordem de serviço. Revise essa receita no financeiro antes de confirmar o pedido.', 409);
  const now = new Date().toISOString();
  const store = legacyStore(env);
  for (const payment of installments(order)) {
    const id = await uuidFor(`pedidos:${context.organizationId}:${order.id}:parcela:${payment.sequence}`);
    const previous = await store.read('transactions', id, context.organizationId);
    if (previous && (Number(previous.amount_cents) !== payment.amountCents || previous.due_date !== payment.dueDate)) throw new OrderError('Há uma parcela diferente no financeiro. Revise os valores antes de confirmar.',409);
    await store.insert('transactions', {
      id, organization_id: context.organizationId, description: await seal(`Pedido ${order.number} · ${order.clientName} · ${payment.label}`, env),
      type: 'receita', category: await seal('Venda de piscinas', env), amount_cents: payment.amountCents, due_date: payment.dueDate,
      status: 'pendente', created_at: now, updated_at: now,
    });
  }
}
async function syncDelivery(order, context, env) {
  if (!context.permissions.agenda) throw new OrderError('Seu perfil precisa ter acesso à Agenda para agendar uma entrega.',403);
  const appointmentId = await uuidFor(`pedidos:${context.organizationId}:${order.id}:entrega`);
  const store = legacyStore(env);
  const now = new Date().toISOString();
  const values = {
    title: `Entrega · ${order.number}`, customer_id: order.customerId || '', client_name: order.clientName,
    start_at: `${order.deliveryDate}T${order.deliveryTime || '09:00'}:00-03:00`, address: await seal(order.address,env),
    technician: order.carrier, kind:'Entrega de piscina', status:'agendado', notes: await seal(`${order.reference}\n${order.deliveryInstructions || ''}\nPedido ${order.number}`,env), updated_at:now,
  };
  if (await store.read('appointments',appointmentId,context.organizationId)) await store.patch('appointments',appointmentId,context.organizationId,values);
  else await store.insert('appointments',{id:appointmentId,organization_id:context.organizationId,...values,created_at:now});
  order.appointmentId = appointmentId;
}
async function updateOrder(db, env, id, org, revision, callback) {
  integer(revision, 'Revisão', 1, 2_000_000_000);
  const token = crypto.randomUUID();
  const locked = await db.prepare('UPDATE sales_orders SET lock_token=?,lock_until=? WHERE id=? AND organization_id=? AND revision=? AND lock_until<?')
    .bind(token,Date.now()+180_000,id,org,revision,Date.now()).run();
  if (!locked.meta.changes) {
    await readOrder(db,env,id,org);
    throw new OrderError('Este pedido mudou ou está sendo atualizado. Recarregue antes de continuar.',409);
  }
  try {
    const order = await readOrder(db,env,id,org);
    await callback(order);
    const payload = await seal(order,env);
    const updatedAt = new Date().toISOString();
    const saved = await db.prepare('UPDATE sales_orders SET status=?,payload=?,revision=revision+1,updated_at=?,lock_token=\'\',lock_until=0 WHERE id=? AND organization_id=? AND lock_token=?')
      .bind(order.status,payload,updatedAt,id,org,token).run();
    if (!saved.meta.changes) throw new OrderError('Não foi possível confirmar a gravação. Recarregue o pedido.',409);
    return {...order,revision:revision+1,updatedAt};
  } finally { await db.prepare("UPDATE sales_orders SET lock_token='',lock_until=0 WHERE id=? AND organization_id=? AND lock_token=?").bind(id,org,token).run(); }
}
async function createOrder(input, context, app, request, env, ctx) {
  assertPermission(context,'edit');
  if (!/^[a-f0-9-]{36}$/i.test(input.requestId || '')) throw new OrderError('Identificador do pedido inválido. Atualize a página.');
  const existing = await env.DB.prepare('SELECT id FROM sales_orders WHERE organization_id=? AND request_id=?').bind(context.organizationId,input.requestId).first();
  if (existing) return readOrder(env.DB,env,existing.id,context.organizationId);
  const data = await catalog(app,request,env,ctx);
  let values = {...input};
  if (input.sourceQuoteId) {
    const quote = data.quotes?.find(q=>q.id===input.sourceQuoteId);
    if (!quote || quote.status !== 'aprovado') throw new OrderError('Selecione um orçamento aprovado desta empresa.');
    const duplicate = await env.DB.prepare('SELECT id FROM sales_orders WHERE organization_id=? AND source_quote_id=?').bind(context.organizationId,quote.id).first();
    if (duplicate) return readOrder(env.DB,env,duplicate.id,context.organizationId);
    if(quoteConverted(quote))throw new OrderError('Este orçamento já foi convertido em ordem de serviço. Use outro orçamento para a venda da piscina.',409);
    values.clientName = quote.clientName;
    values.customerId = quote.customerId || input.customerId || '';
  }
  if (values.customerId) {
    const customer = data.customers?.find(c=>c.id===values.customerId);
    if (!customer && !values.sourceQuoteId) throw new OrderError('Selecione um cliente desta empresa.');
    if(customer&&values.sourceQuoteId&&customer.name.trim().toLocaleLowerCase('pt-BR')!==String(values.clientName).trim().toLocaleLowerCase('pt-BR'))throw new OrderError('O cliente selecionado deve corresponder ao cliente do orçamento.');
    if (customer) values.clientName=customer.name;
  }
  const order = normalizeOrder(values);
  if (!context.permissions.finance && (order.depositCents || order.installmentCount !== 1)) throw new OrderError('Seu perfil não permite definir parcelamentos.',403);
  const counter = await env.DB.prepare('INSERT INTO sales_order_counters(organization_id,next_value) VALUES (?,1) ON CONFLICT(organization_id) DO UPDATE SET next_value=next_value+1 RETURNING next_value').bind(context.organizationId).first();
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  Object.assign(order,{id,number:`PED-${String(counter.next_value).padStart(6,'0')}`,status:'registrado',revision:1,createdAt:now,updatedAt:now,history:[],attachments:[]});
  recordEvent(order,context.user,'Pedido registrado.');
  try {
    await env.DB.prepare('INSERT INTO sales_orders(id,organization_id,order_number,source_quote_id,request_id,status,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id,context.organizationId,order.number,order.sourceQuoteId,input.requestId,order.status,await seal(order,env),now,now).run();
  } catch(error) {
    const duplicate = await env.DB.prepare('SELECT id FROM sales_orders WHERE organization_id=? AND (request_id=? OR (source_quote_id<>\'\' AND source_quote_id=?))').bind(context.organizationId,input.requestId,order.sourceQuoteId).first();
    if (duplicate) return readOrder(env.DB,env,duplicate.id,context.organizationId);
    throw error;
  }
  return order;
}
async function mutate(order, input, context, env) {
  const action=input.action; const now=new Date().toISOString(); const store=legacyStore(env);
  if (action === 'confirm') {
    assertPermission(context,'edit'); assertPermission(context,'finance'); transition(order.status,'confirmado');
    await confirmFinancial(order,context,env); order.status='confirmado'; recordEvent(order,context.user,'Venda confirmada. Parcelas pendentes vinculadas ao financeiro.');
  } else if (action === 'stage') {
    assertPermission(context,'deliver');
    if (!['preparacao','pronto','transporte'].includes(input.status)) throw new OrderError('Etapa inválida.');
    transition(order.status,input.status); order.status=input.status; recordEvent(order,context.user,`Etapa: ${STAGES[order.status]}.`);
  } else if (action === 'sync') {
    assertPermission(context,'edit');assertPermission(context,'finance');
    if(['registrado','cancelado'].includes(order.status))throw new OrderError('Confirme a venda antes de sincronizar as parcelas.',409);
    await confirmFinancial(order,context,env);recordEvent(order,context.user,'Parcelas conferidas e sincronizadas com o financeiro.',true);
  } else if (action === 'schedule') {
    assertPermission(context,'deliver'); transition(order.status,'agendado');
    order.deliveryDate=date(input.deliveryDate,'Data da entrega');
    if (order.deliveryDate<today()) throw new OrderError('Escolha hoje ou uma data futura para agendar.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.deliveryTime || '')) throw new OrderError('Informe um horário válido.');
    order.deliveryTime=input.deliveryTime; order.carrier=required(input.carrier,'Responsável pela entrega',120); order.carrierPhone=text(input.carrierPhone,40);
    order.deliveryInstructions=text(input.instructions,2000);
    const reason=order.status==='agendado'?required(input.reason,'Motivo do reagendamento',500):'';
    await syncDelivery(order,context,env);
    recordEvent(order,context.user,`${reason?'Entrega reagendada':'Entrega agendada'} para ${order.deliveryDate} às ${order.deliveryTime}, responsável: ${order.carrier}.${reason?' Motivo: '+reason:''}`);
    order.status='agendado';
  } else if (action === 'deliver') {
    assertPermission(context,'deliver'); transition(order.status,'entregue');
    order.receivedBy=required(input.receivedBy,'Nome de quem recebeu',180); order.deliveredAt=now; order.deliveryReceipt=text(input.receipt,2000);
    if (order.appointmentId) {
      const appointment=await store.read('appointments',order.appointmentId,context.organizationId);
      if (!appointment) throw new OrderError('O agendamento vinculado não foi encontrado. Atualize a agenda antes de confirmar.',409);
      await store.patch('appointments',order.appointmentId,context.organizationId,{status:'concluido',updated_at:now});
    }
    order.status='entregue'; recordEvent(order,context.user,`Entrega confirmada. Recebido por ${order.receivedBy}.${order.deliveryReceipt?' '+order.deliveryReceipt:''}`);
  } else if (action === 'pay') {
    assertPermission(context,'finance');
    if (['registrado','cancelado'].includes(order.status)) throw new OrderError('Confirme a venda antes de registrar pagamentos.',409);
    const payments=await financials(order,env,context.organizationId); const payment=payments.find(p=>p.id===input.paymentId);
    if (!payment || payment.status==='nao_gerada') throw new OrderError('Parcela não encontrada.',404);
    if (!payment.paid) {
      const updated=await store.patch('transactions',payment.id,context.organizationId,{status:'pago',updated_at:now},payment.status);
      if (!updated.length) throw new OrderError('A parcela mudou no financeiro. Atualize antes de continuar.',409);
      recordEvent(order,context.user,`Pagamento confirmado: ${payment.label}. ${text(input.note,500)}`,true);
    }
  } else if (action === 'cancel') {
    assertPermission(context,'edit'); assertPermission(context,'finance'); transition(order.status,'cancelado');
    const reason=required(input.reason,'Motivo do cancelamento',1000);
    const payments=await financials(order,env,context.organizationId);
    if (payments.some(p=>p.paid)) throw new OrderError('Este pedido tem valores recebidos. Registre o estorno no financeiro antes de cancelar.',409);
    // Deterministic IDs also cover a previous confirmation that failed midway.
    for (const payment of payments.filter(p=>p.status!=='nao_gerada')) {
      const fresh=await store.read('transactions',payment.id,context.organizationId);
      if (fresh?.status==='pago') throw new OrderError('Uma parcela foi recebida. Revise o financeiro antes de cancelar.',409);
      if (fresh) {
        const removed=await store.remove('transactions',payment.id,context.organizationId,fresh.status);
        if(!(Array.isArray(removed)?removed.length:removed.meta?.changes))throw new OrderError('Uma parcela mudou no financeiro. Atualize o pedido antes de cancelar.',409);
      }
    }
    if (order.appointmentId) await store.remove('appointments',order.appointmentId,context.organizationId,'agendado');
    order.status='cancelado'; order.cancelReason=reason; recordEvent(order,context.user,`Pedido cancelado. Motivo: ${reason}`);
  } else if (action === 'note') {
    assertPermission(context,'edit'); recordEvent(order,context.user,required(input.note,'Observação',2000));
  } else if (action === 'edit') {
    assertPermission(context,'edit');
    if (order.status!=='registrado') throw new OrderError('Valores e produtos só podem ser editados antes da confirmação da venda.',409);
    if((await financials(order,env,context.organizationId)).some(payment=>payment.status!=='nao_gerada'))throw new OrderError('Há parcelas vinculadas a uma confirmação anterior. Retome a confirmação da venda ou cancele o pedido antes de alterar os valores.',409);
    const commercial={...order,...input.order,sourceQuoteId:order.sourceQuoteId,customerId:order.customerId,clientName:order.clientName};
    if(!context.permissions.finance)for(const field of ['depositCents','installmentCount','firstDueDate','paymentMethod'])commercial[field]=order[field];
    const changed=normalizeOrder(commercial);
    Object.assign(order,changed); recordEvent(order,context.user,'Dados do pedido atualizados.');
  } else throw new OrderError('Ação desconhecida.');
}
async function signingKey(env) {
  const secret=env.FAMA_DATA_BRIDGE_SECRET;
  if (!secret) throw new OrderError('A comunicação com o Control está indisponível.',503);
  return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function sign(env,method,path,timestamp,payload) {
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC',await signingKey(env),new TextEncoder().encode(`${timestamp}\n${method}\n${path}\n${payload}`))));
}
async function policyService(request,env) {
  const timestamp=request.headers.get('x-pedidos-time') || ''; const signature=request.headers.get('x-pedidos-signature') || '';
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now()-Number(timestamp))>60000) throw new OrderError('Solicitação interna inválida.',403);
  const payload=request.method==='GET'?'':await boundedText(request,10000);
  let valid=false;
  try {valid=await crypto.subtle.verify('HMAC',await signingKey(env),decode(signature),new TextEncoder().encode(`${timestamp}\n${request.method}\n/api/internal/pedidos-policy\n${payload}`));}catch{}
  if(!valid) throw new OrderError('Solicitação interna inválida.',403);
  if(request.method==='GET') return json({policies:(await env.DB.prepare('SELECT scope,policy,revision,updated_at,actor FROM sales_order_policies ORDER BY scope').all()).results.map(row=>({...row,policy:JSON.parse(row.policy)}))});
  if(request.method!=='POST') throw new OrderError('Método não permitido.',405);
  let input;try{input=JSON.parse(payload);}catch{throw new OrderError('Configuração inválida.');}
  if(!/^(global|plan:(inicial|intermediario|profissional)|organization:[\w-]{1,128}|member:[\w-]{1,128}:[\w-]{1,128})$/.test(input.scope))throw new OrderError('Destino inválido.');
  const policy=validatePolicy(input.policy); const revision=integer(input.revision,'Revisão',0,2_000_000_000);
  const now=new Date().toISOString();
  const result=await env.DB.prepare(`INSERT INTO sales_order_policies(scope,policy,revision,updated_at,actor) SELECT ?,?,1,?,? WHERE ?=0 ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,revision=sales_order_policies.revision+1,updated_at=excluded.updated_at,actor=excluded.actor WHERE sales_order_policies.revision=?`)
    .bind(input.scope,JSON.stringify(policy),now,text(input.actor,180),revision,revision).run();
  // Existing rows require UPDATE because SELECT above intentionally excludes a nonzero initial revision.
  if(!result.meta.changes && revision>0) {
    const updated=await env.DB.prepare('UPDATE sales_order_policies SET policy=?,revision=revision+1,updated_at=?,actor=? WHERE scope=? AND revision=?').bind(JSON.stringify(policy),now,text(input.actor,180),input.scope,revision).run();
    if(!updated.meta.changes)throw new OrderError('As regras mudaram. Recarregue antes de salvar.',409);
  } else if(!result.meta.changes) throw new OrderError('As regras mudaram. Recarregue antes de salvar.',409);
  return json({saved:true,revision:revision+1});
}
async function adminPolicy(app,request,env,ctx) {
  const organizations=await parsedOriginal(app,request,env,ctx,'/api/admin/organizations'); // Existing owner + MFA authorization.
  const session=await parsedOriginal(app,request,env,ctx,'/api/auth/session');
  const input=request.method==='POST'?await body(request,10000):null;
  if(input?.scope?.startsWith('organization:') && !organizations.organizations?.some(o=>`organization:${o.id}`===input.scope)) throw new OrderError('Empresa não encontrada.',404);
  if(input?.scope?.startsWith('member:')) {
    const org=input.scope.split(':')[1],userId=input.scope.split(':')[2];
    if(!organizations.organizations?.some(o=>o.id===org))throw new OrderError('Empresa não encontrada.',404);
    const members=await parsedOriginal(app,request,env,ctx,`/api/admin/organizations/${org}/members`);
    if(!members.members?.some(m=>m.userId===userId || m.user_id===userId))throw new OrderError('Usuário não encontrado nesta empresa.',404);
  }
  if(!env.FAMA_SYSTEM?.fetch)throw new OrderError('A conexão com o Fama System está indisponível.',503);
  const path='/api/internal/pedidos-policy';const method=input?'POST':'GET';const timestamp=String(Date.now());
  const payload=input?JSON.stringify({...input,actor:session.email || session.displayName || 'Administração'}):'';
  const response=await env.FAMA_SYSTEM.fetch(new Request(`https://famasystem.online${path}`,{method,headers:{'Content-Type':'application/json','x-pedidos-time':timestamp,'x-pedidos-signature':await sign(env,method,path,timestamp,payload)},body:payload||undefined}));
  const data=await response.json();
  return json(input?data:{...data,organizations:organizations.organizations?.map(o=>({id:o.id,name:o.name,plan:o.plan}))},response.status);
}
export async function handleOrders(app,request,env,ctx,kind='system') {
  const url=new URL(request.url);const path=url.pathname;
  const legacyConversion=kind==='system'&&request.method==='POST'?path.match(/^\/api\/quotes\/([^/]+)\/convert$/):null;
  if (!path.startsWith('/api/pedidos') && path!=='/api/internal/pedidos-policy' && !legacyConversion) return null;
  try {
    if(path==='/api/internal/pedidos-policy') {
      if(kind!=='system')throw new OrderError('Não encontrado.',404);
      return await policyService(request,env);
    }
    trusted(request);
    if(legacyConversion){
      const {access}=await parsedOriginal(app,request,env,ctx,'/api/access');
      const modules=access?.moduleAccess??access?.permissions??[];
      if(!access?.organizationId||!modules.includes('quotes')||!modules.includes('orders'))throw new OrderError('Seu perfil precisa de acesso a orçamentos e ordens de serviço.',403);
      return await quoteLock(env.DB,access.organizationId,legacyConversion[1],async()=>{
        const linked=await env.DB.prepare("SELECT id FROM sales_orders WHERE organization_id=? AND source_quote_id=? AND status<>'cancelado'").bind(access.organizationId,legacyConversion[1]).first();
        if(linked)throw new OrderError('Este orçamento já está vinculado a um pedido de piscina. Acompanhe a venda pela aba Pedidos para evitar lançamentos duplicados.',409);
        return app.fetch(request,env,ctx);
      });
    }
    if(kind==='control') {
      if(path!=='/api/pedidos-admin' || !['GET','POST'].includes(request.method))throw new OrderError('Não encontrado.',404);
      return await adminPolicy(app,request,env,ctx);
    }
    if(!['GET','POST','PATCH'].includes(request.method))throw new OrderError('Método não permitido.',405);
    const context=await tenant(app,request,env,ctx);
    if(path==='/api/pedidos/context' && request.method==='GET') {
      const data=await catalog(app,request,env,ctx);
      return json({permissions:context.permissions,user:context.user,organization:context.organization,version:VERSION,
        customers:(data.customers??[]).map(c=>({id:c.id,name:c.name,phone:c.phone,address:c.address})),
        quotes:(data.quotes??[]).filter(q=>q.status==='aprovado'&&!quoteConverted(q)).map(q=>({id:q.id,number:q.quoteNumber,customerId:q.customerId,clientName:q.clientName,totalCents:q.totalCents,service:q.service})),
        employees:(data.employees??[]).filter(e=>e.active).map(e=>({name:e.name,phone:e.phone})),
      });
    }
    const match=path.match(/^\/api\/pedidos(?:\/([a-f0-9-]{36}))?(?:\/(attachments)(?:\/([a-f0-9-]{36}))?)?$/i);
    if(!match)throw new OrderError('Não encontrado.',404);
    const [,id,attachmentPath,attachmentId]=match;
    if(!id && request.method==='GET') {
      const page=Math.max(0,Math.min(1000,Number.parseInt(url.searchParams.get('page')||'0',10)||0));
      const rows=(await env.DB.prepare('SELECT * FROM sales_orders WHERE organization_id=? ORDER BY created_at DESC,id LIMIT 100 OFFSET ?').bind(context.organizationId,page*100).all()).results;
      const orders=await Promise.all(rows.map(async row=>publicOrder({...await unseal(row.payload,env),id:row.id,number:row.order_number,status:row.status,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at},context,env)));
      if(context.permissions.finance) {
        const data=await catalog(app,request,env,ctx);
        const entries=new Map((data.transactions??[]).map(row=>[row.id,row]));
        for(const order of orders) {
          const payments=await Promise.all(installments(order).map(async payment=>entries.get(await uuidFor(`pedidos:${context.organizationId}:${order.id}:parcela:${payment.sequence}`))));
          order.receivedCents=payments.filter(row=>row?.status==='pago').reduce((sum,row)=>sum+Number(row.amountCents),0);
          order.balanceCents=['registrado','cancelado'].includes(order.status)?0:order.totalCents-order.receivedCents;
        }
      }
      return json({orders,hasMore:rows.length===100&&page<1000,page,permissions:context.permissions});
    }
    if(!id && request.method==='POST') {
      const input=await body(request);
      const create=()=>createOrder(input,context,app,request,env,ctx);
      const order=input.sourceQuoteId?await quoteLock(env.DB,context.organizationId,text(input.sourceQuoteId,128),create):await create();
      return json({order:await publicOrder(order,context,env,true)},201);
    }
    if(!id)throw new OrderError('Método não permitido.',405);
    const order=await readOrder(env.DB,env,id,context.organizationId);
    if(attachmentPath) {
      if(attachmentId && request.method==='GET') {
        const row=await env.DB.prepare('SELECT payload FROM sales_order_attachments WHERE id=? AND organization_id=? AND order_id=?').bind(attachmentId,context.organizationId,id).first();
        if(!row)throw new OrderError('Anexo não encontrado.',404);
        const file=await unseal(row.payload,env);return new Response(decode(file.data),{headers:{...privateHeaders,'Content-Type':file.type,'Content-Disposition':`attachment; filename="${file.name.replace(/[^\w.-]/g,'_')}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
      }
      if(!attachmentId && request.method==='POST') {
        if(!context.permissions.edit && !context.permissions.deliver)throw new OrderError('Seu perfil não permite anexar arquivos.',403);
        const input=await body(request,1_450_000);let bytes;try{bytes=decode(String(input.data || ''));}catch{throw new OrderError('O conteúdo do anexo é inválido.');}
        if(bytes.length>1_048_576 || bytes.length<4)throw new OrderError('O anexo deve ter até 1 MB.');
        const type=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':'';
        if(!type || input.type!==type)throw new OrderError('Anexe uma foto JPG, PNG ou documento PDF válido.');
        const attachment={id:crypto.randomUUID(),name:required(input.name,'Nome do anexo',150),type,size:bytes.length,at:new Date().toISOString()};
        const saved=await updateOrder(env.DB,env,id,context.organizationId,input.revision,async value=>{
          if((value.attachments??[]).length>=10)throw new OrderError('Cada pedido pode ter até 10 anexos.');
          await env.DB.prepare('INSERT INTO sales_order_attachments(id,organization_id,order_id,payload,created_at) VALUES (?,?,?,?,?)').bind(attachment.id,context.organizationId,id,await seal({...attachment,data:input.data},env),attachment.at).run();
          value.attachments=[...(value.attachments??[]),attachment];recordEvent(value,context.user,`Anexo adicionado: ${attachment.name}`);
        });
        return json({order:await publicOrder(saved,context,env,true)},201);
      }
      throw new OrderError('Método não permitido.',405);
    }
    if(request.method==='GET')return json({order:await publicOrder(order,context,env,true),permissions:context.permissions});
    if(request.method!=='PATCH')throw new OrderError('Método não permitido.',405);
    const input=await body(request);
    const saved=await updateOrder(env.DB,env,id,context.organizationId,input.revision,value=>mutate(value,input,context,env));
    return json({order:await publicOrder(saved,context,env,true)});
  }catch(error){
    if(!(error instanceof OrderError))console.error(JSON.stringify({event:'pedidos_request_failed',path,error:error?.name||'Error'}));
    return json({error:error instanceof OrderError?error.message:'Não foi possível concluir a operação. Atualize e tente novamente.'},error instanceof OrderError?error.status:503);
  }
}
