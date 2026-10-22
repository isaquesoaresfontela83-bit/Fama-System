import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const apps = process.argv[2] ? [process.argv[2]] : ['system', 'control'];
if (apps.some(app => !['system', 'control'].includes(app))) {
  throw new Error('Choose system or control.');
}

for (const app of apps) {
  const appRoot = join(root, 'apps', app);
  const server = join(appRoot, 'dist/server');
  const client = join(appRoot, 'dist/client');
  const configPath = join(server, 'wrangler.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const source = JSON.parse(await readFile(join(appRoot, 'deployment/cloudflare.json'), 'utf8'));
  if (config.name !== source.name) throw new Error('Build does not target the expected Cloudflare Worker.');

  const assets = [];
  for (const filename of (await readdir(join(client, 'assets'))).sort()) {
    if (!/\.(js|css)$/.test(filename)) continue;
    const body = await readFile(join(client, 'assets', filename));
    assets.push({ app, path: '/assets/' + filename, size: body.length,
      sha256: createHash('sha256').update(body).digest('hex') });
  }
  if (!assets.length) throw new Error('Client build is missing.');

  await copyFile(join(here, app + '-entry.mjs'), join(server, 'fama-entry.mjs'));
  config.main = 'fama-entry.mjs';
  config.d1_databases = source.d1_databases;
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  await writeFile(join(server, 'fama-static-assets.json'), JSON.stringify(assets, null, 2) + '\n');
  console.log(JSON.stringify({ app, worker: config.name, clientAssets: assets.length }));
}
