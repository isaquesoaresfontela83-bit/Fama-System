import { mkdir, mkdtemp, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.env.SITES_PROJECT_ROOT || process.cwd());
const runtime = resolve(root, '.sites-runtime');
await mkdir(runtime, { recursive: true });
const checkpoint = await mkdtemp(resolve(runtime, 'previous-build-'));
// Cloudflare's RSC build can resolve a previous generated Worker. Isolate that
// output and transform caches before compiling; client assets are retained by
// preserve-client-assets so open tabs can still load their old chunks.
for (const [source, target] of [
  ['dist/server', 'server'],
  ['dist/client', 'client'],
  ['node_modules/.vite', 'vite'],
  ['node_modules/.vite-temp', 'vite-temp'],
  ['node_modules/.vite-rsc-temp', 'vite-rsc-temp'],
]) {
  const path = resolve(root, source);
  try { await stat(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  await rename(path, resolve(checkpoint, target));
}
console.log('Previous generated Worker and transform caches isolated before compilation.');
