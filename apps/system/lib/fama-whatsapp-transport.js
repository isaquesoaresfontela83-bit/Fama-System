import { env } from 'cloudflare:workers';
import { RequestError } from './tenant';
import { limitedWhatsappBody } from './fama-whatsapp';
export async function whatsappSignature(raw, signature, secret) {
    if (!/^sha256=[0-9a-f]{64}$/i.test(signature || '') || !secret)
        return false;
    const bytes = Uint8Array.from(signature.slice(7).match(/../g), value => parseInt(value, 16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(raw));
}
export async function whatsappGraph(phoneNumberId, accessToken, message) {
    if (!/^\d{5,30}$/.test(phoneNumberId))
        throw new RequestError('ID do número oficial inválido.', 400);
    const runtime = env;
    const version = String(runtime.META_GRAPH_VERSION || 'v23.0');
    if (!/^v\d{1,2}\.0$/.test(version))
        throw new RequestError('Versão da conexão Meta inválida.', 503);
    const suffix = message ? '/messages' : '?fields=id,display_phone_number,verified_name';
    let response;
    try {
        response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}${suffix}`, {
            method: message ? 'POST' : 'GET', headers: { Authorization: `Bearer ${accessToken}`, ...(message ? { 'Content-Type': 'application/json' } : {}) },
            ...(message ? { body: JSON.stringify(message) } : {}), redirect: 'manual', signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok || response.status >= 300) {
            void response.body?.cancel().catch(() => { });
            throw new Error('provider_rejected');
        }
        const raw = await limitedWhatsappBody(response, 32_000, 10_000);
        const result = JSON.parse(raw);
        if (!result || typeof result !== 'object' || Array.isArray(result))
            throw new Error('provider_payload');
        return result;
    }
    catch {
        throw new RequestError('Não foi possível confirmar a resposta da Meta. Confira a conexão antes de tentar novamente.', 502);
    }
}
