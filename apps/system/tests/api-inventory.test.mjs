import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { operationalFixture } from './operational-fixture.mjs';
import { apiCatalog } from '../lib/api-catalog.js';
const f = await operationalFixture(new URL('../', import.meta.url).pathname);
const route = await f.load('/app/api/internal/api-status/route.js');
let sql, probes, failure;
function database() {
    sql = new DatabaseSync(':memory:');
    sql.exec('CREATE TABLE organization_settings(organization_id TEXT,settings_json TEXT)');
    sql.prepare('INSERT INTO organization_settings VALUES (?,?)').run('private-org-id', JSON.stringify({ fiscalProvider: 'asaas', fiscalApiToken: 'private-fiscal-token', legalName: 'Private customer name' }));
    return { prepare(query) { const statement = sql.prepare(query); let args = []; const api = { bind(...values) { args = values; return api; }, async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; }, async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; } }; return api; } };
}
beforeEach(() => {
    sql?.close(); f.reset(); f.runtime.DB = database(); f.runtime.FAMA_DATA_BRIDGE_SECRET = 'private-bridge-fixture'; probes = []; failure = false;
    f.tables.bank_connections = [{ id: 'private-bank', provider: 'asaas', encrypted_item_id: 'private-bank-key' }];
    f.tables.fama_whatsapp_connections = [{ verified_at: '2026-10-20T00:00:00Z', token_ciphertext: 'private-meta-token' }];
    const delegated = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        if (String(url).startsWith('https://brasilapi.com.br/')) {
            probes.push({ url, init }); assert.equal(init.method || 'GET', 'GET'); assert.equal(init.redirect, 'manual');
            return failure ? new Response('Unavailable', { status: 503 }) : Response.json({ code: 1, name: 'Banco do Brasil' });
        }
        return delegated(url, init);
    };
});
after(async () => { sql?.close(); await f.close(); });
const request = (method, body, authorized = true) => f.request(method, '/api/internal/api-status', body, authorized ? { authorization: 'Bearer private-bridge-fixture' } : {});
test('System inventory is internal and requires the bridge secret before reading any data', async () => {
    assert.equal((await route.GET(request('GET', undefined, false))).status, 401); assert.equal((await route.POST(request('POST', { id: 'brasilapi' }, false))).status, 401); assert.equal(f.calls.length, 0); assert.equal(probes.length, 0);
});
test('System reports all its integrations using configuration and safe aggregate counts', async () => {
    const response = await route.GET(request('GET')); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/); const data = await response.json();
    assert.deepEqual(Object.keys(data.observations).sort(), apiCatalog.filter(item => item.scopes.includes('system')).map(item => item.id).sort());
    assert.equal(data.observations['cloudflare-d1'].status, 'verified'); assert.equal(data.observations['asaas-fiscal'].status, 'configured'); assert.equal(data.observations['meta-whatsapp'].status, 'configured'); assert.equal(data.observations['asaas-finance'].status, 'configured');
    assert.equal(data.observations.brasilapi.status, 'public'); assert.equal(data.observations.scanner.status, 'device'); assert.equal(data.observations['asaas-billing'].status, 'unconfigured'); assert.equal(probes.length, 0); assert.equal(f.businessWrites().length, 0);
    assert.doesNotMatch(JSON.stringify(data), /private-org|private-fiscal|private-bank|private-meta|Private customer|sb_secret|private-bridge/);
});
test('a local database outage leaves independent public integrations and configuration visible', async () => {
    f.runtime.DB = { prepare() { throw new Error('Unavailable D1'); } };
    const data = await (await route.GET(request('GET'))).json(); assert.equal(data.observations['cloudflare-d1'].status, 'unavailable'); assert.equal(data.observations.brasilapi.status, 'public'); assert.equal(data.observations['asaas-fiscal'].status, 'unknown');
});
test('only explicit safe probes are accepted, provider failure is never reported online', async () => {
    for (const id of ['resend','sentry','ocrspace','scanner','https://foreign.example']) assert.equal((await route.POST(request('POST', { id }))).status, 400);
    assert.equal((await route.POST(request('POST', { id: 'brasilapi', url: 'https://foreign.example' }))).status, 400); assert.equal(probes.length, 0);
    let data = await (await route.POST(request('POST', { id: 'brasilapi' }))).json(); assert.equal(data.observation.status, 'verified'); assert.equal(probes.length, 1); assert.ok(data.observation.checkedAt);
    failure = true; data = await (await route.POST(request('POST', { id: 'brasilapi' }))).json(); assert.equal(data.observation.status, 'unavailable'); assert.equal(probes.length, 2); assert.equal(f.businessWrites().length, 0);
});
