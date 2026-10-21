import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{hmr:false,middlewareMode:true}});
after(()=>vite.close());
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {DocumentScanner}=await vite.ssrLoadModule('/app/document-scanner.jsx');
function buttons(view){return view.root.findAllByType('button');}
function content(view){return JSON.stringify(view.toJSON());}
async function click(view,label){const button=buttons(view).find(b=>JSON.stringify(b.props.children).includes(label));assert.ok(button,label);await act(async()=>button.props.onClick());}
async function mount(){let view;await act(async()=>{view=create(React.createElement(DocumentScanner,{organizationId:'org',entity:'customers',recordId:'customer',onSaved(){}}));});await click(view,'Digitalizar documento');return view;}
test('guides setup before allowing a scan and explains missing connection inline',async()=>{
 const view=await mount();
 await act(async()=>view.root.findByType('select').props.onChange({target:{value:'windows'}}));
 assert.ok(content(view).includes('Prepare o computador uma vez'));
 assert.equal(buttons(view).some(b=>b.props.children==='Digitalizar agora'),false);
 await click(view,'Já abri o programa');
 const connect=buttons(view).find(b=>b.props.children==='Conectar digitalizadora');assert.equal(connect.props.disabled,true);
 await act(async()=>view.root.findByType('input').props.onChange({target:{value:'test-code'}}));
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw new TypeError('offline');};
 try {await click(view,'Conectar digitalizadora');assert.ok(content(view).includes('ainda não encontrou o programa'));assert.equal(view.root.findAllByProps({role:'alert'}).length,1);}
 finally{globalThis.fetch=saved;await act(async()=>view.unmount());}
});
test('Chromebook sees supported route instead of a broken localhost connection',async()=>{
 const view=await mount();
 await act(async()=>view.root.findByType('select').props.onChange({target:{value:'chromeos'}}));
 assert.ok(content(view).includes('aplicativo de digitalização'));
 assert.equal(view.root.findAllByType('input').length,0);
 assert.equal(buttons(view).some(b=>b.props.children==='Digitalizar agora'),false);
 await act(async()=>view.unmount());
});
test('successful connection unlocks capture without claiming scanner detected',async()=>{
 const view=await mount();await act(async()=>view.root.findByType('select').props.onChange({target:{value:'windows'}}));await click(view,'Já abri o programa');
 await act(async()=>view.root.findByType('input').props.onChange({target:{value:'test-code'}}));
 const saved=globalThis.fetch;globalThis.fetch=async()=>Response.json({available:true});
 try {await click(view,'Conectar digitalizadora');const capture=buttons(view).find(b=>b.props.children==='Digitalizar agora');assert.ok(capture);assert.equal(capture.props.disabled,false);assert.ok(content(view).includes('Programa conectado'));}
 finally{globalThis.fetch=saved;await act(async()=>view.unmount());}
});
