import { archiveStatus, downloadArchive, recoveryKeyDownload } from "@/lib/backup-archive";
import { logAudit } from "@/lib/security";
import { backupSummary, downloadBackup, getBackupRun, startBackup, stepBackup } from "@/lib/platform-backup";
import { isTrustedMutation } from "@/lib/request-security";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";
export async function GET(request) {
    try {
        const user = await requirePlatformAdmin();
        const query = new URL(request.url).searchParams;
        if (query.get('key') === '1')
            return recoveryKeyDownload();
        if (query.get('source') === 'archive' && query.get('runId'))
            return downloadArchive(query.get('runId'));
        if (!query.get('runId'))
            return Response.json({ error: 'Inicie o backup para gerar uma cópia completa.' }, { status: 400 });
        const run = await getBackupRun(query.get('runId'));
        if (!run)
            throw new RequestError('Backup não encontrado.', 404);
        if (query.get('download') === '1') {
            if (run.status !== 'complete')
                throw new RequestError('O backup ainda não foi concluído.', 409);
            await logAudit({ actorUserId: user.id, eventType: 'export', entityType: 'platform_backup_v3', recordId: run.id });
            return downloadBackup(run);
        }
        return Response.json({ ...backupSummary(run), archive: await archiveStatus(run.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível consultar o backup.');
    }
}
export async function POST(request) {
    try {
        const user = await requirePlatformAdmin();
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação inválida.', 403);
        const body = await request.json();
        const run = body.runId ? await stepBackup(body.runId) : await startBackup();
        if (!run || !run.id)
            throw new RequestError('Backup não encontrado.', 404);
        if (!body.runId)
            await logAudit({ actorUserId: user.id, eventType: 'security', entityType: 'platform_backup_started', recordId: run.id });
        return Response.json(backupSummary(run), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível gerar ou validar o backup completo.');
    }
}
