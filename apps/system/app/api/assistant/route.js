import { GET as readBootstrap } from '../bootstrap/route';
import { GET as readSettings } from '../ai-settings/route';
import { systemAssistantData, systemAssistantSources } from '@/lib/fama-ai-access';
import { parseAssistantSettingsEnvelope, restrictAssistantSettings } from '@/lib/fama-ai-settings';
import { assistantCalendar, parseAssistantRequest } from '@/lib/fama-ai-request';
import { answerNative } from '@/lib/fama-ai-provider';
import { cloudflareConnectionStatus, enrichWithCloudflare } from '@/lib/fama-ai-cloudflare';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit } from '@/lib/security';
import { requireTenant, RequestError, tenantError } from '@/lib/tenant';
import { hasBlockAccess } from '@/lib/fama-blocks';
import { assertPlanFeature } from '@/lib/plan-feature-access';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request);
        await assertPlanFeature(organization.plan, 'assistant');
        if (!hasBlockAccess(organization.moduleAccess, 'assistant'))
            throw new RequestError('O bloco Fama IA foi removido para este acesso.', 403);
        return Response.json(cloudflareConnectionStatus(), { headers });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request) {
    try {
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação não autorizada.', 403);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            throw new RequestError('Envie a consulta em JSON.', 415);
        if (Number(request.headers.get('content-length') || 0) > 20_000)
            throw new RequestError('Consulta muito grande.', 400);
        const { user, organization } = await requireTenant(request);
        await assertPlanFeature(organization.plan, 'assistant');
        if (!hasBlockAccess(organization.moduleAccess, 'assistant'))
            throw new RequestError('O bloco Fama IA foi removido para este acesso.', 403);
        let input;
        try {
            input = parseAssistantRequest(await request.text());
        }
        catch (error) {
            throw new RequestError(error instanceof Error ? error.message : 'Consulta inválida.', 400);
        }
        await assertRateLimit(request, 'assistant_query', user.id, 12, 60);
        const settingsResponse = await readSettings();
        if (!settingsResponse.ok)
            throw new RequestError('Não foi possível verificar a configuração da assistente.', 503);
        const envelope = parseAssistantSettingsEnvelope(await settingsResponse.json());
        const settings = restrictAssistantSettings(envelope.settings, systemAssistantSources(organization.role, organization.permissions, organization.moduleAccess));
        if (!settings.enabled || !settings.sources[input.source])
            throw new RequestError('Seu usuário não possui acesso a esta função da assistente.', 403);
        const bootstrap = await readBootstrap(request);
        if (!bootstrap.ok)
            return bootstrap;
        const data = systemAssistantData(await bootstrap.json(), organization.role, organization.permissions, organization.moduleAccess);
        const calendar = assistantCalendar(data, input.timeZone);
        const native = answerNative(input, calendar.data, settings, calendar.now);
        const answer = await enrichWithCloudflare(input, native, request.signal);
        return Response.json({ answer }, { headers });
    }
    catch (error) {
        return failure(error);
    }
}
function failure(error) {
    const response = tenantError(error, 'Não foi possível consultar a assistente.');
    for (const [key, value] of Object.entries(headers))
        response.headers.set(key, value);
    return response;
}
