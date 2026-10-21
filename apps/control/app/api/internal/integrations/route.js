import { isInternalRequest } from '@/lib/internal-auth';
import { readJsonObject } from '@/lib/request-body';
import { tenantError, RequestError } from '@/lib/tenant';
import { runPlatformIntegration, platformIntegrationSummary } from '@/lib/platform-integrations';
const headers = { 'Cache-Control': 'private,no-store' };
const actions = new Set(['integration_status', 'drive_upload', 'resend_send', 'ocr_extract', 'sentry_capture']);
export async function POST(request) {
    try {
        if (!await isInternalRequest(request)) throw new RequestError('Acesso não autorizado.', 401);
        const input = await readJsonObject(request, 7 * 1024 * 1024);
        if (!actions.has(input.action) || typeof input.organization_id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(input.organization_id)) throw new RequestError('Operação inválida.', 400);
        if (input.action === 'integration_status') return Response.json({ handled: true, integrations: (await platformIntegrationSummary()).filter(item => ['drive','resend','sentry','ocrspace'].includes(item.provider)).map(item => ({ provider: item.provider, managed: item.managed && (item.configured || !item.enabled), configured: item.enabled && item.configured })) }, { headers });
        const result = await runPlatformIntegration(input.action, input, input.organization_id);
        return Response.json(result ? { handled: true, ...result } : { handled: false }, { headers });
    } catch (error) { return tenantError(error, 'A central de integrações não confirmou a operação.'); }
}
