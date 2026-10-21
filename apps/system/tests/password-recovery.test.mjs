import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import React, { act } from 'react';
import { create } from 'react-test-renderer';
import { createServer } from 'vite';

const root=new URL('..',import.meta.url).pathname;
const original={fetch:globalThis.fetch,window:globalThis.window,FormData:globalThis.FormData,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},ssr:{noExternal:['next']},server:{hmr:false,middlewareMode:true,ws:false},plugins:[{
  name:'recovery-form-fixtures',enforce:'pre',
  resolveId(id){if(id==='next/link')return '\0recovery-link';const name=id.match(/components\/ui\/(button|input|label)(?:\.jsx)?$/)?.[1];if(name)return `\0recovery-${name}`;},
  load(id){const components={'\0recovery-link':['default','a'],'\0recovery-button':['Button','button'],'\0recovery-input':['Input','input'],'\0recovery-label':['Label','label']};const c=components[id];if(c)return `import React from 'react';${c[0]==='default'?'export default function Component':'export function '+c[0]}(props){return React.createElement('${c[1]}',props);}`;}
}]});
const {default:Recovery}=await vite.ssrLoadModule('/app/auth/recuperar/page.jsx');
after(async()=>{await vite.close();Object.assign(globalThis,{fetch:original.fetch,window:original.window,FormData:original.FormData,IS_REACT_ACT_ENVIRONMENT:original.act});});

async function mount(mfa){
  globalThis.window={location:{hash:'#access_token=fixture-access&refresh_token=fixture-refresh&expires_in=3600',pathname:'/auth/recuperar',search:''},history:{replaceState(){}},setTimeout};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(key){return this.values[key];}};
  globalThis.fetch=async path=>Response.json(path==='/api/auth/session'?{requiresMfa:mfa,factorId:mfa?'factor-fixture':undefined}:{challengeId:'challenge-fixture'});
  let view;await act(async()=>{view=create(React.createElement(Recovery));});return view;
}

test('password form recovers from a lost connection without disabling the retry or losing the fields',async()=>{
  const view=await mount(false);
  try{
    globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
    const event={preventDefault(){},currentTarget:{values:{password:'new-fixture-password',confirmation:'new-fixture-password'}}};
    await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/Falha de conexão/);assert.equal(view.root.findByType('button').props.disabled,false);assert.equal(view.root.findAllByType('input').length,2);
    globalThis.fetch=async()=>Response.json({updated:true});
    await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/Senha alterada com sucesso/);assert.equal(view.root.findAllByType('form').length,0);
  }finally{await act(async()=>view.unmount());}
});

test('MFA recovery allows another attempt after a connection failure and opens the password form only on verification',async()=>{
  const view=await mount(true);
  try{
    globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
    const event={preventDefault(){},currentTarget:{values:{code:'123456'}}};
    await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/Tente validar o código novamente/);assert.equal(view.root.findByType('button').props.disabled,false);assert.equal(view.root.findAllByType('input').length,1);
    globalThis.fetch=async()=>Response.json({verified:true});
    await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.equal(view.root.findAllByType('input').length,2);assert.match(JSON.stringify(view.toJSON()),/Defina uma nova senha/);
  }finally{await act(async()=>view.unmount());}
});

async function mountExpired(send){
  globalThis.window={location:{hash:'#error=access_denied&error_code=otp_expired',pathname:'/auth/recuperar',search:''},history:{replaceState(){}},setTimeout};
  globalThis.FormData=class{constructor(form){this.values=form.values;}get(key){return this.values[key];}};
  globalThis.fetch=send;
  let view;await act(async()=>{view=create(React.createElement(Recovery));});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  return view;
}

test('an expired link offers a new email request without opening the password form or accepting an invalid session',async()=>{
  const requests=[];
  const view=await mountExpired(async(path,init)=>{requests.push({path,body:JSON.parse(init.body)});return Response.json({sent:true});});
  try{
    assert.equal(requests.length,0);assert.match(JSON.stringify(view.toJSON()),/e-mail mais recente/);
    assert.equal(view.root.findByType('input').props.type,'email');
    await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){},currentTarget:{values:{email:' fixture@example.test '}}});});
    assert.deepEqual(requests,[{path:'/api/auth/recover',body:{email:'fixture@example.test'}}]);
    assert.match(JSON.stringify(view.toJSON()),/apenas a mensagem mais recente/);assert.equal(view.root.findAllByType('form').length,0);
  }finally{await act(async()=>view.unmount());}
});

test('failed email delivery keeps the request form available for another attempt',async()=>{
  let fail=true;
  const view=await mountExpired(async()=>fail?Response.json({error:'Não foi possível enviar a recuperação agora.'},{status:503}):Response.json({sent:true}));
  const event={preventDefault(){},currentTarget:{values:{email:'fixture@example.test'}}};
  try{
    await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/Não foi possível enviar/);assert.equal(view.root.findByType('button').props.disabled,false);
    assert.equal(view.root.findByType('input').props.type,'email');
    fail=false;await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/Solicitação enviada/);
  }finally{await act(async()=>view.unmount());}
});

test('email sending limits are visible and a network failure does not leave the request disabled',async()=>{
  let disconnected=false;
  const view=await mountExpired(async()=>{if(disconnected)throw new TypeError('Failed to fetch');return Response.json({error:'O limite de envio de e-mails foi atingido. Aguarde antes de solicitar outro link.'},{status:429});});
  const event={preventDefault(){},currentTarget:{values:{email:'fixture@example.test'}}};
  try{
    await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/limite de envio/);assert.equal(view.root.findByType('button').props.disabled,false);
    disconnected=true;await act(async()=>{await view.root.findByType('form').props.onSubmit(event);});
    assert.match(JSON.stringify(view.toJSON()),/Falha de conexão/);assert.equal(view.root.findByType('button').props.disabled,false);
  }finally{await act(async()=>view.unmount());}
});
