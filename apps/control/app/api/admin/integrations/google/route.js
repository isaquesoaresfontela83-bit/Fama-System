import { requestPublicUrl } from "@/lib/request-security";
import { requirePlatformAdmin, tenantError, RequestError } from '@/lib/tenant';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit } from '@/lib/security';
import { beginDriveAuthorization } from '@/lib/integration-google-oauth';
export async function POST(request) {
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request)) throw new RequestError('Origem inválida.', 403);
        await assertRateLimit(request, 'drive_connect', admin.id, 8, 60);
        return Response.json(await beginDriveAuthorization(admin.id, requestPublicUrl(request).origin), { headers: { 'Cache-Control': 'private,no-store' } });
    } catch (error) { return tenantError(error, 'Não foi possível iniciar a conexão com o Google.'); }
}
