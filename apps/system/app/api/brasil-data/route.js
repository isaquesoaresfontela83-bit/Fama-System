import { requireTenant, tenantError, RequestError } from '@/lib/tenant';
import { hasFeaturePermission } from '@/lib/permissions';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { queryBrasilData } from '@/lib/brasil-data-server';
export async function POST(request) { try {
    const { user, organization } = await requireTenant(request);
    if (!['customers', 'consultation', 'agenda', 'finance'].some(feature => hasFeaturePermission(organization.role, organization.permissions, feature, organization.moduleAccess)))
        throw new RequestError('Seu perfil não tem acesso a estas consultas.', 403);
    await assertRateLimit(request, 'brasil_data', user.id, 20, 60);
    const input = await readJsonObject(request, 8192);
    if (typeof input.id !== 'string' || !input.parameters || typeof input.parameters !== 'object' || Array.isArray(input.parameters))
        throw new RequestError('Consulta inválida.', 400);
    return Response.json(await queryBrasilData(input.id, input.parameters), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return tenantError(error, 'Não foi possível consultar a BrasilAPI.');
} }
