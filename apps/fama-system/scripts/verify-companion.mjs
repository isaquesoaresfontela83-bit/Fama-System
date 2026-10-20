import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const companion = process.argv[2];
if (!companion) throw new Error('Informe o caminho do outro projeto Fama.');
const local = new URL('../', import.meta.url);
for (const path of ['lib/fama-release.js', 'lib/integration-catalog.js', 'lib/permissions.js', 'lib/plan-features.js']) {
    const [left, right] = await Promise.all([readFile(new URL(path, local), 'utf8'), readFile(resolve(companion, path), 'utf8')]);
    assert.equal(left, right, `${path} diverge entre System e Control`);
}
console.log('System e Control: versão, lançamento, integrações, permissões e catálogo de recursos sincronizados.');
