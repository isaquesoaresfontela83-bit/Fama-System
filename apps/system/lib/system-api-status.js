import { env } from 'cloudflare:workers';
import { runtimeApiStatus } from './api-runtime-status';
import { observation } from './api-status-model';
import { publicApiProbe } from './api-read-probes';
import { database } from './database';
import { getPlatformBillingConfig } from './billing';
import { asaasRequest } from './asaas';
import { firebaseConfiguration } from './firebase-push';
import { cloudflareConnectionStatus } from './fama-ai-cloudflare';
import { usesSupabase, selectRows } from './supabase';
import { RequestError } from './request-error';

async function companyConnections(result) {
    const db = database();
    const names = new Set((await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(row => row.name));
    const counts = [
        ['asaas-finance', async () => usesSupabase() ? await selectRows('bank_connections', { provider: 'asaas' }, { select: 'id', limit: 1001 }) : names.has('bank_connections') ? (await db.prepare("SELECT id FROM bank_connections WHERE provider='asaas' LIMIT 1001").all()).results : []],
        ['meta-whatsapp', async () => usesSupabase() ? await selectRows('fama_whatsapp_connections', {}, { select: 'verified_at', limit: 1001 }) : [], row => row.verified_at],
        ['asaas-fiscal', async () => names.has('organization_settings') ? (await db.prepare('SELECT settings_json FROM organization_settings LIMIT 1001').all()).results : [], row => { const config = JSON.parse(row.settings_json); return config.fiscalProvider === 'asaas' && config.fiscalApiToken; }],
    ];
    await Promise.all(counts.map(async ([id, read, filter]) => {
        try {
            const raw = await read(), rows = filter ? raw.filter(filter) : raw, partial = raw.length > 1000;
            result[id] = observation(rows.length ? 'configured' : partial ? 'unknown' : 'unconfigured', rows.length ? `${partial ? 'Pelo menos ' : ''}${rows.length} cadastro(s) de conexão encontrado(s). A conexão de cada empresa deve ser conferida no respectivo cadastro.` : partial ? 'A consulta atingiu o limite de 1.001 cadastros; não é possível confirmar a ausência de conexões.' : 'Nenhuma conexão encontrada para este provedor.');
        } catch { result[id] = observation('unknown', 'Não foi possível conferir os cadastros de conexão das empresas.'); }
    }));
}
export async function systemApiStatus() {
    const result = runtimeApiStatus('system', env);
    result['data-bridge'] = observation('verified', 'O canal administrativo recebeu uma solicitação autenticada do Control.', new Date().toISOString());
    await Promise.all([
        (async () => { try { await database().prepare('SELECT 1 AS ok').first(); result['cloudflare-d1'] = observation('verified', 'Consulta de leitura ao banco confirmada.', new Date().toISOString()); } catch { result['cloudflare-d1'] = observation('unavailable', 'O banco local não respondeu ao diagnóstico.', new Date().toISOString()); } })(),
        (async () => { try { const config = await getPlatformBillingConfig(); result['asaas-billing'] = observation(config ? 'configured' : 'unconfigured', config ? `Conta ${config.environment === 'production' ? 'de produção' : 'de testes'} cadastrada. A API e os webhooks ainda precisam ser conferidos.` : 'A conta Asaas de assinaturas ainda não foi cadastrada.'); } catch { result['asaas-billing'] = observation('unknown', 'Não foi possível conferir a configuração protegida de assinaturas.'); } })(),
        companyConnections(result).catch(() => { for (const id of ['asaas-finance','asaas-fiscal','meta-whatsapp']) result[id] = observation('unknown', 'Não foi possível conferir os cadastros de conexão das empresas.'); }),
    ]);
    result.firebase = observation(firebaseConfiguration() ? 'configured' : 'unconfigured', firebaseConfiguration() ? 'Notificações configuradas. Nenhuma notificação foi enviada neste diagnóstico.' : 'A configuração completa de notificações ainda não está disponível.');
    const cloud = cloudflareConnectionStatus().cloud;
    result['workers-ai'] = observation(cloud.state === 'ready' ? 'configured' : cloud.state === 'disabled' ? 'paused' : cloud.state === 'invalid_configuration' ? 'unknown' : 'unconfigured', cloud.state === 'ready' ? 'Serviço Python e Workers AI configurados. Não foi executada inferência neste diagnóstico.' : 'Confira a configuração da geração em nuvem na Fama IA.');
    return result;
}
export async function probeSystemApi(id) {
    if (['brasilapi','met-norway'].includes(id)) return publicApiProbe(id);
    if (id === 'system-api' || id === 'data-bridge') return observation('verified', 'A API interna respondeu com autenticação válida.', new Date().toISOString());
    if (id === 'cloudflare-d1') { await database().prepare('SELECT 1 AS ok').first(); return observation('verified', 'Consulta de leitura ao banco confirmada.', new Date().toISOString()); }
    if (id === 'supabase-database') {
        if (!usesSupabase()) throw new RequestError('Este sistema está usando D1.', 409);
        await selectRows('organizations', {}, { select: 'id', limit: 1 });
        return observation('verified', 'Consulta de leitura ao serviço de dados confirmada.', new Date().toISOString());
    }
    if (id === 'asaas-billing') {
        const config = await getPlatformBillingConfig();
        if (!config) throw new RequestError('Configure a conta de assinaturas.', 409);
        await asaasRequest(config.apiKey, config.environment, '/myAccount/status', { signal: AbortSignal.timeout(8000) });
        return observation('verified', 'Consulta à conta Asaas confirmada. A aprovação da conta e a entrega de webhooks possuem verificações próprias.', new Date().toISOString());
    }
    throw new RequestError('A disponibilidade desta integração é conferida na operação ou no dispositivo responsável.', 400);
}
