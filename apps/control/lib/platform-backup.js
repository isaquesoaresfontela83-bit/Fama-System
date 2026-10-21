import { env } from "cloudflare:workers";
import { encryptText, decryptText } from "@/lib/crypto";
import { readD1Backup, verifyD1Backup } from "@/lib/d1-backup";
import { callRpc, selectOne, selectRows } from "@/lib/supabase";
import { mirrorBackup, pruneArchive } from "./backup-archive";
const runtime = () => env;
const sha256 = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value))).map(byte => byte.toString(16).padStart(2, '0')).join('');
function base64(bytes) { let value = ''; for (let start = 0; start < bytes.length; start += 8192)
    value += String.fromCharCode(...bytes.subarray(start, start + 8192)); return btoa(value); }
function bytes64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
async function storage(path, init = {}) {
    const config = runtime(), key = String(config.SUPABASE_SECRET_KEY ?? '');
    if (!key || !config.SUPABASE_URL)
        throw new Error('O armazenamento do backup não está configurado.');
    const headers = new Headers(init.headers);
    headers.set('apikey', key);
    if (key.startsWith('eyJ'))
        headers.set('Authorization', `Bearer ${key}`);
    const response = await fetch(`${String(config.SUPABASE_URL).replace(/\/+$/, '')}/storage/v1/object/${path}`, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(25000) });
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Não foi possível copiar ou conferir um arquivo do backup.');
    }
    return response;
}
export async function startBackup(scheduled = false) { return callRpc('fama_start_full_backup', { p_scheduled: scheduled }); }
export async function getBackupRun(id) { return selectOne('fama_full_backup_runs', { id }); }
async function part(run, lease, kind, content, rows) {
    const number = run.manifest.partCount;
    const plain = JSON.stringify({ format: 'fama-backup-part-v3', runId: run.id, number, kind, content });
    const checksum = await sha256(plain), payload = await encryptText(plain);
    if (await sha256(await decryptText(payload)) !== checksum)
        throw new Error('A recuperação da parte criptografada divergiu.');
    await callRpc('fama_put_backup_part', { p_run_id: run.id, p_lease_id: lease, p_number: number, p_payload: payload, p_checksum: checksum });
    run.manifest.parts.push({ number, kind, checksum, ...(rows !== undefined ? { rows } : {}) });
    run.manifest.partCount++;
}
async function copyStorageFile(run, lease, object) {
    const bucket = String(object.bucket_id), name = String(object.name), path = `${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`;
    const response = await storage(path), mime = response.headers.get('content-type') ?? 'application/octet-stream';
    const limit = 12 * 1024 * 1024;
    if (Number(response.headers.get('content-length') ?? 0) > limit) {
        await response.body?.cancel();
        throw new Error('Um arquivo excede o tamanho de 12 MB suportado neste backup. O backup não foi marcado como completo.');
    }
    const content = new Uint8Array(await response.arrayBuffer());
    const meta = object.metadata;
    if (content.length > limit || (meta?.size !== undefined && Number(meta.size) !== content.length))
        throw new Error('O arquivo mudou durante o backup ou excede o tamanho permitido.');
    const checksum = await sha256(content), temporary = `__fama_backup_verify/${run.id}/${crypto.randomUUID()}`;
    const tempPath = `${encodeURIComponent(bucket)}/${temporary}`;
    let uploaded = false;
    try {
        const put = await storage(tempPath, { method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: content });
        await put.body?.cancel();
        uploaded = true;
        const copy = await storage(tempPath);
        const restored = new Uint8Array(await copy.arrayBuffer());
        if (await sha256(restored) !== checksum)
            throw new Error('O arquivo não passou na restauração isolada.');
        const pieceSize = 2 * 1024 * 1024;
        for (let offset = 0; offset < content.length || offset === 0; offset += pieceSize) {
            const encoded = base64(content.subarray(offset, offset + pieceSize));
            if (await sha256(bytes64(encoded)) !== await sha256(content.subarray(offset, offset + pieceSize)))
                throw new Error('O conteúdo binário recuperado divergiu.');
            await part(run, lease, 'storage-file', { bucket, name, mime, offset, size: content.length, checksum, data: encoded });
        }
    }
    finally {
        if (uploaded) {
            const deleted = await storage(encodeURIComponent(bucket), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [temporary] }) });
            await deleted.body?.cancel();
        }
    }
    run.manifest.fileCount++;
}
export async function stepBackup(id) {
    const lease = crypto.randomUUID();
    const run = await callRpc('fama_claim_backup_run', { p_run_id: id, p_lease_id: lease });
    if (!run)
        return { ...await getBackupRun(id), busy: true };
    try {
        let budget = 8;
        while (budget-- > 0 && run.manifest.stage === 'postgres') {
            const table = run.manifest.source.inventory[run.manifest.index];
            if (!table) {
                run.manifest.stage = 'local';
                break;
            }
            const rows = table.count ? await callRpc('fama_backup_snapshot_page', { p_backup_id: run.source_backup_id, p_key: table.key, p_offset: run.manifest.offset }) : [];
            const expected = Math.min(100, table.count - run.manifest.offset);
            if (rows.length !== expected)
                throw new Error('A coleção do backup ficou incompleta.');
            await part(run, lease, 'postgres-table', { schema: table.schema, table: table.name, offset: run.manifest.offset, rows }, rows.length);
            run.manifest.offset += rows.length;
            if (run.manifest.offset >= table.count) {
                run.manifest.index++;
                run.manifest.offset = 0;
            }
        }
        if (run.manifest.stage === 'local') {
            const control = await readD1Backup(), controlCheck = await verifyD1Backup(control);
            await part(run, lease, 'd1-control', control);
            const token = String(runtime().FAMA_BACKUP_SERVICE_TOKEN ?? '');
            if (!token)
                throw new Error('A chave do backup compartilhado não está configurada.');
            const values = runtime();
            const send = values.FAMA_SYSTEM?.fetch ? values.FAMA_SYSTEM.fetch.bind(values.FAMA_SYSTEM) : fetch;
            const response = await send('https://famasystem.online/api/internal/backup-d1', { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual', signal: AbortSignal.timeout(45000) });
            if (!response.ok)
                throw new Error('O Fama System não confirmou o backup local.');
            const system = await response.json();
            if (system.verification?.valid !== true || !Array.isArray(system.snapshot?.tables))
                throw new Error('A restauração local do Fama System não foi confirmada.');
            await part(run, lease, 'd1-system', system.snapshot);
            run.manifest.d1 = { control: controlCheck, system: system.verification };
            run.manifest.stage = 'files';
            run.manifest.index = 0;
        }
        else if (run.manifest.stage === 'files') {
            const objects = run.manifest.source.inventory.find(table => table.schema === 'storage' && table.name === 'objects');
            if (!objects || run.manifest.index >= objects.count)
                run.manifest.stage = 'verify';
            else {
                const offset = Math.floor(run.manifest.index / 100) * 100;
                const page = await callRpc('fama_backup_snapshot_page', { p_backup_id: run.source_backup_id, p_key: objects.key, p_offset: offset });
                const object = page[run.manifest.index - offset];
                if (!object)
                    throw new Error('Arquivo ausente no inventário do backup.');
                await copyStorageFile(run, lease, object);
                run.manifest.index++;
            }
        }
        if (run.manifest.stage === 'verify') {
            const postgres = await callRpc('fama_verify_backup_snapshot', { p_backup_id: run.source_backup_id });
            if (postgres?.valid !== true)
                throw new Error('A restauração completa do banco não foi confirmada.');
            run.manifest.verification = { postgres };
            run.manifest.stage = 'parts-check';
            run.manifest.index = 0;
        }
        if (run.manifest.stage === 'parts-check') {
            for (let checked = 0; checked < 8 && run.manifest.index < run.manifest.parts.length; checked++) {
                const descriptor = run.manifest.parts[run.manifest.index];
                const saved = await callRpc('fama_backup_run_part', { p_run_id: run.id, p_offset: descriptor.number });
                if (!saved || saved.checksum !== descriptor.checksum || await sha256(await decryptText(saved.payload)) !== descriptor.checksum)
                    throw new Error('Uma parte salva do backup está ausente ou corrompida.');
                run.manifest.index++;
            }
            if (run.manifest.index === run.manifest.parts.length) {
                run.manifest.verification = { valid: true, postgres: run.manifest.verification?.postgres, d1: run.manifest.d1, files: run.manifest.fileCount, encryptedParts: run.manifest.partCount, checkedAt: new Date().toISOString() };
                run.manifest.stage = 'complete';
            }
        }
        const status = run.manifest.stage === 'complete' ? 'complete' : 'running';
        const payload = status === 'complete' ? await encryptText(JSON.stringify({ format: 'fama-backup-manifest-v3', runId: run.id, ...run.manifest })) : '';
        if (!await callRpc('fama_commit_backup_run', { p_run_id: run.id, p_lease_id: lease, p_manifest: run.manifest, p_status: status, p_manifest_payload: payload, p_error: '' }))
            throw new Error('A atualização do backup não foi confirmada.');
        return { ...run, status, manifest_payload: payload };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'O backup não foi concluído.';
        await callRpc('fama_commit_backup_run', { p_run_id: run.id, p_lease_id: lease, p_manifest: run.manifest, p_status: 'failed', p_manifest_payload: '', p_error: message }).catch(() => undefined);
        throw new Error(message);
    }
}
export async function automaticBackup() {
    const active = (await selectRows('fama_full_backup_runs', { status: 'running' }, { order: 'created_at.asc', limit: 1 }))[0];
    if (active)
        return stepBackup(active.id);
    const latest = (await selectRows('fama_full_backup_runs', { scheduled: true, status: 'complete' }, { order: 'created_at.desc', limit: 1 }))[0];
    const today = new Date().toISOString().slice(0, 10);
    if (latest?.created_at.slice(0, 10) === today) {
        const archive = await mirrorBackup(latest);
        if (archive.complete)
            await pruneArchive();
        return { ...latest, archive };
    }
    if (new Date().getUTCHours() < 6)
        return latest ?? null;
    return startBackup(true);
}
export function backupSummary(run) {
    const inventory = run.manifest.source.inventory;
    return { id: run.id, status: run.status, valid: run.status === 'complete', format: 'fama-platform-backup-v3', encrypted: true,
        tables: inventory.length, records: inventory.reduce((total, table) => total + table.count, 0),
        organizations: inventory.find(table => table.key === 'organizations')?.count ?? 0, members: inventory.find(table => table.key === 'organization_members')?.count ?? 0,
        attachments: run.manifest.fileCount, parts: run.manifest.partCount, archive: run.archive, verification: run.manifest.verification, error: run.error || undefined };
}
export function downloadBackup(run) {
    const encoder = new TextEncoder();
    let offset = -1;
    const stream = new ReadableStream({ async pull(controller) {
            try {
                if (offset === -1) {
                    controller.enqueue(encoder.encode(JSON.stringify({ format: 'fama-platform-backup-v3', exportedAt: run.created_at, encrypted: true, algorithm: 'AES-256-GCM', manifest: run.manifest_payload }).slice(0, -1) + ',"parts":['));
                    offset = 0;
                    return;
                }
                const saved = await callRpc('fama_backup_run_part', { p_run_id: run.id, p_offset: offset });
                if (!saved) {
                    if (offset !== run.manifest.partCount)
                        throw new Error('Backup incompleto.');
                    controller.enqueue(encoder.encode(']}'));
                    controller.close();
                    return;
                }
                controller.enqueue(encoder.encode((offset ? ',' : '') + JSON.stringify(saved)));
                offset++;
            }
            catch (error) {
                controller.error(error);
            }
        } });
    return new Response(stream, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="fama-platform-backup-${run.created_at.slice(0, 10)}.json"`, 'Cache-Control': 'private, no-store' } });
}
