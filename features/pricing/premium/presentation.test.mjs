import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { normalizeCatalog } from './catalog-runtime.mjs';
import { withPresentation, VERSION, RELEASE, PREFIX } from './entry.mjs';
import { deploy, fingerprint, readModules } from './deploy.mjs';
import { buildResources } from './build.mjs';
import { deployConnected } from './deploy-connected.mjs';

const payload = { plans: [
 { id: 'inicial', name: 'Basic', price: 10900, users: 'Até 3 usuários', clients: 'Até 100.000 clientes', modules: 'Painel personalizável e gestão geral\nAgenda semanal e recorrente' },
 { id: 'intermediario', name: 'Plus', price: 19900, userLimit: 6, customerLimit: 100000, modules: 'Tudo do Basic\nEstoque e controle de produtos com leitura de código de barras' },
 { id: 'profissional', name: 'Pro', price: 39900, userLimit: 50, customerLimit: 100000, modules: 'Tudo do Plus\nFama IA com voz para consultar e planejar a operação' },
] };
const html = '<html><head><meta name="robots" content="noindex,nofollow"><!--FAMA_CATALOG--></head><body>new page</body></html>';
const resources = {
 html: { type: 'text/html', body: html },
 [PREFIX + 'theme.js']: { type: 'application/javascript', body: 'theme' },
};
const liveCatalog = async () => Response.json(payload);

test('catalog reflects current limits and inherits only explicit parent declarations', () => {
 const data = normalizeCatalog(payload);
 assert.deepEqual(data.plans.map(plan => plan.priceCents), [10900, 19900, 39900]);
 assert.equal(data.plans[0].customers, 100000);
 assert.deepEqual(data.featureGroups[0].availability['Agenda semanal e recorrente'], [true, true, true]);
 const customized = structuredClone(payload);
 customized.plans[1].modules = 'Somente recurso personalizado';
 const custom = normalizeCatalog(customized);
 assert.deepEqual(custom.featureGroups[0].availability['Agenda semanal e recorrente'], [true, false, false]);
 assert.throws(() => normalizeCatalog({ plans: [payload.plans[0], payload.plans[0], payload.plans[2]] }));
});

test('presentation retains public headers and protects embedded catalog data', async () => {
 const dangerous = structuredClone(payload);
 dangerous.plans[0].name = '</script><img src=x onerror=alert(1)>';
 const app = withPresentation({ fetch: async () => new Response('<main class="fp-page">old</main>', {
  headers: { 'content-type': 'text/html', 'x-robots-tag': 'index, follow', 'content-security-policy': "default-src 'self'", 'set-cookie': 'existing=preserved' },
 }) }, 'system', resources, async () => Response.json(dangerous));
 const response = await app.fetch(new Request('https://famasystem.online/'));
 const text = await response.text();
 assert.match(text, /id="fama-public-catalog"/);
 assert.ok(!text.includes('</script><img'));
 assert.match(text, /content="index, follow"/);
 assert.equal(response.headers.get('content-security-policy'), "default-src 'self'");
 assert.equal(response.headers.get('set-cookie'), 'existing=preserved');
});

test('authenticated root, consent pages, checkout and APIs preserve response identity', async () => {
 for (const [path, body] of [['/', '<main class="application">private</main>'], ['/assinar/inicial', 'checkout'], ['/api/orders', 'orders']]) {
  const original = new Response(body, { headers: { 'content-type': 'text/html', 'set-cookie': 'session=preserved' } });
  const app = withPresentation({ fetch: async () => original }, 'system', resources, () => { throw new Error('Catalog must not be called'); });
  assert.equal(await app.fetch(new Request('https://famasystem.online' + path)), original);
 }
});

test('catalog failures return the original commercial page and assets support HEAD', async () => {
 const original = new Response('<main class="fp-page">old</main>', { headers: { 'content-type': 'text/html' } });
 const app = withPresentation({ fetch: async () => original }, 'system', resources, async () => { throw new Error('offline'); });
 assert.equal(await app.fetch(new Request('https://famasystem.online/planos')), original);
 const asset = await app.fetch(new Request('https://famasystem.online' + PREFIX + 'theme.js', { method: 'HEAD' }));
 assert.equal(await asset.text(), '');
 assert.match(asset.headers.get('content-type'), /javascript/);
});

test('production catalog uses the existing application handler and normalized live limits', async () => {
 let requests = 0;
 const mapped = { plans: Object.fromEntries(payload.plans.map(plan => [plan.id, {
  code: plan.id, name: plan.name, priceCents: plan.price, description: plan.description,
  limits: { users: plan.id === 'inicial' ? 3 : plan.id === 'intermediario' ? 6 : 50, customers: 100000 },
  highlights: plan.modules.split('\n'),
 }])) };
 const environment = {}, context = {};
 const app = withPresentation({ fetch: async (request, env, ctx) => {
  if (new URL(request.url).pathname === '/api/public/plans') {
   assert.equal(env, environment);
   assert.equal(ctx, context);
   requests++;
   return Response.json(mapped);
  }
  return new Response('<main class="fp-page">old</main>', { headers: { 'Content-Type': 'text/html' } });
 } }, 'system', resources);
 const response = await app.fetch(new Request('https://famasystem.online/planos'), environment, context);
 const text = await response.text();
 assert.match(text, /id="fama-public-catalog"/);
 assert.match(text, /"priceCents":10900/);
 assert.equal(requests, 1);
});

test('Control keeps operational routes and reports the same release without dropping diagnostics', async () => {
 const original = new Response('control');
 const app = withPresentation({ fetch: async request => request.url.endsWith('/api/health') ?
  Response.json({ status: 'ok', diagnostics: { db: 'ok' } }) : original }, 'control', {});
 assert.equal(await app.fetch(new Request('https://control.famasystem.online/')), original);
 const response = await app.fetch(new Request('https://control.famasystem.online/api/health'));
 assert.deepEqual(await response.json(), { status: 'ok', diagnostics: { db: 'ok' }, version: VERSION, release: RELEASE, releaseId: RELEASE });
});

async function deploymentFixture(failSecond = false) {
 const built = await buildResources();
 const baseParts = [
  { name: 'optical-preview-main.mjs', bytes: Buffer.from('export default {};'), type: 'application/javascript+module' },
  { name: 'index.js', bytes: Buffer.from('existing application'), type: 'application/javascript+module' },
  { name: 'module.wasm', bytes: Buffer.from([0, 97, 115, 109]), type: 'application/wasm' },
 ];
 const state = new Map(['fama-system-app', 'fama-control-app'].map(name => [name, {
  parts: structuredClone(baseParts), version: name + '-old', puts: 0, rollbacks: 0,
 }]));
 const result = value => Response.json({ success: true, result: value });
 const http = async (urlValue, options = {}) => {
  const url = new URL(urlValue);
  if (url.hostname !== 'api.cloudflare.com') {
   if (url.pathname === '/api/health') return Response.json({ status: 'ok', version: VERSION, release: RELEASE });
   if (url.pathname === '/' || url.pathname === '/planos') return new Response('<button id="theme-toggle"></button><script id="fama-public-catalog"></script>');
   return new Response(built[url.pathname]?.body || 'missing');
  }
  assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
  const match = url.pathname.match(/\/workers\/scripts\/(fama-(?:system|control)-app)(.*)/);
  assert.ok(match, 'Unexpected API path');
  const [, name, suffix] = match;
  const worker = state.get(name);
  if (suffix === '/deployments' && options.method === 'POST') {
   worker.version = JSON.parse(options.body).versions[0].version_id;
   worker.parts = structuredClone(baseParts);
   worker.rollbacks++;
   return result({});
  }
  if (suffix === '/deployments') return result({ deployments: [{ versions: [{ version_id: worker.version, percentage: 100 }] }] });
  if (suffix === '/versions') return result({ items: [{ id: worker.version }] });
  if (suffix === '/settings') return result({ bindings: [{ name: 'ASSETS', type: 'assets' }, { name: 'PRIVATE', type: 'secret_text' }], compatibility_date: '2026-11-01' });
  if (options.method === 'PUT') {
   worker.puts++;
   if (failSecond && name === 'fama-control-app') throw new Error('Upload interrupted');
   assert.equal(url.searchParams.get('bindings_inherit'), 'strict');
   const metadata = JSON.parse(await options.body.get('metadata').text());
   assert.deepEqual(metadata.bindings, [{ name: 'ASSETS', type: 'inherit' }, { name: 'PRIVATE', type: 'inherit' }]);
   assert.equal(metadata.keep_assets, true);
   worker.parts = await readModules(new Response(options.body));
   for (const part of worker.parts.filter(part => part.name.startsWith('presentation-'))) {
    const check = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: part.bytes });
    assert.equal(check.status, 0, part.name + ': ' + check.stderr.toString());
   }
   worker.version = name + '-new';
   return result({});
  }
  const form = new FormData();
  for (const part of worker.parts) form.append(part.name, new Blob([part.bytes], { type: part.type }), part.name);
  return new Response(form);
 };
 return { http, state, baseParts };
}

test('joint upload preserves every original module, binary and binding in both Workers', async () => {
 const fixture = await deploymentFixture();
 const result = await deploy({ token: 'test-token', accountId: 'test-account', activate: true, http: fixture.http });
 assert.equal(result.success, true);
 for (const worker of fixture.state.values()) {
  assert.equal(worker.puts, 1);
  assert.equal(fingerprint(worker.parts.filter(part => !part.name.startsWith('presentation-'))), fingerprint(fixture.baseParts));
 }
});

test('failed second upload restores the first Worker to its captured version', async () => {
 const fixture = await deploymentFixture(true);
 const result = await deploy({ token: 'test-token', accountId: 'test-account', activate: true, http: fixture.http });
 assert.equal(result.success, false);
 assert.equal(fixture.state.get('fama-system-app').version, 'fama-system-app-old');
 assert.equal(fixture.state.get('fama-system-app').rollbacks, 1);
 assert.equal(fixture.state.get('fama-control-app').version, 'fama-control-app-old');
});

test('missing deployment credentials fail before any API request', async () => {
 await assert.rejects(() => deploy({ http: () => { throw new Error('Must not be called'); } }), /Configure CLOUDFLARE_API_TOKEN/);
});

test('invalid token formatting is rejected without revealing the credential', async () => {
 const privateValue = 'private-token with spaces';
 await assert.rejects(() => deploy({ token: privateValue, accountId: 'test-account', http: () => { throw new Error('Must not be called'); } }), error => {
  assert.match(error.message, /formato do token/);
  assert.ok(!error.message.includes(privateValue));
  return true;
 });
});

test('copied credentials tolerate surrounding line breaks before a dry run', async () => {
 const fixture = await deploymentFixture();
 const result = await deploy({ token: '\n test-token \r\n', accountId: ' test-account ', http: fixture.http });
 assert.equal(result.prepared, true);
 assert.ok([...fixture.state.values()].every(worker => worker.puts === 0));
});

for (const failSecond of [false, true]) test('connected publication ' + (failSecond ? 'rolls back an interrupted pair' : 'preserves binary source, bindings and both releases'), async () => {
 const fixture = await deploymentFixture(failSecond);
 const input = {
  version: VERSION, release: RELEASE, resources: await buildResources(),
  core: (await readFile(new URL('entry.mjs', import.meta.url), 'utf8')).replace('./catalog-runtime.mjs', './presentation-catalog.mjs'),
  catalog: await readFile(new URL('catalog-runtime.mjs', import.meta.url), 'utf8'),
  baseline: Object.fromEntries(['system', 'control'].map(kind => [kind, {
   version: 'fama-' + kind + '-app-old', hash: fingerprint(fixture.baseParts), modules: fixture.baseParts.length,
  }])),
 };
 const connector = { request: async ({ method, path, query, body }) => {
  const url = new URL('https://api.cloudflare.com/client/v4' + path);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
  const response = await fixture.http(url, { method, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body), headers: new Headers({ Authorization: 'Bearer test-token' }) });
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : new Uint8Array(await response.arrayBuffer());
 } };
 const originalFetch = globalThis.fetch;
 globalThis.fetch = fixture.http;
 try {
  const result = await deployConnected(connector, 'test-account', input, true);
  assert.equal(result.success, !failSecond, result.error);
  for (const [name, worker] of fixture.state) {
   assert.equal(worker.version, name + (failSecond ? '-old' : '-new'));
   assert.equal(fingerprint(worker.parts.filter(part => !part.name.startsWith('presentation-'))), fingerprint(fixture.baseParts));
  }
  if (failSecond) assert.equal(fixture.state.get('fama-system-app').rollbacks, 1);
 } finally { globalThis.fetch = originalFetch; }
});
