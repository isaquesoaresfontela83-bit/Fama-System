import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { wazeMapUrl, wazeNavigationUrl } from '../lib/waze.js';

const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { WazeLink, WazeNavigation } = await vite.ssrLoadModule('/app/waze-navigation.jsx');
const { FieldConditions } = await vite.ssrLoadModule('/app/field-conditions.jsx');
const originalFetch = globalThis.fetch;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let view;
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; globalThis.fetch = originalFetch; });
after(async () => { await vite.close(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const navigation = () => view.root.findAllByType('a').filter(node => node.props['aria-label'] === 'Abrir navegação no Waze');
const button = text => view.root.findAllByType('button').find(node => node.children.includes(text));

test('official navigation opens the confirmed coordinates and encodes Brazilian addresses safely', () => {
    const precise = new URL(wazeNavigationUrl({ latitude: -15.81, longitude: -47.91, source: 'manual', address: 'Referência' }));
    assert.equal(precise.origin + precise.pathname, 'https://waze.com/ul');
    assert.equal(precise.searchParams.get('ll'), '-15.81,-47.91');
    assert.equal(precise.searchParams.get('navigate'), 'yes');
    assert.equal(precise.searchParams.get('utm_source'), 'fama_system');
    const address = 'Rua São João, 10 & fundos #2, Brasília - DF';
    const search = new URL(wazeNavigationUrl(address));
    assert.equal(search.searchParams.get('q'), address);
    assert.equal([...search.searchParams].length, 3);
});

test('a CEP region cannot become a precise customer destination', () => {
    const destination = { latitude: -15.8, longitude: -47.9, source: 'cep', address: 'Rua do cliente, 123, Brasília - DF' };
    const href = new URL(wazeNavigationUrl(destination));
    assert.equal(href.searchParams.has('ll'), false);
    assert.equal(href.searchParams.get('q'), destination.address);
    assert.equal(wazeNavigationUrl({ ...destination, address: '' }), null);
    const map = new URL(wazeMapUrl(destination));
    assert.equal(map.searchParams.get('pin'), '0');
});

test('missing and invalid positions never navigate to invented zero coordinates', () => {
    for (const destination of [null, undefined, '', '  ', {}, { latitude: null, longitude: '' }, { latitude: NaN, longitude: 2 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }]) {
        assert.equal(wazeNavigationUrl(destination), null);
        assert.equal(wazeMapUrl(destination), null);
    }
    assert.equal(new URL(wazeNavigationUrl({ latitude: 0, longitude: 0 })).searchParams.get('ll'), '0,0');
});

test('the official Waze map loads only on request and follows the newly selected point', async () => {
    const props = { point: { latitude: -15.81, longitude: -47.91, source: 'manual' }, address: 'Rua A, 10', label: 'Atendimento A' };
    await act(async () => { view = Renderer.create(React.createElement(WazeNavigation, props)); });
    assert.equal(view.root.findAllByType('iframe').length, 0);
    assert.equal(navigation()[0].props.rel, 'noopener noreferrer');
    await act(async () => button('Ver trânsito no Waze').props.onClick());
    const frame = () => view.root.findByType('iframe');
    assert.equal(new URL(frame().props.src).origin, 'https://embed.waze.com');
    assert.equal(frame().props.referrerPolicy, 'no-referrer');
    assert.equal(frame().props.src.includes('Atendimento'), false);
    await act(async () => view.update(React.createElement(WazeNavigation, { ...props, point: { latitude: -23.55, longitude: -46.63, source: 'manual' } })));
    assert.equal(new URL(frame().props.src).searchParams.get('lat'), '-23.55');
    assert.equal(new URL(navigation()[0].props.href).searchParams.get('ll'), '-23.55,-46.63');
    await act(async () => frame().props.onError());
    assert.match(JSON.stringify(view.toJSON()), /Não foi possível carregar o mapa/);
    assert.equal(navigation().length, 1);
    await act(async () => button('Ocultar mapa do Waze').props.onClick());
    assert.equal(view.root.findAllByType('iframe').length, 0);
});

test('an address can open Waze without GPS while an empty destination has no link', async () => {
    await act(async () => { view = Renderer.create(React.createElement(WazeNavigation, { address: 'Rua do cliente, 100' })); });
    assert.equal(new URL(navigation()[0].props.href).searchParams.get('q'), 'Rua do cliente, 100');
    assert.equal(view.root.findAllByType('iframe').length, 0);
    await act(async () => view.update(React.createElement(WazeLink, { destination: '' })));
    assert.equal(view.toJSON(), null);
});

test('switching appointments never sends the previous confirmed point to the next customer', async () => {
    let finishLookup;
    globalThis.fetch = async input => {
        if (String(input) === '/api/operation-weather') return Response.json({ configured: false, location: null });
        if (String(input).startsWith('https://cep.awesomeapi.com.br/json/')) return new Promise(resolve => { finishLookup = resolve; });
        throw new Error('Unexpected request: ' + input);
    };
    const visits = ['A', 'B'].map((id, i) => ({ id, clientName: 'Cliente ' + id, title: 'Visita ' + id, startAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(), status: 'agendado', address: i ? 'Rua B, 20, CEP 70040-010' : 'Rua A, 10' }));
    await act(async () => { view = Renderer.create(React.createElement(FieldConditions, { organizationId: 'waze-test', appointments: visits, onSelect() {} })); });
    const visitButton = id => view.root.findAllByType('button').find(node => node.findAllByType('strong').some(child => child.children.includes('Cliente ' + id)));
    await act(async () => visitButton('A').props.onClick());
    const { LocationPointPicker } = await vite.ssrLoadModule('/app/location-point-picker.jsx');
    await act(async () => button('Ajustar ponto').props.onClick());
    await act(async () => view.root.findByType(LocationPointPicker).props.onConfirm({ latitude: -15.81, longitude: -47.91, source: 'manual', address: 'Entrada confirmada' }));
    let panel = view.root.findByType(WazeNavigation);
    assert.equal(new URL(panel.findByType('a').props.href).searchParams.get('ll'), '-15.81,-47.91');
    await act(async () => visitButton('B').props.onClick());
    panel = view.root.findByType(WazeNavigation);
    const href = new URL(panel.findByType('a').props.href);
    assert.equal(href.searchParams.has('ll'), false);
    assert.equal(href.searchParams.get('q'), visits[1].address);
    assert.equal(panel.findAllByType('iframe').length, 0);
    await act(async () => finishLookup(Response.json({ cep: '70040010', lat: -15.8, lng: -47.9, city: 'Brasília', state: 'DF', address: 'Praça central' })));
    assert.equal(new URL(panel.findByType('a').props.href).searchParams.get('q'), visits[1].address);
});
