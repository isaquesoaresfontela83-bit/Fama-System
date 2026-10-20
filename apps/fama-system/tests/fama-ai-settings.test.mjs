import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
const originalFetch = globalThis.fetch;
const root = new URL('..', import.meta.url).pathname;
globalThis.__assistantSystemRuntime = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'assistant-runtime', enforce: 'pre', resolveId(id) { if (id === 'cloudflare:workers') return '\0assistant-system-env'; }, load(id) { if (id === '\0assistant-system-env') return 'export const env = globalThis.__assistantSystemRuntime;'; } }] });
const api = await vite.ssrLoadModule('/app/api/ai-settings/route.js');
const { defaultAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.js');
const { answerInternal } = await vite.ssrLoadModule('/lib/fama-ai.js');
const { systemAssistantData } = await vite.ssrLoadModule('/lib/fama-ai-access.js');
after(async () => { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__assistantSystemRuntime; });

test('system obtains only public preferences using the configured publishable key, independently of the Control domain', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://fixture.supabase.co/rest/v1/fama_ai_settings?id=eq.global&select=config,revision,updated_at&limit=1');
    assert.equal(init.headers.apikey, 'sb_publishable_fixture');
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.body, undefined);
    return Response.json([{ config: defaultAssistantSettings, revision: 3, updated_at: '2026-10-01T12:00:00Z' }]);
  };
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).revision, 3);
  assert.equal(api.POST, undefined);
});

test('unavailable, invalid and oversized configuration fails closed', async () => {
  for (const response of [Response.json({}, { status: 503 }), Response.json([]), Response.json([{ config: defaultAssistantSettings, revision: 0, updated_at: 'invalid' }]), new Response('x'.repeat(50_001))]) {
    globalThis.fetch = async () => response;
    assert.equal((await api.GET()).status, 503);
  }
});

test('public preferences reject redirects without forwarding credentials or making a second request', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(url).host, 'fixture.supabase.co');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Authorization, undefined);
    return new Response(null, { status: 307, headers: { Location: 'https://other.example.test/preferences' } });
  };
  assert.equal((await api.GET()).status, 503);
  assert.equal(calls, 1);
});

test('restricted administrators and members cannot query finance or count its records', () => {
  const data = { customers: [{ name: 'Permitido' }], transactions: [{ description: 'SEGREDO', amountCents: 10000, status: 'pago', type: 'receita' }] };
  for (const role of ['admin', 'member', 'technician']) {
    const permitted = systemAssistantData(data, role, ['customers']);
    assert.equal(permitted.transactions, undefined);
    assert.match(answerInternal('resumo da gestão', permitted).text, /Clientes: 1/);
    assert.doesNotMatch(answerInternal('resumo da gestão', permitted).text, /Lançamentos|SEGREDO/);
    assert.doesNotMatch(answerInternal('financeiro', permitted).text, /SEGREDO|100,00/);
  }
});
