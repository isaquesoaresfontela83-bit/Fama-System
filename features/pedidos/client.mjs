import { STAGES, today, isOverdue, policyDefaults } from './fama-pedidos-model-15.21.0.mjs';

const kind = new URL(import.meta.url).searchParams.get('app') || 'system';
const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/></svg>';
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((value||0)/100);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formattedDate = value => value ? new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',...(value.includes('T')?{timeStyle:'short'}:{})}).format(new Date(value.includes('T')?value:value+'T12:00:00Z')) : 'A definir';
const cents = value => Math.round(Number(value||0)*100);
const roles = {owner:'Proprietário',admin:'Administrador',member:'Colaborador',technician:'Técnico'};
function newRequestId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
let opened=false, container=null, currentOrganization='', context=null, orders=[], selected=null, loading=false, generation=0, dialog=null, requestId=newRequestId();
let filters={query:'',status:'',overdue:false,seller:'',start:'',end:''};
let adminData=null;
function organizationId(){return document.querySelector('select.company-switcher,select[aria-label="Empresa ativa"]')?.value || '';}
async function api(path, options={}) {
  const org=organizationId();
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(org?{'x-organization-id':org}:{}),...options.headers},cache:'no-store'});
  const data=await response.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(org && org!==organizationId())throw new Error('A empresa ativa mudou. Abra os pedidos novamente.');
  if(!response.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
  return data;
}
function alertBox(message){return `<div class="fo-alert" role="alert">${esc(message)}</div>`;}
function showError(message){const area=dialog?.querySelector('.fo-error')||container?.querySelector('.fo-error');if(area)area.innerHTML=alertBox(message);}
function pageHeading(title,description,actions=''){return `<header class="fo-heading"><div><span class="fo-kicker">${esc(context?.organization?.name || (kind==='control'?'FAMA CONTROL':'FAMA SYSTEM'))}</span><h1>${title}</h1><p>${description}</p></div><div class="fo-actions">${actions}</div></header>`;}
function button(label,attrs='',secondary=false){return `<button type="button" class="fo-button ${secondary?'fo-secondary':''}" ${attrs}>${label}</button>`;}
function modal(title,content,onSubmit){
  dialog?.close();dialog?.remove();
  dialog=document.createElement('dialog');dialog.className='fo-dialog';dialog.innerHTML=`<form><header><h2 id="fo-dialog-title">${esc(title)}</h2>${button('×','data-close aria-label="Fechar"',true)}</header><div class="fo-error"></div>${content}</form>`;
  dialog.setAttribute('aria-labelledby','fo-dialog-title');document.body.append(dialog);
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  const ownDialog=dialog;
  dialog.addEventListener('close',()=>{ownDialog.remove();if(dialog===ownDialog)dialog=null;});
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const submit=form.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;showError('');try{await onSubmit(form);}catch(error){showError(error.message);}finally{if(submit.isConnected)submit.disabled=false;}};
  dialog.showModal();return dialog;
}
function field(label,name,value='',type='text',extra=''){return `<label class="fo-field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
function textArea(label,name,value='',extra=''){return `<label class="fo-field fo-wide">${label}<textarea name="${name}" rows="3" ${extra}>${esc(value)}</textarea></label>`;}
const footer=(label='Salvar')=>`<footer>${button('Voltar','data-cancel',true)}<button class="fo-button" type="submit">${label}</button></footer>`;
function attachCancel(element){element.querySelector('[data-cancel]').onclick=()=>element.close();}
function goBack(){selected=null;renderList();}
async function refresh(){
  const mine=++generation;loading=true;
  if(!context)container.innerHTML=pageHeading('Pedidos de piscinas','Carregando seus pedidos…')+'<div class="fo-error"></div>';
  try {
    if(kind==='control'){adminData=await api('/api/pedidos-admin');if(mine===generation)renderAdmin();return;}
    const org=organizationId();if(!org)throw new Error('Selecione uma empresa para abrir os pedidos.');
    const [nextContext,first]=await Promise.all([api('/api/pedidos/context'),api('/api/pedidos')]);
    if(mine!==generation)return;context=nextContext;currentOrganization=org;orders=first.orders;
    let page=0,more=first.hasMore;
    while(more && mine===generation){const next=await api(`/api/pedidos?page=${++page}`);orders.push(...next.orders);more=next.hasMore;}
    if(mine!==generation)return;
    if(selected)await openDetail(selected.id);else renderList();
  }catch(error){if(mine===generation){container.innerHTML=pageHeading('Pedidos','Acompanhe as vendas e entregas da sua empresa.',button('Tentar novamente','data-retry',true))+'<div class="fo-error">'+alertBox(error.message)+'</div>';container.querySelector('[data-retry]').onclick=()=>void refresh();}}
  finally{if(mine===generation)loading=false;}
}
function renderList(){
  selected=null;
  const active=orders.filter(o=>!['entregue','cancelado'].includes(o.status));
  const weekEnd=new Date(today()+'T12:00:00Z');weekEnd.setUTCDate(weekEnd.getUTCDate()+7);const lastDay=weekEnd.toISOString().slice(0,10);
  container.innerHTML=pageHeading('Pedidos de piscinas','Venda, preparação e entrega em um só lugar.',button('Atualizar','data-refresh',true)+(context.permissions.edit?button('+ Novo pedido','data-create'):''))+
    `<div class="fo-error"></div><div class="fo-metrics"><article><span>Pedidos abertos</span><strong>${active.length}</strong><small>Acompanhar até a entrega</small></article><article><span>Entregas nos próximos 7 dias</span><strong>${active.filter(o=>o.deliveryDate>=today()&&o.deliveryDate<=lastDay).length}</strong><small>Previsões e agendamentos</small></article><article><span>Entregas atrasadas</span><strong>${active.filter(o=>isOverdue(o)).length}</strong><small>Prazo previsto ultrapassado</small></article><article><span>${context.permissions.finance?'A receber':'Vendas confirmadas'}</span><strong>${money(orders.filter(o=>!['registrado','cancelado'].includes(o.status)).reduce((sum,o)=>sum+(context.permissions.finance?o.balanceCents:o.totalCents),0))}</strong><small>${context.permissions.finance?'Parcelas pendentes dos pedidos':'Valor dos pedidos confirmados'}</small></article></div>`+
    `<section class="fo-panel"><div class="fo-filters"><label>Buscar<input data-filter="query" type="search" placeholder="Cliente, pedido ou piscina" value="${esc(filters.query)}"></label><label>Etapa<select data-filter="status"><option value="">Todas</option>${Object.entries(STAGES).map(([k,v])=>`<option value="${k}" ${filters.status===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Vendedor<select data-filter="seller"><option value="">Todos</option>${[...new Set(orders.map(o=>o.seller))].sort().map(value=>`<option ${filters.seller===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label><label>Entrega a partir de<input data-filter="start" type="date" value="${esc(filters.start)}"></label><label>Até<input data-filter="end" type="date" value="${esc(filters.end)}"></label><label class="fo-checkbox"><input data-filter="overdue" type="checkbox" ${filters.overdue?'checked':''}>Só atrasados</label></div><div class="fo-table-wrap"><table><thead><tr><th>Pedido / cliente</th><th>Piscina</th><th>Etapa</th><th>Previsão de entrega</th><th>Vendedor</th><th>Total</th><th></th></tr></thead><tbody id="fo-rows"></tbody></table></div><p class="fo-list-count"></p></section>`;
  container.querySelector('[data-create]')?.addEventListener('click',()=>orderForm());container.querySelector('[data-refresh]').onclick=()=>void refresh();
  container.querySelectorAll('[data-filter]').forEach(input=>input.addEventListener(input.type==='search'?'input':'change',()=>{filters[input.dataset.filter]=input.type==='checkbox'?input.checked:input.value;renderRows();}));
  renderRows();
}
function renderRows(){
  const q=filters.query.trim().toLocaleLowerCase('pt-BR');
  const filtered=orders.filter(o=>(!q||`${o.number} ${o.clientName} ${o.items.map(i=>i.name).join(' ')}`.toLocaleLowerCase('pt-BR').includes(q))&&(!filters.status||o.status===filters.status)&&(!filters.seller||o.seller===filters.seller)&&(!filters.overdue||isOverdue(o))&&(!filters.start||o.deliveryDate>=filters.start)&&(!filters.end||Boolean(o.deliveryDate&&o.deliveryDate<=filters.end)));
  container.querySelector('#fo-rows').innerHTML=filtered.length?filtered.map(o=>`<tr><td><strong>${esc(o.number)}</strong><small>${esc(o.clientName)}</small></td><td>${esc(o.items[0]?.name)}${o.items.length>1?`<small>+ ${o.items.length-1} item(ns)</small>`:''}</td><td><span class="fo-badge fo-stage-${o.status}">${STAGES[o.status]}</span></td><td>${formattedDate(o.deliveryDate)}${isOverdue(o)?'<small class="fo-late">Prazo ultrapassado</small>':''}</td><td>${esc(o.seller)}</td><td>${money(o.totalCents)}</td><td>${button('Abrir',`data-order="${o.id}"`,true)}</td></tr>`).join(''):`<tr><td colspan="7"><div class="fo-empty">${orders.length?'Nenhum pedido corresponde aos filtros.':'Seus pedidos aparecerão aqui. Comece pelo botão Novo pedido.'}</div></td></tr>`;
  container.querySelector('.fo-list-count').textContent=`${filtered.length} de ${orders.length} pedido(s)`;
  container.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>void openDetail(b.dataset.order));
}
function itemRow(item={}){return `<div class="fo-item"><label>Modelo / produto<input data-item="name" value="${esc(item.name)}" required maxlength="180"></label><label>Medidas<input data-item="dimensions" value="${esc(item.dimensions)}" placeholder="Ex.: 6 × 3 × 1,40 m" maxlength="100"></label><label>Cor<input data-item="color" value="${esc(item.color)}" maxlength="80"></label><label>Qtd.<input data-item="quantity" type="number" min="1" max="100" step="1" value="${item.quantity||1}" required></label><label>Preço unitário (R$)<input data-item="unitPrice" type="number" min="0" max="1000000" step="0.01" value="${((item.unitPriceCents||0)/100).toFixed(2)}" required></label>${button('×','data-remove aria-label="Remover produto"',true)}</div>`;}
function formItems(form){return [...form.querySelectorAll('.fo-item')].map(row=>{const get=name=>row.querySelector(`[data-item="${name}"]`).value;return {name:get('name'),dimensions:get('dimensions'),color:get('color'),quantity:Number(get('quantity')),unitPriceCents:cents(get('unitPrice'))};});}
function formOrder(form){const d=Object.fromEntries(new FormData(form));return {...d,items:formItems(form),discountCents:cents(d.discount),freightCents:cents(d.freight),depositCents:cents(d.deposit),installmentCount:Number(d.installmentCount||1)};}
function orderForm(existing=null){
  const o=existing||{seller:context.user.displayName||context.user.email,items:[{}],firstDueDate:today(),installmentCount:1};
  const element=modal(existing?'Editar pedido':'Novo pedido',
    (!existing?`<label class="fo-field">Aproveitar orçamento aprovado<select name="sourceQuoteId"><option value="">Criar pedido manualmente</option>${context.quotes.map(q=>`<option value="${q.id}">${esc(q.number)} · ${esc(q.clientName)} · ${money(q.totalCents)}</option>`).join('')}</select></label>`:'')+
    `<div class="fo-form-grid"><label class="fo-field">Cliente cadastrado<select name="customerId" ${existing?'disabled':''}><option value="">Informar cliente manualmente</option>${context.customers.map(c=>`<option value="${c.id}" ${o.customerId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`+
    field('Nome do cliente *','clientName',o.clientName,'text',`required maxlength="180" ${existing?'readonly':''}`)+field('Telefone / WhatsApp','phone',o.phone,'tel','maxlength="40"')+field('Vendedor *','seller',o.seller,'text','required maxlength="120"')+
    field('Endereço de entrega *','address',o.address,'text','required maxlength="500"')+field('Ponto de referência','reference',o.reference,'text','maxlength="250"')+'</div>'+
    `<h3>Piscina e acessórios</h3><div class="fo-items">${o.items.map(itemRow).join('')}</div>${button('+ Adicionar produto','data-add-item',true)}<div class="fo-form-grid">`+
    field('Desconto (R$)','discount',((o.discountCents||0)/100).toFixed(2),'number','min="0" step="0.01"')+field('Frete (R$)','freight',((o.freightCents||0)/100).toFixed(2),'number','min="0" step="0.01"')+
    field('Previsão de entrega','deliveryDate',o.deliveryDate,'date')+`<div class="fo-total" aria-live="polite">Total <strong data-total></strong></div></div>`+
    (context.permissions.finance?`<h3>Condições de pagamento</h3><p class="fo-muted">A entrada e as parcelas serão geradas como pendentes quando a venda for confirmada.</p><div class="fo-form-grid">${field('Entrada combinada (R$)','deposit',((o.depositCents||0)/100).toFixed(2),'number','min="0" step="0.01"')}${field('Parcelas do restante','installmentCount',o.installmentCount||1,'number','min="1" max="36" step="1"')}${field('Vencimento inicial','firstDueDate',o.firstDueDate,'date','required')}<label class="fo-field">Forma de pagamento<select name="paymentMethod">${['pix','boleto','cartao','dinheiro','transferencia'].map(v=>`<option value="${v}" ${v===o.paymentMethod?'selected':''}>${({pix:'Pix',boleto:'Boleto',cartao:'Cartão',dinheiro:'Dinheiro',transferencia:'Transferência'})[v]}</option>`).join('')}</select></label></div>`:`<input type="hidden" name="deposit" value="0"><input type="hidden" name="installmentCount" value="1"><input type="hidden" name="firstDueDate" value="${today()}">`)+
    textArea('Observações internas','notes',o.notes,'maxlength="4000"')+footer(existing?'Salvar alterações':'Registrar pedido'),async form=>{
      const values=formOrder(form);const path=existing?`/api/pedidos/${existing.id}`:'/api/pedidos';
      const payload=existing?{action:'edit',revision:existing.revision,order:values}:{...values,requestId};
      const result=await api(path,{method:existing?'PATCH':'POST',body:JSON.stringify(payload)});requestId=newRequestId();element.close();await refresh();await openDetail(result.order.id);
    });
  attachCancel(element);
  const form=element.querySelector('form');
  const total=()=>{const items=formItems(form);const sum=items.reduce((s,i)=>s+i.quantity*i.unitPriceCents,0)-cents(form.elements.discount.value)+cents(form.elements.freight.value);form.querySelector('[data-total]').textContent=money(sum);};
  form.addEventListener('input',total);
  const wireRemove=()=>form.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(form.querySelectorAll('.fo-item').length===1){showError('Mantenha pelo menos um produto.');return;}b.closest('.fo-item').remove();total();});
  form.querySelector('[data-add-item]').onclick=()=>{if(form.querySelectorAll('.fo-item').length>=30)return;form.querySelector('.fo-items').insertAdjacentHTML('beforeend',itemRow());wireRemove();};wireRemove();
  form.elements.customerId?.addEventListener('change',event=>{const c=context.customers.find(c=>c.id===event.target.value);if(c){form.elements.clientName.value=c.name;form.elements.phone.value=c.phone||'';form.elements.address.value=c.address||'';}});
  form.elements.sourceQuoteId?.addEventListener('change',event=>{const q=context.quotes.find(q=>q.id===event.target.value);if(!q)return;form.elements.clientName.value=q.clientName;form.elements.customerId.value=q.customerId||'';const c=context.customers.find(c=>c.id===q.customerId);if(c){form.elements.phone.value=c.phone||'';form.elements.address.value=c.address||'';}form.querySelector('.fo-items').innerHTML=itemRow({name:q.service||`Piscina e acessórios · ${q.number}`,quantity:1,unitPriceCents:q.totalCents});form.elements.discount.value='0.00';form.elements.freight.value='0.00';wireRemove();total();});
  total();
}
async function openDetail(id){
  try{
    const result=await api(`/api/pedidos/${id}`);selected=result.order;const o=selected,p=context.permissions;
    const next={confirmado:['preparacao','Iniciar preparação'],preparacao:['pronto','Marcar como pronto'],agendado:['transporte','Saiu para entrega']}[o.status];
    const actions=(o.status==='registrado'&&p.edit?button('Editar','data-edit',true):'')+
      (o.status==='registrado'&&p.edit&&p.finance?button('Confirmar venda','data-command="confirm"'):'')+
      (next&&p.deliver?button(next[1],`data-stage="${next[0]}"`):'')+
      (['pronto','agendado'].includes(o.status)&&p.deliver&&p.agenda?button(o.status==='agendado'?'Reagendar entrega':'Agendar entrega','data-command="schedule"'):'')+
      (o.status==='transporte'&&p.deliver?button('Confirmar recebimento','data-command="deliver"'):'');
    container.innerHTML=pageHeading(`${esc(o.number)} <span class="fo-badge fo-stage-${o.status}">${STAGES[o.status]}</span>`,esc(o.clientName),button('← Todos os pedidos','data-back',true)+actions)+`<div class="fo-error"></div>`+
      (isOverdue(o)?'<div class="fo-alert fo-warning">A previsão de entrega deste pedido está atrasada.</div>':'')+
      `<div class="fo-detail-grid"><div><section class="fo-panel"><h2>Cliente e entrega</h2><dl class="fo-info"><div><dt>Cliente</dt><dd>${esc(o.clientName)}</dd></div><div><dt>Telefone</dt><dd>${esc(o.phone)||'Não informado'}</dd></div><div><dt>Vendedor</dt><dd>${esc(o.seller)}</dd></div><div><dt>Previsão</dt><dd>${formattedDate(o.deliveryDate)} ${esc(o.deliveryTime)}</dd></div><div class="fo-wide"><dt>Endereço</dt><dd>${esc(o.address)}</dd></div><div><dt>Referência</dt><dd>${esc(o.reference)||'Não informada'}</dd></div><div><dt>Responsável pela entrega</dt><dd>${esc(o.carrier)||'A definir'} ${esc(o.carrierPhone)}</dd></div></dl>${o.deliveryInstructions?`<p class="fo-note">${esc(o.deliveryInstructions)}</p>`:''}${o.deliveredAt?`<div class="fo-success">Entregue em ${formattedDate(o.deliveredAt)}. Recebido por ${esc(o.receivedBy)}.<p>${esc(o.deliveryReceipt)}</p></div>`:''}${o.cancelReason?alertBox('Cancelamento: '+o.cancelReason):''}${o.phone?button('Mensagem no WhatsApp','data-whatsapp',true):''}</section>`+
      `<section class="fo-panel"><h2>Piscina e acessórios</h2><div class="fo-table-wrap"><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${o.items.map(i=>`<tr><td>${esc(i.name)}<small>${esc([i.dimensions,i.color].filter(Boolean).join(' · '))}</small></td><td>${i.quantity}</td><td>${money(i.unitPriceCents)}</td><td>${money(i.quantity*i.unitPriceCents)}</td></tr>`).join('')}</tbody></table></div><div class="fo-totals"><span>Produtos <b>${money(o.subtotalCents)}</b></span><span>Desconto <b>− ${money(o.discountCents)}</b></span><span>Frete <b>${money(o.freightCents)}</b></span><strong>Total <b>${money(o.totalCents)}</b></strong></div></section>`+
      (p.finance?`<section class="fo-panel"><h2>Pagamentos</h2><p class="fo-muted">A confirmação do pagamento atualiza a parcela vinculada no financeiro.</p><div class="fo-payment-summary"><span>Recebido <b>${money(o.receivedCents)}</b></span><span>A receber <b>${money(o.balanceCents)}</b></span></div>${o.status==='registrado'?'<p class="fo-warning">As parcelas serão geradas ao confirmar a venda.</p>':''}${!['registrado','cancelado'].includes(o.status)&&p.edit&&o.payments.some(pay=>pay.status==='nao_gerada')?button('Sincronizar parcelas','data-command="sync"',true):''}<div class="fo-payment-list">${o.payments.map(pay=>`<div><span><strong>${pay.label}</strong><small>${formattedDate(pay.dueDate)}${pay.dueDate<today()&&!pay.paid&&pay.status!=='nao_gerada'?' · Em atraso':''}</small></span><b>${money(pay.amountCents)}</b><span class="fo-badge">${pay.paid?'Recebido':o.status==='cancelado'?'Cancelado':pay.status==='nao_gerada'?'A gerar':'Pendente'}</span>${!pay.paid&&!['registrado','cancelado'].includes(o.status)&&pay.status!=='nao_gerada'?button('Confirmar pagamento',`data-pay="${pay.id}"`,true):''}</div>`).join('')}</div></section>`:'')+
      `<section class="fo-panel"><h2>Anexos</h2><p class="fo-muted">Fotos JPG/PNG e documentos PDF, até 1 MB por arquivo.</p><div class="fo-attachments">${(o.attachments||[]).map(file=>button(esc(file.name),`data-download="${file.id}"`,true)).join('')||'<p>Nenhum anexo adicionado.</p>'}</div>${(p.edit||p.deliver)&&o.attachments.length<10?'<label class="fo-upload">+ Adicionar anexo<input type="file" accept="image/jpeg,image/png,application/pdf" data-upload></label>':''}</section></div>`+
      `<aside><section class="fo-panel"><h2>Histórico interno</h2>${o.notes?`<p class="fo-note">${esc(o.notes)}</p>`:''}${p.edit?button('+ Adicionar observação','data-command="note"',true):''}<ol class="fo-history">${[...o.history].reverse().map(event=>`<li><strong>${esc(event.message)}</strong><span>${esc(event.actor)}</span><small>${formattedDate(event.at)}</small></li>`).join('')}</ol></section>${p.edit&&p.finance&&!['entregue','cancelado','transporte'].includes(o.status)?button('Cancelar pedido','data-command="cancel"',true):''}</aside></div>`;
    container.querySelector('[data-back]').onclick=goBack;container.querySelector('[data-edit]')?.addEventListener('click',()=>orderForm(o));
    container.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>actionDialog(b.dataset.command));
    container.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>actionDialog('stage',{status:b.dataset.stage}));
    container.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>actionDialog('pay',{paymentId:b.dataset.pay}));
    container.querySelector('[data-whatsapp]')?.addEventListener('click',()=>{let phone=o.phone.replace(/\D/g,'');if(phone.length===10||phone.length===11)phone='55'+phone;if(phone.length<10){showError('Confira o telefone do cliente antes de abrir o WhatsApp.');return;}const message=`Olá, ${o.clientName}! Seu pedido ${o.number} está na etapa ${STAGES[o.status].toLowerCase()}.${o.deliveryDate?' Previsão de entrega: '+formattedDate(o.deliveryDate)+'.':''}`;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');});
    container.querySelectorAll('[data-download]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const response=await fetch(`/api/pedidos/${o.id}/attachments/${b.dataset.download}`,{headers:{'x-organization-id':organizationId()},cache:'no-store'});if(!response.ok)throw new Error('Não foi possível abrir o anexo.');const link=document.createElement('a'),file=o.attachments.find(a=>a.id===b.dataset.download),url=URL.createObjectURL(await response.blob());link.href=url;link.download=file?.name||'anexo';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){showError(error.message);}finally{b.disabled=false;}});
    container.querySelector('[data-upload]')?.addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(file.size>1_048_576){showError('Escolha um arquivo de até 1 MB.');event.target.value='';return;}event.target.disabled=true;try{let binary='';const bytes=new Uint8Array(await file.arrayBuffer());for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));await api(`/api/pedidos/${o.id}/attachments`,{method:'POST',body:JSON.stringify({revision:o.revision,name:file.name,type:file.type,data:btoa(binary)})});await openDetail(o.id);}catch(error){showError(error.message);event.target.disabled=false;}});
  }catch(error){showError(error.message);}
}
function actionDialog(action,extra={}){
  const o=selected;
  const titles={confirm:'Confirmar venda',sync:'Sincronizar parcelas',stage:'Atualizar etapa',schedule:o.status==='agendado'?'Reagendar entrega':'Agendar entrega',deliver:'Confirmar recebimento',pay:'Confirmar pagamento',cancel:'Cancelar pedido',note:'Observação interna'};
  let content='';
  if(action==='confirm')content=`<p>Confirmar a venda de <strong>${money(o.totalCents)}</strong> para ${esc(o.clientName)}?</p><p class="fo-muted">As parcelas serão criadas como pendentes. O recebimento é confirmado separadamente.</p>`;
  if(action==='stage')content=`<p>Alterar ${esc(o.number)} para <strong>${STAGES[extra.status]}</strong>?</p>`;
  if(action==='sync')content='<p>Conferir as parcelas deste pedido e criar os lançamentos que estiverem faltando?</p><p>Pagamentos já registrados serão preservados.</p>';
  if(action==='schedule')content=`<div class="fo-form-grid">${field('Data da entrega *','deliveryDate',o.deliveryDate>=today()?o.deliveryDate:today(),'date',`required min="${today()}"`)}${field('Horário *','deliveryTime',o.deliveryTime||'09:00','time','required')}${field('Responsável / transportador *','carrier',o.carrier,'text','required list="fo-team" maxlength="120"')}${field('Contato do responsável','carrierPhone',o.carrierPhone,'tel','maxlength="40"')}<datalist id="fo-team">${context.employees.map(e=>`<option value="${esc(e.name)}">${esc(e.phone)}</option>`).join('')}</datalist></div>${textArea('Instruções da entrega','instructions',o.deliveryInstructions,'maxlength="2000"')}${o.status==='agendado'?textArea('Motivo do reagendamento *','reason','','required maxlength="500"'):''}<p class="fo-muted">A entrega será vinculada à Agenda da empresa.</p>`;
  if(action==='deliver')content=field('Nome de quem recebeu *','receivedBy','','text','required maxlength="180"')+textArea('Observação / comprovante de entrega','receipt','','maxlength="2000"')+'<p>A data e a hora serão registradas ao confirmar. Você pode anexar uma foto na ficha do pedido.</p>';
  if(action==='pay'){const payment=o.payments.find(p=>p.id===extra.paymentId);content=`<p>Confirmar o recebimento de <strong>${money(payment.amountCents)}</strong>, referente a ${payment.label.toLowerCase()}?</p>${textArea('Observação do pagamento','note','','maxlength="500"')}<label class="fo-checkbox"><input type="checkbox" required>Conferi e recebi este pagamento.</label>`;}
  if(action==='cancel')content=textArea('Motivo do cancelamento *','reason','','required maxlength="1000"')+'<p>As parcelas pendentes e o agendamento vinculado serão removidos. O pedido e o histórico serão preservados.</p>';
  if(action==='note')content=textArea('Observação *','note','','required maxlength="2000"');
  const element=modal(titles[action],content+footer(action==='cancel'?'Confirmar cancelamento':'Confirmar'),async form=>{
    await api(`/api/pedidos/${o.id}`,{method:'PATCH',body:JSON.stringify({action,...extra,...Object.fromEntries(new FormData(form)),revision:o.revision})});element.close();await refresh();await openDetail(o.id);
  });attachCancel(element);
}
function renderAdmin(){
  container.innerHTML=pageHeading('Pedidos de piscinas','Defina a liberação e os perfis que podem operar os pedidos.',button('Atualizar','data-refresh',true))+'<div class="fo-error"></div>'+`<section class="fo-panel"><h2>Liberação do módulo</h2><p>Os pedidos seguem o acesso a Orçamentos. Pagamentos também exigem acesso ao Financeiro ou Financeiro básico, e agendamentos exigem acesso à Agenda.</p><p class="fo-muted">As regras mais específicas prevalecem: empresa, plano e configuração geral. Os dados de cada empresa permanecem separados.</p><label class="fo-field">Aplicar regra a<select data-scope><option value="global">Todas as empresas — regra geral</option><optgroup label="Planos"><option value="plan:inicial">Basic</option><option value="plan:intermediario">Plus</option><option value="plan:profissional">Pro</option></optgroup><optgroup label="Empresa">${(adminData.organizations||[]).map(o=>`<option value="organization:${o.id}">${esc(o.name)}</option>`).join('')}</optgroup></select></label><form data-policy><div data-policy-fields></div><button class="fo-button" type="submit">Salvar regra</button><p class="fo-status" role="status"></p></form></section>`;
  container.querySelector('[data-refresh]').onclick=()=>void refresh();
  const select=container.querySelector('[data-scope]'),form=container.querySelector('[data-policy]');
  const render=()=>{const row=adminData.policies?.find(p=>p.scope===select.value),policy=row?.policy||policyDefaults();form.dataset.revision=String(row?.revision||0);form.querySelector('[data-policy-fields]').innerHTML=`<label class="fo-checkbox fo-policy-enabled"><input type="checkbox" name="enabled" ${policy.enabled?'checked':''}>Habilitar Pedidos neste destino</label><div class="fo-policy-grid">${[['editRoles','Cadastrar, editar e cancelar'],['deliveryRoles','Preparar e confirmar entregas'],['financeRoles','Visualizar e confirmar pagamentos']].map(([key,label])=>`<fieldset><legend>${label}</legend>${Object.entries(roles).map(([role,name])=>`<label class="fo-checkbox"><input type="checkbox" name="${key}" value="${role}" ${policy[key].includes(role)?'checked':''}>${name}</label>`).join('')}</fieldset>`).join('')}</div><p class="fo-muted">${row?'Regra personalizada neste destino.':'Nenhuma regra personalizada neste destino. A liberação atual é herdada das regras mais gerais.'}</p>`;form.querySelector('.fo-status').textContent='';};
  select.onchange=render;render();
  form.onsubmit=async event=>{event.preventDefault();const b=form.querySelector('button[type=submit]');b.disabled=true;try{const values=new FormData(form),policy={enabled:values.has('enabled'),editRoles:values.getAll('editRoles'),deliveryRoles:values.getAll('deliveryRoles'),financeRoles:values.getAll('financeRoles')};await api('/api/pedidos-admin',{method:'POST',body:JSON.stringify({scope:select.value,policy,revision:Number(form.dataset.revision)})});const chosen=select.value;adminData=await api('/api/pedidos-admin');render();select.value=chosen;render();form.querySelector('.fo-status').textContent='Regra salva. Novas consultas aos pedidos já respeitam esta configuração.';}catch(error){showError(error.message);}finally{b.disabled=false;}};
}
function closeWorkspace(){
  opened=false;generation++;dialog?.close();container?.remove();container=null;context=null;selected=null;orders=[];
  document.querySelectorAll('.fo-workspace-open').forEach(n=>n.classList.remove('fo-workspace-open'));document.querySelectorAll('.fo-pedidos-active').forEach(n=>n.classList.remove('fo-pedidos-active'));
  document.querySelectorAll('[data-pedidos-nav]').forEach(n=>n.removeAttribute('aria-current'));
  const url=new URL(location.href);url.searchParams.delete('pedidos');history.replaceState(history.state,'',url);
}
function closeMobileNavigation(link){const sheet=link.closest('[data-mobile="true"],.control-mobile-menu');const close=sheet&&[...sheet.querySelectorAll('button')].find(b=>b.textContent.trim()==='Close');close?.click();}
function openWorkspace(){
  const main=document.querySelector(kind==='control'?'main.control-main':'main.workspace');if(!main)return;
  if(!container||!container.isConnected){container=document.createElement('section');container.id='fama-pedidos-root';container.className='fo-root';main.append(container);}
  main.classList.add('fo-workspace-open');main.closest('.application')?.classList.add('fo-pedidos-active');opened=true;
  document.querySelectorAll('[data-pedidos-nav]').forEach(n=>n.setAttribute('aria-current','page'));
  const url=new URL(location.href);url.searchParams.set('pedidos','1');history.replaceState(history.state,'',url);
  void refresh();
}
function addNavigation(){
  if(kind==='control') {
    document.querySelectorAll('.control-nav').forEach(nav=>{if(nav.querySelector('[data-pedidos-nav]'))return;const link=document.createElement('a');link.href='?pedidos=1';link.className='control-nav-item';link.dataset.pedidosNav='';link.innerHTML=icon+'<span>Pedidos</span>';link.onclick=event=>{event.preventDefault();openWorkspace();closeMobileNavigation(link);};nav.append(link);});
  } else {
    const contents=document.querySelectorAll('.workspace-navigation-content');
    contents.forEach(nav=>{if(nav.querySelector('[data-pedidos-nav]'))return;const quote=[...nav.querySelectorAll('button,a')].find(n=>n.textContent.trim()==='Orçamentos');if(!quote)return;const parent=quote.closest('li')||quote.parentElement;const item=parent.cloneNode(false);item.removeAttribute('id');const link=document.createElement('a');link.href='?pedidos=1';link.className=quote.className;for(const attr of ['data-sidebar','data-slot','data-size'])if(quote.hasAttribute(attr))link.setAttribute(attr,quote.getAttribute(attr));link.dataset.pedidosNav='';link.innerHTML=icon+'<span>Pedidos</span>';link.onclick=event=>{event.preventDefault();event.stopPropagation();openWorkspace();closeMobileNavigation(link);};item.append(link);parent.after(item);});
  }
  if(opened && container && !container.isConnected)closeWorkspace();
  if(!opened && new URL(location.href).searchParams.has('pedidos') && document.querySelector('[data-pedidos-nav]'))openWorkspace();
}
document.addEventListener('click',event=>{if(!opened)return;const target=event.target instanceof Element?event.target:null;if(!target||target.closest('[data-pedidos-nav],#fama-pedidos-root,.fo-dialog'))return;if(target.closest('.workspace-navigation-content,.control-nav,.back-navigation')&&target.closest('button,a'))closeWorkspace();},true);
document.addEventListener('change',event=>{if(event.target.matches('select.company-switcher,select[aria-label="Empresa ativa"]')&&opened){context=null;selected=null;orders=[];currentOrganization='';queueMicrotask(()=>void refresh());}},true);
let queued=false;
new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;addNavigation();});}).observe(document.documentElement,{childList:true,subtree:true});
addNavigation();
