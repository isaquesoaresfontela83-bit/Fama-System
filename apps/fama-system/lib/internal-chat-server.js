import { callRpc, selectOne, selectRows, usesSupabase, SupabaseRequestError } from './supabase';
import { requireTenant, RequestError, tenantError } from './tenant';
import { hasFeaturePermission } from './permissions';
import { memberBlockAccess } from './fama-blocks-server';
import { encryptPlainText, decryptText } from './crypto';
import { readJsonObject } from './request-body';
import { assertRateLimit } from './security';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
function failure(error) { if (error instanceof SupabaseRequestError) {
    if (error.code === '42501')
        return Response.json({ error: 'Você não pode acessar esta conversa ou realizar esta ação.' }, { status: 403, headers });
    if (error.code === '22023')
        return Response.json({ error: 'Confira a conversa, os dados e o limite de dez mensagens fixadas.' }, { status: 400, headers });
} const r = tenantError(error, 'O Chat está temporariamente indisponível. Tente novamente.'); Object.entries(headers).forEach(([key, value]) => r.headers.set(key, value)); return r; }
async function access(request) { const tenant = await requireTenant(request); if (!hasFeaturePermission(tenant.organization.role, tenant.organization.permissions, 'chat', tenant.organization.moduleAccess))
    throw new RequestError('Seu perfil não tem acesso ao Chat.', 403); if (!usesSupabase())
    throw new RequestError('O Chat interno requer o banco de dados da plataforma.', 503); const member = await selectOne('organization_members', { organization_id: tenant.organization.id, user_email: tenant.user.email.toLowerCase(), status: 'active' }); if (!member)
    throw new RequestError('Acesso indisponível.', 403); return { ...tenant, member }; }
async function roster(organizationId) { return (await selectRows('organization_members', { organization_id: organizationId, status: 'active' }, { limit: 500 })).filter(row => row.user_id); }
async function recipient(organizationId, memberId) { const row = await selectOne('organization_members', { organization_id: organizationId, id: memberId, status: 'active' }); return row?.user_id && hasFeaturePermission(row.role, row.permissions, 'chat', await memberBlockAccess(row)) ? row : null; }
async function message(row) { return { id: row.id, sequence: Number(row.sequence), senderId: row.sender_id, author: row.author, text: await decryptText(row.body_ciphertext), createdAt: row.created_at, replyId: row.reply_id || null, urgent: Boolean(row.urgent), pinned: Boolean(row.pinned), readCount: Number(row.read_count || 0) }; }
export async function internalChatGET(request) {
    try {
        const { organization, member } = await access(request);
        const url = new URL(request.url), threadId = url.searchParams.get('thread'), before = url.searchParams.get('before');
        if (threadId && !uuid.test(threadId) || before && (!threadId || !/^\d{1,15}$/.test(before)))
            throw new RequestError('Conversa ou página inválida.', 400);
        const base = { p_organization_id: organization.id, p_member_id: member.id };
        if (url.searchParams.get('summary') === '1') {
            const rows = await callRpc('fama_internal_chat', { ...base, p_operation: 'inbox' });
            return Response.json({ unread: rows.reduce((sum, row) => sum + Number(row.unread || 0), 0) }, { headers });
        }
        const [people, threads] = await Promise.all([roster(organization.id), callRpc('fama_internal_chat', { ...base, p_operation: 'inbox' })]);
        const result = { selfId: member.id, members: people.map(r => ({ id: r.id, name: r.display_name || 'Usuário', role: r.role })), threads: await Promise.all(threads.map(async (row) => ({ id: row.id, kind: row.kind, title: row.title, announcements: row.announcements, participantIds: row.participant_ids, preview: await decryptText(row.preview_ciphertext || ''), lastAt: row.last_at, unread: Number(row.unread) }))), messages: [], pinned: [], threadId: threadId || null, hasMore: false };
        if (threadId) {
            const [page, pinned] = await Promise.all([callRpc('fama_internal_chat', { ...base, p_operation: 'page', p_thread_id: threadId, p_cursor: before ? Number(before) : null }), callRpc('fama_internal_chat', { ...base, p_operation: 'pinned', p_thread_id: threadId })]);
            result.hasMore = page.length > 80;
            result.messages = await Promise.all(page.slice(-80).map(message));
            result.pinned = await Promise.all(pinned.map(message));
        }
        return Response.json(result, { headers });
    }
    catch (error) {
        return failure(error);
    }
}
export async function internalChatPOST(request) {
    try {
        const { user, organization, member } = await access(request), body = await readJsonObject(request, 24000);
        const allowed = { direct: ['recipientId'], channel: ['title', 'announcements'], send: ['threadId', 'text', 'clientId', 'replyId', 'urgent'], read: ['threadId', 'sequence'], pin: ['threadId', 'messageId', 'pinned'] };
        const action = String(body.action);
        if (!allowed[action] || Object.keys(body).some(key => key !== 'action' && !allowed[action].includes(key)))
            throw new RequestError('Solicitação inválida.', 400);
        const args = { p_organization_id: organization.id, p_member_id: member.id, p_operation: action };
        if (!['direct', 'channel'].includes(action)) {
            if (typeof body.threadId !== 'string' || !uuid.test(body.threadId))
                throw new RequestError('Selecione uma conversa.', 400);
            args.p_thread_id = body.threadId;
        }
        if (action === 'direct') {
            if (typeof body.recipientId !== 'string' || !await recipient(organization.id, body.recipientId))
                throw new RequestError('Escolha um usuário ativo desta empresa com acesso ao Chat.', 400);
            args.p_recipient_id = body.recipientId;
        }
        if (action === 'channel') {
            if (!['owner', 'admin'].includes(organization.role))
                throw new RequestError('Somente administradores podem criar canais.', 403);
            if (typeof body.title !== 'string' || body.title.trim().length < 2 || body.title.length > 60 || typeof body.announcements !== 'boolean')
                throw new RequestError('Informe um nome de canal entre 2 e 60 caracteres.', 400);
            args.p_title = body.title.trim();
            args.p_announcements = body.announcements;
        }
        if (action === 'send') {
            const thread = await selectOne('fama_internal_threads', { organization_id: organization.id, id: args.p_thread_id });
            if (!thread)
                throw new RequestError('Conversa indisponível.', 403);
            if (thread.kind === 'direct') {
                const participants = await selectRows('fama_internal_participants', { organization_id: organization.id, thread_id: thread.id });
                const other = participants.find(p => p.member_id !== member.id);
                if (!participants.some(p => p.member_id === member.id) || !other || !await recipient(organization.id, other.member_id))
                    throw new RequestError('Conversa privada ou participante sem acesso ao Chat.', 403);
            }
            if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000 || typeof body.clientId !== 'string' || !uuid.test(body.clientId) || body.replyId !== undefined && body.replyId !== null && (typeof body.replyId !== 'string' || !uuid.test(body.replyId)) || typeof body.urgent !== 'boolean')
                throw new RequestError('Confira a mensagem (até 4.000 caracteres).', 400);
            args.p_body = await encryptPlainText(body.text.trim());
            args.p_client_id = body.clientId;
            args.p_reply_id = body.replyId || null;
            args.p_urgent = body.urgent;
        }
        if (action === 'read') {
            if (!Number.isSafeInteger(body.sequence) || Number(body.sequence) < 0)
                throw new RequestError('Página inválida.', 400);
            args.p_cursor = body.sequence;
        }
        if (action === 'pin') {
            if (typeof body.messageId !== 'string' || !uuid.test(body.messageId) || typeof body.pinned !== 'boolean')
                throw new RequestError('Mensagem inválida.', 400);
            args.p_reply_id = body.messageId;
            args.p_pinned = body.pinned;
        }
        if (action !== 'read')
            await assertRateLimit(request, 'internal_chat_' + action, user.id, action === 'send' ? 40 : 20, 60);
        const result = await callRpc('fama_internal_chat', args);
        return Response.json(action === 'send' ? { message: await message(result) } : result, { headers });
    }
    catch (error) {
        return failure(error);
    }
}
