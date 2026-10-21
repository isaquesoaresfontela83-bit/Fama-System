import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const system = resolve(process.argv[2] || fileURLToPath(new URL('../../', import.meta.url)));
const control = resolve(process.argv[3] || resolve(system, '../control'));
assert.equal(await readFile(resolve(system, 'lib/fama-release.js'), 'utf8'), await readFile(resolve(control, 'lib/fama-release.js'), 'utf8'), 'Os lançamentos dos dois sistemas divergem.');
for (const root of [system, control]) {
    for (const path of ['.next/standalone/server.js', '.next/BUILD_ID', 'server/vps-sqlite.mjs', 'server/vps-env.mjs']) {
        assert.ok((await stat(resolve(root, path))).isFile(), 'Arquivo obrigatório ausente: ' + path);
    }
    const manifest = JSON.parse(await readFile(resolve(root, '.next/required-server-files.json'), 'utf8'));
    assert.equal(manifest.config.output, 'standalone');
}
console.log('Os dois pacotes standalone existem e pertencem ao mesmo lançamento. Valide os dados, as credenciais e o servidor antes de publicar.');
