import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { createFetchMock, Miniflare } from 'miniflare';

const compile = async path => (await transform(await readFile(new URL(path, import.meta.url), 'utf8'), { format:'esm', target:'es2022' })).code;
const fetchMock = createFetchMock();
fetchMock.disableNetConnect();
const runtime = new Miniflare({
  fetchMock,
  modules: [
    { type: 'ESModule', path: 'provider-worker.mjs', contents: `
      import { asaasRequest } from './asaas.mjs';
      export default { async fetch(request) {
        try {
          const payload = await asaasRequest('fixture-private-key', 'production', '/myAccount/status');
          return Response.json({ok:true,payload});
        } catch(error) { return Response.json({ok:false,status:error.status,name:error.name}); }
      } };
    ` },
    { type: 'ESModule', path: 'asaas.mjs', contents: await compile('../lib/asaas.js') },
    { type: 'ESModule', path: 'tenant.mjs', contents: 'export class RequestError extends Error { constructor(message,status) { super(message); this.status=status; } }' },
  ],
});
after(async () => { await runtime.dispose(); await fetchMock.close(); });

test('Asaas requests execute in the Workers runtime and return the provider response', async () => {
  fetchMock.get('https://api.asaas.com').intercept({ path: '/v3/myAccount/status', method: 'GET', headers: {access_token:'fixture-private-key'} }).reply(200, { general: 'APPROVED' });
  const response = await runtime.dispatchFetch('https://fixture.local/asaas');
  assert.deepEqual(await response.json(), { ok: true, payload: { general: 'APPROVED' } });
});

test('Asaas redirects are refused before sending credentials to another destination', async () => {
  fetchMock.get('https://api.asaas.com').intercept({ path: '/v3/myAccount/status', method: 'GET' }).reply(307, '', { headers: { location: 'https://untrusted.example.test' } });
  const response = await runtime.dispatchFetch('https://fixture.local/asaas');
  assert.equal((await response.json()).status, 502);
});
