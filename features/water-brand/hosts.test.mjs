import assert from 'node:assert/strict';
import test from 'node:test';

import { CONTROL_BRAND, CONTROL_DOCK_JS, CONTROL_LAYOUT_CSS, MFA_MANAGE_CSS, MFA_MANAGE_FLOW, MFA_MANAGE_JS, PREFIX, withWaterBrand } from './entry.mjs';
import { migrateLegacyReferences, useWaterHosts } from './hosts.mjs';

test('moves application hosts without rewriting unrelated services', () => {
 const source = [
  'https://famasystem.online/auth/recuperar',
  'https://control.famasystem.online/api/public/plans',
  'https://WWW.famasystem.online:443/entrar',
  'https://famasystem.online.other.example/',
  'https://famasystem.localhost.famasystem.online/',
  'https://notfamasystem.online/',
 ].join('\n');
 const migrated = useWaterHosts(source);
 assert.equal(migrated, [
  'https://watersystem.online/auth/recuperar',
  'https://control.watersystem.online/api/public/plans',
  'https://www.watersystem.online:443/entrar',
  'https://famasystem.online.other.example/',
  'https://famasystem.localhost.famasystem.online/',
  'https://notfamasystem.online/',
 ].join('\n'));
 assert.equal(useWaterHosts(migrated), migrated);
});

test('retired host references are removed from selected static resources for GET and HEAD', async () => {
 const path = '/assets/client.js';
 const originalHeaders = { 'content-type': 'application/javascript', 'etag': '"old"', 'content-length': '30', 'cache-control': 'public, immutable', 'accept-ranges': 'bytes' };
 const app = { async fetch(request) {
  assert.equal(request.headers.get('if-none-match'), null);
  assert.equal(request.headers.get('range'), null);
  return new Response(request.method === 'HEAD' ? null : '"https://famasystem.online/"', { headers: originalHeaders });
 } };
 const worker = withWaterBrand(app, {}, 'system', [path]);
 for (const method of ['GET', 'HEAD']) {
  const request = new Request('https://watersystem.online' + path, { method, headers: { 'if-none-match': '"old"', 'range': 'bytes=0-10' } });
  const response = await worker.fetch(request);
  assert.equal(await response.text(), method === 'HEAD' ? '' : '"https://watersystem.online/"');
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(response.headers.get('accept-ranges'), null);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
 }
});

test('public names and the repository move without changing storage and binding identifiers', () => {
 const original = 'FAMA SYSTEM · Fama Control · FamaSystem/1.0 · ' +
  'https://github.com/isaquesoaresfontela83-bit/Fama-System · FAMA_SYSTEM · fama-system-theme-v2';
 const updated = 'WATER SYSTEM · Water Control · WaterSystem/1.0 · ' +
  'https://github.com/isaquesoaresfontela83-bit/Water-System · FAMA_SYSTEM · fama-system-theme-v2';
 assert.equal(migrateLegacyReferences(original), updated);
 assert.equal(migrateLegacyReferences(updated), updated);
});

test('Control uses its transparent mark for the panel and favicon while the opening keeps its monogram', async () => {
 const image = body => ({ body, type: 'image/webp' });
 const resources = {
  'icon.webp': image('original monogram'),
  [CONTROL_BRAND + '-mark.webp']: image('Control logo'),
  [CONTROL_BRAND + '.js']: { body: '', type: 'application/javascript' },
 };
 const app = { fetch: () => assert.fail('Brand images should be handled by the extension') };
 const routes = [
  ['/fama-piscinas-mark.png', 'Control logo'],
  ['/favicon.ico', 'Control logo'],
  [PREFIX + 'icon.webp', 'original monogram'],
 ];
 for (const product of ['control', 'system']) {
  const worker = withWaterBrand(app, resources, product);
  for (const [path, expected] of routes) {
   const response = await worker.fetch(new Request('https://watersystem.online' + path));
   assert.equal(response.headers.get('Content-Type'), 'image/webp');
   assert.equal(await response.text(), product === 'control' ? expected : 'original monogram');
  }
 }
});

test('shared Control layout loads only for Control and leaves authentication resources intact', async () => {
 const calls = [];
 const previous = globalThis.HTMLRewriter;
 globalThis.HTMLRewriter = class {
  on(selector, handler) { if (selector === 'head') handler.element({ append: html => calls.push(html) }); return this; }
  transform(response) { return response; }
 };
 const resources = {
  [CONTROL_LAYOUT_CSS]: { body: '.control-shell { color: inherit }', type: 'text/css; charset=utf-8' },
  [CONTROL_DOCK_JS]: { body: 'export {};', type: 'application/javascript; charset=utf-8' },
  [MFA_MANAGE_JS]: { body: 'export {};', type: 'application/javascript' },
  [MFA_MANAGE_FLOW]: { body: 'export {};', type: 'application/javascript' },
  [MFA_MANAGE_CSS]: { body: '/* mfa */', type: 'text/css; charset=utf-8' },
 };
 const upstream = new Response('<html><head></head><body>login</body></html>', { headers: { 'content-type': 'text/html', 'set-cookie': 'session=existing; HttpOnly', 'content-security-policy': "default-src 'self'" } });
 const app = { fetch: () => upstream.clone() };
 try {
  const control = withWaterBrand(app, resources, 'control');
  const response = await control.fetch(new Request('https://control.watersystem.online/'));
  assert.ok(calls.some(html => html.includes(PREFIX + CONTROL_LAYOUT_CSS)));
  assert.ok(calls.some(html => html.includes(PREFIX + CONTROL_DOCK_JS)));
  assert.ok(calls.some(html => html.includes(PREFIX + MFA_MANAGE_JS)));
  assert.match(response.headers.get('set-cookie'), /session=existing/);
  assert.equal(response.headers.get('content-security-policy'), "default-src 'self'");
  for (const method of ['GET', 'HEAD']) {
   const css = await control.fetch(new Request('https://control.watersystem.online' + PREFIX + CONTROL_LAYOUT_CSS, { method }));
   assert.match(css.headers.get('content-type'), /^text\/css/);
   assert.equal(await css.text(), method === 'HEAD' ? '' : resources[CONTROL_LAYOUT_CSS].body);
  }
  calls.length = 0;
  await withWaterBrand(app, resources, 'system').fetch(new Request('https://watersystem.online/entrar'));
  assert.ok(!calls.some(html => html.includes(CONTROL_LAYOUT_CSS)));
  assert.ok(!calls.some(html => html.includes(CONTROL_DOCK_JS)));
  assert.ok(calls.some(html => html.includes(PREFIX + MFA_MANAGE_JS)));
 } finally { globalThis.HTMLRewriter = previous; }
});
