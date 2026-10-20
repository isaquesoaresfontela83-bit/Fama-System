import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__famaResponseFixture = { requests: [], cancellations: 0 };
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{
  name: 'deferred-local-narrative', enforce: 'pre',
  resolveId(id) { if (id.startsWith('\0')) return id; if (/\/hooks\/use-fama-local-ai(?:\.js)?$/.test(id)) return '\0deferred-local-ai'; if (/\/hooks\/use-assistant-connection(?:\.js)?$/.test(id)) return '\0internal-answer'; },
  load(id) {
    if (id === '\0internal-answer') return `export function useAssistantConnection(){return {state:'ready',configured:true,busy:false,error:'',cancel(){},refresh(){},async ask(){return {source:'agenda',text:'Resultado conferido do sistema.',narrative:'Resultado conferido do sistema.',actions:[],engine:'internal'};}}}`;
    if (id === '\0deferred-local-ai') return `import {useState} from 'react';const noop=()=>{};export function useFamaLocalAi(){const [generating,setGenerating]=useState(false);return {enabled:true,setEnabled:noop,generating,models:{language:{status:'ready',saved:true},speech:{status:'saved',saved:true}},voice:'idle',seconds:0,error:'',speaking:false,localVoiceAvailable:false,releaseMemory:noop,stopVoice:noop,stopSpeaking:noop,clearError:noop,terminate(){globalThis.__famaResponseFixture.cancellations++;setGenerating(false);},generate(){setGenerating(true);return new Promise(resolve=>globalThis.__famaResponseFixture.requests.push(text=>{setGenerating(false);resolve(text);}));}}}`;
  },
}] });
const { FamaAiPanel } = await vite.ssrLoadModule('/app/fama-ai-panel.jsx');
let renderer;
beforeEach(() => { globalThis.__famaResponseFixture = { requests: [], cancellations: 0 }; });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { await vite.close(); delete globalThis.__famaResponseFixture; if (originalAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct; });
const text = () => JSON.stringify(renderer.toJSON());
async function mount() { await act(async () => { renderer = Renderer.create(React.createElement(FamaAiPanel, { data: { appointments: [] }, platform: true, allowedSources: ['overview', 'agenda'] }), { createNodeMock: () => ({ focus() {}, scrollTop: 0, scrollHeight: 10 }) }); }); }
async function ask(question) { await act(async () => renderer.root.findByType('textarea').props.onChange({ target: { value: question } })); await act(async () => renderer.root.findByProps({ className: 'fama-ai-composer' }).props.onSubmit({ preventDefault() {} })); }

test('the internal answer and composer stay available while a slow local suggestion is pending', async () => {
  await mount(); await ask('Agenda de hoje');
  assert.match(text(), /Resultado conferido do sistema/);
  assert.equal(globalThis.__famaResponseFixture.requests.length, 1);
  assert.equal(renderer.root.findByType('textarea').props.disabled, false);
  assert.match(text(), /Preparando uma sugestão local/);
  await act(async () => globalThis.__famaResponseFixture.requests[0]('Sugestão do modelo local.'));
  assert.match(text(), /Sugestão do modelo local/); assert.match(text(), /Resultado conferido do sistema/);
});

test('starting another conversation cancels the previous narrative and discards its late reply', async () => {
  await mount(); await ask('Agenda de hoje');
  const previousReply = globalThis.__famaResponseFixture.requests[0];
  const button = renderer.root.findAllByType('button').find(item => item.children.includes('Nova conversa'));
  await act(async () => button.props.onClick());
  assert.equal(globalThis.__famaResponseFixture.cancellations, 1);
  await ask('Planejar a semana');
  await act(async () => previousReply('Resposta atrasada da conversa anterior.'));
  assert.doesNotMatch(text(), /Resposta atrasada da conversa anterior/);
  assert.match(text(), /Planejar a semana/);
  await act(async () => globalThis.__famaResponseFixture.requests[1]('Sugestão da nova conversa.'));
  assert.match(text(), /Sugestão da nova conversa/);
});
