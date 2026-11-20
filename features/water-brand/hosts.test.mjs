import assert from 'node:assert/strict';
import test from 'node:test';

import { withWaterBrand } from './entry.mjs';
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
