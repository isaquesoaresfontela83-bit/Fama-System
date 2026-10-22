import { RequestError, requireTenant } from './tenant';
import { hasFeaturePermission } from './permissions';
import { readJsonObject, readLimitedBody } from './request-body';
import { assertRateLimit, sha256 } from './security';
import { callRpc, usesSupabase } from './supabase';
import { normalizeLookupValue } from './registration-lookup';
const cache = new Map();
const pending = new Map();
let localReceitaWindow = { startedAt: 0, count: 0 };
const text = (value, max = 200) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
async function authorize(request) {
    const tenant = await requireTenant(request);
    if (!hasFeaturePermission(tenant.organization.role, tenant.organization.permissions, 'customers', tenant.organization.moduleAccess))
        throw new RequestError('Seu perfil não tem acesso às consultas de cadastro.', 403);
    return tenant;
}
async function receitaQuota() {
    if (usesSupabase()) {
        const allowed = await callRpc('fama_consume_rate_limit', { p_key_hash: await sha256('fama:receitaws:public'), p_action: 'lookup_receitaws_public', p_limit: 3, p_window_seconds: 60 });
        if (!allowed)
            throw new RequestError('O limite gratuito da ReceitaWS foi atingido. Aguarde um minuto.', 429);
        return;
    }
    if (Date.now() - localReceitaWindow.startedAt >= 60_000)
        localReceitaWindow = { startedAt: Date.now(), count: 0 };
    if (++localReceitaWindow.count > 3)
        throw new RequestError('O limite gratuito da ReceitaWS foi atingido. Aguarde um minuto.', 429);
}
async function providerLookup(type, provider, value) {
    if (provider === 'receitaws' && /[A-Z]/.test(value))
        throw new RequestError('Use BrasilAPI para consultar CNPJ alfanumérico.', 400);
    if (provider === 'receitaws')
        await receitaQuota();
    const url = provider === 'receitaws' ? 'https://receitaws.com.br/v1/cnpj/' + value : 'https://brasilapi.com.br/api/' + (type === 'cep' ? 'cep/v2/' : 'cnpj/v1/') + value;
    let response;
    try {
        response = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    }
    catch {
        throw new RequestError('O serviço de consulta não respondeu. Tente novamente.', 502);
    }
    if (!response.ok || response.status >= 300) {
        void response.body?.cancel().catch(() => { });
        if (response.status === 404)
            throw new RequestError((type === 'cep' ? 'CEP' : 'CNPJ') + ' não encontrado neste serviço.', 404);
        if (response.status === 429)
            throw new RequestError('O serviço atingiu o limite de consultas. Aguarde um pouco.', 429);
        throw new RequestError('O serviço de consulta está indisponível. Tente novamente.', 502);
    }
    let raw;
    try {
        raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readLimitedBody(response, 64_000, 10_000)));
    }
    catch {
        throw new RequestError('O serviço retornou uma resposta inválida.', 502);
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new RequestError('O serviço retornou uma resposta inválida.', 502);
    if (raw.erro === true || raw.erro === 'true' || provider === 'receitaws' && raw.status === 'ERROR')
        throw new RequestError((type === 'cep' ? 'CEP' : 'CNPJ') + ' não encontrado neste serviço.', 404);
    const returned = type === 'cep' ? text(raw.cep).replace(/[^0-9]/g, '') : taxCode(raw.cnpj);
    if (returned !== value)
        throw new RequestError('O serviço retornou dados de outro cadastro. Confira o documento informado.', 502);
    const cep = text(raw.cep).replace(/[^0-9]/g, ''), city = text(raw.city || raw.localidade || raw.municipio), state = text(raw.state || raw.uf, 2);
    const street = text(raw.street || raw.logradouro), neighborhood = text(raw.neighborhood || raw.bairro), number = type === 'cnpj' ? text(raw.numero, 20) : '';
    if (!/^[A-Z]{2}$/.test(state) || !city || (type === 'cnpj' && !text(raw.razao_social || raw.nome)))
        throw new RequestError('O serviço retornou dados incompletos. Confira o cadastro manualmente.', 502);
    const result = { type, provider, value, consultedAt: new Date().toISOString(), cached: false, cep, street, neighborhood, city, state,
        address: [street + (number ? ', ' + number : ''), type === 'cnpj' ? text(raw.complemento) : '', neighborhood, city + '/' + state, cep.length === 8 ? 'CEP ' + cep.slice(0, 5) + '-' + cep.slice(5) : ''].filter(Boolean).join(' — ').slice(0, 600),
        name: type === 'cnpj' ? text(raw.razao_social || raw.nome) : '', tradeName: type === 'cnpj' ? text(raw.nome_fantasia || raw.fantasia) : '',
        phone: type === 'cnpj' ? text(raw.ddd_telefone_1 || raw.telefone, 80) : '', email: type === 'cnpj' ? text(raw.email, 254) : '', situation: type === 'cnpj' ? text(raw.descricao_situacao_cadastral || raw.situacao, 60) : '' };
    return result;
}
function taxCode(value) { return text(value, 40).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export async function registrationLookupPOST(request) {
    try {
        const { user, organization } = await authorize(request), body = await readJsonObject(request, 2000);
        if (Object.keys(body).some(key => !['type', 'provider', 'value'].includes(key)) || !['cep', 'cnpj'].includes(String(body.type)))
            throw new RequestError('Consulta inválida.', 400);
        const type = body.type;
        let value;
        try {
            value = normalizeLookupValue(type, body.value);
        }
        catch (error) {
            throw new RequestError(error.message, 400);
        }
        const provider = type === 'cep' || /[A-Z]/.test(value) ? 'brasilapi' : 'receitaws';
        if (body.provider !== undefined && body.provider !== provider)
            throw new RequestError('O serviço desta consulta é definido automaticamente.', 400);
        await assertRateLimit(request, 'registration_lookup', user.id, 30, 60);
        const key = provider + ':' + type + ':' + value, stored = cache.get(key);
        if (stored && stored.expiresAt > Date.now())
            return json({ ...stored.result, cached: true });
        if (stored)
            cache.delete(key);
        let operation = pending.get(key);
        if (!operation) {
            if (pending.size >= 50)
                throw new RequestError('Há muitas consultas em andamento. Aguarde um pouco.', 429);
            operation = providerLookup(type, provider, value).then(result => {
                if (cache.size >= 256)
                    cache.delete(cache.keys().next().value);
                cache.set(key, { expiresAt: Date.now() + (type === 'cep' ? 24 * 3600_000 : 3600_000), result });
                return result;
            }).finally(() => pending.delete(key));
            pending.set(key, operation);
        }
        const result = await operation;
        await authorize(request);
        return json(result);
    }
    catch (error) {
        if (error instanceof RequestError)
            return json({ error: error.message }, error.status);
        return json({ error: 'Não foi possível consultar o cadastro. Tente novamente.' }, 503);
    }
}
