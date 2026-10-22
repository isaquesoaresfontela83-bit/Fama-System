import { isBackupRequest } from "@/lib/backup-auth";
import { readD1Backup, verifyD1Backup } from "@/lib/d1-backup";
export async function GET(request) {
    if (!await isBackupRequest(request))
        return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
    try {
        const snapshot = await readD1Backup();
        const verification = await verifyD1Backup(snapshot);
        return Response.json({ snapshot, verification }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch {
        return Response.json({ error: "O backup local não passou na restauração isolada." }, { status: 503 });
    }
}
