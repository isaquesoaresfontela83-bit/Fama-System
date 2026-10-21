import { apiCatalog } from './api-catalog';
import { observation } from './api-status-model';
const text = value => String(value ?? '').trim();
const has = (env, ...keys) => keys.every(key => Boolean(text(env[key])));
export function runtimeApiStatus(scope, env) {
    const result = Object.fromEntries(apiCatalog.filter(item => item.scopes.includes(scope)).map(item => [item.id, observation('unknown', 'Aguardando conferência da configuração.') ]));
    const configured = (id, value, yes, no = 'A conexão ainda não está configurada.') => { result[id] = observation(value ? 'configured' : 'unconfigured', value ? yes || 'Configuração cadastrada. A resposta do provedor ainda não foi testada.' : no); };
    for (const id of ['brasilapi','receitaws','awesomeapi','met-norway','overpass','osm-tiles','pwned-passwords','model-downloads']) if (Object.hasOwn(result, id)) result[id] = observation('public', 'Integração pública presente no sistema. A resposta do provedor ainda não foi testada.');
    result[scope + '-api'] = observation('verified', 'Esta API respondeu à consulta de status.', new Date().toISOString());
    configured('data-bridge', has(env, 'FAMA_DATA_BRIDGE_SECRET'), 'Canal interno configurado. A autenticação entre os dois sistemas ainda precisa ser conferida.');
    const supabase = has(env, 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY');
    configured('supabase-auth', supabase, 'Autenticação configurada. As sessões são verificadas no acesso.');
    if (text(env.SUPABASE_AUTH_ENABLED).toLowerCase() === 'false') result['supabase-auth'] = observation('paused', 'Autenticação Supabase desativada neste sistema.');
    const dataEnabled = text(env.DATA_BACKEND).toLowerCase() === 'supabase';
    configured('supabase-database', dataEnabled && has(env, 'SUPABASE_URL') && (has(env, 'SUPABASE_SECRET_KEY') || scope === 'system' && has(env, 'FAMA_DATA_BRIDGE_SECRET')), 'Serviço de dados configurado. Ainda não foi feita consulta de diagnóstico.');
    if (!dataEnabled) result['supabase-database'] = observation('standby', 'Este sistema está usando o banco local D1.');
    configured('supabase-functions', supabase, 'Conexões anteriores disponíveis para consulta de configuração; cada provedor tem um status próprio.');
    configured('cloudflare-d1', Boolean(env.DB));
    configured('workers-ai', has(env, 'FAMA_AI_PYTHON_URL', 'FAMA_AI_PYTHON_TOKEN'), 'Serviço Python e modelo em nuvem configurados. Não foi executada geração de texto.');
    if (has(env, 'FAMA_AI_PYTHON_URL', 'FAMA_AI_PYTHON_TOKEN') && env.FAMA_AI_GENERATIVE_ENABLED !== 'true') result['workers-ai'] = observation('paused', 'A geração opcional em nuvem está desativada.');
    result['local-ai'] = observation('device', 'Disponibilidade verificada no dispositivo ao abrir a Fama IA; não pode ser confirmada pelo servidor.');
    if (scope === 'control') configured('cloudflare-r2', Boolean(env.BUCKET), 'Armazenamento de backups vinculado. Não foi lido nenhum arquivo neste diagnóstico.');
    if (scope === 'system') {
        configured('supabase-storage', has(env, 'SUPABASE_URL') && (has(env, 'SUPABASE_SECRET_KEY') || has(env, 'FAMA_DATA_BRIDGE_SECRET')), 'Armazenamento configurado. Acesso aos documentos é validado por empresa.');
        configured('google-calendar', /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(text(env.FAMA_GOOGLE_CALENDAR_CLIENT_ID)), 'Aplicativo Google configurado; a autorização e a sessão pertencem a cada usuário.');
        configured('openrouteservice', text(env.FAMA_OPENROUTESERVICE_API_KEY).length >= 10);
        configured('osrm', has(env, 'FAMA_ROUTING_BASE_URL'), 'Servidor dedicado cadastrado; a rota será validada na operação.');
        result.brouter = observation(has(env, 'FAMA_ROUTING_BASE_URL') || text(env.FAMA_OPENROUTESERVICE_API_KEY).length >= 10 ? 'standby' : 'public', 'Alternativa pública de rotas. Disponibilidade e limites são confirmados durante o cálculo.');
        configured('geoapify', /^[A-Za-z0-9_-]{16,128}$/.test(text(env.FAMA_GEOAPIFY_MAPS_PUBLIC_KEY)));
        result.waze = observation('device', 'Mapa integrado sem chave. Carregamento e navegação dependem do navegador e do dispositivo.');
        result.scanner = observation('device', 'A ponte local deve ser conferida no computador que possui o scanner.');
        result['meta-whatsapp'] = observation('company', 'A conexão oficial e a autorização são cadastradas por empresa.');
        result['asaas-finance'] = observation('company', 'As contas e credenciais são cadastradas por empresa.');
        result['asaas-fiscal'] = observation('company', 'A API fiscal é opcional por empresa; portais oficiais sem API não representam conexão automática.');
        result.openweather = observation(has(env, 'OPENWEATHER_API_KEY') || has(env, 'OPENWEATHERMAP_API_KEY') ? 'configured' : 'company', 'Chave global ou da empresa; a resposta e a seleção do provedor são verificadas na previsão.');
        result['open-meteo'] = observation(has(env, 'OPEN_METEO_API_KEY') ? 'configured' : 'company', 'Conta comercial ou avaliação escolhida pela empresa; não há verificação automática de previsão.');
        configured('pool-bridge', has(env, 'FAMA_POOL_BRIDGE_SECRET','FAMA_POOL_SITE_SERVICE_TOKEN','FAMA_POOL_WEBHOOK_TOKEN'), 'Ponte de serviços configurada. Nenhum webhook foi enviado neste diagnóstico.');
    }
    return result;
}
