import { decryptText, encryptPlainText as encryptText } from './crypto';
import { callRpc, selectOne, selectRows, updateRows, usesSupabase } from './supabase';
import { RequestError, requireTenant } from './tenant';
import { hasFeaturePermission } from './permissions';
import { assertRateLimit, sha256 } from './security';
import { limitedWhatsappBody, whatsappPhoneInput } from './fama-whatsapp';
import { whatsappGraph } from './fama-whatsapp-transport';
const connections = 'fama_whatsapp_connections', conversations = 'fama_chat_conversations', messages = 'fama_chat_messages';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
function failure(error) {
    if (error instanceof RequestError)
        return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
        return json({ error: 'Envie uma solicitação válida.' }, 400);
    if (error instanceof Error && error.message.startsWith('body_'))
        return json({ error: 'Solicitação muito grande ou interrompida.' }, 413);
    if (error?.code === '22023') {
        const windowClosed = String(error.message).includes('service window');
        return json({ error: windowClosed ? 'O prazo para responder terminou. Use um modelo aprovado na Meta para retomar a conversa.' : 'Conversa ou solicitação indisponível. Atualize o Chat.' }, 409);
    }
    return json({ error: 'Não foi possível concluir a operação no Chat. Tente novamente.' }, 503);
}
async function access(request) {
    const tenant = await requireTenant(request);
    if (!hasFeaturePermission(tenant.organization.role, tenant.organization.permissions, 'chat', tenant.organization.moduleAccess))
        throw new RequestError('Seu perfil não tem acesso ao Chat.', 403);
    if (!usesSupabase())
        throw new RequestError('O Chat requer o banco de dados da plataforma.', 503);
    return tenant;
}
function ready(row) { return Boolean(row?.verified_at && row.webhook_verified_at); }
function filter(row) { return { organization_id: String(row.organization_id), connection_id: String(row.id), business_phone_id: String(row.phone_number_id) }; }
async function conversationView(row) {
    return { id: String(row.id), phone: await decryptText(String(row.phone_ciphertext)), name: await decryptText(String(row.name_ciphertext || '')),
        preview: await decryptText(String(row.last_message_ciphertext || '')), lastMessageAt: String(row.last_message_at), lastInboundAt: row.last_inbound_at ? String(row.last_inbound_at) : null,
        unread: Boolean(row.last_inbound_at && (!row.last_read_at || Date.parse(String(row.last_inbound_at)) > Date.parse(String(row.last_read_at)))) };
}
async function messageView(row) {
    return { id: String(row.id), direction: row.direction === 'in' ? 'in' : 'out', kind: String(row.kind), text: await decryptText(String(row.body_ciphertext)),
        status: String(row.status), occurredAt: String(row.occurred_at), author: row.actor_user_id === 'fama-ai' ? 'Fama IA' : row.direction === 'out' ? 'Equipe' : '' };
}
export async function chatGET(request) {
    try {
        const { organization } = await access(request), url = new URL(request.url);
        const conversationId = url.searchParams.get('conversation') || '', beforeId = url.searchParams.get('before') || '';
        if ((conversationId && !uuid.test(conversationId)) || (beforeId && (!conversationId || !uuid.test(beforeId))))
            throw new RequestError('Conversa inválida.', 400);
        const connection = await selectOne(connections, { organization_id: organization.id });
        const result = { connection: connection ? { id: String(connection.id), displayPhone: String(connection.display_phone || ''), ready: ready(connection) } : null, conversations: [], conversationId: null, messages: [], hasMore: false };
        if (!ready(connection))
            return json(result);
        const rows = await selectRows(conversations, filter(connection), { order: 'last_message_at.desc,id.desc', limit: 100 });
        result.conversations = await Promise.all(rows.map(conversationView));
        if (conversationId) {
            const thread = rows.find(row => row.id === conversationId) || await selectOne(conversations, { ...filter(connection), id: conversationId });
            if (!thread)
                throw new RequestError('Conversa não encontrada nesta empresa.', 404);
            if (!rows.some(row => row.id === conversationId))
                result.conversations.push(await conversationView(thread));
            const page = await callRpc('fama_chat_message_page', { p_organization_id: organization.id, p_connection_id: String(connection.id), p_conversation_id: conversationId, p_before_id: beforeId });
            result.conversationId = conversationId;
            result.hasMore = page.length > 100;
            result.messages = await Promise.all(page.slice(0, 100).reverse().map(messageView));
        }
        return json(result);
    }
    catch (error) {
        return failure(error);
    }
}
export async function chatPOST(request) {
    let reservation = null, sending = false;
    try {
        const { user, organization } = await access(request);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            throw new RequestError('Envie a solicitação em JSON.', 415);
        const body = JSON.parse(await limitedWhatsappBody(request, 24_000));
        const allowed = { read: ['conversationId'], text: ['conversationId', 'clientId', 'text'], template: ['conversationId', 'clientId', 'phone', 'templateName', 'language', 'parameters'] };
        if (!body || typeof body !== 'object' || Array.isArray(body) || !allowed[String(body.action)] || Object.keys(body).some(key => key !== 'action' && !allowed[String(body.action)].includes(key)))
            throw new RequestError('Solicitação inválida.', 400);
        const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
        if ((conversationId && !uuid.test(conversationId)) || (!conversationId && body.action !== 'template'))
            throw new RequestError('Selecione uma conversa válida.', 400);
        const connection = await selectOne(connections, { organization_id: organization.id });
        if (!ready(connection))
            throw new RequestError('Conecte o número e confirme o recebimento na Meta para usar o Chat.', 409);
        if (body.action === 'read') {
            const changed = await updateRows(conversations, { last_read_at: new Date().toISOString() }, { ...filter(connection), id: conversationId });
            if (!changed.length)
                throw new RequestError('Conversa não encontrada nesta empresa.', 404);
            return json({ read: true });
        }
        if (typeof body.clientId !== 'string' || !uuid.test(body.clientId))
            throw new RequestError('Identificador de envio inválido.', 400);
        let preview, payload, phone = '';
        if (body.action === 'text') {
            if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096)
                throw new RequestError('Escreva uma mensagem com até 4.096 caracteres.', 400);
            preview = body.text.trim();
            payload = { type: 'text', text: { preview_url: false, body: preview } };
        }
        else {
            if (typeof body.templateName !== 'string' || !/^[a-z0-9_]{1,512}$/.test(body.templateName) || typeof body.language !== 'string' || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(body.language))
                throw new RequestError('Informe o nome e o idioma do modelo aprovado na Meta.', 400);
            const parameters = body.parameters ?? [];
            if (!Array.isArray(parameters) || parameters.length > 20 || parameters.some(value => typeof value !== 'string' || !value.trim() || value.length > 256))
                throw new RequestError('Parâmetros do modelo inválidos.', 400);
            if (!conversationId) {
                try {
                    phone = whatsappPhoneInput(body.phone);
                }
                catch {
                    throw new RequestError('Informe o telefone do contato com DDD.', 400);
                }
            }
            preview = `Modelo: ${body.templateName}${parameters.length ? '\n' + parameters.join('\n') : ''}`;
            payload = { type: 'template', template: { name: body.templateName, language: { code: body.language }, ...(parameters.length ? { components: [{ type: 'body', parameters: parameters.map(text => ({ type: 'text', text })) }] } : {}) } };
        }
        await assertRateLimit(request, 'whatsapp_chat', `${organization.id}:${user.id}`, 30, 60);
        const reserved = await callRpc('fama_chat_reserve_send', {
            p_organization_id: organization.id, p_connection_id: String(connection.id), p_conversation_id: conversationId,
            p_phone_hash: phone ? await sha256(`${organization.id}:${phone}`) : '', p_phone_ciphertext: phone ? await encryptText(phone) : '',
            p_client_request_id: body.clientId, p_request_hash: await sha256(JSON.stringify({ conversationId, phone, payload })), p_body_ciphertext: await encryptText(preview), p_kind: body.action, p_actor_user_id: user.id,
        });
        if (!reserved?.message || !reserved.conversation)
            throw new RequestError('Não foi possível preparar o envio.', 503);
        reservation = reserved.message;
        if (!reserved.created)
            return json({ conversationId: String(reserved.conversation.id), message: await messageView(reserved.message), duplicate: true });
        const latest = await access(request);
        const current = await selectOne(connections, { id: String(connection.id), organization_id: organization.id });
        if (latest.user.id !== user.id || !ready(current) || current.phone_number_id !== connection.phone_number_id || current.token_ciphertext !== connection.token_ciphertext)
            throw new RequestError('A conexão ou o acesso mudou. Atualize o Chat.', 409);
        phone = await decryptText(String(reserved.conversation.phone_ciphertext));
        sending = true;
        const result = await whatsappGraph(String(current.phone_number_id), await decryptText(String(current.token_ciphertext)), { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, ...payload });
        const providerId = Array.isArray(result.messages) ? result.messages[0]?.id : null;
        if (typeof providerId !== 'string' || !providerId || providerId.length > 300)
            throw new RequestError('A Meta não confirmou o envio. Confira a conversa antes de enviar outra mensagem.', 502);
        const updated = await updateRows(messages, { provider_message_id: providerId, status: 'sent' }, { id: String(reservation.id), organization_id: organization.id, connection_id: String(connection.id) });
        if (!updated.length)
            throw new RequestError('A confirmação de envio está pendente. Atualize o Chat.', 502);
        return json({ conversationId: String(reserved.conversation.id), message: await messageView(updated[0]), duplicate: false });
    }
    catch (error) {
        if (reservation)
            await updateRows(messages, { status: sending ? 'uncertain' : 'failed' }, { id: String(reservation.id), organization_id: String(reservation.organization_id), status: 'sending' }).catch(() => { });
        return failure(error);
    }
}
export async function recordChatIncoming(connection, message, name = '') {
    const occurredAt = Number(message.timestamp) * 1000, age = Date.now() - occurredAt;
    if (!/^\d{10,15}$/.test(message.from || '') || typeof message.id !== 'string' || !message.id || message.id.length > 300 || !Number.isFinite(age) || age < -300_000 || age > 30 * 86400_000)
        return;
    const labels = { image: 'Imagem recebida', audio: 'Áudio recebido', video: 'Vídeo recebido', document: 'Documento recebido', sticker: 'Figurinha recebida', location: 'Localização recebida', contacts: 'Contato recebido' };
    const kind = message.type === 'text' ? 'text' : Object.hasOwn(labels, message.type) ? message.type : 'other';
    const caption = message.image?.caption || message.video?.caption || message.document?.caption || message.document?.filename;
    const text = (kind === 'text' ? String(message.text?.body || '') : `${labels[kind] || 'Mensagem recebida'}${caption ? '\n' + String(caption) : ''}`).slice(0, 4096);
    if (!text)
        return;
    return callRpc('fama_chat_record_message', { p_connection_id: String(connection.id), p_phone_hash: await sha256(`${connection.organization_id}:${message.from}`),
        p_phone_ciphertext: await encryptText(message.from), p_name_ciphertext: await encryptText(String(name).slice(0, 200)), p_message_id: message.id, p_body_ciphertext: await encryptText(text), p_kind: kind, p_direction: 'in', p_actor_user_id: '', p_occurred_at: new Date(occurredAt).toISOString() });
}
export async function recordChatOutgoing(connection, phone, providerId, text) {
    return callRpc('fama_chat_record_message', { p_connection_id: String(connection.id), p_phone_hash: await sha256(`${connection.organization_id}:${phone}`),
        p_phone_ciphertext: await encryptText(phone), p_name_ciphertext: '', p_message_id: providerId, p_body_ciphertext: await encryptText(text), p_kind: 'text', p_direction: 'out', p_actor_user_id: 'fama-ai', p_occurred_at: new Date().toISOString() });
}
export async function recordChatDelivery(connection, status) {
    if (typeof status.id !== 'string' || !status.id || status.id.length > 300 || !/^\d{10,15}$/.test(status.recipient_id || '') || !['sent', 'delivered', 'read', 'failed'].includes(status.status || ''))
        return;
    return callRpc('fama_chat_delivery', { p_connection_id: String(connection.id), p_message_id: status.id, p_phone_hash: await sha256(`${connection.organization_id}:${status.recipient_id}`), p_status: status.status });
}
