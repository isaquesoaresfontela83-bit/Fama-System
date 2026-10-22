import { requireTenant, RequestError, tenantError } from '@/lib/tenant';
import { hasFeaturePermission } from '@/lib/permissions';
import { assertRateLimit } from '@/lib/security';
import { readJsonObject } from '@/lib/request-body';
import { nearbyInput, nearbyPlaces } from '@/lib/nearby-places';
export async function POST(request) {
    try {
        const { user, organization } = await requireTenant(request);
        if (!['dashboard', 'agenda', 'mobile'].some(p => hasFeaturePermission(organization.role, organization.permissions, p, organization.moduleAccess)))
            throw new RequestError('Seu perfil não tem acesso ao mapa operacional.', 403);
        const input = nearbyInput(await readJsonObject(request, 2000));
        await assertRateLimit(request, 'nearby_places', user.id, 6, 60);
        await assertRateLimit(new Request('https://famasystem.online/'), 'nearby_places_shared', 'fama-system', 20, 60);
        return Response.json({ places: await nearbyPlaces(input), reference: input, source: 'OpenStreetMap / Overpass' }, { headers: { 'Cache-Control': 'private,no-store' } });
    }
    catch (e) {
        return tenantError(e, 'Não foi possível consultar os pontos de apoio.');
    }
}
