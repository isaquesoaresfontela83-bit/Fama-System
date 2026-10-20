import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('release assets retain two prior generations and then discard obsolete chunks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fama-assets-'));
  const assets = join(root, 'dist/client/assets');
  const script = fileURLToPath(new URL('../scripts/preserve-client-assets.mjs', import.meta.url));
  const stage = operation => { const result = spawnSync(process.execPath, [script, operation], { cwd: root, env: { ...process.env, SITES_PROJECT_ROOT: root }, encoding: 'utf8', timeout: 10000 }); assert.equal(result.status, 0, result.stderr); };
  const build = async generation => { await rm(assets, { recursive: true, force: true }); await mkdir(assets, { recursive: true }); await writeFile(join(assets, `panel-${generation}.js`), `import './dependency-${generation}.js'`); await writeFile(join(assets, `dependency-${generation}.js`), `export default ${generation}`); await writeFile(join(assets, `style-${generation}.css`), `body{--generation:${generation}}`); };
  try {
    await build(0);
    for (const generation of [1, 2, 3]) {
      stage('capture'); await build(generation); stage('restore');
      const files = await readdir(assets);
      for (let prior = Math.max(0, generation - 2); prior <= generation; prior++) {
        assert.ok(files.includes(`panel-${prior}.js`)); assert.ok(files.includes(`dependency-${prior}.js`));
        assert.equal(await readFile(join(assets, `style-${prior}.css`), 'utf8'), `body{--generation:${prior}}`);
      }
    }
    const files = await readdir(assets); assert.equal(files.length, 9); assert.ok(!files.includes('panel-0.js'));
    const manifest = JSON.parse(await readFile(join(root, 'dist/client/fama-client-assets.json'), 'utf8'));
    assert.deepEqual(manifest.current.sort(), ['dependency-3.js', 'panel-3.js', 'style-3.css']);
    assert.deepEqual(manifest.previous.sort(), ['dependency-2.js', 'panel-2.js', 'style-2.css']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
