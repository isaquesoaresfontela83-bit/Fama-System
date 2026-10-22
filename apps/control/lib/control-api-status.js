import { env } from 'cloudflare:workers';
import { apiCatalog } from './api-catalog';
import { runtimeApiStatus } from './api-runtime-status';
import { observation, normalizeApiObservations, apiInventoryRows } from './api-status-model';
import { readApiJson } from './api-read-probes';
import { platformIntegrationSummary, testPlatformIntegration } from './platform-integrations';
import { integrationProviders, defaultFamaRepository } from './integration-catalog';
import { integrationBackend } from './integration-backend';
import { readBaileysConfig, baileysRequest } from './baileys-config';
import { database } from './database';
import { selectRows, usesSupabase } from './supabase';
import { cloudflareConnectionStatus } from './fama-ai-cloudflare';
import { FAMA_VERSION, FAMA_RELEASE_ID } from './fama-release';
import { RequestError } from './request-error';

const systemSend = (...args) => env.FAMA_SYSTEM?.fetch ? env.FAMA_SYSTEM.fetch(...args) : fetch(...args);
export async function systemApiSnapshot() {
    if (!env.FAMA_DATA_BRIDGE_SECRET) throw new Error('Bridge unavailable');
    const value = await readApiJson('https://famasystem.online/api/internal/api-status', { headers: { Authorization: 'Bearer ' + env.FAMA_DATA_BRIDGE_SECRET } }, systemSend);
    if (value.scope !== 'system' || typeof value.version !== 'string' || typeof value.releaseId !== 'string' || !value.observations || typeof value.observations !== 'object') throw new Error('Invalid snapshot');
    return { observations: normalizeApiObservations('system', value.observations), version: value.version.slice(0,40), releaseId: value.releaseId.slice(0,80) };
}
async function systemRelease() {
    const value = await readApiJson('https://famasystem.online/api/health', {}, systemSend);
    if (value.service !== 'Fama System' || typeof value.version !== 'string' || typeof value.releaseId !== 'string') throw new Error('Invalid release');
    return { version: value.version.slice(0,40), releaseId: value.releaseId.slice(0,80) };
}
export async function controlApiStatus() {
    const result = runtimeApiStatus('control', env);
    const [central, legacy, baileys, d1] = await Promise.allSettled([
        platformIntegrationSummary(), integrationBackend('fama-control-admin', 'integration_status', {}, { timeoutMs: 8000 }), readBaileysConfig(), Promise.resolve().then(() => database().prepare('SELECT 1 AS ok').first()),
    ]);
    const data = legacy.status === 'fulfilled' ? legacy.value.data : null;
    if (data) result['supabase-functions'] = observation('verified', 'A função administrativa respondeu à consulta de configuração. Isso não confirma a conexão individual dos provedores.', new Date().toISOString());
    else if (result['supabase-functions'].status !== 'unconfigured') result['supabase-functions'] = observation('unavailable', 'A função anterior não confirmou a consulta. As conexões gerenciadas no Control possuem status próprios.', new Date().toISOString());
    for (const provider of integrationProviders) {
        const local = central.status === 'fulfilled' ? central.value.find(item => item.provider === provider.id) : null;
        if (local?.managed && !local.enabled) result[provider.id] = observation('paused', 'Integração pausada na central do Fama Control.');
        else if (local?.managed && local.configured) result[provider.id] = observation(['github','ipinfo'].includes(provider.id) && !local.present.token ? 'public' : 'configured', 'Configuração gerenciada no Fama Control. A resposta do provedor ainda não foi testada.');
        else if (data) {
            const configured = data[provider.statusKey]?.configured === true;
            const publicMode = provider.id === 'github' && data.github_rest?.available === true || provider.id === 'ipinfo' && data.ipinfo?.available === true;
            result[provider.id] = observation(configured ? 'configured' : publicMode ? 'public' : 'unconfigured', configured ? 'Configuração encontrada na conexão anterior da plataforma. O provedor ainda não foi testado.' : publicMode ? 'Consulta pública habilitada na conexão anterior. A resposta do provedor ainda não foi testada.' : 'Nenhuma configuração completa encontrada para esta integração.');
        } else result[provider.id] = observation(central.status === 'fulfilled' && local?.managed ? 'unconfigured' : 'unknown', 'Não foi possível confirmar uma configuração completa. Confira a central de integrações.');
    }
    result.baileys = baileys.status === 'fulfilled' ? observation(baileys.value ? 'configured' : 'unconfigured', baileys.value ? 'Servidor cadastrado. O status do servidor e as sessões das empresas possuem verificações próprias.' : 'O servidor Baileys ainda não foi cadastrado.') : observation('unknown', 'Não foi possível conferir a configuração protegida do Baileys.');
    result['cloudflare-d1'] = d1.status === 'fulfilled' ? observation('verified', 'Consulta de leitura ao banco confirmada.', new Date().toISOString()) : observation('unavailable', 'O banco local não respondeu ao diagnóstico.', new Date().toISOString());
    const cloud = cloudflareConnectionStatus().cloud;
    result['workers-ai'] = observation(cloud.state === 'ready' ? 'configured' : cloud.state === 'disabled' ? 'paused' : cloud.state === 'invalid_configuration' ? 'unknown' : 'unconfigured', cloud.state === 'ready' ? 'Serviço Python e Workers AI configurados. Não foi executada inferência neste diagnóstico.' : 'Confira a configuração da geração em nuvem na Fama IA.');
    return result;
}
export async function allApiStatus() {
    const [own, system, release] = await Promise.allSettled([controlApiStatus(), systemApiSnapshot(), systemRelease()]);
    const control = own.status === 'fulfilled' ? own.value : normalizeApiObservations('control', {});
    const snapshots = { control, system: system.status === 'fulfilled' ? system.value.observations : normalizeApiObservations('system', {}) };
    if (release.status === 'fulfilled') snapshots.system['system-api'] = observation('verified', 'A API pública de saúde respondeu. Os demais serviços possuem verificações próprias.', new Date().toISOString());
    if (system.status === 'fulfilled') control['data-bridge'] = observation('verified', 'Canal administrativo entre Control e System autenticado e respondendo.', new Date().toISOString());
    else control['data-bridge'] = observation(env.FAMA_DATA_BRIDGE_SECRET ? 'unavailable' : 'unconfigured', env.FAMA_DATA_BRIDGE_SECRET ? 'O System não confirmou o inventário autenticado. Confira a publicação dos dois sistemas e o canal interno.' : 'O canal administrativo entre os sistemas ainda não foi configurado.', new Date().toISOString());
    const companion = release.status === 'fulfilled' ? release.value : system.status === 'fulfilled' ? { version: system.value.version, releaseId: system.value.releaseId } : null;
    return { apis: apiInventoryRows(snapshots), checkedAt: new Date().toISOString(), companionAvailable: system.status === 'fulfilled',
        release: { control: { version: FAMA_VERSION, releaseId: FAMA_RELEASE_ID }, system: companion, synchronized: system.status === 'fulfilled' && companion?.version === FAMA_VERSION && companion?.releaseId === FAMA_RELEASE_ID && system.value.version === FAMA_VERSION && system.value.releaseId === FAMA_RELEASE_ID },
        notice: system.status === 'fulfilled' ? null : 'Alguns status do System não puderam ser conferidos. O inventário continua completo; status ausentes não significam que o provedor está fora do ar.',
    };
}
async function probeControlApi(id) {
    if (id === 'control-api') return observation('verified', 'A API administrativa respondeu.', new Date().toISOString());
    if (id === 'data-bridge') { await systemApiSnapshot(); return observation('verified', 'Canal administrativo entre os dois sistemas autenticado e respondendo.', new Date().toISOString()); }
    if (id === 'cloudflare-d1') { await database().prepare('SELECT 1 AS ok').first(); return observation('verified', 'Consulta de leitura ao banco confirmada.', new Date().toISOString()); }
    if (id === 'supabase-database') {
        if (!usesSupabase()) throw new RequestError('Este sistema está usando D1.', 409);
        await selectRows('organizations', {}, { select: 'id', limit: 1 });
        return observation('verified', 'Consulta de leitura ao serviço de dados confirmada.', new Date().toISOString());
    }
    if (id === 'baileys') {
        const value = await baileysRequest(await readBaileysConfig(), '/health');
        if (value.provider !== 'baileys' || value.ok !== true) throw new Error('Invalid health');
        return observation('verified', 'Servidor Baileys respondeu. A sessão WhatsApp de cada empresa é conferida separadamente.', new Date().toISOString());
    }
    if (['drive','github','ipinfo'].includes(id)) {
        const summary = await platformIntegrationSummary(), local = summary.find(item => item.provider === id);
        if (local.managed && !local.enabled) return observation('paused', 'Integração pausada na central do Control.');
        if (local.managed && local.configured) {
            const value = await testPlatformIntegration(id);
            return observation(value.verified ? 'verified' : 'configured', value.message, value.checkedAt || new Date().toISOString());
        }
        if (id === 'github') {
            const value = await integrationBackend('fama-control-admin', 'github_rest_get', { path: `repos/${defaultFamaRepository}/commits`, params: { per_page: 1 } }, { timeoutMs: 8000 });
            if (!Array.isArray(value.data)) throw new Error('Invalid provider response');
        } else if (id === 'ipinfo') {
            const value = await integrationBackend('fama-control-admin', 'ipinfo_lookup', { ip: '8.8.8.8' }, { timeoutMs: 8000 });
            if (value.data.ip !== '8.8.8.8') throw new Error('Invalid provider response');
        } else {
            const value = await integrationBackend('fama-control-admin', 'integration_status', {}, { timeoutMs: 8000 });
            const provider = integrationProviders.find(item => item.id === id);
            return observation(value.data[provider.statusKey]?.configured === true ? 'configured' : 'unconfigured', value.data[provider.statusKey]?.configured === true ? 'Configuração encontrada. O teste direto desta conexão anterior deve ser realizado na central de integrações.' : 'Nenhuma configuração completa encontrada para este provedor.');
        }
        return observation('verified', 'Consulta de leitura confirmada pelo provedor.', new Date().toISOString());
    }
    throw new RequestError('Diagnóstico indisponível para esta integração.', 400);
}
export async function probeApi(id, scope) {
    const item = apiCatalog.find(item => item.id === id && item.scopes.includes(scope) && item.probe);
    if (!item) throw new RequestError('Diagnóstico inválido.', 400);
    let value;
    try {
        if (scope === 'control') value = await probeControlApi(id);
        else {
            if (!env.FAMA_DATA_BRIDGE_SECRET) throw new Error('Missing bridge');
            const result = await readApiJson('https://famasystem.online/api/internal/api-status', { method: 'POST', headers: { Authorization: 'Bearer ' + env.FAMA_DATA_BRIDGE_SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }, systemSend);
            if (result.id !== id || result.scope !== 'system') throw new Error('Invalid check');
            value = normalizeApiObservations('system', { [id]: result.observation })[id];
        }
    } catch { value = observation('unavailable', 'A consulta de diagnóstico não foi confirmada. Confira a configuração, a conexão e os limites do serviço.', new Date().toISOString()); }
    return { id, scope, observation: value };
}
