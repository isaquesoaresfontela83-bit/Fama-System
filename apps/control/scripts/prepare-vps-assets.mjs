import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

await import('./prepare-local-ai.mjs');
if (existsSync('scripts/prepare-barcode-runtime.mjs')) await import('./prepare-barcode-runtime.mjs');
if (existsSync('scripts/prepare-fcm-worker.mjs')) await import('./prepare-fcm-worker.mjs');

async function decompress(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filename = join(directory, entry.name);
        if (entry.isDirectory()) await decompress(filename);
        else if (filename.endsWith('.wasm.gz')) {
            const output = filename.slice(0, -3);
            try { await stat(output); } catch { await writeFile(output, gunzipSync(await readFile(filename))); }
        }
    }
}

await decompress('public');
if (existsSync('lib/reader-refresh.js')) {
    await mkdir('app/atualizar-leitor', { recursive: true });
    await writeFile('app/atualizar-leitor/route.js', "import { readerRefreshResponse } from '@/lib/reader-refresh';\nexport function GET() { return readerRefreshResponse(); }\n");
}
