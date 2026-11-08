import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const compile = async path => (await transform(await readFile(new URL(path, import.meta.url), 'utf8'), { format:'esm', target:'es2022' })).code;
const outgoing = [];
let providerRedirect = false;
const runtime = new Miniflare(convertV4MiniflareOptions({
  compatibilityDate: '2026-10-17',
  // The current Miniflare removed createFetchMock. An outbound service handles
  // every request locally and refuses every unrecognised destination.
  outboundService: async request => {
    outgoing.push(request.url);
    assert.equal(request.url, 'https://api.asaas.com/v3/myAccount/status');
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.get('access_token'), 'fixture-private-key');
    return providerRedirect
      ? new Response(null, {status:307,headers:{location:'https://untrusted.example.test'}})
      : Response.json({general:'APPROVED'});
  },
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
}));
after(async () => { await runtime.dispose(); });

test('Asaas requests execute in the Workers runtime and return the provider response', async () => {
  outgoing.length=0;providerRedirect=false;
  const response = await runtime.dispatchFetch('https://fixture.local/asaas');
  assert.deepEqual(await response.json(), { ok: true, payload: { general: 'APPROVED' } });
  assert.equal(outgoing.length,1);
});

test('Asaas redirects are refused before sending credentials to another destination', async () => {
  outgoing.length=0;providerRedirect=true;
  const response = await runtime.dispatchFetch('https://fixture.local/asaas');
  assert.equal((await response.json()).status, 502);
  assert.deepEqual(outgoing,['https://api.asaas.com/v3/myAccount/status']);
});
