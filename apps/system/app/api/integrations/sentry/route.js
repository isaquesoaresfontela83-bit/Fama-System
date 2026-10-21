import { requireTenant, tenantError } from '@/lib/tenant';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { readIntegration, sendSentryEvent } from '@/lib/selected-integrations-server';
const headers = { 'Cache-Control': 'private,no-store' };
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request, ['owner','admin']);
        const settings = await readIntegration(organization.id, 'sentry');
        return Response.json({ enabled: settings.configured }, { headers });
    } catch (error) { return tenantError(error, 'Monitoramento indisponível.'); }
}
export async function POST(request) {
    try {
        const { organization, user } = await requireTenant(request, ['owner','admin']);
        await assertRateLimit(request, 'integration_sentry', `${organization.id}:${user.id}`, 10, 60);
        return Response.json(await sendSentryEvent(organization.id, await readJsonObject(request, 16 * 1024)), { headers });
    } catch (error) { return tenantError(error, 'Não foi possível confirmar o evento no Sentry.'); }
}
