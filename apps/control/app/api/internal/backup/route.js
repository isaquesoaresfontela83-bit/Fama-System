import { isBackupRequest } from "@/lib/backup-auth";
import { automaticBackup, backupSummary } from "@/lib/platform-backup";
export async function POST(request) {
    if (!await isBackupRequest(request))
        return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    try {
        const run = await automaticBackup();
        return Response.json(run ? backupSummary(run) : { status: 'waiting' }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch {
        return Response.json({ error: 'O backup completo não foi concluído. Consulte o Fama Control.' }, { status: 503 });
    }
}
