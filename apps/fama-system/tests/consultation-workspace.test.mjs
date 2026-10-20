import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
const originalAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { ConsultationWorkspace } = await vite.ssrLoadModule('/app/consultation-workspace.jsx');
let renderer, requests, defaults, postReply, geocodeReply, geocodeRequests;
const visible = () => JSON.stringify(renderer.toJSON());
const button = text => renderer.root.findAllByType('button').find(node => node.children.some(child => child === text));
const input = label => { const id = renderer.root.findAllByType('label').find(node => node.children.includes(label)).props.htmlFor; return renderer.root.findAllByType('input').find(node => node.props.id === id); };
async function change(label, value) { await act(async () => input(label).props.onChange({ target: { value } })); }
async function mount(props = {}) { await act(async () => { renderer = Renderer.create(React.createElement(ConsultationWorkspace, { organizationId: 'org-one', plan: 'profissional', compact: true, ...props })); }); await act(async () => button('Frete').props.onClick()); }
async function submit() { await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); }); }
beforeEach(() => {
  requests = [];
  geocodeRequests = []; geocodeReply = () => { throw new Error('Browser geocoding unavailable in fallback fixture'); };
  defaults = { originCep: '72505101', rateCentsPerKm: 1000, routingConfigured: true };
  postReply = () => Response.json({ originCep: requests.at(-1).body.originCep.replace(/\D/g, ''), destinationCep: '01311000', distanceKm: 25.5, rateCentsPerKm: defaults.rateCentsPerKm, totalCents: Math.round(25.5 * defaults.rateCentsPerKm), source: 'brouter' });
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('https://cep.awesomeapi.com.br/json/')) {
      const headers = new Headers(init.headers);
      assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer'); assert.equal(init.redirect, 'error');
      assert.equal(headers.get('authorization'), null); assert.equal(headers.get('cookie'), null); assert.equal(headers.get('x-organization-id'), null);
      geocodeRequests.push(url); return geocodeReply(url);
    }
    assert.equal(url, '/api/freight');
    const method = init.method ?? 'GET', body = init.body ? JSON.parse(init.body) : null;
    requests.push({ method, body, organizationId: new Headers(init.headers).get('x-organization-id') });
    if (method === 'GET') return Response.json(defaults);
    if (method === 'PATCH') { defaults = { ...defaults, originCep: body.originCep.replace(/\D/g, ''), rateCentsPerKm: body.rateCentsPerKm }; return Response.json(defaults); }
    assert.equal(method, 'POST'); return postReply();
  };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { await vite.close(); globalThis.fetch = originalFetch; if (originalAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalAct); else delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

test('two CEPs request automatic driving km and a server-priced freight estimate', async () => {
  await mount();
  assert.equal(renderer.root.findAllByType('input').length, 2);
  assert.doesNotMatch(visible(), /Rota automática não configurada|KM manual|Distância \(km\)|Já sei a distância/);
  assert.equal(renderer.root.findByType('details').props.open, undefined, 'origin and tariff start collapsed');
  assert.equal(input('CEP de origem').props.value, '72505-101');
  await change('CEP de destino', '01311000');
  assert.equal(requests.filter(value => value.method === 'POST').length, 0);
  await submit();
  assert.deepEqual(requests.at(-1).body, { originCep: '72505-101', destinationCep: '01311-000' });
  const maps = new URL(renderer.root.findAllByType('a').find(node => node.props.href.startsWith('https://www.google.com/')).props.href);
  assert.equal(maps.searchParams.get('origin'), '72505-101, Brasil');
  assert.equal(maps.searchParams.get('destination'), '01311-000, Brasil');
  assert.match(visible(), /Frete estimado/); assert.match(visible(), /255,00/);
  assert.match(visible(), /25,5.*km de carro/);
  assert.equal(requests.filter(value => value.method === 'POST').length, 1);
  await change('CEP de destino', '01001000');
  assert.doesNotMatch(visible(), /255,00/);
});

test('administrators can save only the origin and tariff within the card', async () => {
  await mount({ onConfigure() {} });
  await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Alterar origem e tarifa').props.onClick());
  await change('CEP de saída', '01001000'); await change('Valor por km (R$)', '12,50');
  await submit();
  assert.deepEqual(requests.at(-1), { method: 'PATCH', organizationId: 'org-one', body: { originCep: '01001-000', rateCentsPerKm: 1250 } });
  assert.doesNotMatch(visible(), /Origem e tarifa da empresa/);
  await change('CEP de destino', '01311000'); await submit();
  assert.match(visible(), /318,75/);
});

test('changing the trip origin sends both CEPs without overwriting company defaults', async () => {
  await mount();
  await change('CEP de origem', '01001000');
  await change('CEP de destino', '01311000'); await submit();
  assert.deepEqual(requests.at(-1).body, { originCep: '01001-000', destinationCep: '01311-000' });
  assert.equal(defaults.originCep, '72505101');
  assert.equal(requests.filter(value => value.method === 'PATCH').length, 0);
  assert.match(visible(), /Frete estimado/); assert.match(visible(), /255,00/);
  await change('CEP de origem', '01002000'); assert.doesNotMatch(visible(), /255,00/);
});

test('normal users cannot edit defaults and a company switch discards the old estimate', async () => {
  await mount();
  assert.equal(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === 'Alterar origem e tarifa'), false);
  await change('CEP de destino', '01311000');
  let release;
  postReply = () => new Promise(resolve => { release = resolve; });
  let pending;
  await act(async () => { pending = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await Promise.resolve(); });
  defaults = { originCep: '01001000', rateCentsPerKm: 2000, routingConfigured: true };
  await act(async () => renderer.update(React.createElement(ConsultationWorkspace, { organizationId: 'org-two', plan: 'profissional', compact: true })));
  await act(async () => { release(Response.json({ distanceKm: 25, totalCents: 25000, rateCentsPerKm: 1000, source: 'brouter' })); await pending; });
  assert.equal(input('CEP de destino').props.value, '');
  assert.equal(input('CEP de origem').props.value, '01001-000');
  assert.doesNotMatch(visible(), /250,00/);
  assert.equal(requests.at(-1).organizationId, 'org-two');
});

test('a failed automatic route shows an error without asking for km or inventing a price', async () => {
  postReply = () => Response.json({ error: 'Não foi encontrada uma rota de carro entre os CEPs.' }, { status: 422 });
  await mount(); await change('CEP de destino', '01311000'); await submit();
  assert.match(visible(), /Não foi encontrada uma rota/);
  assert.equal(renderer.root.findAllByType('input').length, 2);
  assert.doesNotMatch(visible(), /255,00|Distância \(km\)/);
});

test('the reported CEP pair is located automatically in the browser and submitted for server routing', async () => {
  geocodeReply = url => {
    const cep = url.split('/').at(-1), origin = cep === '72505101';
    return Response.json({ cep, city: 'Brasília', state: 'DF', address: origin ? 'Quadra AC 105 Conjunto A' : 'Rodovia DF-290 km 21', lat: origin ? '-16.0281844' : '-15.7942287', lng: origin ? '-48.0331644' : '-47.8821658' });
  };
  await mount(); await change('CEP de destino', '72415990'); await submit();
  const body = requests.at(-1).body;
  assert.equal(body.originCep, '72505-101'); assert.equal(body.destinationCep, '72415-990');
  assert.equal(body.locations.origin.cep, '72505101'); assert.equal(body.locations.destination.cep, '72415990');
  assert.equal(body.locations.origin.latitude, -16.0281844); assert.equal(body.locations.destination.longitude, -47.8821658);
  assert.equal(body.manualDistanceKm, undefined); assert.equal(body.rateCentsPerKm, undefined);
  assert.equal(geocodeRequests.length, 2); assert.match(visible(), /255,00/);
});
