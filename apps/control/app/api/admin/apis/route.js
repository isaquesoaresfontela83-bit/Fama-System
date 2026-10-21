import { requirePlatformAdmin, tenantError, RequestError } from '@/lib/tenant';
import { isTrustedMutation } from '@/lib/request-security';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { allApiStatus, probeApi } from '@/lib/control-api-status';
const headers = { 'Cache-Control': 'private,no-store' };
export async function GET() {
    try { await requirePlatformAdmin(); return Response.json(await allApiStatus(), { headers }); }
    catch (error) { return tenantError(error, 'Não foi possível conferir o inventário de APIs.'); }
}
export async function POST(request) {
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request)) throw new RequestError('Origem inválida.', 403);
        const input = await readJsonObject(request, 1024);
        if (typeof input.id !== 'string' || !['system','control'].includes(input.scope) || Object.keys(input).some(key => !['id','scope'].includes(key))) throw new RequestError('Diagnóstico inválido.', 400);
        await assertRateLimit(request, 'api_diagnostic', admin.id, 20, 60);
        return Response.json(await probeApi(input.id, input.scope), { headers });
    } catch (error) { return tenantError(error, 'Não foi possível executar o diagnóstico.'); }
}
