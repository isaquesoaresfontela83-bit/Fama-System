import { env } from 'cloudflare:workers';
import { requireTenant, tenantError } from '@/lib/tenant';
export async function GET(request) {
    try {
        await requireTenant(request);
        const candidate = String(env.FAMA_GEOAPIFY_MAPS_PUBLIC_KEY ?? '').trim();
        const publicKey = /^[A-Za-z0-9_-]{16,128}$/.test(candidate) ? candidate : null;
        return Response.json({ provider: publicKey ? 'geoapify' : 'openstreetmap', configured: !!publicKey, publicKey }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível consultar o mapa.');
    }
}
