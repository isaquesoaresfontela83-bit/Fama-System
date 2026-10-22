import { env } from 'cloudflare:workers';
import { decryptText } from './crypto';
import { callRpc } from './supabase';
import { database } from "./database";
const runtime = () => env;
const root = (id) => { if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
    throw new Error('Backup inválido.'); return `fama-backups/${id}/`; };
const hash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const unlock = async (value) => { if (typeof value !== 'string' || !value.startsWith('fama:v1:'))
    throw new Error('Parte sem criptografia.'); return decryptText(value); };
export async function archiveStatus(id) { const bucket = runtime().BUCKET; if (!bucket)
    return { configured: false, complete: false }; const object = await bucket.get(root(id) + 'progress.json'); return object ? { configured: true, ...JSON.parse(await object.text()) } : { configured: true, complete: false }; }
async function mirrorUnlocked(run) {
    const bucket = runtime().BUCKET;
    if (!bucket)
        return { configured: false, complete: false };
    if (run.status !== 'complete' || !run.manifest_payload || run.manifest.verification?.valid !== true)
        throw new Error('Valide o backup antes de arquivar.');
    const path = root(run.id), saved = await bucket.get(path + 'progress.json');
    const progress = saved ? JSON.parse(await saved.text()) : { id: run.id, createdAt: run.created_at, cursor: 0, parts: run.manifest.partCount, complete: false };
    if (progress.parts !== run.manifest.partCount || progress.id !== run.id)
        throw new Error('Inventário externo divergente.');
    if (progress.complete)
        return { configured: true, ...progress };
    await bucket.put(path + 'progress.json', JSON.stringify(progress));
    const deadline = Date.now() + 20000;
    for (let n = 0; n < 8 && progress.cursor < progress.parts && Date.now() < deadline; n++) {
        const part = await callRpc('fama_backup_run_part', { p_run_id: run.id, p_offset: progress.cursor });
        const descriptor = run.manifest.parts[progress.cursor];
        if (!part || part.part_number !== progress.cursor || part.checksum !== descriptor.checksum || await hash(await unlock(part.payload)) !== descriptor.checksum)
            throw new Error('Parte externa inválida.');
        const encoded = JSON.stringify(part), key = path + `parts/${String(progress.cursor).padStart(6, '0')}.json`;
        await bucket.put(key, encoded, { httpMetadata: { contentType: 'application/octet-stream' } });
        const stored = await bucket.get(key);
        if (!stored || await hash(await stored.text()) !== await hash(encoded))
            throw new Error('A leitura externa divergiu.');
        progress.cursor++;
        await bucket.put(path + 'progress.json', JSON.stringify(progress));
    }
    if (progress.cursor === progress.parts) {
        const manifest = JSON.stringify({ format: 'fama-platform-backup-v3', exportedAt: run.created_at, encrypted: true, algorithm: 'AES-256-GCM', manifest: run.manifest_payload, partsCount: progress.parts });
        await bucket.put(path + 'manifest.json', manifest, { httpMetadata: { contentType: 'application/octet-stream' } });
        const copy = await bucket.get(path + 'manifest.json');
        if (!copy || await hash(await copy.text()) !== await hash(manifest))
            throw new Error('Manifesto externo divergente.');
        progress.complete = true;
        progress.checkedAt = new Date().toISOString();
        await bucket.put(path + 'progress.json', JSON.stringify(progress));
    }
    return { configured: true, ...progress };
}
export async function mirrorBackup(run) {
    if (!runtime().BUCKET)
        return { configured: false, complete: false };
    const db = database(), now = Date.now(), lease = String(now + 120000), key = 'backup_archive_runtime_lease';
    const acquired = await db.prepare('INSERT INTO platform_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE CAST(platform_settings.value AS INTEGER) < ?').bind(key, lease, new Date().toISOString(), now).run();
    if (!acquired.meta.changes)
        return { ...await archiveStatus(run.id), busy: true };
    try {
        return await mirrorUnlocked(run);
    }
    finally {
        await db.prepare('UPDATE platform_settings SET value=? WHERE key=? AND value=?').bind('0', key, lease).run();
    }
}
export async function downloadArchive(id) {
    const bucket = runtime().BUCKET;
    if (!bucket)
        throw new Error('Cópia externa indisponível.');
    const path = root(id), status = await archiveStatus(id);
    if (!status.complete)
        throw new Error('Cópia externa em processamento.');
    const object = await bucket.get(path + 'manifest.json');
    if (!object)
        throw new Error('Manifesto externo ausente.');
    const manifest = JSON.parse(await object.text());
    const verified = JSON.parse(await unlock(manifest.manifest));
    if (verified.runId !== id || verified.partCount !== manifest.partsCount || verified.verification?.valid !== true)
        throw new Error('Manifesto externo inválido.');
    const encoder = new TextEncoder();
    let offset = -1;
    const stream = new ReadableStream({ async pull(controller) {
            try {
                if (offset === -1) {
                    const { partsCount, ...header } = manifest;
                    void partsCount;
                    controller.enqueue(encoder.encode(JSON.stringify(header).slice(0, -1) + ',"parts":['));
                    offset = 0;
                    return;
                }
                if (offset === manifest.partsCount) {
                    controller.enqueue(encoder.encode(']}'));
                    controller.close();
                    return;
                }
                const object = await bucket.get(path + `parts/${String(offset).padStart(6, '0')}.json`);
                if (!object)
                    throw new Error('Parte externa ausente.');
                const data = await object.text(), part = JSON.parse(data), plain = await unlock(part.payload), content = JSON.parse(plain);
                if (part.part_number !== offset || content.runId !== id || content.number !== offset || await hash(plain) !== part.checksum || part.checksum !== verified.parts[offset]?.checksum)
                    throw new Error('Parte externa corrompida.');
                controller.enqueue(encoder.encode((offset ? ',' : '') + data));
                offset++;
            }
            catch (error) {
                controller.error(error);
            }
        } });
    return new Response(stream, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="fama-backup-${manifest.exportedAt.slice(0, 10)}.json"`, 'Cache-Control': 'private, no-store' } });
}
export async function pruneArchive() {
    const bucket = runtime().BUCKET;
    if (!bucket)
        return;
    const today = new Date().toISOString().slice(0, 10), last = await bucket.get('fama-backups/cleanup-date');
    if (last && await last.text() === today)
        return;
    let cursor;
    const cutoff = Date.now() - 30 * 86400000;
    do {
        const page = await bucket.list({ prefix: 'fama-backups/', cursor });
        for (const object of page.objects.filter(o => o.key.endsWith('/progress.json'))) {
            const file = await bucket.get(object.key);
            if (!file)
                continue;
            const p = JSON.parse(await file.text());
            if (!Number.isFinite(Date.parse(p.createdAt)) || Date.parse(p.createdAt) >= cutoff)
                continue;
            let next;
            do {
                const old = await bucket.list({ prefix: root(p.id), cursor: next });
                if (old.objects.length)
                    await bucket.delete(old.objects.map(o => o.key));
                next = old.truncated ? old.cursor : undefined;
            } while (next);
        }
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    await bucket.put('fama-backups/cleanup-date', today);
}
export function recoveryKeyDownload() { const key = runtime().FAMA_DATA_ENCRYPTION_KEY; if (!key)
    throw new Error('Chave de recuperação indisponível.'); return new Response(JSON.stringify({ format: 'fama-backup-key-v1', algorithm: 'AES-256-GCM', key, note: 'Guarde em um local privado, separado do backup.' }, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="fama-chave-recuperacao.json"', 'Cache-Control': 'private, no-store' } }); }
