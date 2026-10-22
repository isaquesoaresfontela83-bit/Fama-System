import { requestPublicUrl } from "@/lib/request-security";
import { requirePlatformAdmin } from '@/lib/tenant';
import { completeDriveAuthorization } from '@/lib/integration-google-oauth';
export async function GET(request) {
    let status = 'failed';
    try {
        const admin = await requirePlatformAdmin();
        await completeDriveAuthorization(admin.id, requestPublicUrl(request));
        status = 'connected';
    } catch { /* Never expose authorization codes, credential values or provider errors in URLs. */ }
    return new Response(null, { status: 303, headers: { Location: '/?drive=' + status + '#integrations', 'Cache-Control': 'private,no-store', 'Referrer-Policy': 'no-referrer' } });
}
