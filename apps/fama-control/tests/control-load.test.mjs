import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const originalFetch = globalThis.fetch;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { readControlWorkspace } = await vite.ssrLoadModule('/lib/control-load.js');
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });
const payloads = { organizations: { organizations: [{ id: 'company' }] }, security: { owner: {}, backend: {}, encryption: {}, production: {}, headers: {} }, members: { members: [] }, audit: { audit: [] }, privacy: { requests: [] }, plans: { plans: [] }, support: { tickets: [] } };
test('one unavailable module cannot reject successful Control modules', async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, init }); const key = url.split('/').at(-1); return key === 'privacy' ? Response.json({ error: 'Temporarily unavailable' }, { status: 503 }) : Response.json(payloads[key]); };
  const result = await readControlWorkspace(new AbortController().signal);
  assert.equal(result.privacy.status, 'rejected'); assert.equal(result.privacy.reason.status, 503);
  assert.equal(result.organizations.status, 'fulfilled'); assert.deepEqual(result.organizations.value.organizations, [{ id: 'company' }]);
  assert.equal(result.members.status, 'fulfilled'); assert.equal(requests.length, 7); assert.ok(requests.every(item => item.init.signal instanceof AbortSignal));
});
test('invalid module snapshots and authorization denials are retained as explicit failures', async () => {
  globalThis.fetch = async url => { const key = url.split('/').at(-1); if (key === 'organizations') return Response.json({ error: 'Denied' }, { status: 403 }); return Response.json(key === 'members' ? { members: {} } : key === 'security' ? {} : payloads[key]); };
  const result = await readControlWorkspace(new AbortController().signal);
  assert.equal(result.organizations.status, 'rejected'); assert.equal(result.organizations.reason.status, 403);
  assert.equal(result.members.reason.kind, 'invalid'); assert.equal(result.security.reason.kind, 'invalid');
  assert.equal(result.audit.status, 'fulfilled');
});
