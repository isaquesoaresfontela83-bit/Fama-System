import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { operationalFixture } from './operational-fixture.mjs';

const f = await operationalFixture(new URL('..', import.meta.url).pathname);
const route = await f.load('/app/api/freight/route.js');
const company = await f.load('/app/api/company-settings/route.js');
const { calculateFreight, parseDistanceKm, freightDirectionsUrl } = await f.load('/lib/freight.js');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE organization_settings (organization_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)');
let providers, reply, writes;
const d1 = {
  prepare(sql) {
    const statement = sqlite.prepare(sql); let values = [];
    const result = {
      bind(...next) { values = next; return result; },
      async first() { return statement.get(...values) ?? null; },
      async run() { const changes = statement.run(...values).changes; if (changes && /^(INSERT|UPDATE|DELETE)\s/i.test(sql)) writes.push({ sql, values }); return { meta: { changes: Number(changes) } }; },
    };
    return result;
  },
};
const estimate = (extra = {}, headers) => route.POST(f.request('POST', '/api/freight', { originCep: '01001-000', destinationCep: '01311-000', ...extra }, headers));
const settings = () => JSON.parse(sqlite.prepare('SELECT settings_json FROM organization_settings WHERE organization_id = ?').get('org-one').settings_json);
const saveSettings = value => sqlite.prepare('INSERT OR REPLACE INTO organization_settings VALUES (?, ?, ?)').run('org-one', JSON.stringify(value), new Date().toISOString());
function vendorPayload(url) {
  if (url.hostname === 'routes.fixture.test') return { code: 'Ok', routes: [{ distance: 42000 }] };
  if (url.hostname === 'brouter.de') return { type: 'FeatureCollection', features: [{ properties: { 'track-length': '42000' }, geometry: { type: 'LineString', coordinates: [[-46.63, -23.55], [-46.65, -23.55]] } }] };
  const cep = url.pathname.split('/').at(-1);
  if (url.hostname === 'cep.awesomeapi.com.br') return { cep, address: 'Endereço público', district: 'Centro', city: 'São Paulo', state: 'SP', lat: '-23.55', lng: cep === '01001000' ? '-46.63' : '-46.65' };
  return { cep, street: 'Endereço público', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', location: { coordinates: { latitude: '-23.55', longitude: cep === '01001000' ? '-46.63' : '-46.65' } } };
}
function xmlAddress(url, latitude = '-23.55', longitude = url.pathname.endsWith('01001000') ? '-46.63' : '-46.65') {
  const cep = url.pathname.split('/').at(-1);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><xml><cep>${cep}</cep><address>Endereço público</address><district>Centro</district><city>São Paulo</city><state>SP</state><lat>${latitude}</lat><lng>${longitude}</lng></xml>`, { headers: { 'Content-Type': 'application/xml' } });
}
beforeEach(() => {
  f.reset();
  f.runtime.DB = d1;
  f.runtime.FAMA_ROUTING_BASE_URL = 'https://routes.fixture.test';
  sqlite.exec('DELETE FROM organization_settings');
  saveSettings({ freightOriginCep: '01001000', freightRateCentsPerKm: 350, fiscalApiToken: 'private-company-secret' });
  providers = []; writes = []; reply = url => Response.json(vendorPayload(url));
  const databaseFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (['brasilapi.com.br', 'cep.awesomeapi.com.br', 'brouter.de', 'routes.fixture.test'].includes(url.hostname)) {
      assert.equal(url.protocol, 'https:');
      assert.equal(init.redirect, 'manual');
      assert.equal(new Headers(init.headers).get('authorization'), null);
      assert.equal(new Headers(init.headers).get('cookie'), null);
      providers.push(url); return reply(url);
    }
    return databaseFetch(input, init);
  };
});
after(async () => { await f.close(); sqlite.close(); });

test('consultation receives only the active company tariff and origin', async () => {
  const response = await route.GET(f.request('GET', '/api/freight'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { originCep: '01001000', rateCentsPerKm: 350, routingConfigured: true });
  assert.equal(providers.length, 0);
  assert.equal(f.businessWrites().length, 0);
  assert.equal(writes.length, 0);
});

test('a driving route converts meters to km and uses the saved company rate', async () => {
  const response = await estimate();
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const result = await response.json();
  assert.equal(result.source, 'osrm');
  assert.equal(result.originCep, '01001000');
  assert.equal(result.destinationCep, '01311000');
  assert.equal(result.distanceKm, 42);
  assert.equal(result.rateCentsPerKm, 350);
  assert.equal(result.totalCents, 14700);
  const driving = providers.find(url => url.hostname === 'routes.fixture.test');
  assert.match(driving.pathname, /^\/route\/v1\/driving\/-46\.63,-23\.55;-46\.65,-23\.55$/);
  assert.equal(f.businessWrites().length, 0, 'estimating must not create a payment or customer');
  assert.equal(writes.length, 0);
});

const browserLocations = () => ({ origin: { cep: '01001000', latitude: -23.55, longitude: -46.63, address: 'Praça da Sé · São Paulo/SP' }, destination: { cep: '01311000', latitude: -23.56, longitude: -46.65, address: 'Avenida Paulista · São Paulo/SP' } });

test('browser CEP coordinates avoid the blocked server geocoder while driving km and pricing stay on the server', async () => {
  const response = await estimate({ locations: browserLocations() }); assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const result = await response.json(); assert.equal(result.distanceKm, 42); assert.equal(result.rateCentsPerKm, 350); assert.equal(result.totalCents, 14700);
  assert.equal(providers.length, 1); assert.equal(providers[0].hostname, 'routes.fixture.test');
  assert.match(providers[0].pathname, /-46\.63,-23\.55;-46\.65,-23\.56/);
  assert.equal(f.businessWrites().length, 0); assert.equal(writes.length, 0);
});

test('mismatched, coincident, malformed or foreign browser locations never produce a route or a price', async () => {
  const invalid = [null, [], { ...browserLocations(), url: 'https://attacker.test' }];
  for (const change of [{ cep: '99999999' }, { latitude: '0' }, { longitude: 0 }, { address: '' }, { address: 'x'.repeat(301) }, { token: 'secret' }, { latitude: -23.55, longitude: -46.63 }]) {
    const locations = browserLocations(); Object.assign(locations.destination, change); invalid.push(locations);
  }
  for (const locations of invalid) { const response = await estimate({ locations }); assert.equal(response.status, 400); assert.equal((await response.json()).totalCents, undefined); }
  assert.equal((await estimate({ locations: browserLocations(), manualDistanceKm: 1 })).status, 400);
  assert.equal(providers.length, 0); assert.equal(f.businessWrites().length, 0);
});

test('legacy manual requests remain compatible without affecting automatic routing', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  reply = url => { const payload = vendorPayload(url); delete payload.location; return Response.json(payload); };
  const response = await estimate({ manualDistanceKm: 42 });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, 'manual'); assert.equal(result.totalCents, 14700);
  assert.equal(providers.length, 2);
  assert.ok(providers.every(url => url.hostname === 'cep.awesomeapi.com.br'));
});

test('invalid explicit routing or missing tariff never produces an invented estimate', async () => {
  for (const value of ['http://routes.fixture.test', 'https://127.0.0.1', 'https://router.project-osrm.org']) {
    f.runtime.FAMA_ROUTING_BASE_URL = value;
    assert.equal((await route.GET(f.request('GET', '/api/freight')).then(response => response.json())).routingConfigured, false);
    assert.equal((await estimate()).status, 503);
  }
  saveSettings({ ...settings(), freightRateCentsPerKm: 0 });
  assert.equal((await estimate({ manualDistanceKm: 42 })).status, 422);
  assert.equal(providers.length, 0);
});

test('invalid distances, malformed CEPs and client-supplied rates are rejected before providers', async () => {
  for (const body of [
    { originCep: '123' }, { destinationCep: '01001000?callback=x' },
    { manualDistanceKm: -1 }, { manualDistanceKm: 10001 }, { manualDistanceKm: '42' }, { manualDistanceKm: null },
    { rateCentsPerKm: 1 }, { routingUrl: 'https://attacker.fixture.test' },
  ]) assert.equal((await estimate(body)).status, 400);
  assert.equal(providers.length, 0);
});

test('company access and consultation permission are checked before any CEP request', async () => {
  globalThis.__operationUser = null; assert.equal((await estimate()).status, 401);
  globalThis.__operationUser = f.user;
  assert.equal((await estimate({}, { Origin: 'https://attacker.fixture.test' })).status, 403);
  assert.equal((await estimate({}, { 'x-organization-id': 'org-two' })).status, 403);
  f.member().role = 'member'; f.member().permissions = [];
  assert.equal((await estimate()).status, 403);
  f.member().role = 'owner'; f.rules.organization.overrides.customers = false;
  assert.equal((await estimate()).status, 403);
  assert.equal(providers.length, 0);
});

test('missing coordinates, mismatched CEPs and invalid driving routes return useful errors', async () => {
  reply = url => { const payload = vendorPayload(url); delete payload.location; delete payload.lat; delete payload.lng; return Response.json(payload); };
  assert.equal((await estimate()).status, 422);
  assert.ok(providers.every(url => url.hostname !== 'routes.fixture.test'));
  reply = () => Response.json({ cep: '00000000', city: 'São Paulo', state: 'SP' });
  assert.equal((await estimate()).status, 502);
  for (const payload of [{ code: 'NoRoute' }, { code: 'Ok', routes: [{ distance: -1 }] }, { code: 'Ok', routes: [{ distance: '42000' }] }]) {
    reply = url => Response.json(url.hostname === 'routes.fixture.test' ? payload : vendorPayload(url));
    assert.equal((await estimate()).status, 422);
  }
  assert.equal(f.businessWrites().length, 0);
});

test('without company routing configuration the public car route calculates km from two CEPs', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  assert.equal((await route.GET(f.request('GET', '/api/freight')).then(response => response.json())).routingConfigured, true);
  const response = await estimate();
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const result = await response.json();
  assert.equal(result.source, 'brouter'); assert.equal(result.distanceKm, 42); assert.equal(result.totalCents, 14700);
  const driving = providers.find(url => url.hostname === 'brouter.de');
  assert.equal(driving.searchParams.get('lonlats'), '-46.63,-23.55|-46.65,-23.55');
  assert.equal(driving.searchParams.get('profile'), 'car-fast');
  assert.equal(f.businessWrites().length, 0); assert.equal(writes.length, 0);
  const shared = f.calls.filter(call => call.url.pathname.endsWith('fama_consume_rate_limit') && call.body.p_action === 'freight_brouter_shared');
  assert.equal(shared.length, 1); assert.equal(shared[0].body.p_limit, 1); assert.equal(shared[0].body.p_window_seconds, 3);
});

test('automatic routing falls back to the second CEP source when street coordinates are missing', async () => {
  reply = url => { const payload = vendorPayload(url); if (url.hostname === 'cep.awesomeapi.com.br') { delete payload.lat; delete payload.lng; } return Response.json(payload); };
  const response = await estimate(); assert.equal(response.status, 200);
  assert.equal((await response.json()).distanceKm, 42);
  assert.equal(providers.filter(url => url.hostname === 'brasilapi.com.br').length, 2);
});

test('the documented XML CEP source restores street coordinates when JSON requests are blocked', async () => {
  reply = url => url.hostname === 'cep.awesomeapi.com.br'
    ? url.pathname.startsWith('/xml/') ? xmlAddress(url) : Response.json({ error: 'blocked' }, { status: 403 })
    : Response.json(vendorPayload(url));
  const response = await estimate(); assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const result = await response.json(); assert.equal(result.originCep, '01001000'); assert.equal(result.distanceKm, 42); assert.equal(result.totalCents, 14700);
  assert.equal(providers.filter(url => url.hostname === 'brasilapi.com.br').length, 0);
  assert.equal(providers.filter(url => url.pathname.startsWith('/xml/')).length, 2);
});

test('two different CEPs at the same city centre are relocated before requesting a road route', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  reply = url => {
    if (url.hostname === 'cep.awesomeapi.com.br' && url.pathname.startsWith('/xml/')) return url.pathname.endsWith('72505101') ? xmlAddress(url, '-16.0281844', '-48.0331644') : xmlAddress(url, '-15.7942287', '-47.8821658');
    if (url.hostname === 'brouter.de') return Response.json({ type: 'FeatureCollection', features: [{ properties: { 'track-length': '34809' }, geometry: { type: 'LineString', coordinates: [[-48.033166, -16.028188], [-47.882145, -15.794237]] } }] });
    const payload = vendorPayload(url); payload.lat = '-15.77972'; payload.lng = '-47.92972'; return Response.json(payload);
  };
  const response = await estimate({ originCep: '72505-101', destinationCep: '72415-990' }); assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const result = await response.json(); assert.equal(result.distanceKm, 34.81); assert.equal(result.totalCents, 12184);
  assert.equal(providers.find(url => url.hostname === 'brouter.de').searchParams.get('lonlats'), '-48.0331644,-16.0281844|-47.8821658,-15.7942287');
});

test('identical city-centre coordinates from every source never produce a false road route', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  reply = url => {
    if (url.pathname.startsWith('/xml/')) return xmlAddress(url, '-15.77972', '-47.92972');
    const payload = vendorPayload(url); payload.lat = '-15.77972'; payload.lng = '-47.92972'; return Response.json(payload);
  };
  const response = await estimate(); assert.equal(response.status, 422); assert.equal((await response.json()).totalCents, undefined);
  assert.equal(providers.filter(url => ['brouter.de', 'routes.fixture.test'].includes(url.hostname)).length, 0);
});

test('XML with external entities is rejected without expanding or fetching them', async () => {
  reply = url => url.hostname === 'cep.awesomeapi.com.br'
    ? url.pathname.startsWith('/xml/') ? new Response('<!DOCTYPE xml [<!ENTITY private SYSTEM "https://attacker.fixture.test/secret">]><xml><cep>&private;</cep></xml>') : Response.json({}, { status: 503 })
    : Response.json(vendorPayload(url));
  const response = await estimate(); assert.equal(response.status, 200); assert.equal((await response.json()).distanceKm, 42);
  assert.equal(providers.filter(url => url.hostname === 'brasilapi.com.br').length, 2);
});

test('GeoJSON waypoints do not hide the complete road route', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  reply = url => {
    const payload = vendorPayload(url);
    if (url.hostname === 'brouter.de') payload.features.unshift({ type: 'Feature', geometry: { type: 'Point', coordinates: [-46.63, -23.55] }, properties: { name: 'start' } });
    return Response.json(payload);
  };
  const response = await estimate(); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.distanceKm, 42); assert.equal(result.totalCents, 14700);
});

test('an incomplete cached road track is discarded and recalculated automatically', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches'), cache = new Map(), removed = [];
  let stale = true;
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    async match(request) {
      if (stale && decodeURIComponent(request.url).includes('https://brouter.de/')) return Response.json({ type: 'FeatureCollection', features: [{ properties: { 'track-length': '0' }, geometry: { type: 'LineString', coordinates: [[-46.63, -23.55]] } }] });
      return cache.get(request.url)?.clone();
    },
    async delete(request) { removed.push(request.url); stale = false; return cache.delete(request.url); },
    async put(request, response) { cache.set(request.url, response.clone()); },
  } } });
  try {
    const response = await estimate(); assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const result = await response.json(); assert.equal(result.distanceKm, 42); assert.equal(result.totalCents, 14700);
    assert.equal(removed.length, 1);
    assert.equal(providers.filter(url => url.hostname === 'brouter.de').length, 1);
    providers = [];
    assert.equal((await estimate()).status, 200); assert.equal(providers.length, 0);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor); else delete globalThis.caches; }
});

test('an incomplete live road track is never cached or turned into a zero price', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches'), cache = new Map();
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    async match(request) { return cache.get(request.url)?.clone(); },
    async put(request, response) { cache.set(request.url, response.clone()); },
  } } });
  try {
    reply = url => {
      const payload = vendorPayload(url);
      if (url.hostname === 'brouter.de') { payload.features[0].properties['track-length'] = '0'; payload.features[0].geometry.coordinates.pop(); }
      return Response.json(payload);
    };
    const failed = await estimate(); assert.equal(failed.status, 422); assert.equal((await failed.json()).totalCents, undefined);
    reply = url => Response.json(vendorPayload(url));
    const response = await estimate(); assert.equal(response.status, 200); assert.equal((await response.json()).distanceKm, 42);
    assert.equal(providers.filter(url => url.hostname === 'brouter.de').length, 2);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor); else delete globalThis.caches; }
});

test('invalid BRouter distances and public-provider quota exhaustion never return a price', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  for (const length of ['invalid', '-1', -1, '1e3', 0, '0', 10000001]) {
    reply = url => { const payload = vendorPayload(url); if (url.hostname === 'brouter.de') payload.features[0].properties['track-length'] = length; return Response.json(payload); };
    const response = await estimate(); assert.equal(response.status, 422); assert.equal((await response.json()).totalCents, undefined);
  }
  f.allowed = false;
  assert.equal((await estimate()).status, 429);
});

test('the same normalized CEP gives zero km without requesting a road route', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  const response = await estimate({ destinationCep: '01001000' });
  assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.distanceKm, 0); assert.equal(result.totalCents, 0);
  assert.equal(providers.length, 1); assert.equal(providers[0].hostname, 'cep.awesomeapi.com.br');
});

test('cached public route data still uses the current company tariff and avoids provider quota', async () => {
  delete f.runtime.FAMA_ROUTING_BASE_URL;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches'), cache = new Map();
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    async match(request) { return cache.get(request.url)?.clone(); },
    async put(request, response) { cache.set(request.url, response.clone()); },
  } } });
  try {
    assert.equal((await estimate()).status, 200);
    saveSettings({ ...settings(), freightRateCentsPerKm: 500 }); providers = [];
    const response = await estimate(); assert.equal(response.status, 200);
    assert.equal((await response.json()).totalCents, 21000);
    assert.equal(providers.length, 0);
    assert.equal(f.calls.filter(call => call.body?.p_action === 'freight_brouter_shared').length, 1);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor); else delete globalThis.caches; }
});

test('permissions revoked during routing prevent the estimate from being returned', { timeout: 5000 }, async () => {
  let release, reached;
  const started = new Promise(resolve => { reached = resolve; });
  reply = url => url.hostname === 'routes.fixture.test'
    ? new Promise(resolve => { release = () => resolve(Response.json(vendorPayload(url))); reached(); })
    : Response.json(vendorPayload(url));
  const pending = estimate(); await started;
  f.rules.organization.overrides.customers = false; release();
  const response = await pending;
  assert.equal(response.status, 403);
  assert.equal((await response.json()).totalCents, undefined);
});

test('company settings reject invalid tariff values and normalize formatted CEPs', async () => {
  for (const value of [{ freightOriginCep: 'invalid' }, { freightRateCentsPerKm: -1 }, { freightRateCentsPerKm: 1.5 }, { freightRateCentsPerKm: '350' }, { freightRateCentsPerKm: 1000001 }]) {
    const response = await company.POST(f.request('POST', '/api/company-settings', { settings: value }));
    assert.equal(response.status, 400);
  }
  assert.equal(f.businessWrites().length, 0);
  assert.equal(writes.length, 0);
  const response = await company.POST(f.request('POST', '/api/company-settings', { settings: { freightOriginCep: '01001-000', freightRateCentsPerKm: 350 } }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).settings.freightOriginCep, '01001000');
  assert.equal(settings().freightRateCentsPerKm, 350);
  assert.equal(writes.length, 1);
});

test('billing rounds the displayed distance before multiplying and rejects non-finite values', () => {
  assert.deepEqual(calculateFreight(42, 350), { distanceKm: 42, totalCents: 14700 });
  assert.deepEqual(calculateFreight(12.345, 350), { distanceKm: 12.35, totalCents: 4323 });
  assert.deepEqual(calculateFreight(0, 350), { distanceKm: 0, totalCents: 0 });
  for (const distance of [NaN, Infinity, -1, 10001]) assert.throws(() => calculateFreight(distance, 350));
  for (const rate of [0, -1, 1.5, Infinity, 1000001]) assert.throws(() => calculateFreight(42, rate));
});

test('calculating with just the destination uses the saved company origin', async () => {
  const response = await estimate({ originCep: undefined });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.originCep, '01001000');
  assert.equal(result.totalCents, 14700);
  assert.equal((await estimate({ originCep: null })).status, 400);
});

test('saving freight defaults preserves all other company settings and credentials', async () => {
  const previous = { ...settings(), legalName: 'Empresa original', quoteTerms: 'Condições preservadas', address: 'Endereço cadastrado', fiscalProvider: 'asaas' };
  saveSettings(previous);
  const response = await route.PATCH(f.request('PATCH', '/api/freight', { originCep: '72505-101', rateCentsPerKm: 1000 }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.deepEqual(await response.json(), { originCep: '72505101', rateCentsPerKm: 1000, routingConfigured: true });
  assert.deepEqual(settings(), { ...previous, freightOriginCep: '72505101', freightRateCentsPerKm: 1000 });
  assert.equal(writes.length, 1);
  assert.equal(providers.length, 0);
});

test('only a company administrator can save valid freight defaults in their own organization', async () => {
  const body = { originCep: '72505-101', rateCentsPerKm: 1000 };
  const patch = (value = body, headers = {}) => route.PATCH(f.request('PATCH', '/api/freight', value, headers));
  globalThis.__operationUser = null; assert.equal((await patch()).status, 401);
  globalThis.__operationUser = f.user;
  f.member().role = 'member'; f.member().permissions = ['customers']; assert.equal((await patch()).status, 403);
  f.member().role = 'owner';
  assert.equal((await patch(body, { 'x-organization-id': 'org-two' })).status, 403);
  assert.equal((await patch(body, { Origin: 'https://attacker.fixture.test' })).status, 403);
  for (const value of [{ ...body, rateCentsPerKm: 0 }, { ...body, rateCentsPerKm: 1.5 }, { ...body, rateCentsPerKm: 1_000_001 }, { ...body, originCep: '123' }, { ...body, fiscalApiToken: 'overwrite' }]) assert.equal((await patch(value)).status, 400);
  assert.equal(writes.length, 0);
  assert.equal(providers.length, 0);
});

test('manual km accepts Brazilian decimal notation and a pasted unit without changing billing', () => {
  assert.equal(parseDistanceKm('25,5'), 25.5);
  assert.equal(parseDistanceKm('25,5 km'), 25.5);
  assert.equal(parseDistanceKm('1.234,5 km'), 1234.5);
  assert.equal(parseDistanceKm('25.5'), 25.5);
  for (const value of ['', 'km', '-2', '10001', '1e3', '15/2', '12,3,4']) assert.equal(parseDistanceKm(value), null);
  assert.deepEqual(calculateFreight(parseDistanceKm('25,5 km'), 1000), { distanceKm: 25.5, totalCents: 25500 });
});

test('Google Maps receives the saved origin and destination as an explicit driving route', () => {
  const url = new URL(freightDirectionsUrl('72505101', '01311-000'));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('origin'), '72505-101, Brasil');
  assert.equal(url.searchParams.get('destination'), '01311-000, Brasil');
  assert.equal(url.searchParams.get('travelmode'), 'driving');
  assert.equal(freightDirectionsUrl('72505101', ''), null);
});

test('CEP quota skips XML and subsequent requests to the same throttled provider',async()=>{
 reply=url=>url.hostname==='cep.awesomeapi.com.br'?Response.json({error:'busy'},{status:429,headers:{'Retry-After':'60'}}):Response.json(vendorPayload(url));
 let response=await estimate();assert.equal(response.status,200);assert.equal((await response.json()).totalCents,14700);assert.equal(providers.filter(u=>u.pathname.startsWith('/xml/')).length,0);
 providers=[];response=await estimate();assert.equal(response.status,200);assert.equal((await response.json()).distanceKm,42);assert.equal(providers.filter(u=>u.hostname==='cep.awesomeapi.com.br').length,0);
});

test('OpenRouteService uses the current HeiGIT endpoint and a server-only key, returning road time and distance',async()=>{
 f.runtime.FAMA_OPENROUTESERVICE_API_KEY='server-only-ors-fixture';
 const previous=globalThis.fetch;let request;
 globalThis.fetch=async(input,init)=>{const url=new URL(String(input));if(url.hostname==='api.heigit.org'){request={url,init};return Response.json({routes:[{summary:{distance:12345,duration:1860}}]});}return previous(input,init);};
 try{
  const response=await estimate();assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.source,'openrouteservice');assert.equal(data.distanceKm,12.35);assert.equal(data.durationMinutes,31);assert.equal(data.totalCents,4323);
  assert.equal(request.url.href,'https://api.heigit.org/openrouteservice/v2/directions/driving-car/json');
  assert.equal(request.init.method,'POST');assert.equal(request.init.redirect,'manual');
  assert.equal(new Headers(request.init.headers).get('Authorization'),'server-only-ors-fixture');assert.equal(new Headers(request.init.headers).get('Cookie'),null);
  assert.deepEqual(JSON.parse(request.init.body).coordinates,[[-46.63,-23.55],[-46.65,-23.55]]);
  assert.doesNotMatch(JSON.stringify(data),/server-only-ors-fixture|apiKey|Authorization/);
 }finally{delete f.runtime.FAMA_OPENROUTESERVICE_API_KEY;globalThis.fetch=previous;}
});
test('OpenRouteService surfaces quota and invalid route failures instead of inventing a billable distance',async()=>{
 f.runtime.FAMA_OPENROUTESERVICE_API_KEY='server-only-ors-fixture';const previous=globalThis.fetch;let mode='quota';
 globalThis.fetch=async(input,init)=>new URL(String(input)).hostname==='api.heigit.org'?mode==='quota'?new Response('{}',{status:429}):Response.json({routes:[{summary:{distance:-1,duration:200}}]}):previous(input,init);
 try{assert.equal((await estimate()).status,429);mode='invalid';assert.equal((await estimate()).status,422);assert.equal(writes.length,0);}finally{delete f.runtime.FAMA_OPENROUTESERVICE_API_KEY;globalThis.fetch=previous;}
});
