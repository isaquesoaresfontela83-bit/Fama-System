import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const runtimeTest = 'fama-ai-compressed-runtime.test.mjs';
const tests = (await readdir(new URL('../tests/', import.meta.url)))
  .filter(name => name.endsWith('.test.mjs') && name !== runtimeTest).sort();
run(['--experimental-loader', './tests/cloudflare-loader.mjs', '--test', '--test-concurrency=1', ...tests.map(name => `tests/${name}`)]);
// Vite fixtures can materialize their asset imports. Compress after those tests,
// then verify the exact output that will be packaged and published.
run(['scripts/compress-runtime-assets.mjs']);
run(['scripts/verify-release-assets.mjs']);
run(['--experimental-loader', './tests/cloudflare-loader.mjs', '--test', `tests/${runtimeTest}`]);

