import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.env.SITES_PROJECT_ROOT || process.cwd());
async function serverCode(directory) {
  const parts=[];
  for(const item of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,item.name);
    if(item.isDirectory())parts.push(await serverCode(path));
    else if(item.name.endsWith('.js'))parts.push(await readFile(path,'utf8'));
  }
  return parts.join('\n');
}
// Dynamic Worker imports may move route policy into generated chunks.
const server = await serverCode(resolve(root,'dist/server'));
for (const required of ['PLAN_FEATURES', 'planIncludesFeature', 'O módulo de notas fiscais', 'O cálculo automático de frete', 'O financeiro está disponível a partir do Plus', 'Cada plano libera seus recursos e limites']) {
  assert.ok(server.includes(required), `Built Worker is missing the current plan policy: ${required}`);
}
assert.equal(server.includes('A diferença está na capacidade de usuários e clientes'), false, 'Built Worker contains the superseded common-feature catalog');
const manifest = JSON.parse(await readFile(resolve(root, 'dist/client/fama-client-assets.json'), 'utf8'));
const currentApp = manifest.current.find(name => /^cloriva-app-[\w-]+\.js$/.test(name));
assert.ok(currentApp, 'Current app bundle is absent');
const client = await readFile(resolve(root, 'dist/client/assets', currentApp), 'utf8');
assert.ok(client.includes('Frete automático no Pro')); assert.ok(client.includes('invoicesEnabled'));

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

console.log('Current plan policy verified in the generated Worker and browser app.');
