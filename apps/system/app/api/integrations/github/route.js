import { requireTenant, tenantError, RequestError } from '@/lib/tenant';
export async function GET(request) {
    try {
        await requireTenant(request, ['owner','admin']);
        throw new RequestError('Esta consulta está disponível somente no Fama Control, em Integrações.', 410);
    } catch (error) { return tenantError(error, 'Consulta administrativa indisponível.'); }
}
