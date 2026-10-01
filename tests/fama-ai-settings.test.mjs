import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let edgeHandler;
globalThis.Deno = { env: { get: name => name === 'SUPABASE_URL' ? 'https://database.test' : 'test-service-key' }, serve: handler => { edgeHandler = handler; } };
globalThis.aiSettingsControlMock = { status: 401, calls: [] };
const vite = await createServer({
  configFile: false, resolve: { alias: { '@': fileURLToPath(new URL('..', import.meta.url)) } },
  server: { middlewareMode: true, ws: false, hmr: false },
  plugins: [{ name: 'settings-test-environment', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/supabase/functions/fama-control/index.ts')) return code.replace(/import\s*["']jsr:[^"']+["'];?/, '');
    if (id.endsWith('/app/api/ai-settings/route.ts')) return code.replace(/import\s*\{\s*POST as control\s*\}\s*from\s*['"]\.\.\/fama-control\/route['"];?/, 'const control = async (request) => { globalThis.aiSettingsControlMock.calls.push(await request.json()); return Response.json({ ok: globalThis.aiSettingsControlMock.status === 200 }, { status: globalThis.aiSettingsControlMock.status }); };');
  } }],
});
after(async () => { delete globalThis.Deno; delete globalThis.aiSettingsControlMock; await vite.close(); });
const { defaultAssistantSettings, parseAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');
const { answerInternal } = await vite.ssrLoadModule('/lib/fama-ai.ts');
const route = await vite.ssrLoadModule('/app/api/ai-settings/route.ts');
await vite.ssrLoadModule('/supabase/functions/fama-control/index.ts');
const settings = () => structuredClone(defaultAssistantSettings);
const now = new Date('2026-10-01T12:00:00');

test('rejects malformed options, repeated questions and arbitrary module names', () => {
  assert.deepEqual(parseAssistantSettings(settings()), defaultAssistantSettings);
  for (const change of [{ enabled: 'true' }, { maxItems: 101 }, { maxItems: 4 }, { maxItems: 5.5 }, { sources: {} }, { commands: [{ trigger: 'x', response: 'y', source: 'admin_sql', enabled: true }] }]) assert.throws(() => parseAssistantSettings({ ...settings(), ...change }));
  const config = settings();
  config.commands = [{ trigger: 'Olá', response: 'Uma', source: 'overview', enabled: true }, { trigger: ' ola ', response: 'Outra', source: 'overview', enabled: false }];
  assert.throws(() => parseAssistantSettings(config), /Não repita/);
});

test('global and module controls suppress queries and exclude disabled data from summaries', () => {
  const data = { transactions: [{ type: 'receita', status: 'pendente', amountCents: 9900 }], appointments: [] };
  const config = settings();
  config.enabled = false;
  assert.match(answerInternal('financeiro', data, 'overview', now, config).text, /desativado/);
  config.enabled = true; config.sources.finance = false;
  assert.match(answerInternal('financeiro', data, 'overview', now, config).text, /desativada/);
  assert.doesNotMatch(answerInternal('resumo da gestão', data, 'overview', now, config).text, /Lançamentos|99/);
  config.sources.agenda = false;
  assert.doesNotMatch(answerInternal('resumo da gestão', data, 'overview', now, config).text, /Agenda de hoje/);
});

test('controls form actions, navigation, agenda conflicts and response limits', () => {
  const config = settings();
  const data = { appointments: [], inventory: Array.from({ length: 12 }, (_, id) => ({ name: `Produto ${id}`, quantity: 0, minimumQuantity: 1, unit: 'un' })) };
  config.allowCreate = false;
  let answer = answerInternal('agenda', data, 'overview', now, config);
  assert.equal(answer.actions.some(action => action.create), false);
  assert.equal(answer.actions.length, 1);
  config.allowNavigation = false;
  assert.equal(answerInternal('agenda', data, 'overview', now, config).actions.length, 0);
  config.detectConflicts = false;
  assert.match(answerInternal('conflitos na agenda', data, 'overview', now, config).text, /desativada/);
  config.maxItems = 5;
  answer = answerInternal('estoque baixo', data, 'overview', now, config);
  assert.equal(answer.text.split('\n').filter(line => line.startsWith('•')).length, 5);
  assert.match(answer.text, /Mais 7 registros/);
});

test('custom responses are static text and obey global and module controls', () => {
  const config = settings();
  config.commands = [{ trigger: 'Como agendar?', response: 'Abra a agenda e preencha o formulário.', source: 'agenda', enabled: true }];
  assert.equal(answerInternal(' COMO AGENDAR? ', {}, 'overview', now, config).text, config.commands[0].response);
  config.sources.agenda = false;
  assert.match(answerInternal('Como agendar?', {}, 'overview', now, config).text, /desativada/);
  config.sources.agenda = true; config.commands[0].enabled = false;
  assert.notEqual(answerInternal('Como agendar?', {}, 'overview', now, config).text, config.commands[0].response);
});

test('migration seed matches engine defaults', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261001210000_fama_ai_settings.sql', import.meta.url), 'utf8');
  const seed = sql.match(/VALUES \('global', '([\s\S]+)'\);/)[1];
  assert.deepEqual(parseAssistantSettings(JSON.parse(seed)), defaultAssistantSettings);
});

test('internal save route validates input and forwards only to authenticated control', async () => {
  const request = (body, origin = 'https://fama.test') => new Request('https://fama.test/api/ai-settings', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
  const valid = { settings: settings(), revision: 1 };
  assert.equal((await route.POST(request(valid, 'https://other.test'))).status, 403);
  assert.equal((await route.POST(request({ settings: { enabled: true }, revision: 1 }))).status, 400);
  assert.equal(globalThis.aiSettingsControlMock.calls.length, 0);
  assert.equal((await route.POST(request(valid))).status, 401);
  assert.deepEqual(globalThis.aiSettingsControlMock.calls[0], { action: 'ai_settings_save', ...valid });
});

test('preferences reader exposes only validated settings and fails closed on backend errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.body, undefined);
      return Response.json([{ config: settings(), revision: 4, updated_at: '2026-10-01T12:00:00Z' }]);
    };
    const response = await route.GET();
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.deepEqual(value.settings, settings());
    assert.equal(value.revision, 4);
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal((await route.GET()).status, 503);
  } finally { globalThis.fetch = originalFetch; }
});

test('Edge action denies company owners, validates input and handles stale revisions', async () => {
  const originalFetch = globalThis.fetch;
  let admin = false;
  let stale = false;
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.includes('/auth/v1/user')) return Response.json({ id: 'user1', email: 'admin@fama.test' });
    if (path.includes('/fama_control_admins?')) return Response.json(admin ? [{ user_id: 'user1', email: 'admin@fama.test', enabled: true }] : []);
    if (path.includes('/organization_members?')) return Response.json([{ user_id: 'user1', user_email: 'admin@fama.test', role: 'owner', status: 'active' }]);
    if (path.includes('/fama_ai_settings?')) {
      writes++;
      assert.equal(options.method, 'PATCH');
      assert.match(path, /revision=eq.1/);
      const patch = JSON.parse(options.body);
      assert.equal(patch.revision, 2);
      return Response.json(stale ? [] : [{ config: patch.config, revision: 2, updated_at: patch.updated_at }]);
    }
    if (path.includes('/audit_logs')) return new Response(null, { status: 201 });
    throw new Error(`Unexpected request: ${path}`);
  };
  const request = body => new Request('https://edge.test', { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: JSON.stringify(body) });
  try {
    const body = { action: 'ai_settings_save', settings: settings(), revision: 1 };
    assert.equal((await edgeHandler(request(body))).status, 403);
    assert.equal(writes, 0);
    admin = true;
    assert.equal((await edgeHandler(request({ ...body, settings: { enabled: true } }))).status, 400);
    assert.equal(writes, 0);
    stale = true;
    assert.equal((await edgeHandler(request(body))).status, 409);
    stale = false;
    const response = await edgeHandler(request(body));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.revision, 2);
  } finally { globalThis.fetch = originalFetch; }
});
