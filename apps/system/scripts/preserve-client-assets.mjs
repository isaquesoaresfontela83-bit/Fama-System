import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.env.SITES_PROJECT_ROOT || process.cwd());
const assets = resolve(root, 'dist/client/assets');
const manifest = resolve(root, 'dist/client/fama-client-assets.json');
const snapshot = resolve(root, '.sites-runtime/client-assets');
const valid = name => typeof name === 'string' && /^[\w][\w.-]*\.(js|css|woff2?|png|jpe?g|svg|webp|avif|wasm(?:\.gz)?)$/.test(name);
const list = async () => { try { return (await readdir(assets, { withFileTypes: true })).filter(entry => entry.isFile() && valid(entry.name)).map(entry => entry.name); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } };
const json = async path => { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } };

if (process.argv[2] === 'capture') {
  const present = await list(); const previous = await json(manifest);
  const current = previous?.version === 1 && Array.isArray(previous.current) ? previous.current.filter(name => valid(name) && present.includes(name)) : present;
  const older = previous?.version === 1 && Array.isArray(previous.previous) ? previous.previous.filter(name => valid(name) && present.includes(name)) : [];
  const files = [...new Set([...current, ...older])];
  await rm(snapshot, { recursive: true, force: true }); await mkdir(snapshot, { recursive: true });
  for (const file of files) await copyFile(resolve(assets, file), resolve(snapshot, file));
  await writeFile(resolve(snapshot, 'manifest.json'), JSON.stringify({ current, files }));
} else if (process.argv[2] === 'restore') {
  const current = await list(); const saved = await json(resolve(snapshot, 'manifest.json'));
  await mkdir(assets, { recursive: true });
  for (const file of saved?.files ?? []) if (valid(file) && !current.includes(file)) await copyFile(resolve(snapshot, file), resolve(assets, file));
  await writeFile(manifest, JSON.stringify({ version: 1, current, previous: (saved?.current ?? []).filter(valid) }));
  await rm(snapshot, { recursive: true, force: true });
} else throw new Error('Use capture or restore.');
