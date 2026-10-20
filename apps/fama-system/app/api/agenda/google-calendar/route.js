import { env } from 'cloudflare:workers';
import { requireTenant, RequestError, tenantError } from '@/lib/tenant';
import { hasFeaturePermission } from '@/lib/permissions';
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request);
        if (!hasFeaturePermission(organization.role, organization.permissions, 'agenda', organization.moduleAccess))
            throw new RequestError('Seu perfil não tem acesso à agenda.', 403);
        const clientId = String(env.FAMA_GOOGLE_CALENDAR_CLIENT_ID || '').trim();
        const configured = /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
        return Response.json({ configured, clientId: configured ? clientId : null }, { headers: { 'Cache-Control': 'private,no-store' } });
    }
    catch (e) {
        return tenantError(e, 'Não foi possível consultar a integração Google Calendar.');
    }
}
