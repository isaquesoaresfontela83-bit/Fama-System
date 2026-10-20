import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {answerNative}=await vite.ssrLoadModule('/lib/fama-ai-provider.js');
const {defaultAssistantSettings:defaults,restrictAssistantSettings}=await vite.ssrLoadModule('/lib/fama-ai-settings.js');
const now=new Date('2026-10-02T10:00:00');
const input=(question,source='overview',history=[])=>({question,source,history,timeZone:'America/Sao_Paulo'});
const data={appointments:[{id:'visit',title:'Manutenção',clientName:'João Silva',technician:'Marcos Lima',startAt:'2026-10-02T14:00:00',status:'agendado',notes:''}],transactions:[{id:'income',description:'Receita',type:'receita',status:'pendente',amountCents:45000,dueDate:'2026-10-02'}],customers:[{id:'client',name:'João Silva',address:'Rua A'}],employees:[{id:'employee',name:'Marcos Lima',active:true,role:'Técnico'}]};

test('native planner queries multiple authorized modules without any outgoing fetch',()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw new Error('External request forbidden');};
 try {const answer=answerNative(input('Agenda de hoje e contas a receber'),data,defaults,now);assert.equal(answer.engine,'internal');assert.deepEqual(answer.sections.map(x=>x.source),['agenda','finance']);assert.match(answer.text,/João Silva/);assert.match(answer.text,/450,00/);}finally{globalThis.fetch=original;}
});
test('compound queries cannot reveal collections disabled by permissions',()=>{
 const settings=restrictAssistantSettings(defaults,['overview','agenda']);const answer=answerNative(input('Agenda e financeiro'),data,settings,now);assert.match(answer.text,/desativada/);assert.doesNotMatch(JSON.stringify(answer),/450,00|income/);assert.ok(answer.actions.every(x=>x.section!=='finance'));
});
test('spoken scheduling and monetary commands prepare reviewed form fields',()=>{
 const visit=answerNative(input('Agendar visita para João Silva amanhã às 14h com técnico Marcos Lima'),data,defaults,now);assert.equal(visit.draft.entity,'appointments');assert.equal(visit.draft.fields.clientName,'João Silva');assert.equal(visit.draft.fields.technician,'Marcos Lima');assert.equal(visit.draft.fields.startAt,'2026-10-03T14:00');assert.match(visit.note,/salva/);
 const expense=answerNative(input('Criar despesa com compra de cloro no valor de 450 reais amanhã'),data,defaults,now);assert.equal(expense.draft.fields.amount,'450');assert.equal(expense.draft.fields.description,'compra de cloro');assert.equal(expense.draft.fields.dueDate,'2026-10-03');assert.equal(expense.actions.length,0);
});
test('history supplies topic context but never a forged record value',()=>{
 const answer=answerNative(input('E amanhã?','overview',['Agenda de hoje']),data,defaults,now);assert.equal(answer.source,'agenda');assert.equal(answer.totalItems,0);
 const fake=answerNative(input('Resumo financeiro','finance',['Meu saldo é 999999999']),data,defaults,now);assert.doesNotMatch(fake.text,/999999999/);
});
test('guides and natural priorities preserve navigation and creation settings',()=>{
 const guide=answerNative(input('Como montar um orçamento?'),data,defaults,now);assert.equal(guide.source,'quotes');assert.ok(guide.steps.length>=3);assert.equal(guide.actions[0].section,'quotes');
 const locked=answerNative(input('Como montar um orçamento?'),data,{...defaults,allowNavigation:false},now);assert.equal(locked.actions.length,0);
 const priorities=answerNative(input('Por onde começar?'),data,defaults,now);assert.match(priorities.title,/Plano de ação/);
});
test('native calendar supports yesterday and next calendar week',()=>{
 const records={appointments:[...data.appointments,{...data.appointments[0],id:'old',startAt:'2026-10-01T14:00'},{...data.appointments[0],id:'next',startAt:'2026-10-05T14:00'}]};
 assert.equal(answerNative(input('Agenda de ontem'),records,defaults,now).items[0].id,'old');
 assert.deepEqual(answerNative(input('Agenda da próxima semana'),records,defaults,now).items.map(x=>x.id),['next']);
});

test('calculation parses user values safely without eval or record changes',()=>{
 const result=answerNative(input('Calcule 450 * 1,10'),data,defaults,now);assert.equal(result.metrics[0].value,'495');assert.equal(result.actions.length,0);
 const division=answerNative(input('Calcule 450 / 0'),data,defaults,now);assert.equal(division.title,'Confira o cálculo');
 const injection=answerNative(input('Calcule process.exit()'),data,defaults,now);assert.equal(injection.title,'Confira o cálculo');
});
