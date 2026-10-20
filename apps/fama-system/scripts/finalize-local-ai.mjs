import { readdir, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Old open tabs can still request a worker hash from the previous release.
const root = process.env.SITES_PROJECT_ROOT || process.cwd();
const assets = resolve(root, 'dist/client/assets');
const files = (await readdir(assets)).filter(file => /^fama-local-ai\.worker-[\w-]+\.js$/.test(file));
if (files.length !== 1) throw new Error('Expected exactly one local AI worker bundle.');
const runtime = resolve(root, 'dist/client/fama-ai-runtime');
await mkdir(runtime, { recursive: true });
await copyFile(resolve(assets, files[0]), resolve(runtime, 'fama-local-ai.worker.js'));
