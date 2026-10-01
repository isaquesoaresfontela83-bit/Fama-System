import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createFetchMock, Miniflare } from 'miniflare';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fetchMock = createFetchMock();
fetchMock.disableNetConnect();
const runtime = new Miniflare({
  fetchMock,
  modules: [
    { type: 'ESModule', path: 'provider-worker.mjs', contents: `
      import { asaasRequest } from './asaas.mjs';
      import { notaasRequest } from './fiscal.mjs';
      export default { async fetch(request) {
        const provider = new URL(request.url).pathname.slice(1);
        try {
          const payload = provider === 'asaas'
            ? await asaasRequest('fixture-private-key', 'production', '/myAccount/status')
            : await notaasRequest({fiscalEnvironment:'sandbox',fiscalApiBaseUrl:''}, 'sk_test_fixture', '/invoices/fixture/status');
          return Response.json({ok:true,payload});
        } catch(error) { return Response.json({ok:false,status:error.status,name:error.name}); }
      } };
    ` },
    { type: 'ESModule', path: 'asaas.mjs', contents: await compile('../lib/asaas.ts') },
    { type: 'ESModule', path: 'fiscal.mjs', contents: (await compile('../lib/fiscal.ts')).replace('@/lib/tenant', './tenant.mjs') },
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

test('Notaas requests execute in Workers and preserve asynchronous invoice status', async () => {
  fetchMock.get('https://platform.notaas.com.br').intercept({ path: '/api/v1/invoices/fixture/status', method: 'GET', headers: {'x-api-key':'sk_test_fixture'} }).reply(200, { status: 'processing' });
  const response = await runtime.dispatchFetch('https://fixture.local/notaas');
  assert.deepEqual(await response.json(), { ok: true, payload: { status: 'processing' } });
});

test('Notaas redirects are refused without forwarding the fiscal credential', async () => {
  fetchMock.get('https://platform.notaas.com.br').intercept({ path: '/api/v1/invoices/fixture/status', method: 'GET' }).reply(302, '', { headers: { location: 'https://untrusted.example.test' } });
  const response = await runtime.dispatchFetch('https://fixture.local/notaas');
  assert.equal((await response.json()).status, 502);
});
