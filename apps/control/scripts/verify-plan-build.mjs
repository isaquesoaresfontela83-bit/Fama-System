import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(process.env.SITES_PROJECT_ROOT || process.cwd());
const server = await readFile(resolve(root, 'dist/server/index.js'), 'utf8');
assert.ok(server.includes('plan_finance_plus_release_2026_10_10'), 'Current finance catalog release is absent');

const policy = server.match(/(?:var|let|const)\s+PLAN_FEATURES\s*=\s*\{\s*inicial:\s*([\w$]+),\s*intermediario:\s*([\w$]+),/);
assert.ok(policy, 'Compiled plan policy is absent');
const featureArray = name => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = server.match(new RegExp('(?:var|let|const)\\s+' + escaped + '\\s*=\\s*\\[([^\\]]+)\\]'));
  assert.ok(match, `Compiled features are absent: ${name}`);
  return match[1];
};
assert.equal(featureArray(policy[1]).includes('"finance"'), false, 'Basic must not include finance');
assert.ok(featureArray(policy[2]).includes('"finance"'), 'Plus must include finance');

console.log('Control finance catalog and plan access policy verified in the generated Worker.');
