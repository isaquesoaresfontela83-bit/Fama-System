import { readFile, writeFile, readdir, stat, copyFile, unlink, mkdir, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const root = resolve(process.env.SITES_PROJECT_ROOT || process.cwd(), 'dist/client');
const renamed = new Map();
const originals = resolve(root, '../../.sites-runtime/uncompressed-client-assets');
async function compress(directory, assetRoot = root, storageRoot = originals) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.name === ".rsync-tmp") { await rm(path, { recursive: true, force: true }); continue; }
    if (entry.isDirectory()) { await compress(path, assetRoot, storageRoot); continue; }
    if (!entry.name.endsWith('.wasm') || (await stat(path)).size <= 25 * 1024 * 1024) continue;
    const original = await readFile(path), encoded = gzipSync(original, { level: 9 });
    if (encoded.length > 25 * 1024 * 1024 || !gunzipSync(encoded).equals(original)) throw new Error('The compressed AI runtime is invalid or exceeds the hosting limit.');
    await writeFile(path + '.gz', encoded);
    const stored = join(storageRoot, relative(assetRoot, path));
    await mkdir(resolve(stored, '..'), { recursive: true });
    await copyFile(path, stored);
    await unlink(path);
    renamed.set(entry.name, entry.name + '.gz');
    console.log(`Compressed local AI runtime: ${relative(root, path)} (${encoded.length} bytes).`);
  }
}
await compress(root);
const serverRoot = resolve(root, '../server/ssr');
let serverAssets;
try { serverAssets = await stat(serverRoot); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (serverAssets?.isDirectory()) await compress(serverRoot, serverRoot, resolve(originals, '../uncompressed-server-assets'));
const path = join(root, 'fama-client-assets.json');
const manifest = JSON.parse(await readFile(path, 'utf8'));
for (const key of ['current', 'previous']) manifest[key] = (manifest[key] || []).map(name => renamed.get(name) || name);
await writeFile(path, JSON.stringify(manifest));
