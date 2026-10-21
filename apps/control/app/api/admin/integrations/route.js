import { env } from 'cloudflare:workers';
import { isIP } from 'node:net';
import { requirePlatformAdmin, tenantError, RequestError } from '@/lib/tenant';
import { isTrustedMutation } from '@/lib/request-security';
import { readJsonObject, readLimitedBody } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { integrationBackend } from '@/lib/integration-backend';
import { integrationProviders, defaultFamaRepository, repositoryValid } from '@/lib/integration-catalog';
import { FAMA_VERSION, FAMA_RELEASE_ID } from '@/lib/fama-release';
import { platformIntegrationSummary } from '@/lib/platform-integrations';
const headers = { 'Cache-Control': 'private,no-store' };

async function systemRelease() {
    const send = env.FAMA_SYSTEM?.fetch ? env.FAMA_SYSTEM.fetch.bind(env.FAMA_SYSTEM) : fetch;
    const response = await send('https://famasystem.online/api/health', { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('System indisponível.');
    const data = JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 16384, 8000)));
    if (data.service !== 'Fama System' || typeof data.version !== 'string') throw new Error('Versão inválida.');
    return { version: data.version.slice(0,40), releaseId: String(data.releaseId || '').slice(0,80) };
}

export async function GET() {
    try {
        await requirePlatformAdmin();
        const [status, system, central] = await Promise.allSettled([
            integrationBackend('fama-control-admin', 'integration_status'), systemRelease(), platformIntegrationSummary(),
        ]);
        const data = status.status === 'fulfilled' ? status.value.data : null;
        const providers = integrationProviders.map(provider => {
            const local = central.status === 'fulfilled' ? central.value.find(item => item.provider === provider.id) : null;
            if (local?.managed && (local.configured || !local.enabled)) return { id: provider.id, configured: local.configured, available: local.available, enabled: local.enabled, mode: 'control', managed: true };
            return ({
            id: provider.id,
            configured: data ? provider.id === 'github' ? data.github_rest?.available === true : provider.id === 'ipinfo' ? data.ipinfo_lite?.available === true : data[provider.statusKey]?.configured === true : null,
            available: data ? provider.id === 'ipinfo' ? data.ipinfo?.available === true : provider.id === 'github' ? data.github_rest?.available === true : data[provider.statusKey]?.configured === true : false,
            mode: provider.id === 'ipinfo' && data ? String(data.ipinfo?.mode || '') : null,
        }); });
        return Response.json({ providers, repository: central.status === 'fulfilled' ? central.value.find(item => item.provider === 'github')?.fields.repository || defaultFamaRepository : defaultFamaRepository, backendAvailable: Boolean(data) || central.status === 'fulfilled',
            backendMessage: data || central.status === 'fulfilled' ? null : 'Não foi possível conferir as integrações. Confirme sua sessão e o acesso administrativo ao serviço.',
            release: { control: { version: FAMA_VERSION, releaseId: FAMA_RELEASE_ID }, system: system.status === 'fulfilled' ? system.value : null,
                synchronized: system.status === 'fulfilled' && system.value.version === FAMA_VERSION && system.value.releaseId === FAMA_RELEASE_ID },
            checkedAt: new Date().toISOString(),
        }, { headers });
    } catch (error) { return tenantError(error, 'Não foi possível conferir as integrações.'); }
}

export async function POST(request) {
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request)) throw new RequestError('Origem da solicitação inválida.', 403);
        const input = await readJsonObject(request, 4096);
        if (!['github','ipinfo'].includes(input.provider)) throw new RequestError('Consulta administrativa inválida.', 400);
        await assertRateLimit(request, 'admin_integration_' + input.provider, admin.id, 10, 60);
        if (input.provider === 'github') {
            const repository = String(input.repository || defaultFamaRepository).trim();
            if (!repositoryValid(repository)) throw new RequestError('Informe proprietário/repositório.', 400);
            const [commits, releases] = await Promise.all([
                integrationBackend('fama-control-admin', 'github_rest_get', { path: `repos/${repository}/commits`, params: { per_page: 5 } }),
                integrationBackend('fama-control-admin', 'github_rest_get', { path: `repos/${repository}/releases`, params: { per_page: 1 } }),
            ]);
            if (!Array.isArray(commits.data) || !Array.isArray(releases.data)) throw new RequestError('Resposta GitHub inválida.', 502);
            return Response.json({ repository, url: `https://github.com/${repository}`,
                commits: commits.data.slice(0,5).map(item => ({ sha: String(item.sha || '').slice(0,40), message: String(item.commit?.message || '').split('\n')[0].slice(0,200), date: item.commit?.committer?.date || null })),
                release: releases.data[0] ? { name: String(releases.data[0].name || releases.data[0].tag_name || '').slice(0,150), date: releases.data[0].published_at || null } : null,
            }, { headers });
        }
        const ip = String(input.ip || request.headers.get('cf-connecting-ip') || '').trim();
        if (!isIP(ip)) throw new RequestError('Informe um endereço IPv4 ou IPv6 válido.', 400);
        const result = await integrationBackend('fama-control-admin', 'ipinfo_lookup', { ip });
        const value = key => typeof result.data[key] === 'string' ? result.data[key].slice(0,200) : null;
        return Response.json({ ip: value('ip') || ip, country: value('country'), countryCode: value('country_code'), asn: value('asn'), network: value('as_name'), source: result.source === 'ipinfo_lite' ? 'IPinfo Lite' : 'IPinfo público', cached: result.cached === true }, { headers });
    } catch (error) { return tenantError(error, 'Não foi possível concluir a consulta administrativa.'); }
}
