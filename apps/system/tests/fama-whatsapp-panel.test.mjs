import assert from 'node:assert/strict';
import test,{after,afterEach,beforeEach} from 'node:test';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {createServer} from 'vite';
const root=new URL('..',import.meta.url).pathname,originalFetch=globalThis.fetch;
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
const {FamaWhatsappPanel}=await vite.ssrLoadModule('/app/fama-whatsapp-panel.jsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let data,requests,renderer;
const connection={id:'connection-a',phoneNumberId:'11111',displayPhone:'+5511000000000',verified:true,webhookVerified:false,enabled:false,webhookUrl:'https://fama.example.test/api/whatsapp/webhook?connection=connection-a',verifyToken:'verification-fixture'};
const flush=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});};
beforeEach(()=>{data={connection:null,members:[{id:'member-a',name:'Equipe A',email:'a@example.test',role:'member'}],links:[]};requests=[];globalThis.fetch=async(url,init)=>{requests.push({url,init});if(init.method==='POST')data={...data,connection:{...connection}};return Response.json(data);};});
after(async()=>{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=originalFetch;delete globalThis.IS_REACT_ACT_ENVIRONMENT;await vite.close();});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
const mount=async(org='org-a')=>{await act(async()=>{renderer=create(React.createElement(FamaWhatsappPanel,{organizationId:org}));});await flush();};
const input=label=>renderer.root.findByProps({'aria-label':label});
const nodeText=node=>node.children.map(child=>typeof child==='string'?child:nodeText(child)).join('');
const button=text=>renderer.root.findAllByType('button').find(node=>nodeText(node).includes(text));
const text=()=>JSON.stringify(renderer.toJSON());
test('setup uses labeled fields, requires complete credentials, and clears secret inputs after saving',async()=>{
  await mount();assert.match(text(),/Fama IA no WhatsApp/);assert.equal(button('Ativar IA').props.disabled,true);assert.equal(button('Conferir e salvar').props.disabled,true);
  await act(async()=>{input('ID do número na Meta').props.onChange({target:{value:'11111'}});input('Token de acesso Meta').props.onChange({target:{value:'private-token-fixture'}});input('Chave secreta Meta').props.onChange({target:{value:'b'.repeat(32)}});});
  await act(async()=>{button('Conferir e salvar').props.onClick();});await flush();
  assert.equal(renderer.root.findAllByProps({'aria-label':'Token de acesso Meta'}).length,0);assert.equal(button('Ativar IA').props.disabled,true);assert.match(text(),/Aguardando a confirmação/);assert.doesNotMatch(text(),/private-token-fixture/);
  assert.equal(requests.filter(r=>r.init.method==='POST').length,1);assert.equal(new Headers(requests.at(-1).init.headers).get('x-organization-id'),'org-a');await act(async()=>renderer.unmount());renderer=null;
});
test('saved credentials are collapsed and stay empty when the administrator opens them again',async()=>{
  data.connection={...connection,webhookVerified:true};await mount();
  assert.equal(renderer.root.findAllByProps({'aria-label':'Token de acesso Meta'}).length,0);
  assert.doesNotMatch(text(),/verification-fixture/);
  await act(async()=>button('Alterar conexão').props.onClick());
  assert.equal(input('Token de acesso Meta').props.value,'');assert.equal(input('Chave secreta Meta').props.value,'');
});
test('team link requires explicit identity confirmation; duplicate clicks produce one request',async()=>{
  data.connection={...connection,webhookVerified:true};await mount();assert.equal(button('Autorizar telefone').props.disabled,true);
  await act(async()=>{input('Usuário autorizado').props.onChange({target:{value:'member-a'}});input('Telefone autorizado').props.onChange({target:{value:'5511999999999'}});});assert.equal(button('Autorizar telefone').props.disabled,true);
  await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='checkbox').props.onChange({target:{checked:true}}));assert.equal(button('Autorizar telefone').props.disabled,false);
  let resolve;globalThis.fetch=async(url,init)=>{requests.push({url,init});return new Promise(done=>{resolve=done;});};
  await act(async()=>{button('Autorizar telefone').props.onClick();button('Autorizar telefone').props.onClick();});assert.equal(requests.filter(r=>r.init.method==='POST').length,1);
  await act(async()=>resolve(Response.json({...data,links:[{id:'link-a',memberId:'member-a',name:'Equipe A',phone:'5511999999999'}]})));await flush();assert.match(text(),/Revogar/);await act(async()=>renderer.unmount());renderer=null;
});
test('changing company cancels a pending write and hides the previous phones and credentials',async()=>{
  data.connection={...connection,webhookVerified:true};data.links=[{id:'link-a',memberId:'member-a',name:'PRIVATE_TEAM_A',phone:'5511999999999'}];await mount();
  let finishOld;const fetchCurrent=globalThis.fetch;globalThis.fetch=async(url,init)=>init.method==='POST'?new Promise(resolve=>{finishOld=resolve;}):fetchCurrent(url,init);
  await act(async()=>button('Ativar IA').props.onClick());data={connection:null,members:[],links:[]};await act(async()=>renderer.update(React.createElement(FamaWhatsappPanel,{organizationId:'org-b'})));await flush();assert.doesNotMatch(text(),/PRIVATE_TEAM_A|5511999999999/);
  await act(async()=>finishOld(Response.json({connection:{...connection,enabled:true},members:[],links:[{id:'link-a',name:'PRIVATE_TEAM_A',phone:'5511999999999'}]})));await flush();assert.doesNotMatch(text(),/PRIVATE_TEAM_A|IA ativa para a equipe/);await act(async()=>renderer.unmount());renderer=null;
});
test('the current company user is preselected and Brazilian phone authorization shows the exact number',async()=>{
  data.connection={...connection,webhookVerified:true};data.currentMemberId='member-current';data.members.push({id:'member-current',name:'Owner',email:'owner@example.test',role:'owner'});
  await mount();assert.equal(input('Usuário autorizado').props.value,'member-current');
  await act(async()=>input('Telefone autorizado').props.onChange({target:{value:'(61) 99123-4567'}}));
  assert.match(text(),/5561991234567/);assert.equal(button('Autorizar telefone').props.disabled,true);
  await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='checkbox').props.onChange({target:{checked:true}}));
  await act(async()=>button('Autorizar telefone').props.onClick());await flush();
  assert.deepEqual(JSON.parse(requests.find(r=>r.init.method==='POST').init.body),{action:'link',memberId:'member-current',phone:'+5561991234567'});
});
test('international phone authorization retains its explicit country instead of applying Brazil twice',async()=>{
  data.connection={...connection,webhookVerified:true};await mount();
  await act(async()=>input('Telefone autorizado').props.onChange({target:{value:'+1 (415) 555-0123'}}));
  assert.match(text(),/14155550123/);assert.doesNotMatch(text(),/5514155550123/);
  await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='checkbox').props.onChange({target:{checked:true}}));
  await act(async()=>button('Autorizar telefone').props.onClick());await flush();
  assert.equal(JSON.parse(requests.find(r=>r.init.method==='POST').init.body).phone,'+14155550123');
});
test('changing a confirmed phone requires confirming the new identity again',async()=>{
  data.connection={...connection,webhookVerified:true};await mount();
  await act(async()=>input('Telefone autorizado').props.onChange({target:{value:'(61) 99123-4567'}}));
  await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='checkbox').props.onChange({target:{checked:true}}));
  assert.equal(button('Autorizar telefone').props.disabled,false);
  await act(async()=>input('Telefone autorizado').props.onChange({target:{value:'(61) 99888-8888'}}));
  assert.equal(button('Autorizar telefone').props.disabled,true);
});
test('automatic callback confirmation preserves the phone draft and releases its timer on unmount',async()=>{
  const originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout,scheduled=new Set();
  globalThis.setTimeout=(callback,delay,...args)=>{if(delay!==5000)return originalTimeout(callback,delay,...args);const handle={callback};scheduled.add(handle);return handle;};
  globalThis.clearTimeout=handle=>{if(scheduled.has(handle))scheduled.delete(handle);else originalClear(handle);};
  try{
    data.connection={...connection};await mount();assert.equal(scheduled.size,1);
    await act(async()=>input('Telefone autorizado').props.onChange({target:{value:'(61) 99123-4567'}}));
    data={...data,connection:{...connection,webhookVerified:true}};
    const timer=[...scheduled][0];scheduled.delete(timer);await act(async()=>timer.callback());await flush();
    assert.match(text(),/Recebimento confirmado pela Meta/);assert.equal(input('Telefone autorizado').props.value,'(61) 99123-4567');
    assert.equal(requests.filter(r=>r.init.method==='POST').length,0);
    await act(async()=>renderer.unmount());renderer=null;assert.equal(scheduled.size,0);
  }finally{globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}
});
test('a stale confirmation read cannot overwrite a newly authorized phone',async()=>{
  data.connection={...connection};await mount();
  await act(async()=>input('Telefone autorizado').props.onChange({target:{value:'(61) 99123-4567'}}));
  await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='checkbox').props.onChange({target:{checked:true}}));
  const oldData=structuredClone(data);let finishRead;
  globalThis.fetch=async(url,init)=>init.method==='POST'?Response.json({...data,connection:{...connection,webhookVerified:true},links:[{id:'link-new',memberId:'member-a',name:'NEW_LINK',phone:'5561991234567'}]}):new Promise(resolve=>{finishRead=resolve;});
  await act(async()=>button('Atualizar confirmação').props.onClick());
  await act(async()=>button('Autorizar telefone').props.onClick());await flush();
  await act(async()=>finishRead(Response.json(oldData)));await flush();
  assert.match(text(),/NEW_LINK/);assert.match(text(),/Recebimento confirmado pela Meta/);
});
test('testing opens a draft chat only for a ready active connection and never sends a message itself',async()=>{
  data.connection={...connection,webhookVerified:true,enabled:true};data.links=[{id:'link-a',memberId:'member-a',name:'Owner',phone:'5511999999999'}];await mount();
  const chat=renderer.root.findAllByType('a').find(node=>nodeText(node).includes('Abrir conversa de teste'));
  assert.equal(chat.props.href,'https://wa.me/5511000000000?text=Agenda%20de%20hoje');assert.equal(requests.filter(r=>r.init.method==='POST').length,0);
  await act(async()=>renderer.unmount());renderer=null;data.connection.enabled=false;await mount();
  assert.equal(renderer.root.findAllByType('a').filter(node=>nodeText(node).includes('Abrir conversa de teste')).length,0);
});
