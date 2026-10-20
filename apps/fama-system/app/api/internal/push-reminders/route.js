import { isBackupRequest } from '@/lib/backup-auth';
import { runPushReminderBatch } from '@/lib/push-reminders';
export async function POST(request) { if (!await isBackupRequest(request))
    return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 }); const cursor = new URL(request.url).searchParams.get('cursor') || ''; if (cursor.length > 250 || /[\u0000-\u001f]/.test(cursor))
    return Response.json({ error: 'Cursor inválido.' }, { status: 400 }); try {
    return Response.json(await runPushReminderBatch(cursor), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch {
    return Response.json({ error: 'Não foi possível executar os lembretes.' }, { status: 503 });
} }
