import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
const runtime = { DATA_BACKEND: 'supabase', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture', PLATFORM_OWNER_EMAIL: 'admin@example.test' };
globalThis.__assistantRuntime = runtime;
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, appType: 'custom', root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false }, plugins: [{
  name: 'assistant-settings-fixtures', enforce: 'pre',
  resolveId(id) {
    if (id === 'cloudflare:workers') return '\0assistant-env';
    if (id.endsWith('/app/chatgpt-auth') || id.endsWith('/app/chatgpt-auth.ts')) return '\0assistant-auth';
  },
  load(id) {
    if (id === '\0assistant-env') return 'export const env = globalThis.__assistantRuntime;';
    if (id === '\0assistant-auth') return 'export async function getChatGPTUser() { return globalThis.__assistantUser; }';
  },
}] });
const api = await vite.ssrLoadModule('/app/api/ai-settings/route.ts');
const { defaultAssistantSettings, parseAssistantSettings, restrictAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');
const { answerInternal } = await vite.ssrLoadModule('/lib/fama-ai.ts');
const { systemAssistantData, systemAssistantSources } = await vite.ssrLoadModule('/lib/fama-ai-access.ts');
let record, requests, audits, rateAllowed, failSave;
beforeEach(() => {
  globalThis.__assistantUser = { id: 'platform-admin', email: 'admin@example.test', displayName: 'Administrador' };
  record = { config: structuredClone(defaultAssistantSettings), revision: 1, updated_at: '2026-10-01T12:00:00Z' };
  requests = []; audits = []; rateAllowed = true; failSave = false;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, body });
    if (url.pathname === '/rest/v1/fama_ai_settings') return Response.json(record ? [record] : []);
    if (url.pathname === '/rest/v1/rpc/fama_consume_rate_limit') return Response.json(rateAllowed);
    if (url.pathname === '/rest/v1/rpc/fama_save_ai_settings') {
      if (failSave) return Response.json({ message: 'Transaction rolled back' }, { status: 503 });
      if (!record || record.revision !== body.p_revision) return Response.json(null);
      record = { config: body.p_settings, revision: record.revision + 1, updated_at: '2026-10-01T12:01:00Z' };
      audits.push({ actor: body.p_actor_user_id, revision: record.revision });
      return Response.json({ settings: record.config, revision: record.revision, updatedAt: record.updated_at });
    }
    throw new Error(`Unexpected fixture destination: ${url.pathname}`);
  };
});
after(async () => { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__assistantRuntime; delete globalThis.__assistantUser; });
const post = (settings = defaultAssistantSettings, revision = 1, headers = {}) => api.POST(new Request('https://control.example.test/api/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://control.example.test', ...headers }, body: JSON.stringify({ settings, revision }) }));

test('preferences expose only settings, with no cached or fallback configuration', async () => {
  globalThis.__assistantUser = null;
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(await response.json()).sort(), ['revision', 'settings', 'updatedAt']);
  record = null;
  assert.equal((await api.GET()).status, 503);
});

test('settings writes reject anonymous users, company administrators and cross-origin requests before database changes', async () => {
  globalThis.__assistantUser = null;
  assert.equal((await post()).status, 401);
  globalThis.__assistantUser = { id: 'company-admin', email: 'company@example.test', displayName: 'Admin', user_metadata: { role: 'platform_admin' } };
  assert.equal((await post()).status, 403);
  globalThis.__assistantUser = { id: 'platform-admin', email: 'admin@example.test', displayName: 'Admin' };
  assert.equal((await post(defaultAssistantSettings, 1, { Origin: 'https://other.example.test' })).status, 403);
  assert.equal(requests.length, 0);
  assert.equal(record.revision, 1);
});

test('concurrent saves compare revisions and audit only the committed change', async () => {
  const settings = { ...defaultAssistantSettings, enabled: false };
  const responses = await Promise.all([post(settings), post({ ...settings, name: 'Outro rascunho' })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(record.revision, 2);
  assert.equal(record.config.name, defaultAssistantSettings.name);
  assert.equal(audits.length, 1);
  const rpc = requests.find(item => item.url.pathname.endsWith('fama_save_ai_settings'));
  assert.equal(rpc.body.p_actor_user_id, 'platform-admin');
});

test('strict configuration validation, body limits and rate limits prevent writes', async () => {
  assert.equal((await post({ ...defaultAssistantSettings, maxItems: 101 })).status, 400);
  assert.equal((await post({ ...defaultAssistantSettings, enabled: 'true' })).status, 400);
  assert.equal((await post(defaultAssistantSettings, 0)).status, 400);
  const oversized = new Request('https://control.example.test/api/ai-settings', { method: 'POST', body: 'x'.repeat(50_001) });
  assert.equal((await api.POST(oversized)).status, 400);
  rateAllowed = false;
  assert.equal((await post()).status, 429);
  assert.equal(record.revision, 1);
  assert.equal(audits.length, 0);
});

test('transaction failures keep the previous revision and never report success', async () => {
  failSave = true;
  assert.equal((await post({ ...defaultAssistantSettings, name: 'Rascunho' })).status, 503);
  assert.equal(record.revision, 1);
  assert.equal(record.config.name, defaultAssistantSettings.name);
  assert.equal(audits.length, 0);
});

test('company permissions omit protected records from answers and prevent settings from granting access', () => {
  const data = { appointments: [], transactions: [{ description: 'SEGREDO FINANCEIRO', amountCents: 90000, type: 'receita', status: 'pago' }], customers: [{ name: 'Cliente permitido' }] };
  const permitted = systemAssistantData(data, 'admin', ['customers']);
  assert.deepEqual(Object.keys(permitted), ['customers']);
  const settings = restrictAssistantSettings(defaultAssistantSettings, systemAssistantSources('admin', ['customers']));
  const overview = answerInternal('resumo da gestão', permitted, 'overview', new Date(), settings);
  assert.match(overview.text, /Clientes: 1/);
  assert.doesNotMatch(overview.text, /Lançamentos|SEGREDO|Agenda/);
  const finance = answerInternal('resumo financeiro', permitted, 'overview', new Date(), settings);
  assert.doesNotMatch(finance.text, /SEGREDO|900/);
  assert.deepEqual(finance.actions, []);
  assert.deepEqual(systemAssistantData(data, 'member', []), {});
  assert.deepEqual(systemAssistantData(data, 'owner', []), data);
});

test('disabled sources, actions and commands respect administrative preferences', () => {
  const settings = parseAssistantSettings({ ...defaultAssistantSettings, allowCreate: false, allowNavigation: false, sources: { ...defaultAssistantSettings.sources, finance: false }, commands: [{ trigger: 'Política', response: 'Orientação cadastrada', source: 'overview', enabled: true }] });
  assert.match(answerInternal('politica', {}, 'overview', new Date(), settings).text, /Orientação cadastrada/);
  assert.equal(answerInternal('agenda', { appointments: [] }, 'overview', new Date(), settings).actions.length, 0);
  assert.doesNotMatch(answerInternal('resumo da gestão', { transactions: [{ status: 'aberto' }] }, 'overview', new Date(), settings).text, /Lançamentos/);
  assert.throws(() => parseAssistantSettings({ ...settings, commands: [...settings.commands, { ...settings.commands[0], trigger: ' politica ' }] }), /repita/);
});
