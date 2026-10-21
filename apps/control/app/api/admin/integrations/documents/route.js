import { requirePlatformAdmin, tenantError } from '@/lib/tenant';
import { assertRateLimit } from '@/lib/security';
import { downloadPlatformDriveFile } from '@/lib/platform-integrations';
export async function GET(request) {
    try {
        const admin = await requirePlatformAdmin();
        await assertRateLimit(request, 'drive_document_download', admin.id, 20, 60);
        const result = await downloadPlatformDriveFile(new URL(request.url).searchParams.get('id'));
        return new Response(result.bytes, { headers: { 'Content-Type': result.mime, 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(result.name), 'Cache-Control': 'private,no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) { return tenantError(error, 'Não foi possível baixar o documento.'); }
}
