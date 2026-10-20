import { requireTenant, tenantError, RequestError } from '@/lib/tenant';
import { integrationStatus } from '@/lib/selected-integrations-server';
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request, ['owner','admin']);
        return Response.json({ integrations: await integrationStatus(organization.id) }, { headers: { 'Cache-Control': 'private,no-store' } });
    } catch (error) { return tenantError(error, 'Não foi possível carregar as integrações.'); }
}
export async function POST(request) {
    try {
        await requireTenant(request, ['owner','admin']);
        throw new RequestError('As credenciais destas integrações são configuradas somente no backend da plataforma.', 405);
    } catch (error) { return tenantError(error, 'Não foi possível alterar a integração.'); }
}
