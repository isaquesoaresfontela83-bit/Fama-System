import {DOCK_LABELS,STORAGE_KEY,normalizePreferences,moveItem} from './fama-dock-model-15.23.0.mjs';

if(!window.__famaDockCustomizer){
  window.__famaDockCustomizer=true;
  let preferences=read(),dialog=null,trigger=null,nav=null,frame=0,draft=null;
  function read(){try{return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return normalizePreferences();}}
  function identify(button){
    if(button.hasAttribute('data-fama-dock-settings'))return null;
    if(button.classList.contains('mobile-dock-new'))return 'new';
    const label=button.textContent.trim();
    return Object.keys(DOCK_LABELS).find(id=>DOCK_LABELS[id]===label)||null;
  }
  function buttons(){return nav?[...nav.children].filter(e=>e.tagName==='BUTTON'&&identify(e)):[];}
  function available(){return new Map(buttons().map(b=>[identify(b),b]));}
  function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
  function button(label,handler){const b=element('button',label);b.type='button';b.addEventListener('click',handler);return b;}
  function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;apply();});}
  function apply(){
    const found=document.querySelector('.workspace-mobile-dock');
    if(found!==nav){if(dialog?.open)dialog.close();nav=found;}
    if(!nav){trigger?.remove();return;}
    const permitted=available();
    for(const [id,b] of permitted){
      const hidden=preferences.hidden.includes(id)&&id!=='more';
      if(hidden){if(!b.hasAttribute('data-fama-dock-hidden')){b.setAttribute('data-fama-dock-hidden','');b.hidden=true;}}
      else if(b.hasAttribute('data-fama-dock-hidden')){b.removeAttribute('data-fama-dock-hidden');b.hidden=false;}
    }
    if(!trigger){trigger=button('',openSettings);trigger.setAttribute('data-fama-dock-settings','');trigger.setAttribute('aria-label','Personalizar barra inferior');trigger.setAttribute('aria-haspopup','dialog');trigger.append(element('span','⚙','fama-dock-gear'),element('small','Editar'));}
    const ordered=preferences.order.map(id=>permitted.get(id)).filter(Boolean);
    ordered.push(trigger);
    // Move existing nodes, keeping their original application listeners and keyboard order.
    for(let i=0;i<ordered.length;i++)if(nav.children[i]!==ordered[i])nav.insertBefore(ordered[i],nav.children[i]||null);
  }
  function openSettings(){
    if(!nav)return;
    draft=normalizePreferences(preferences);
    if(!dialog){
      dialog=element('dialog',null,'fama-dock-settings');dialog.setAttribute('aria-labelledby','fama-dock-title');
      dialog.addEventListener('close',()=>{trigger?.setAttribute('aria-expanded','false');if(trigger?.isConnected)trigger.focus();});
      dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
      document.body.append(dialog);
    }
    render();trigger.setAttribute('aria-expanded','true');dialog.showModal();
  }
  function render(focusLabel){
    dialog.replaceChildren();
    const heading=element('header'),title=element('h2','Sua barra, do seu jeito');title.id='fama-dock-title';
    heading.append(title,button('Fechar',()=>dialog.close()));dialog.append(heading,element('p','Escolha os atalhos e use as setas para mudar a ordem. Salvo apenas neste navegador.'));
    const list=element('div',null,'fama-dock-settings-list'),permitted=available();
    const ids=draft.order.filter(id=>permitted.has(id));
    ids.forEach((id,index)=>{
      const row=element('div',null,'fama-dock-settings-row'),label=element('label'),input=element('input');input.type='checkbox';input.checked=!draft.hidden.includes(id);input.disabled=id==='more';
      input.addEventListener('change',()=>{draft.hidden=draft.hidden.filter(x=>x!==id);if(!input.checked)draft.hidden.push(id);});
      label.append(input,element('span',DOCK_LABELS[id]+(id==='more'?' · sempre disponível':'')));row.append(label);
      for(const [direction,text,arrow] of [[-1,'Mover para cima','↑'],[1,'Mover para baixo','↓']]){
        const b=button(arrow,()=>{draft=moveItem(draft,id,direction,ids);render(`${text}: ${DOCK_LABELS[id]}`);});
        b.setAttribute('aria-label',`${text}: ${DOCK_LABELS[id]}`);b.disabled=direction<0?index===0:index===ids.length-1;row.append(b);
      }
      list.append(row);
    });
    dialog.append(list);
    const status=element('p','', 'fama-dock-settings-status');status.setAttribute('role','status');
    const footer=element('footer');footer.append(button('Restaurar padrão',()=>{draft=normalizePreferences();render();}),button('Cancelar',()=>dialog.close()));
    const save=button('Salvar',()=>{preferences=normalizePreferences(draft);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(preferences));}catch{status.textContent='Aplicado nesta sessão. O navegador não permitiu salvar a preferência.';apply();return;}apply();dialog.close();});save.className='fama-dock-save';footer.append(save);dialog.append(status,footer);
    if(focusLabel){const target=[...dialog.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===focusLabel);if(target&&!target.disabled)target.focus();else dialog.querySelector('button').focus();}
  }
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){preferences=read();schedule();}});
  new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
  apply();
}
