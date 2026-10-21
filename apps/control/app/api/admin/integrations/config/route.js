import { requirePlatformAdmin, tenantError, RequestError } from '@/lib/tenant';
import { isTrustedMutation } from '@/lib/request-security';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { platformIntegrationSummary, savePlatformIntegration, integrationActivity, recordIntegrationActivity } from '@/lib/platform-integrations';
const headers = { 'Cache-Control': 'private,no-store' };
export async function GET() {
    try {
        await requirePlatformAdmin();
        return Response.json({ integrations: await platformIntegrationSummary(), activity: await integrationActivity() }, { headers });
    } catch (error) { return tenantError(error, 'Não foi possível carregar a central de integrações.'); }
}
export async function PATCH(request) {
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request)) throw new RequestError('Origem inválida.', 403);
        await assertRateLimit(request, 'admin_integration_config', admin.id, 20, 60);
        const input = await readJsonObject(request, 32000), integration = await savePlatformIntegration(input);
        await recordIntegrationActivity(input.provider, 'config_saved', 'saved');
        return Response.json({ integration }, { headers });
    } catch (error) { return tenantError(error, 'Não foi possível salvar a integração.'); }
}
