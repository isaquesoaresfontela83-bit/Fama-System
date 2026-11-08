// Touch feedback is bundled into this versioned client at publication.
import {DOCK_CATALOG,DOCK_LABELS,STORAGE_KEY,normalizePreferences,moveItem,allowedCatalog} from './fama-dock-model-15.24.0.mjs';
if(!window.__famaDockCustomizer){
 window.__famaDockCustomizer=true;
 let preferences=read(),dialog=null,trigger=null,nav=null,frame=0,draft=null,catalog=new Map(),scope='',loadToken=0,loading=false,loadError='',search='',activeOriginals=new Map();
 const definitions=new Map(DOCK_CATALOG.map(x=>[x.id,x]));
 function read(){try{return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return normalizePreferences();}}
 function org(){return document.querySelector('select.company-switcher,select[aria-label="Empresa ativa"]')?.value||'';}
 function scopeKey(){return org()+'|'+String(history.state?.famaWorkspace?.scope||'');}
 function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
 function button(label,handler){const b=element('button',label);b.type='button';b.addEventListener('click',handler);return b;}
 function identify(b){if(b.hasAttribute('data-fama-dock-settings')||b.hasAttribute('data-fama-dock-shortcut'))return null;if(b.classList.contains('mobile-dock-new'))return 'new';return ['home','agenda','customers','more'].find(id=>DOCK_LABELS[id]===b.textContent.trim())||null;}
 function originals(){return new Map(nav?[...nav.children].filter(e=>e.tagName==='BUTTON'&&identify(e)).map(b=>[identify(b),b]):[]);}
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;apply();});}
 function sourceFor(item){return [...document.querySelectorAll('.workspace-navigation .workspace-nav-link,[data-pedidos-nav]')].find(e=>e.getAttribute('aria-label')===item.source||e.textContent.trim()===item.source);}
 function icon(item){const original=sourceFor(item)?.querySelector('svg');if(original)return original.cloneNode(true);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z');svg.append(path);return svg;}
 function apply(){
  const found=document.querySelector('.workspace-mobile-dock');if(found!==nav){if(dialog?.open)dialog.close();nav=found;scope='';}
  if(!nav){trigger?.remove();return;}
  activeOriginals=originals();const key=scopeKey();if(scope!==key){scope=key;catalog=new Map([...activeOriginals.keys()].map(id=>[id,definitions.get(id)]));void refreshCatalog();}
  for(const [id,b] of activeOriginals){const hidden=preferences.hidden.includes(id)&&id!=='more';if(hidden){b.setAttribute('data-fama-dock-hidden','');b.hidden=true;}else{b.removeAttribute('data-fama-dock-hidden');b.hidden=false;}}
  const extra=new Map([...nav.querySelectorAll('[data-fama-dock-shortcut]')].map(b=>[b.getAttribute('data-fama-dock-shortcut'),b]));
  for(const [id,b] of extra)if(!catalog.has(id)||preferences.hidden.includes(id)){b.remove();extra.delete(id);}
  for(const id of preferences.order){if(activeOriginals.has(id)||id==='more'||id==='new'||preferences.hidden.includes(id)||!catalog.has(id))continue;if(!extra.has(id)){const item=catalog.get(id),b=button('',()=>void navigateTo(id));b.setAttribute('data-fama-dock-shortcut',id);b.setAttribute('aria-label',item.label);b.title=item.label;b.append(icon(item),element('span',item.short||item.label));extra.set(id,b);}}
  if(!trigger){trigger=button('',openSettings);trigger.setAttribute('data-fama-dock-settings','');trigger.setAttribute('aria-label','Personalizar barra inferior');trigger.setAttribute('aria-haspopup','dialog');trigger.append(element('span','⚙','fama-dock-gear'),element('small','Editar'));}
  const ordered=preferences.order.map(id=>activeOriginals.get(id)||extra.get(id)).filter(Boolean);ordered.push(trigger);for(let i=0;i<ordered.length;i++)if(nav.children[i]!==ordered[i])nav.insertBefore(ordered[i],nav.children[i]||null);
  const current=document.querySelector('.application[data-workspace-section]')?.getAttribute('data-workspace-section')||location.hash.slice(1).split('/')[0];
  for(const [id,b] of extra){const selected=id==='pedidos'?new URL(location.href).searchParams.has('pedidos'):catalog.get(id)?.section===current&&!new URL(location.href).searchParams.has('pedidos');if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 }
 async function refreshCatalog(){
  const organization=org(),key=scopeKey(),token=++loadToken;loading=true;loadError='';
  try{if(!organization)throw Error('Selecione uma empresa para carregar as funções.');const response=await fetch('/api/access',{headers:{'x-organization-id':organization},cache:'no-store'});if(!response.ok)throw Error('Não foi possível carregar as funções. Tente novamente.');const payload=await response.json();if(payload.access?.organizationId!==organization)throw Error('A empresa mudou. Abra o editor novamente.');
   let pedidos=false;if(payload.access.moduleAccess?.includes('quotes')){try{const r=await fetch('/api/pedidos/context',{headers:{'x-organization-id':organization},cache:'no-store'});pedidos=r.ok;await r.body?.cancel();}catch{}}
   if(token!==loadToken||key!==scopeKey())return;
   catalog=new Map(allowedCatalog(payload.access,pedidos).filter(item=>!item.native||activeOriginals.has(item.id)).map(item=>[item.id,item]));for(const id of activeOriginals.keys())catalog.set(id,definitions.get(id));
  }catch(error){if(token===loadToken)loadError=error.message;}finally{if(token===loadToken){loading=false;schedule();if(dialog?.open)render();}}
 }
 async function waitFor(find,key){for(let i=0;i<90;i++){if(key!==scopeKey())return null;const result=find();if(result)return result;await new Promise(resolve=>requestAnimationFrame(resolve));}return null;}
 async function navigateTo(id){
  const item=catalog.get(id),key=scopeKey();if(!item)return;
  const b=nav?.querySelector(`[data-fama-dock-shortcut="${id}"]`);if(b)b.disabled=true;
  try{
   // Always invoke the application's own menu handler; never invent a route or grant access.
   let target=sourceFor(item);
   if(!target&&!document.querySelector('.workspace-navigation')){activeOriginals.get('more')?.click();await waitFor(()=>document.querySelector('.workspace-navigation'),key);}
   if(!target)target=sourceFor(item);
   if(!target&&item.group){const folder=[...document.querySelectorAll('.workspace-nav-toggle')].find(e=>e.getAttribute('aria-label')===item.group);if(folder&&folder.getAttribute('aria-expanded')!=='true')folder.click();target=await waitFor(()=>sourceFor(item),key);}
   if(!target&&!item.group)target=await waitFor(()=>sourceFor(item),key);
   if(key!==scopeKey())return;
   if(target&&!target.disabled&&target.getAttribute('aria-disabled')!=='true'){target.click();schedule();}
   else{loadError='Esta função não está disponível neste acesso. Atualize a lista no editor.';await refreshCatalog();openSettings();}
  }finally{if(b?.isConnected)b.disabled=false;}
 }
 function openSettings(){if(!nav)return;draft=normalizePreferences(preferences);search='';if(!dialog){dialog=element('dialog',null,'fama-dock-settings');dialog.setAttribute('aria-labelledby','fama-dock-title');dialog.addEventListener('close',()=>{trigger?.setAttribute('aria-expanded','false');if(trigger?.isConnected)trigger.focus();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});document.body.append(dialog);}render();trigger.setAttribute('aria-expanded','true');if(!dialog.open)dialog.showModal();void refreshCatalog();}
 function render(focusLabel){
  const keepSearch=dialog.querySelector('.fama-dock-search')===document.activeElement;
  dialog.replaceChildren();const heading=element('header'),title=element('h2','Escolha as funções da sua barra');title.id='fama-dock-title';heading.append(title,button('Fechar',()=>dialog.close()));dialog.append(heading,element('p','Escolha qualquer área liberada no seu acesso. Marque os atalhos e use as setas para organizar. Salvo neste navegador.'));
  const input=element('input');input.type='search';input.placeholder='Buscar função: Financeiro, Estoque, Pedidos…';input.setAttribute('aria-label','Buscar função');input.value=search;input.className='fama-dock-search';input.addEventListener('input',()=>{search=input.value;filterRows();});dialog.append(input);
  const list=element('div',null,'fama-dock-settings-list');list.setAttribute('aria-busy',String(loading));const ids=draft.order.filter(id=>catalog.has(id));
  const sorted=[...ids.filter(id=>!draft.hidden.includes(id)),...ids.filter(id=>draft.hidden.includes(id))];
  sorted.forEach(id=>{const row=element('div',null,'fama-dock-settings-row');row.setAttribute('data-dock-choice',id);const label=element('label'),check=element('input');check.type='checkbox';check.checked=!draft.hidden.includes(id);check.disabled=id==='more';check.addEventListener('change',()=>{draft.hidden=draft.hidden.filter(x=>x!==id);if(!check.checked)draft.hidden.push(id);updateCount();});label.append(check,element('span',DOCK_LABELS[id]+(id==='more'?' · sempre disponível':'')));row.append(label);
   const selected=ids.filter(key=>!draft.hidden.includes(key));for(const [direction,text,arrow] of [[-1,'Mover para cima','↑'],[1,'Mover para baixo','↓']]){const b=button(arrow,()=>{const available=draft.order.filter(key=>catalog.has(key)&&!draft.hidden.includes(key));draft=moveItem(draft,id,direction,available);render(`${text}: ${DOCK_LABELS[id]}`);});b.setAttribute('aria-label',`${text}: ${DOCK_LABELS[id]}`);b.disabled=draft.hidden.includes(id)||(direction<0?selected.indexOf(id)===0:selected.indexOf(id)===selected.length-1);row.append(b);}list.append(row);
  });dialog.append(list);
  const count=element('p','', 'fama-dock-choice-count');count.setAttribute('role','status');dialog.append(count);
  function updateCount(){count.textContent=`${ids.filter(id=>!draft.hidden.includes(id)).length} atalhos selecionados. Se necessário, deslize a barra para ver todos.`;for(const row of list.children){const id=row.getAttribute('data-dock-choice'),selected=draft.order.filter(key=>catalog.has(key)&&!draft.hidden.includes(key));const arrows=[...row.querySelectorAll('button')];arrows[0].disabled=draft.hidden.includes(id)||selected.indexOf(id)===0;arrows[1].disabled=draft.hidden.includes(id)||selected.indexOf(id)===selected.length-1;}}
  updateCount();
  function filterRows(){const query=search.trim().toLocaleLowerCase('pt-BR');for(const row of list.children)row.hidden=!DOCK_LABELS[row.getAttribute('data-dock-choice')].toLocaleLowerCase('pt-BR').includes(query);}
  filterRows();
  if(loading)dialog.append(element('p','Carregando todas as funções…'));if(loadError){const e=element('p',loadError);e.setAttribute('role','alert');dialog.append(e,button('Tentar novamente',()=>void refreshCatalog()));}
  const status=element('p','', 'fama-dock-settings-status');status.setAttribute('role','status');const footer=element('footer');footer.append(button('Restaurar padrão',()=>{draft=normalizePreferences();render();}),button('Cancelar',()=>dialog.close()));const save=button('Salvar',()=>{preferences=normalizePreferences(draft);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(preferences));}catch{status.textContent='Aplicado nesta sessão. O navegador não permitiu salvar a preferência.';apply();return;}apply();dialog.close();});save.className='fama-dock-save';footer.append(save);dialog.append(status,footer);
  if(keepSearch&&!focusLabel)input.focus();
  if(focusLabel){const target=[...dialog.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===focusLabel);if(target&&!target.disabled)target.focus();else dialog.querySelector('button').focus();}
 }
 window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){preferences=read();schedule();}});window.addEventListener('hashchange',schedule);window.addEventListener('popstate',schedule);document.addEventListener('change',e=>{if(e.target.matches('select.company-switcher,select[aria-label="Empresa ativa"]')){scope='';schedule();}},true);
 new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});apply();
}
