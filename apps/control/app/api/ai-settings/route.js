import { parseAssistantSettings, parseAssistantSettingsEnvelope } from '@/lib/fama-ai-settings';
import { readPublicAssistantSettings } from '@/lib/fama-ai-settings-reader';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit } from '@/lib/security';
import { callRpc } from '@/lib/supabase';
import { requirePlatformAdmin, RequestError, tenantError } from '@/lib/tenant';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
/** Public preferences only: no company records, conversations or secrets. */
export async function GET() {
    try {
        return Response.json(await readPublicAssistantSettings(), { headers });
    }
    catch (error) {
        const response = tenantError(error, 'Não foi possível carregar a configuração da assistente.');
        for (const [key, value] of Object.entries(headers))
            response.headers.set(key, value);
        return response;
    }
}
export async function POST(request) {
    try {
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação não autorizada.', 403);
        const user = await requirePlatformAdmin();
        await assertRateLimit(request, 'ai_settings_save', user.id, 10, 60);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > 50_000)
            throw new RequestError('Configuração muito grande.', 400);
        let settings;
        let revision;
        try {
            const body = JSON.parse(raw);
            settings = parseAssistantSettings(body.settings);
            revision = body.revision;
            if (!Number.isInteger(revision) || revision < 1 || revision >= 2_147_483_647)
                throw new Error('Revisão inválida. Recarregue a configuração.');
        }
        catch (error) {
            throw new RequestError(error instanceof Error ? error.message : 'Configuração inválida.', 400);
        }
        // Revision comparison, update and audit happen in a single database transaction.
        const saved = await callRpc('fama_save_ai_settings', { p_settings: settings, p_revision: revision, p_actor_user_id: user.id });
        if (!saved)
            throw new RequestError('Outro administrador alterou a configuração. Recarregue antes de salvar.', 409);
        return Response.json(parseAssistantSettingsEnvelope(saved), { headers });
    }
    catch (error) {
        const response = tenantError(error, 'Não foi possível salvar a configuração da assistente.');
        for (const [key, value] of Object.entries(headers))
            response.headers.set(key, value);
        return response;
    }
}
