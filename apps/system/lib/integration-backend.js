import { env } from 'cloudflare:workers';
import { getSupabaseAccessToken } from '@/app/system-auth';
import { RequestError } from '@/lib/request-error';
import { readLimitedBody } from '@/lib/request-body';

const actions = {
    'fama-system-integrations': new Set(['integration_status', 'drive_upload', 'resend_send', 'ocr_extract', 'sentry_capture']),
    'fama-control-admin': new Set(['integration_status', 'github_rest_get', 'ipinfo_lookup', 'ipinfo_lite_lookup']),
};

async function centralOperation(action, input) {
    if (!env.FAMA_DATA_BRIDGE_SECRET) return null;
    const send = env.FAMA_CONTROL?.fetch ? env.FAMA_CONTROL.fetch.bind(env.FAMA_CONTROL) : fetch;
    let response;
    try {
        response = await send('https://control.famasystem.online/api/internal/integrations', {
            method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
            headers: { Authorization: 'Bearer ' + env.FAMA_DATA_BRIDGE_SECRET, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...input, action }),
        });
    } catch { throw new RequestError('A central de integrações do Fama Control está indisponível.', 502); }
    // Allows a compatible rolling update while the companion's new route is published.
    if (response.status === 404) { await response.body?.cancel(); return null; }
    let result;
    try { result = JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 2 * 1024 * 1024, 30000))); }
    catch { throw new RequestError('A central de integrações retornou uma resposta inválida.', 502); }
    if (!response.ok) throw new RequestError(typeof result.error === 'string' ? result.error.slice(0,300) : 'A central de integrações não confirmou a operação.', [400,401,403,409,413,424,429,503].includes(response.status) ? response.status : 502);
    return result;
}

// Use the selected server-side session. Never accept a provider key or JWT from the browser body.
export async function integrationBackend(service, action, input = {}) {
    if (!actions[service]?.has(action)) throw new RequestError('Operação de integração inválida.', 400);
    const token = await getSupabaseAccessToken();
    if (!token) throw new RequestError('Entre novamente na sua conta para usar esta integração.', 401);
    let overrides = null;
    const statusKeys = { drive: 'google_drive', resend: 'resend', sentry: 'sentry', ocrspace: 'ocr_space' };
    if (service === 'fama-system-integrations') {
        const central = await centralOperation(action, input);
        if (action === 'integration_status' && Array.isArray(central?.integrations)) {
            overrides = Object.fromEntries(central.integrations.filter(item => item.managed && statusKeys[item.provider]).map(item => [statusKeys[item.provider], { configured: item.configured === true }]));
            if (Object.keys(overrides).length === 4) return { data: overrides };
        } else if (central?.handled) return { data: central.data };
    }
    let origin;
    try {
        const url = new URL(String(env.SUPABASE_URL || ''));
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/') throw new Error();
        origin = url.origin;
    } catch { throw new RequestError('O serviço de integrações ainda não foi configurado.', 503); }
    let response;
    try {
        response = await fetch(`${origin}/functions/v1/${service}`, {
            method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: String(env.SUPABASE_PUBLISHABLE_KEY || '') },
            body: JSON.stringify({ ...input, action }),
        });
    } catch { throw new RequestError('O serviço de integrações não respondeu. Tente novamente.', 502); }
    if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new RequestError('O serviço de integrações retornou uma resposta inesperada.', 502);
    }
    let result;
    try { result = JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 2 * 1024 * 1024, 30000))); }
    catch { throw new RequestError('O serviço de integrações retornou uma resposta inválida.', 502); }
    if (!response.ok || result?.ok !== true) {
        const status = [400, 401, 402, 403, 404, 408, 409, 413, 415, 422, 424, 429].includes(response.status) ? response.status : 502;
        const message = typeof result?.message === 'string' && result.message.length <= 400 ? result.message : 'Não foi possível concluir a integração.';
        throw new RequestError(message, status);
    }
    if (!result.data || typeof result.data !== 'object' || (Array.isArray(result.data) && action !== 'github_rest_get')) throw new RequestError('Resposta de integração incompleta.', 502);
    return overrides ? { ...result, data: { ...result.data, ...overrides } } : result;
}
