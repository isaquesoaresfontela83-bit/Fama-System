import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
const root = new URL('../', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { useModuleAnalytics } = await vite.ssrLoadModule('/hooks/use-module-analytics.js');
const originalFetch = globalThis.fetch, originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let current, renderer, pending, props;
function Harness(input) { current = useModuleAnalytics(input); return null; }
beforeEach(() => { pending = []; globalThis.fetch = (url, init) => new Promise(resolve => pending.push({ url, init, resolve })); props = { organizationId: 'org-a', scope: 'user-a:org-a', section: 'members', allowed: ['members'] }; });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; globalThis.fetch = originalFetch; });
after(async () => { await vite.close(); globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct; });
const render = async () => act(async () => { renderer = Renderer.create(React.createElement(Harness, props)); });
const respond = async (request, body, status = 200) => act(async () => { request.resolve(Response.json(body, { status })); });
test('switching tenant aborts the prior request and prevents late data from crossing scopes', async () => {
    await render(); const first = pending[0];
    props = { ...props, organizationId: 'org-b', scope: 'user-b:org-b' };
    await act(async () => renderer.update(React.createElement(Harness, props)));
    assert.equal(first.init.signal.aborted, true);
    assert.equal(pending[1].init.headers['x-organization-id'], 'org-b');
    await respond(first, { members: [{ id: 'private-org-a' }] });
    assert.equal(current.context.members.status, 'loading');
    await respond(pending[1], { members: [{ id: 'org-b-member' }] });
    assert.equal(current.context.members.data.members[0].id, 'org-b-member');
});
test('invalid responses and HTTP failures show errors, while retry can recover to an actual empty result', async () => {
    await render(); await respond(pending[0], { ok: true });
    assert.equal(current.context.members.status, 'error');
    await act(async () => current.refresh()); await respond(pending[1], { error: 'Unavailable' }, 503);
    assert.equal(current.context.members.status, 'error');
    await act(async () => current.refresh()); await respond(pending[2], { members: [] });
    assert.equal(current.context.members.status, 'ready');
    assert.deepEqual(current.context.members.data.members, []);
});
test('permission removal clears supplemental data and releases pending network work', async () => {
    await render(); const first = pending[0];
    props = { ...props, allowed: [] }; await act(async () => renderer.update(React.createElement(Harness, props)));
    assert.equal(first.init.signal.aborted, true);
    assert.deepEqual(current.context, {});
    await respond(first, { members: [{ id: 'hidden' }] }); assert.deepEqual(current.context, {});
    assert.equal(pending.length, 1);
});
