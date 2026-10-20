import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

const descriptors = Object.fromEntries(['navigator', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { OperationMap } = await vite.ssrLoadModule('/app/operation-map.jsx');
let renderer, calls, cleared;
const current = () => new URL(renderer.root.findByType('iframe').props.src);
const currentPoint = () => current().searchParams.has('pin') ? `${current().searchParams.get('lat')},${current().searchParams.get('lon')}` : null;
const visible = () => JSON.stringify(renderer.toJSON());
const position = (latitude = -15.8, longitude = -47.9, accuracy = 25, timestamp = Date.now()) => ({ coords: { latitude, longitude, accuracy }, timestamp });
async function mount(props = {}) { await act(async () => { renderer = Renderer.create(React.createElement(OperationMap, props)); }); }
beforeEach(context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  calls = []; cleared = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: { watchPosition(success, failure, options) { const id = calls.length; calls.push({ success, failure, options }); return id; }, clearWatch(id) { cleared.push(id); } } } });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
after(async () => { await vite.close(); for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });

test('a real interactive map is visible before GPS responds and no location is invented', async () => {
  await mount();
  assert.equal(current().origin, 'https://embed.waze.com');
  assert.equal(current().searchParams.has('pin'), false);
  assert.equal(current().searchParams.get('zoom'), '4');
  assert.match(renderer.root.findByType('iframe').props.title, /Waze/);
  assert.equal(renderer.root.findAllByType('button').some(node => /Usar mapa/.test(node.props['aria-label'] || '')), false);
  assert.match(visible(), /Mapa do Brasil|Obtendo a localização/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.enableHighAccuracy, true);
  assert.equal(calls[0].options.timeout, 15000);
  assert.equal(calls[0].options.maximumAge, 0);
});

test('GPS permission centers the real map on returned coordinates and offers the same point in Waze', async () => {
  await mount(); await act(async () => calls[0].success(position()));
  assert.equal(currentPoint(), '-15.8,-47.9');
  assert.equal(current().searchParams.get('pin'), '1');
  assert.equal(current().searchParams.get('zoom'), '16');
  const external = new URL(renderer.root.findByType('a').props.href);
  assert.equal(external.origin, 'https://waze.com');
  assert.equal(external.searchParams.get('ll'), '-15.8,-47.9');
  assert.equal(external.searchParams.has('navigate'), false, 'viewing your own GPS position must not start a journey to yourself');
  assert.equal(renderer.root.findByType('iframe').props.referrerPolicy, 'no-referrer');
  assert.match(visible(), /Sua posição atual|25 m/);
  assert.deepEqual(cleared, [0]);
});

for (const [code, message] of [[1, /Permita a localização/], [2, /Verifique o GPS/], [3, /demorou para responder/]]) {
  test(`GPS failure ${code} retains a real map and lets the user retry`, async context => {
    await mount(); await act(async () => calls[0].failure({ code }));
    if (code !== 1) await act(async () => context.mock.timers.tick(45_000));
    assert.match(visible(), message);
    assert.equal(current().searchParams.has('pin'), false);
    const retry = renderer.root.findAllByType('button').find(node => node.children.some(child => child === 'Tentar localização'));
    assert.ok(retry); assert.equal(retry.props.disabled, false);
    await act(async () => retry.props.onClick());
    await act(async () => calls[1].success(position(-23.55, -46.63)));
    assert.equal(currentPoint(), '-23.55,-46.63');
  });
}

test('invalid device coordinates never create a marker', async context => {
  await mount(); await act(async () => calls[0].success(position(100, NaN)));
  await act(async () => context.mock.timers.tick(45_000));
  assert.match(visible(), /localização inválida/);
  assert.equal(current().searchParams.has('pin'), false);
});

test('a device without geolocation retains the interactive map', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  await mount(); assert.match(visible(), /Localização indisponível/);
  assert.equal(current().searchParams.has('pin'), false);
});

test('a late callback from the previous view cannot change the newly opened map', async () => {
  await mount(); const previous = calls[0];
  await act(async () => renderer.unmount()); renderer = null;
  assert.deepEqual(cleared, [0]);
  await mount(); await act(async () => previous.success(position()));
  assert.equal(current().searchParams.has('pin'), false);
  await act(async () => calls[1].success(position(-23.55, -46.63)));
  assert.equal(currentPoint(), '-23.55,-46.63');
});

test('the first coarse estimate continues refining until a fresh, accurate reading arrives', async () => {
  await mount();
  await act(async () => calls[0].success(position(-15, -47, 2500)));
  assert.equal(current().searchParams.has('pin'), false, 'a coarse network estimate must not be presented as device position');
  assert.match(visible(), /Obtendo uma leitura atual/);
  assert.equal(cleared.length, 0);
  await act(async () => calls[0].success(position(-15.79, -47.89, 200)));
  await act(async () => calls[0].success(position(-15.8, -47.9, 12)));
  assert.equal(currentPoint(), '-15.8,-47.9');
  assert.match(visible(), /Sua posição atual/);
  assert.deepEqual(cleared, [0]);
});

test('a less accurate reading cannot displace a better recent estimate', async () => {
  await mount();
  await act(async () => calls[0].success(position(-15.8, -47.9, 80)));
  await act(async () => calls[0].success(position(-15, -47, 900)));
  assert.equal(currentPoint(), '-15.8,-47.9');
});

test('an old cached position is discarded while fresh readings can still succeed', async () => {
  await mount();
  await act(async () => calls[0].success(position(-15, -47, 5, Date.now() - 30_000)));
  assert.equal(current().searchParams.has('pin'), false);
  assert.equal(cleared.length, 0);
  await act(async () => calls[0].success(position(-15.8, -47.9, 10)));
  assert.equal(currentPoint(), '-15.8,-47.9');
});

test('a bounded search reports approximation and the actual margin when the device stays coarse', async context => {
  await mount(); await act(async () => calls[0].success(position(-15.8, -47.9, 1200)));
  await act(async () => context.mock.timers.tick(45_000));
  assert.equal(current().searchParams.has('pin'), false);
  assert.match(visible(), /localização precisa/);
  assert.match(visible(), /1\.200/);
  const retry = renderer.root.findAllByType('button').find(node => node.children.some(child => child === 'Tentar localização'));
  assert.equal(retry.props.disabled, false);
  assert.deepEqual(cleared, [0]);
  await act(async () => retry.props.onClick());
  await act(async () => calls[1].success(position(-15.81, -47.91, 8)));
  assert.equal(currentPoint(), '-15.81,-47.91');
  // An already cancelled attempt cannot restore an obsolete point.
  await act(async () => calls[0].success(position(-15, -47, 1)));
  assert.equal(currentPoint(), '-15.81,-47.91');
});

test('transient failures do not stop subsequent GPS refinement', async () => {
  await mount(); await act(async () => calls[0].failure({ code: 3 }));
  assert.equal(cleared.length, 0);
  await act(async () => calls[0].success(position(-15.8, -47.9, 9)));
  assert.match(visible(), /Sua posição atual/);
  assert.deepEqual(cleared, [0]);
});

test('unknown accuracy is never described as precise and the watcher stops at the deadline', async context => {
  await mount(); await act(async () => calls[0].success(position(-15.8, -47.9, NaN)));
  await act(async () => context.mock.timers.tick(45_000));
  assert.equal(current().searchParams.has('pin'), false);
  assert.match(visible(), /imprecisa/);
  assert.deepEqual(cleared, [0]);
});

test('a worse current reading does not displace the best accepted fix during the bounded search', async context => {
  await mount(); await act(async () => calls[0].success(position(-15.8, -47.9, 60)));
  await act(async () => context.mock.timers.tick(11_000));
  await act(async () => calls[0].success(position(-15.82, -47.92, 100)));
  assert.equal(currentPoint(), '-15.8,-47.9');
});
