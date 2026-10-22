import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {isLocalModelDownload,localAiModels,localAssistantMessages,cleanLocalNarrative}=await vite.ssrLoadModule('/lib/fama-ai-local.js');
const origin='https://fama.example.test';
test('model workers allow fixed asset downloads and reject APIs, credentials and data uploads',()=>{
 const url=`https://huggingface.co/${localAiModels.language.id}/resolve/${localAiModels.language.revision}/onnx/model_q4f16.onnx`;
 assert.ok(isLocalModelDownload(url,origin));assert.ok(isLocalModelDownload('/fama-ai-runtime/ort-wasm-simd-threaded.jsep.wasm',origin));
 for(const [value,method] of [[url,'POST'],[`${url}?prompt=private`,'GET'],['https://api.openai.com/v1/responses','GET'],['https://huggingface.co/api/models','GET'],['/api/bootstrap','GET'],[url.replace(localAiModels.language.revision,'main'),'GET'],[url.replace('huggingface.co','huggingface.co.evil.test'),'GET']])assert.equal(isLocalModelDownload(value,origin,method),false);
});
test('local prompt supplies bounded evidence and distinguishes history from records',()=>{
 const messages=localAssistantMessages('Pergunta',{source:'finance',text:'Receita: R$ 450,00',actions:[]},['Pergunta antiga']);
 assert.equal(messages.length,2);assert.match(messages[0].content,/Não invente/);assert.match(messages[1].content,/DADOS_CONFERIDOS/);assert.match(messages[1].content,/Receita/);
 const huge=localAssistantMessages('x'.repeat(9000),{source:'overview',text:'z'.repeat(100000),actions:[]},Array(20).fill('h'.repeat(9000)));assert.ok(huge[1].content.length<10000);
});
test('local prose rejects invented numbers and claims of completed actions',()=>{
 assert.equal(cleanLocalNarrative('Seu saldo é R$ 999,00.','Receita: R$ 450,00'), '');
 for(const text of ['Enviei a mensagem.','Paguei a conta.','Criei um contrato.','Agendei a visita.'])assert.equal(cleanLocalNarrative(text,'Agenda: 2'), '');
 assert.equal(cleanLocalNarrative('<think>internal</think>Confira os vencimentos.','Receita: R$ 450,00'), 'Confira os vencimentos.');
 assert.equal(cleanLocalNarrative('1. Confira o financeiro.\n2. Revise o cadastro.','Nenhum registro'),'1. Confira o financeiro.\n2. Revise o cadastro.');
});
