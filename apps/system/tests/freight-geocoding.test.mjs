import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch, root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, server: { middlewareMode: true, hmr: false, ws: false } });
const { locateFreightCeps } = await vite.ssrLoadModule('/lib/freight-geocoding.js');
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });

test('public browser CEP lookups preserve zeros, omit credentials, cache validated locations and reject cancellation', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer'); assert.equal(new Headers(init.headers).get('authorization'), null);
    const cep = url.split('/').at(-1);
    return Response.json({ cep, city: 'São Paulo', state: 'SP', address: 'Endereço público', lat: '-23.55', lng: cep === '01001000' ? '-46.63' : '-46.65' });
  };
  const signal = new AbortController().signal;
  const points = await locateFreightCeps('01001-000', '01311-000', signal); assert.equal(points.origin.cep, '01001000'); assert.equal(points.destination.longitude, -46.65);
  assert.deepEqual(await locateFreightCeps('01001000', '01311000', signal), points); assert.equal(calls, 2);
  const abort = new AbortController(); abort.abort(); await assert.rejects(locateFreightCeps('01001000', '01311000', abort.signal)); assert.equal(calls, 2);
});

test('missing or unrelated provider coordinates never become browser freight locations', async () => {
  globalThis.fetch = async () => Response.json({ cep: '99999999', city: 'Brasília', state: 'DF', lat: '', lng: '-47.92972' });
  await assert.rejects(locateFreightCeps('72505-101', '72415-990', new AbortController().signal));
});

test('browser throttling uses independent validated CEP coordinates and caches them without credentials',async()=>{
 const calls=[];globalThis.fetch=async(url,init)=>{calls.push(url);assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');if(url.includes('awesomeapi'))return Response.json({error:'busy'},{status:429});const cep=url.split('/').at(-1);return Response.json({cep,city:'Brasília',state:'DF',street:'Rua',location:{coordinates:{latitude:-16,longitude:cep==='72505102'?-48:-47.9}}});};
 const signal=new AbortController().signal,points=await locateFreightCeps('72505102','72415991',signal);assert.equal(points.origin.longitude,-48);assert.equal(points.destination.longitude,-47.9);const count=calls.length;assert.deepEqual(await locateFreightCeps('72505102','72415991',signal),points);assert.equal(calls.length,count);
});
