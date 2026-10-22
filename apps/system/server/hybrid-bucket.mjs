import { Buffer } from 'node:buffer';
export class HybridBucket {
    constructor(configuration) {
        this.origin = new URL(configuration.SUPABASE_URL);
        if (this.origin.protocol !== 'https:' || this.origin.username || this.origin.password || this.origin.pathname !== '/' || this.origin.search || this.origin.hash) throw new Error('Endereço do armazenamento inválido.');
        this.key = configuration.SUPABASE_SECRET_KEY;
        this.bucket = configuration.FAMA_BACKUP_BUCKET;
        if (!this.key || !/^[a-z0-9-]+$/.test(this.bucket || '')) throw new Error('Configure o bucket privado de backups.');
    }
    path(key) {
        if (!key || key.split('/').some(part => !part || part === '.' || part === '..') || /[\\\0]/.test(key)) throw new Error('Nome de arquivo inválido.');
        return key.split('/').map(encodeURIComponent).join('/');
    }
    async request(path, init = {}, missing = false) {
        const response = await fetch(new URL('/storage/v1/' + path, this.origin), { ...init, redirect: 'manual', signal: AbortSignal.timeout(25000), headers: {
            apikey: this.key, ...(this.key.startsWith('eyJ') ? { Authorization: 'Bearer ' + this.key } : {}), ...init.headers,
        } });
        if (missing && response.status === 404) { await response.body?.cancel(); return null; }
        if (!response.ok) { await response.body?.cancel(); throw new Error('O armazenamento privado não confirmou a operação.'); }
        return response;
    }
    async put(key, value, metadata = {}) {
        await this.request('object/' + this.bucket + '/' + this.path(key), { method: 'POST', headers: {
            'Content-Type': metadata.httpMetadata?.contentType || 'application/octet-stream', 'x-upsert': 'true',
        }, body: Buffer.from(await new Response(value).arrayBuffer()) });
        return { key };
    }
    async get(key) {
        const response = await this.request('object/authenticated/' + this.bucket + '/' + this.path(key), {}, true);
        if (!response) return null;
        const bytes = await response.arrayBuffer();
        return { key, size: bytes.byteLength, body: new Blob([bytes]).stream(), arrayBuffer: async () => bytes,
            text: async () => new TextDecoder().decode(bytes), json: async () => JSON.parse(new TextDecoder().decode(bytes)) };
    }
    async delete(keys) {
        const prefixes = Array.isArray(keys) ? keys : [keys];
        prefixes.forEach(key => this.path(key));
        await this.request('object/' + this.bucket, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes }) });
    }
    async list({ prefix = '', cursor = '', limit = 1000 } = {}) {
        const objects = [];
        const visit = async directory => {
            for (let offset = 0;; offset += 100) {
                const response = await this.request('object/list/' + this.bucket, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: directory, offset, limit: 100, sortBy: { column: 'name', order: 'asc' } }) });
                const entries = await response.json();
                if (!Array.isArray(entries)) throw new Error('Lista de backups inválida.');
                for (const entry of entries) {
                    if (!entry.name || entry.name.includes('/') || ['.', '..'].includes(entry.name)) throw new Error('Nome de backup inválido.');
                    const key = directory ? directory + '/' + entry.name : entry.name;
                    if (!entry.id) await visit(key);
                    else if (key.startsWith(prefix) && key > cursor) objects.push({ key, size: Number(entry.metadata?.size || 0), uploaded: new Date(entry.created_at) });
                    if (objects.length > 10000) throw new Error('A lista de backups exige paginação administrativa.');
                }
                if (entries.length < 100) break;
            }
        };
        // Prefixes used by backup-archive are directory prefixes.
        const directory = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix.slice(0, prefix.lastIndexOf('/') + 1).replace(/\/$/, '');
        if (directory) this.path(directory);
        await visit(directory);
        objects.sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        const page = objects.slice(0, Math.max(1, Math.min(1000, Number(limit) || 1000)));
        return { objects: page, truncated: page.length < objects.length, ...(page.length < objects.length ? { cursor: page.at(-1).key } : {}) };
    }
}
