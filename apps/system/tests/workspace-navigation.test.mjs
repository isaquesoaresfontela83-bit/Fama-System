import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const descriptors = Object.fromEntries(['window','IS_REACT_ACT_ENVIRONMENT'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile:false, root, resolve:{ alias:{'@':root} }, server:{ middlewareMode:true, hmr:false, ws:false } });
const { useWorkspaceNavigation } = await vite.ssrLoadModule('/hooks/use-workspace-navigation.js');
const { workspaceSnapshot } = await vite.ssrLoadModule('/lib/workspace-navigation.js');
const allowed = ['overview','customers','assistant','chat','invoices','finance/visao','finance/bancos'];
let api, renderer, browser, props;
function fakeBrowser() {
  const listeners = new Map(); const storage = new Map();
  const entries = [{ state:null,hash:'' }]; let index=0; let backCalls=0;
  const win = {
    scrollY:0, location:{hash:'',pathname:'/',search:''},
    sessionStorage:{ getItem:key=>storage.get(key)??null, setItem:(key,value)=>storage.set(key,value) },
    addEventListener(type, listener, capture=false){ if(!listeners.has(type)) listeners.set(type,new Set()); listeners.get(type).add({listener,capture:Boolean(capture)}); },
    removeEventListener(type, listener, capture=false){for(const entry of listeners.get(type)??[]){if(entry.listener===listener && entry.capture===Boolean(capture))listeners.get(type).delete(entry);}},
    scrollTo({top}){win.scrollY=top;},
    history:{
      state:null, scrollRestoration:'auto',
      pushState(state,_,hash){entries.splice(index+1);entries.push({state:structuredClone(state),hash});index++;this.state=entries[index].state;win.location.hash=hash;},
      replaceState(state,_,hash){entries[index]={state:structuredClone(state),hash};this.state=entries[index].state;win.location.hash=hash;},
      back(){backCalls++;move(-1);},forward(){move(1);},
    },
  };
  const fire=type=>{let stopped=false;const event={state:win.history.state,stopImmediatePropagation(){stopped=true;}};const ordered=[...(listeners.get(type)??[])].sort((a,b)=>Number(b.capture)-Number(a.capture));for(const entry of ordered){entry.listener(event);if(stopped)break;}};
  const move=amount=>{const next=index+amount;if(next<0||next>=entries.length)return;index=next;win.history.state=entries[index].state;win.location.hash=entries[index].hash;fire('popstate');fire('hashchange');};
  return {win,storage,listeners,entries,fire,get backCalls(){return backCalls;}};
}
function Harness(current){api=useWorkspaceNavigation(current);return null;}
async function mount(overrides={}){props={scope:'user:tenant-a',initial:'overview',allowed,...overrides};await act(async()=>{renderer=Renderer.create(React.createElement(Harness,props));});}
beforeEach(()=>{browser=fakeBrowser();globalThis.window=browser.win;});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
after(async()=>{await vite.close();for(const [key,value] of Object.entries(descriptors)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});

test('rapid module and finance-tab changes retain their correct order without stale closures',async()=>{
  await mount(); const navigate=api.navigate;
  await act(async()=>{navigate('customers');navigate('finance/visao');navigate('finance/bancos');});
  assert.equal(api.current,'finance/bancos');assert.deepEqual(api.history,['overview','customers','finance/visao']);
  await act(async()=>navigate('forbidden'));assert.equal(api.current,'finance/bancos');assert.equal(window.location.hash,'#finance/bancos');
});

test('browser back/forward and the app back button preserve tab history and scroll',async()=>{
  await mount();window.scrollY=140;
  await act(async()=>api.navigate('customers'));await act(async()=>api.restoreScroll());assert.equal(window.scrollY,0);
  window.scrollY=620;
  await act(async()=>api.navigate('finance/bancos'));await act(async()=>api.restoreScroll());
  await act(async()=>api.back());assert.equal(api.current,'customers');await act(async()=>api.restoreScroll());assert.equal(window.scrollY,620);
  await act(async()=>window.history.back());assert.equal(api.current,'overview');await act(async()=>api.restoreScroll());assert.equal(window.scrollY,140);
  await act(async()=>window.history.forward());assert.equal(api.current,'customers');await act(async()=>api.restoreScroll());assert.equal(window.scrollY,620);
});

test('restored history works without navigating back out to a login page',async()=>{
  browser.storage.set('fama:navigation:v2:user:tenant-a',JSON.stringify({current:'finance/bancos',history:['overview','customers']}));
  await mount();assert.equal(api.current,'finance/bancos');
  await act(async()=>api.back());assert.equal(api.current,'customers');assert.equal(browser.backCalls,0);
});

test('tenant and permission changes cannot restore a previous tenant or forbidden view',async()=>{
  await mount();await act(async()=>api.navigate('finance/bancos'));
  props={scope:'user:tenant-b',initial:'customers',allowed:['customers','assistant']};
  await act(async()=>renderer.update(React.createElement(Harness,props)));
  assert.equal(api.current,'customers');assert.deepEqual(api.history,[]);
  await act(async()=>window.history.back());assert.equal(api.current,'customers');
  await act(async()=>api.navigate('assistant'));
  props={...props,allowed:['customers']};await act(async()=>renderer.update(React.createElement(Harness,props)));
  assert.equal(api.current,'customers');assert.ok(api.history.every(view=>view==='customers'));
});

test('disabled storage and malformed memory do not break navigation; history stays bounded',async()=>{
  window.sessionStorage.getItem=()=>{throw new Error('disabled');};window.sessionStorage.setItem=()=>{throw new Error('disabled');};
  await mount();await act(async()=>{for(let i=0;i<90;i++)api.navigate(i%2?'customers':'assistant');});
  assert.equal(api.current,'customers');assert.equal(api.history.length,32);
  assert.deepEqual(workspaceSnapshot({current:'evil',history:['evil','customers',null,{}]},allowed,'overview'),{current:'overview',history:['customers']});
});

test('authorized deep links open their module and unmount releases browser listeners',async()=>{
  window.location.hash='#finance/bancos';await mount();assert.equal(api.current,'finance/bancos');
  await act(async()=>renderer.unmount());renderer=null;
  assert.equal([...browser.listeners.values()].reduce((sum,set)=>sum+set.size,0),0);assert.equal(window.history.scrollRestoration,'auto');
});
test('the dedicated invoices view keeps its own back history and respects permission removal',async()=>{
  window.location.hash='#invoices';await mount();assert.equal(api.current,'invoices');
  await act(async()=>api.navigate('finance/visao'));await act(async()=>api.back());assert.equal(api.current,'invoices');
  props={...props,allowed:['overview','customers']};await act(async()=>renderer.update(React.createElement(Harness,props)));
  assert.equal(api.current,'overview');assert.ok(api.history.every(view=>view!=='invoices'));
});


test('the Chat deep link preserves history and closes when its permission is removed', async()=>{
  window.location.hash='#chat';await mount();assert.equal(api.current,'chat');
  await act(async()=>api.navigate('customers'));await act(async()=>api.back());assert.equal(api.current,'chat');
  props={...props,allowed:['overview','customers']};await act(async()=>renderer.update(React.createElement(Harness,props)));
  assert.equal(api.current,'overview');assert.ok(api.history.every(view=>view!=='chat'));
  await act(async()=>api.navigate('chat'));assert.equal(api.current,'overview');
});

test('local module back skips framework reloads while real route changes still reach the router',async()=>{
  let serverNavigations=0;
  window.addEventListener('popstate',()=>{serverNavigations++;});
  await mount();await act(async()=>api.navigate('customers'));
  await act(async()=>api.back());assert.equal(api.current,'overview');assert.equal(serverNavigations,0);
  window.location.pathname='/entrar';
  await act(async()=>browser.fire('popstate'));assert.equal(serverNavigations,1);
});
