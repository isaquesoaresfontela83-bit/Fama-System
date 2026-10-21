import { env } from 'cloudflare:workers';
import { isTrustedMutation } from '@/lib/request-security';
import { testCloudflareConnection } from '@/lib/fama-ai-cloudflare';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
let previousTest = 0;
async function authorized(request) {
    // Diagnostic access is off by default, including when an old secret remains
    // in the hosting provider after it is removed from the Site configuration.
    if (env.FAMA_AI_CONNECTION_TEST_ENABLED !== 'true')
        return false;
    const expected = typeof env.FAMA_AI_CONNECTION_TEST_SECRET === 'string' ? env.FAMA_AI_CONNECTION_TEST_SECRET : '';
    const supplied = request.headers.get('x-fama-ai-test-token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(expected) || supplied.length !== 64)
        return false;
    const encoder = new TextEncoder();
    const digests = await Promise.all([expected, supplied].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
    const [left, right] = digests.map(value => new Uint8Array(value));
    let difference = 0;
    for (let index = 0; index < left.length; index++)
        difference |= left[index] ^ right[index];
    return difference === 0;
}
/** Service-only diagnostics. The temporary secret is removed after publication checks. */
export async function POST(request) {
    if (!isTrustedMutation(request) || !await authorized(request))
        return Response.json({ error: 'Acesso não autorizado.' }, { status: 403, headers });
    if (Number(request.headers.get('content-length') || 0) > 1000)
        return Response.json({ error: 'Solicitação inválida.' }, { status: 400, headers });
    if (Date.now() - previousTest < 60_000)
        return Response.json({ error: 'Aguarde antes de testar novamente.' }, { status: 429, headers });
    previousTest = Date.now();
    const result = await testCloudflareConnection(request.signal);
    return Response.json(result, { status: result.ok ? 200 : 502, headers });
}
