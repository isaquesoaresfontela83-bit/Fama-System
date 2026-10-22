import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/** File-backed encrypted backup objects on a private persistent volume. */
export class VpsBucket {
    constructor(directory) { this.directory = resolve(directory); }

    path(key) {
        if (typeof key !== 'string' || !key || key.split('/').some(part => !part || part === '.' || part === '..') || /[\\\0]/.test(key)) {
            throw new Error('Nome de arquivo inválido.');
        }
        const target = resolve(this.directory, key);
        if (!target.startsWith(this.directory + sep)) throw new Error('Arquivo fora do armazenamento.');
        return target;
    }

    async get(key) {
        const filename = this.path(key);
        let bytes, metadata;
        try { bytes = await readFile(filename); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
        try { metadata = JSON.parse(await readFile(filename + '.meta.json', 'utf8')); } catch { metadata = {}; }
        const info = await stat(filename);
        return {
            key, size: bytes.length, uploaded: info.mtime,
            etag: createHash('sha256').update(bytes).digest('hex'),
            httpMetadata: metadata.httpMetadata ?? {}, customMetadata: metadata.customMetadata ?? {},
            body: new Blob([bytes]).stream(),
            text: async () => bytes.toString('utf8'),
            json: async () => JSON.parse(bytes.toString('utf8')),
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        };
    }

    async put(key, value, metadata = {}) {
        const filename = this.path(key);
        const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(await new Response(value).arrayBuffer());
        await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
        const temporary = filename + '.tmp-' + randomUUID();
        await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
        await rename(temporary, filename);
        await writeFile(filename + '.meta.json', JSON.stringify({ httpMetadata: metadata.httpMetadata, customMetadata: metadata.customMetadata }), { mode: 0o600 });
        return { key, size: bytes.length, etag: createHash('sha256').update(bytes).digest('hex') };
    }

    async delete(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            for (const filename of [this.path(key), this.path(key) + '.meta.json']) {
                try { await unlink(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
            }
        }
    }

    async list({ prefix = '', cursor, limit = 1000 } = {}) {
        const objects = [];
        const visit = async (directory, parent = '') => {
            let entries;
            try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
            for (const entry of entries) {
                const key = parent + entry.name;
                if (entry.isDirectory()) await visit(resolve(directory, entry.name), key + '/');
                else if (entry.isFile() && !key.endsWith('.meta.json') && !key.includes('.tmp-') && key.startsWith(prefix) && (!cursor || key > cursor)) {
                    const info = await stat(this.path(key));
                    objects.push({ key, size: info.size, uploaded: info.mtime });
                }
            }
        };
        await visit(this.directory);
        objects.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        const page = objects.slice(0, Math.max(1, Math.min(1000, Number(limit) || 1000)));
        const truncated = page.length < objects.length;
        return { objects: page, truncated, ...(truncated ? { cursor: page.at(-1).key } : {}) };
    }
}
