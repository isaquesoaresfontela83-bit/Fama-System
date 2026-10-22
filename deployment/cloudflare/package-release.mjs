import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, '.sites-runtime/cloudflare-release');
await mkdir(output, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const app of ['system', 'control']) {
    const serverRoot = join(root, 'apps', app, 'dist/server');
    const clientRoot = join(root, 'apps', app, 'dist/client');
    const server = [];
    async function collect(directory) {
        for (const item of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, item.name);
            if (item.isDirectory()) { if (!item.name.startsWith('.')) await collect(path); continue; }
            if (!/\.(js|mjs)$/.test(item.name) || /^fama-local-ai\.worker-/.test(item.name)) continue;
            server.push({ name: relative(serverRoot, path).replaceAll('\\', '/'), content: await readFile(path, 'utf8') });
        }
    }
    await collect(serverRoot);
    if (!server.some(file => file.name === 'fama-entry.mjs')) throw Error('Prepared entry is missing.');
    const client = [];
    for (const name of await readdir(join(clientRoot, 'assets'))) {
        if (!/\.(js|css)$/.test(name)) continue;
        const content = await readFile(join(clientRoot, 'assets', name));
        client.push({ path: '/assets/' + name, body_base64: content.toString('base64'), sha256: digest(content), size: content.length, content_type: name.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8' });
    }
    for (const [kind, files] of [['server', server], ['client', client]]) {
        const bytes = gzipSync(Buffer.from(JSON.stringify({ app, files })), { level: 9 });
        const path = join(output, `${app}-${kind}.json.gz`);
        await writeFile(path, bytes);
        console.log(JSON.stringify({ app, kind, files: files.length, gzipBytes: bytes.length, sha256: digest(bytes), path }));
    }
}
