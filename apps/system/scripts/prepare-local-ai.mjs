import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(root, 'public/fama-ai-runtime');
await mkdir(destination, { recursive: true });
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const ort = JSON.parse(await readFile(join(root, 'node_modules/onnxruntime-web/package.json'), 'utf8'));
const prefix = `fama-transformers-${manifest.dependencies['@huggingface/transformers']}-ort-${ort.version}-delivery2-`;

for (const filename of ['ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  const source = join(root, 'node_modules/onnxruntime-web/dist', filename);
  await copyFile(source, join(destination, filename));
  if (!filename.includes('.jsep.')) await copyFile(source, join(destination, prefix + filename));
}
console.log('Local Fama AI browser runtime prepared.');
