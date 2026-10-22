import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { operationalFixture } from './operational-fixture.mjs';
import { apiCatalog } from '../lib/api-catalog.js';
import { FAMA_VERSION, FAMA_RELEASE_ID } from '../lib/fama-release.js';
const f = await operationalFixture(new URL('../', import.meta.url).pathname);
const route = await f.load('/app/api/admin/apis/route.js');
const model = await f.load('/lib/api-status-model.js');
const settings = await f.load('/lib/platform-integrations.js');
let sql, external, mode;
function database() {
    sql = new DatabaseSync(':memory:');
    sql.exec('CREATE TABLE platform_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)');
    return { prepare(query) { const statement = sql.prepare(query); let args = []; const bound = { bind(...values) { args = values; return bound; }, async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; }, async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; } }; return bound; } };
}
beforeEach(() => {
    sql?.close(); f.reset(); f.runtime.DB = database(); f.runtime.FAMA_DATA_BRIDGE_SECRET = 'private-bridge-fixture'; f.runtime.PLATFORM_OWNER_EMAIL = f.user.email; mode = ''; external = [];
    f.runtime.FAMA_SYSTEM = { async fetch(url, init = {}) {
        if (mode === 'system-down') throw new Error('Fixture unavailable');
        if (url.endsWith('/api/health')) return Response.json({ service: 'Fama System', version: FAMA_VERSION, releaseId: FAMA_RELEASE_ID });
        assert.equal(url, 'https://famasystem.online/api/internal/api-status');
        assert.equal(new Headers(init.headers).get('authorization'), 'Bearer private-bridge-fixture');
        if (mode === 'old-system') return new Response('Missing', { status: 404 });
        if (init.method === 'POST') { const { id } = JSON.parse(init.body); return Response.json({ id, scope: 'system', observation: { status: 'verified', detail: 'Consulta de leitura confirmada.', checkedAt: new Date().toISOString() }, secret: 'must-not-leak' }); }
        const observations = Object.fromEntries(apiCatalog.filter(item => item.scopes.includes('system')).map(item => [item.id, { status: item.id === 'system-api' ? 'verified' : 'configured', detail: 'Conferido no System.', checkedAt: null, secret: 'must-not-leak' }]));
        return Response.json({ scope: 'system', version: FAMA_VERSION, releaseId: FAMA_RELEASE_ID, observations, secret: 'must-not-leak' });
    } };
    const delegated = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        if (String(url).includes('/functions/v1/fama-control-admin')) {
            const body = JSON.parse(init.body); external.push(body.action);
            if (mode === 'backend-down') throw new Error('Fixture unavailable');
            if (body.action === 'integration_status') return Response.json({ ok: true, data: { google_drive: { configured: true }, resend: { configured: false }, sentry: { configured: false }, ocr_space: { configured: false }, github_rest: { available: true }, ipinfo: { available: true }, secret: 'must-not-leak' } });
            if (body.action === 'github_rest_get') return Response.json({ ok: true, data: [] });
            if (body.action === 'ipinfo_lookup') return Response.json({ ok: true, data: { ip: '8.8.8.8' } });
            throw new Error('Unexpected side effect');
        }
        return delegated(url, init);
    };
});
after(async () => { sql?.close(); await f.close(); });
const post = (body, headers) => route.POST(f.request('POST', '/api/admin/apis', body, headers));
test('the complete inventory separates configuration from proof and returns no credentials or customer data', async () => {
    const response = await route.GET(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    const data = await response.json(); assert.equal(data.apis.length, apiCatalog.length); assert.ok(data.apis.length > 30); assert.equal(new Set(data.apis.map(item => item.id)).size, data.apis.length); assert.equal(data.release.synchronized, true);
    assert.equal(data.apis.find(item => item.id === 'drive').status, 'configured'); assert.equal(data.apis.some(item => item.id === 'resend'), false); assert.equal(data.apis.find(item => item.id === 'github').status, 'public');
    assert.ok(data.apis.every(item => item.instances.length === item.scopes.length)); assert.deepEqual(external, ['integration_status']);
    assert.doesNotMatch(JSON.stringify(data), /must-not-leak|private-bridge-fixture|sb_secret_fixture|token_ciphertext/);
});
test('an older or unreachable companion preserves all rows without inventing provider availability', async () => {
    mode = 'old-system'; let data = await (await route.GET()).json(); assert.equal(data.companionAvailable, false); assert.equal(data.apis.length, apiCatalog.length);
    assert.equal(data.apis.find(item => item.id === 'met-norway').status, 'unknown'); assert.equal(data.apis.find(item => item.id === 'system-api').status, 'verified');
    mode = 'system-down'; data = await (await route.GET()).json(); assert.equal(data.release.synchronized, false); assert.equal(data.release.system, null); assert.equal(data.apis.find(item => item.id === 'system-api').status, 'unknown');
});
test('legacy failure, local paused settings and D1 failure remain distinct', async () => {
    await settings.savePlatformIntegration({ provider: 'github', enabled: false, fields: {}, expectedRevision: 0 }); mode = 'backend-down';
    let data = await (await route.GET()).json(); assert.equal(data.apis.find(item => item.id === 'github').status, 'paused'); assert.equal(data.apis.find(item => item.id === 'drive').status, 'unknown');
    f.runtime.DB = { prepare() { throw new Error('Unavailable D1'); } }; data = await (await route.GET()).json();
    assert.equal(data.apis.find(item => item.id === 'cloudflare-d1').instances.find(item => item.scope === 'control').status, 'unavailable'); assert.equal(data.apis.find(item => item.id === 'control-api').status, 'verified');
});
test('read-only diagnostics are explicit, allowlisted and independent by application', async () => {
    assert.equal((await post({ id: 'sentry', scope: 'control' })).status, 400); assert.equal((await post({ id: 'ocrspace', scope: 'control' })).status, 400);
    assert.equal((await post({ id: 'https://foreign.example', scope: 'system' })).status, 400); assert.equal((await post({ id: 'github', scope: 'system' })).status, 400);
    let value = await (await post({ id: 'github', scope: 'control' })).json(); assert.equal(value.observation.status, 'verified'); assert.deepEqual(external, ['github_rest_get']);
    value = await (await post({ id: 'brasilapi', scope: 'system' })).json(); assert.equal(value.observation.status, 'verified'); assert.equal(value.scope, 'system'); assert.doesNotMatch(JSON.stringify(value), /must-not-leak/);
    assert.equal((await post({ id: 'resend', scope: 'control' })).status,400); assert.ok(!external.includes('resend_send'));
    mode = 'system-down'; value = await (await post({ id: 'brasilapi', scope: 'system' })).json(); assert.equal(value.observation.status, 'unavailable'); assert.ok(value.observation.checkedAt);
});
test('administration and diagnostics require the owner, a trusted origin and an actual session', async () => {
    f.runtime.PLATFORM_OWNER_USER_ID = 'another'; f.runtime.PLATFORM_OWNER_EMAIL = 'another@example.test'; assert.equal((await route.GET()).status, 403); assert.equal((await post({ id: 'github', scope: 'control' })).status, 403); assert.equal(external.length, 0);
    f.runtime.PLATFORM_OWNER_EMAIL = f.user.email; assert.equal((await post({ id: 'github', scope: 'control' }, { origin: 'https://foreign.example' })).status, 403); assert.equal((await post({ id: 'github', scope: 'control', token: 'caller-value' })).status, 400); assert.equal(external.length, 0);
    globalThis.__operationUser = null; assert.equal((await route.GET()).status, 401);
});
test('invalid companion status data is rejected and extra fields never cross the boundary', () => {
    const value = model.normalizeApiObservations('system', { 'met-norway': { status: 'online', detail: 'Not a known state', checkedAt: null }, brasilapi: { status: 'verified', detail: 'Resposta confirmada.', checkedAt: 'invalid', credential: 'must-not-leak' } });
    assert.equal(value['met-norway'].status, 'unknown'); assert.equal(value.brasilapi.status, 'unknown'); assert.doesNotMatch(JSON.stringify(value), /must-not-leak/);
});
