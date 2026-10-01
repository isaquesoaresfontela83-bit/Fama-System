import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const originalFetch = globalThis.fetch;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, ws: false, hmr: false } });
const { answerGenerative, assistantProviderConfigured } = await vite.ssrLoadModule('/lib/fama-ai-provider.ts');
const { defaultAssistantSettings: settings, restrictAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });
const runtime = { OPENAI_API_KEY: 'provider-key-fixture', FAMA_AI_GENERATIVE_ENABLED: 'true', FAMA_AI_MODEL: 'model-fixture' };
const input = { question: 'Resumo do meu financeiro', source: 'finance', history: [], timeZone: 'America/Sao_Paulo' };
const now = new Date('2026-10-01T12:00:00');
let requests, replies;
beforeEach(() => {
  requests = []; replies = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    assert.equal(init.headers.Authorization, 'Bearer provider-key-fixture');
    const body = JSON.parse(init.body); requests.push(body);
    assert.equal(body.store, false); assert.equal(body.model, 'model-fixture');
    return replies.shift() ?? Response.json({ output: [] });
  };
});
const call = (name, args, callId = 'c1') => ({ type: 'function_call', name, arguments: JSON.stringify(args), call_id: callId });
const message = text => ({ type: 'message', content: [{ type: 'output_text', text }] });

test('provider requires both a server secret and explicit activation; internal mode makes no paid requests', async () => {
  for (const configuration of [{}, { OPENAI_API_KEY: 'key' }, { FAMA_AI_GENERATIVE_ENABLED: 'true' }, { ...runtime, FAMA_AI_GENERATIVE_ENABLED: 'false' }]) {
    assert.equal(assistantProviderConfigured(configuration), false);
    await assert.rejects(answerGenerative(input, {}, settings, configuration, now), /ainda não está conectada/);
  }
  assert.equal(requests.length, 0);
});

test('function loop queries trusted records, replays reasoning and returns only locally validated actions', async () => {
  const reasoning = { type: 'reasoning', id: 'reasoning-1', summary: [] };
  replies = [Response.json({ output: [reasoning, call('query_system', { source: 'finance', question: 'Resumo financeiro' })] }), Response.json({ output: [message('Há receitas cadastradas. Confira os vencimentos antes de decidir.')] })];
  const answer = await answerGenerative(input, { transactions: [{ id: 'registered', description: 'Manutenção registrada', amountCents: 45000, type: 'receita', status: 'pendente', dueDate: '2026-10-02' }] }, settings, runtime, now);
  assert.equal(answer.engine, 'generative');
  assert.equal(answer.items[0].id, 'registered');
  assert.ok(answer.actions.every(action => ['finance'].includes(action.section)));
  assert.equal(requests[0].tool_choice, 'required');
  assert.equal(requests[1].input.some(item => item.id === 'reasoning-1'), true);
  const result = requests[1].input.find(item => item.type === 'function_call_output');
  assert.equal(result.call_id, 'c1'); assert.match(result.output, /450,00/);
  assert.doesNotMatch(JSON.stringify(answer), /provider-key-fixture/);
  for (const tool of requests[0].tools) { assert.equal(tool.strict, true); assert.equal(tool.parameters.additionalProperties, false); }
});

test('a model cannot query denied modules, invent mutation tools or bypass global settings', async () => {
  const restricted = restrictAssistantSettings(settings, ['overview', 'agenda']);
  replies = [Response.json({ output: [call('query_system', { source: 'finance', question: 'Financeiro' }), call('delete_record', { id: 'secret' }, 'c2')] }), Response.json({ output: [message('Invented answer')] })];
  await assert.rejects(answerGenerative({ ...input, source: 'overview' }, { transactions: [{ description: 'SEGREDO', amountCents: 777000, type: 'receita', status: 'pago' }] }, restricted, runtime, now), /precisa consultar os registros/);
  assert.doesNotMatch(JSON.stringify(requests), /SEGREDO|777000|7\.770/);
  assert.equal(requests[0].tools[0].parameters.properties.source.enum.includes('finance'), false);
  assert.match(requests[1].input.find(item => item.type === 'function_call_output').output, /não autorizado/);
  await assert.rejects(answerGenerative(input, {}, restricted, runtime, now), error => error.status === 403);
});

test('prepared records sanitize fields, preserve review and never mutate database or payments', async () => {
  replies = [Response.json({ output: [call('prepare_record', { entity: 'transactions', fields: [{ name: 'description', value: 'Material' }, { name: 'amount', value: '450,00' }, { name: 'type', value: 'despesa' }, { name: 'status', value: 'pago' }, { name: 'organizationId', value: 'other' }] })] }), Response.json({ output: [message('Confira os dados no formulário antes de salvar.')] })];
  const data = { transactions: [] }; const before = JSON.stringify(data);
  const answer = await answerGenerative(input, data, settings, runtime, now);
  assert.deepEqual(answer.draft.fields, { description: 'Material', type: 'despesa', amount: '450.00' });
  assert.equal(JSON.stringify(data), before); assert.deepEqual(answer.actions, []);
  assert.match(answer.note, /usuário salvar/);
});

test('Control tools never offer operational record preparation', async () => {
  replies = [Response.json({ output: [call('query_system', { source: 'companies', question: 'Empresas' })] }), Response.json({ output: [message('Acompanhe as empresas cadastradas.')] })];
  const answer = await answerGenerative({ ...input, source: 'overview' }, { organizations: [{ id: 'c', name: 'Empresa', status: 'active' }] }, restrictAssistantSettings(settings, ['overview', 'companies', 'users', 'audit', 'privacy']), runtime, now, true);
  assert.equal(requests[0].tools.some(tool => tool.name === 'prepare_record'), false);
  assert.equal(answer.source, 'companies');
});

test('provider failures, malformed tools and broad loops give bounded errors without forwarding provider details', async () => {
  replies = [Response.json({ error: { message: 'provider-key-fixture PRIVATE' } }, { status: 401 })];
  await assert.rejects(answerGenerative(input, {}, settings, runtime, now), error => /não respondeu/.test(error.message) && !/PRIVATE|fixture/.test(error.message));
  replies = [new Response('not-json')];
  await assert.rejects(answerGenerative(input, {}, settings, runtime, now), /resposta inválida/);
  replies = [Response.json({ output: Array.from({ length: 7 }, (_, i) => call('query_system', { source: 'finance', question: 'Financeiro' }, `call-${i}`)) })];
  await assert.rejects(answerGenerative(input, { transactions: [] }, settings, runtime, now), /ampla demais/);
});
