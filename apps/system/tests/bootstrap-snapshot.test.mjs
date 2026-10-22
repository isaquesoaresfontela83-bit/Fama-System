import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, root, server: { middlewareMode: true, hmr: false, ws: false } });
const { emptyData, parseBootstrapData } = await vite.ssrLoadModule('/app/data-model.js');
after(() => vite.close());
test('valid empty records remain distinct from corrupt or missing server and offline snapshots', () => {
  assert.deepEqual(parseBootstrapData({ ...emptyData, storageEnabled: true }), emptyData);
  for (const data of [null, {}, [], { ...emptyData, customers: {} }, { ...emptyData, transactions: [null] }, { ...emptyData, appointments: [false] }]) assert.throws(() => parseBootstrapData(data), /conferidos/);
});
