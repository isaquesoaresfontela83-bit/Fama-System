import { requirePlatformAdmin, tenantError, RequestError } from '@/lib/tenant';
import { isTrustedMutation } from '@/lib/request-security';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { integrationActions, integrationFields } from '@/lib/integration-settings';
import { runPlatformIntegration, testPlatformIntegration, recordIntegrationActivity } from '@/lib/platform-integrations';
const headers = { 'Cache-Control': 'private,no-store' };
const actions = new Set(['drive_upload', 'drive_list', 'resend_send', 'resend_status', 'ocr_extract', 'sentry_issues']);
export async function POST(request) {
    let provider, action;
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request)) throw new RequestError('Origem inválida.', 403);
        const input = await readJsonObject(request, 7 * 1024 * 1024);
        action = input.action; provider = action === 'test' ? input.provider : integrationActions[action];
        if (!integrationFields[provider] || (action !== 'test' && !actions.has(action))) throw new RequestError('Operação inválida.', 400);
        await assertRateLimit(request, 'admin_integration_action', admin.id, 20, 60);
        const result = action === 'test' ? await testPlatformIntegration(provider) : (await runPlatformIntegration(action, input, 'platform'))?.data;
        if (!result) throw new RequestError('Salve a configuração desta integração no Fama Control para usar esta ação.', 424);
        if (action !== 'resend_send') await recordIntegrationActivity(provider, action, action === 'test' && !result.verified ? 'review' : 'confirmed', result.id || result.event_id || '');
        return Response.json(result, { headers });
    } catch (error) {
        // Authorization failures and user content are never recorded in provider history.
        return tenantError(error, 'Não foi possível concluir a operação.');
    }
}
