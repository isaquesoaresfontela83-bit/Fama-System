import { readdir, readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import path from 'node:path';

const roots = ['app', 'lib', 'hooks', 'components', 'db', 'worker', 'workers', 'build', 'supabase/functions'];
let count = 0;
async function check(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const item of entries) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) { await check(file); continue; }
    if (/\.(ts|tsx|mts)$/.test(file)) throw new Error(`Arquivo TypeScript remanescente: ${file}`);
    if (!/\.(js|jsx|mjs)$/.test(file)) continue;
    await transform(await readFile(file, 'utf8'), { loader: file.endsWith('.jsx') ? 'jsx' : 'js', format: 'esm', target: 'esnext', sourcefile: file });
    count++;
  }
}
for (const root of roots) await check(root);
for (const file of ['vite.config.js', 'next.config.js', 'drizzle.config.js']) {
  await transform(await readFile(file, 'utf8'), { loader: 'js', format: 'esm', sourcefile: file });
  count++;
}
console.log(`${count} arquivos JavaScript/JSX verificados.`);
