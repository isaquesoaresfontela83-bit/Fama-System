import { parseBlockOverrides, parseBlockRules } from '@/lib/fama-blocks';
import { readBlockRules } from '@/lib/fama-blocks-server';
import { callRpc, selectOne } from '@/lib/supabase';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit } from '@/lib/security';
import { RequestError, requirePlatformAdmin, tenantError } from '@/lib/tenant';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
async function target(input) {
    const scope = input.scope, organizationId = input.organizationId ?? '', memberId = input.memberId ?? '';
    if (!['global', 'organization', 'member'].includes(scope) || typeof organizationId !== 'string' || typeof memberId !== 'string' || organizationId.length > 128 || memberId.length > 128 || (scope === 'global' && (organizationId || memberId)) || (scope === 'organization' && (!organizationId || memberId)) || (scope === 'member' && (!organizationId || !memberId)))
        throw new RequestError('Escolha um destino válido.', 400);
    if (scope !== 'global') {
        const company = await selectOne('organizations', { id: organizationId }, { select: 'id,status' });
        if (!company || company.status === 'deleted')
            throw new RequestError('Empresa não encontrada.', 404);
    }
    if (scope === 'member' && !await selectOne('organization_members', { id: memberId, organization_id: organizationId }, { select: 'id' }))
        throw new RequestError('A pessoa não pertence à empresa selecionada.', 404);
    return { scope, organizationId, memberId };
}
function failure(error) {
    const response = tenantError(error, 'Não foi possível conferir ou salvar os blocos.');
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
}
export async function GET(request) {
    try {
        await requirePlatformAdmin();
        const selection = await target(Object.fromEntries(new URL(request.url).searchParams));
        return Response.json({ rules: await readBlockRules(selection.organizationId, selection.memberId) }, { headers });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request) {
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação inválida.', 403);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            throw new RequestError('Envie as regras em JSON.', 415);
        await assertRateLimit(request, 'platform_blocks', admin.id, 30, 60);
        if (Number(request.headers.get('content-length') || 0) > 6000)
            throw new RequestError('Configuração muito grande.', 413);
        const bodyText = await request.text();
        if (new TextEncoder().encode(bodyText).byteLength > 6000)
            throw new RequestError('Configuração muito grande.', 413);
        let body, overrides;
        try {
            body = JSON.parse(bodyText);
            if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['scope', 'organizationId', 'memberId', 'revision', 'overrides'].includes(key)))
                throw new Error('Configuração inválida.');
            overrides = parseBlockOverrides(body.overrides);
        }
        catch (error) {
            throw new RequestError(error instanceof Error ? error.message : 'Configuração inválida.', 400);
        }
        if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0 || Number(body.revision) >= 2147483647)
            throw new RequestError('Recarregue as regras antes de salvar.', 400);
        const selection = await target(body);
        const saved = await callRpc('fama_save_block_rule', { p_scope: selection.scope, p_organization_id: selection.organizationId, p_member_id: selection.memberId, p_overrides: overrides, p_revision: body.revision, p_actor_user_id: admin.id });
        if (!saved)
            throw new RequestError('As regras mudaram em outra janela. Recarregue antes de aplicar.', 409);
        const rules = parseBlockRules(saved);
        if (rules[selection.scope].revision !== Number(body.revision) + 1 || JSON.stringify(Object.entries(rules[selection.scope].overrides).sort()) !== JSON.stringify(Object.entries(overrides).sort()))
            throw new RequestError('A gravação não foi confirmada. Recarregue as regras.', 502);
        return Response.json({ rules, verified: true }, { headers });
    }
    catch (error) {
        return failure(error);
    }
}
