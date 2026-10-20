import assert from 'node:assert/strict';

const systems = [
  ['https://famasystem.online', 'https://fama-system-app.famasystem.workers.dev', 'Fama System'],
  ['https://www.famasystem.online', 'https://fama-system-app.famasystem.workers.dev', 'Fama System'],
  ['https://control.famasystem.online', 'https://fama-control-app.famasystem.workers.dev', 'Fama Control'],
];
let checks = 0;
async function request(origin, path, options = {}) {
  return fetch(origin + path, {
    ...options, redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache', ...options.headers },
  });
}
function check(condition, message) { assert.ok(condition, message); checks++; }
function entries(html) { return [...new Set(html.match(/\/assets\/index-[A-Za-z0-9_-]+\.(?:js|css)/g) ?? [])].sort(); }
async function page(origin) {
  const response = await request(origin, '/?release-check=' + Date.now());
  check(response.status === 200, origin + ' does not respond with HTTP 200');
  for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options'])
    check(Boolean(response.headers.get(header)), origin + ' lacks ' + header);
  check(response.headers.get('Cache-Control')?.includes('no-store'), origin + ' caches private HTML');
  return response.text();
}
for (const [origin, service, product] of systems) {
  const [html, direct] = await Promise.all([page(origin), page(service)]);
  check(html.includes(product), origin + ' displays the wrong application');
  assert.deepEqual(entries(html), entries(direct), origin + ' serves a different release'); checks++;
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"<>]+)"/g)].map(match => match[1]))];
  check(assets.length > 0, origin + ' has no application assets');
  for (let index = 0; index < assets.length; index += 4) {
    await Promise.all(assets.slice(index, index + 4).map(async path => {
      const response = await request(origin, path, { method: 'HEAD' });
      check(response.status === 200, origin + path + ' failed to load');
    }));
  }
  const protectedPath = product === 'Fama Control' ? '/api/admin/health' : '/api/bootstrap';
  const protectedResponse = await request(origin, protectedPath);
  check(protectedResponse.status === 401, origin + protectedPath + ' accepts an unauthenticated caller');
  await protectedResponse.body?.cancel();
  const invalidLogin = await request(origin, '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}',
  });
  check(invalidLogin.status === 400, origin + ' accepts an empty login'); await invalidLogin.body?.cancel();
  const foreignOrigin = await request(origin, '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' }, body: '{}',
  });
  check(foreignOrigin.status === 403, origin + ' accepts a foreign mutation origin'); await foreignOrigin.body?.cancel();
  if (product === 'Fama System') {
    const response = await request(origin, '/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-email': 'isaquesoaresfontela83@gmail.com' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'integration_status', arguments: {} } }),
    });
    const payload = await response.json();
    check(payload.error?.code === -32001, origin + ' trusts a caller-supplied administrator identity');
  }
  console.log(JSON.stringify({ origin, product, checked: true, assets: assets.length }));
}
console.log(JSON.stringify({ ok: true, checks, authenticatedWorkflows: 'not exercised' }));
