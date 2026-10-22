import { requestPublicUrl } from "@/lib/request-security";
import { decryptText, encryptText } from './crypto';
import { activeAuthIdentity, callRpc, deleteRows, insertRow, selectOne, selectRows, updateRows, usesSupabase } from './supabase';
import { RequestError, isPlanAccessBlocked, requireTenant } from './tenant';
import { assertRateLimit, sha256 } from './security';
import { isTrustedMutation } from './request-security';
import { limitedWhatsappBody, whatsappPhoneInput } from './fama-whatsapp';
import { whatsappGraph, whatsappSignature } from './fama-whatsapp-transport';
import { GET as readSettings } from '@/app/api/ai-settings/route';
import { parseAssistantSettingsEnvelope, restrictAssistantSettings } from './fama-ai-settings';
import { systemAssistantSources } from './fama-ai-access';
import { assistantCalendar } from './fama-ai-request';
import { answerNative } from './fama-ai-provider';
import { whatsappAssistantData } from './fama-whatsapp-data';
import { memberBlockAccess } from './fama-blocks-server';
import { hasBlockAccess } from './fama-blocks';
import { assertPlanFeature } from './plan-feature-access';
import { recordChatIncoming, recordChatOutgoing, recordChatDelivery } from './fama-chat-server';
const connectionTable = 'fama_whatsapp_connections', linkTable = 'fama_whatsapp_links', eventTable = 'fama_whatsapp_events';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers });
function backend() { if (!usesSupabase())
    throw new RequestError('A integração requer o banco de dados da plataforma.', 503); }
async function linkedAccess(organizationId, memberId) {
    const access = await callRpc('fama_whatsapp_member_access', { p_organization_id: organizationId, p_member_id: memberId });
    if (!access?.member || !access.organization || access.member.id !== memberId || access.member.organization_id !== organizationId || access.organization.id !== organizationId || !await activeAuthIdentity(String(access.member.user_id)))
        return null;
    access.member.moduleAccess = await memberBlockAccess(access.member, access.organization.plan ?? 'inicial');
    return access;
}
function failure(error) {
    if (error instanceof RequestError)
        return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
        return json({ error: 'Envie uma solicitação válida.' }, 400);
    if (error instanceof Error && error.message.startsWith('body_'))
        return json({ error: 'Solicitação muito grande ou interrompida.' }, 413);
    if (error?.code === '23505')
        return json({ error: 'Este número já está vinculado. Confira a conexão ou os telefones autorizados.' }, 409);
    return json({ error: 'Não foi possível concluir a operação. Tente novamente.' }, 503);
}
async function view(request, organizationId, userId) {
    const [connection, links, members] = await Promise.all([
        selectOne(connectionTable, { organization_id: organizationId }),
        selectRows(linkTable, { organization_id: organizationId, active: true }, { order: 'created_at.asc', limit: 30 }),
        selectRows('organization_members', { organization_id: organizationId, status: 'active' }, { select: 'id,user_id,user_email,display_name,role', limit: 100 }),
    ]);
    return {
        currentMemberId: String(members.find(member => member.user_id === userId)?.id || ''),
        connection: connection ? { id: String(connection.id), phoneNumberId: String(connection.phone_number_id), displayPhone: String(connection.display_phone || ''),
            verified: Boolean(connection.verified_at), webhookVerified: Boolean(connection.webhook_verified_at), enabled: connection.assistant_enabled === true,
            webhookUrl: `${requestPublicUrl(request).origin}/api/whatsapp/webhook?connection=${encodeURIComponent(String(connection.id))}`,
            verifyToken: await decryptText(String(connection.verify_token_ciphertext)), } : null,
        links: await Promise.all(links.map(async (link) => ({ id: String(link.id), memberId: String(link.member_id), name: String(members.find(member => member.id === link.member_id)?.display_name || 'Usuário sem acesso ativo'), phone: await decryptText(String(link.phone_ciphertext)) }))),
        members: members.filter(member => member.user_id).map(member => ({ id: String(member.id), name: String(member.display_name || member.user_email), email: String(member.user_email), role: String(member.role) })),
    };
}
export async function whatsappSettingsGET(request) {
    try {
        const { user, organization } = await requireTenant(request, ['owner', 'admin']);
        await assertPlanFeature(organization.plan, 'assistant');
        backend();
        return json(await view(request, organization.id, user.id));
    }
    catch (error) {
        return failure(error);
    }
}
export async function whatsappSettingsPOST(request) {
    try {
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação não autorizada.', 403);
        const { user, organization } = await requireTenant(request, ['owner', 'admin']);
        await assertPlanFeature(organization.plan, 'assistant');
        backend();
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            throw new RequestError('Envie a solicitação em JSON.', 415);
        await assertRateLimit(request, 'whatsapp_settings', user.id, 20, 60);
        const body = JSON.parse(await limitedWhatsappBody(request, 20_000));
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw new RequestError('Solicitação inválida.', 400);
        const allowed = { save: ['phoneNumberId', 'accessToken', 'appSecret'], enable: ['enabled'], link: ['phone', 'memberId'], revoke: ['linkId'] };
        if (!allowed[String(body.action)] || Object.keys(body).some(key => key !== 'action' && !allowed[String(body.action)].includes(key)))
            throw new RequestError('Solicitação inválida.', 400);
        const existing = await selectOne(connectionTable, { organization_id: organization.id });
        if (body.action === 'save') {
            if (typeof body.phoneNumberId !== 'string' || !/^\d{5,30}$/.test(body.phoneNumberId))
                throw new RequestError('Informe o ID do número oficial da Meta.', 400);
            if ((body.accessToken !== undefined && typeof body.accessToken !== 'string') || (body.appSecret !== undefined && typeof body.appSecret !== 'string'))
                throw new RequestError('Credenciais inválidas.', 400);
            const accessToken = String(body.accessToken || '') || (existing ? await decryptText(String(existing.token_ciphertext)) : '');
            const appSecret = String(body.appSecret || '') || (existing ? await decryptText(String(existing.app_secret_ciphertext)) : '');
            if (accessToken.length < 20 || accessToken.length > 4096 || /\s/.test(accessToken) || !/^[0-9a-f]{32}$/i.test(appSecret))
                throw new RequestError('Informe o token de acesso e a chave secreta do aplicativo Meta.', 400);
            const result = await whatsappGraph(body.phoneNumberId, accessToken);
            if (result.id !== body.phoneNumberId)
                throw new RequestError('O token não confirmou o número informado.', 400);
            const rotated = !existing || existing.phone_number_id !== body.phoneNumberId || Boolean(body.appSecret);
            const values = { phone_number_id: body.phoneNumberId, display_phone: String(result.display_phone_number || '').slice(0, 40), token_ciphertext: await encryptText(accessToken), app_secret_ciphertext: await encryptText(appSecret),
                verify_token_ciphertext: rotated ? await encryptText(crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')) : existing.verify_token_ciphertext,
                assistant_enabled: false, verified_at: new Date().toISOString(), webhook_verified_at: rotated ? null : existing.webhook_verified_at, updated_at: new Date().toISOString() };
            if (existing)
                await updateRows(connectionTable, values, { id: String(existing.id), organization_id: organization.id });
            else
                await insertRow(connectionTable, { ...values, id: crypto.randomUUID(), organization_id: organization.id });
        }
        else if (body.action === 'enable') {
            if (!existing || typeof body.enabled !== 'boolean')
                throw new RequestError('Configure a conexão antes de ativar a IA.', 400);
            if (body.enabled) {
                const links = await selectRows(linkTable, { organization_id: organization.id, active: true }, { limit: 1 });
                if (!existing.verified_at || !existing.webhook_verified_at || !links.length)
                    throw new RequestError('Confirme o recebimento na Meta e autorize ao menos um telefone antes de ativar a IA.', 409);
            }
            await updateRows(connectionTable, { assistant_enabled: body.enabled, updated_at: new Date().toISOString() }, { id: String(existing.id), organization_id: organization.id });
        }
        else if (body.action === 'link') {
            if (!existing || typeof body.memberId !== 'string' || body.memberId.length > 100)
                throw new RequestError('Configure a conexão e selecione o usuário.', 400);
            let phone;
            try {
                phone = whatsappPhoneInput(body.phone);
            }
            catch (error) {
                throw new RequestError(error.message, 400);
            }
            if (phone === String(existing.display_phone || '').replace(/\D/g, ''))
                throw new RequestError('Autorize o telefone pessoal do usuário, diferente do número da empresa.', 400);
            const access = await linkedAccess(organization.id, body.memberId);
            if (!access?.member || access.member.organization_id !== organization.id || access.member.id !== body.memberId)
                throw new RequestError('Selecione um usuário ativo desta empresa.', 403);
            const links = await selectRows(linkTable, { organization_id: organization.id }, { limit: 31 });
            const phoneHash = await sha256(`${organization.id}:${phone}`);
            const old = links.find(link => link.phone_hash === phoneHash);
            if (!old && links.filter(link => link.active === true).length >= 20)
                throw new RequestError('Autorize no máximo 20 telefones por empresa.', 409);
            const values = { member_id: body.memberId, phone_hash: phoneHash, phone_ciphertext: await encryptText(phone), active: true, context_ciphertext: '', last_used_at: null };
            if (old)
                await updateRows(linkTable, values, { id: String(old.id), organization_id: organization.id });
            else
                await insertRow(linkTable, { ...values, id: crypto.randomUUID(), organization_id: organization.id });
        }
        else {
            if (typeof body.linkId !== 'string' || body.linkId.length > 100)
                throw new RequestError('Telefone inválido.', 400);
            await deleteRows(linkTable, { id: body.linkId, organization_id: organization.id });
        }
        return json(await view(request, organization.id, user.id));
    }
    catch (error) {
        return failure(error);
    }
}
async function callbackConnection(request) {
    backend();
    const id = new URL(request.url).searchParams.get('connection') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id))
        throw new RequestError('Conexão não autorizada.', 403);
    const row = await selectOne(connectionTable, { id });
    if (!row)
        throw new RequestError('Conexão não autorizada.', 403);
    return row;
}
export async function whatsappWebhookGET(request) {
    try {
        const url = new URL(request.url), connection = await callbackConnection(request);
        const token = await decryptText(String(connection.verify_token_ciphertext));
        if (url.searchParams.get('hub.mode') !== 'subscribe' || !url.searchParams.get('hub.challenge') || await sha256(url.searchParams.get('hub.verify_token') || '') !== await sha256(token))
            throw new RequestError('Verificação não autorizada.', 403);
        await updateRows(connectionTable, { webhook_verified_at: new Date().toISOString() }, { id: String(connection.id) });
        return new Response(url.searchParams.get('hub.challenge'), { headers: { ...headers, 'Content-Type': 'text/plain' } });
    }
    catch (error) {
        return failure(error);
    }
}
async function processMessage(request, connection, message) {
    if (!/^\d{10,15}$/.test(message.from || '') || typeof message.id !== 'string' || !message.id || message.id.length > 300)
        return;
    const age = Date.now() - Number(message.timestamp) * 1000;
    if (!Number.isFinite(age) || age < -300_000 || age > 23 * 3600_000)
        return;
    const organizationId = String(connection.organization_id);
    const link = await selectOne(linkTable, { organization_id: organizationId, phone_hash: await sha256(`${organizationId}:${message.from}`), active: true });
    if (!link)
        return;
    const access = await linkedAccess(organizationId, String(link.member_id));
    if (!access?.member || !access.organization || access.member.id !== link.member_id || access.member.organization_id !== organizationId || access.organization.id !== organizationId)
        return;
    const org = access.organization, member = access.member;
    const moduleAccess = member.moduleAccess;
    if (!hasBlockAccess(moduleAccess, 'assistant'))
        return;
    if (isPlanAccessBlocked(String(org.plan_status || 'trial'), String(org.plan_expires_at || ''), org.billing_enabled !== false, org.block_on_expiry !== false))
        return;
    const messageHash = await sha256(message.id);
    const eventFilter = { connection_id: String(connection.id), message_hash: messageHash };
    if (!await callRpc('fama_whatsapp_claim_event', { p_connection_id: eventFilter.connection_id, p_message_hash: messageHash }))
        return;
    let sending = false;
    try {
        await assertRateLimit(request, 'whatsapp_assistant', `${organizationId}:${link.member_id}`, 12, 60);
        let reply = 'Envie sua pergunta por escrito, com até 2.000 caracteres. A Fama IA consulta apenas os módulos autorizados para seu usuário.';
        let nextContext = '';
        if (message.type === 'text' && typeof message.text?.body === 'string' && message.text.body.trim().length >= 3 && message.text.body.length <= 2000) {
            const preferences = await readSettings();
            if (!preferences.ok)
                throw new RequestError('Configuração da IA indisponível.', 503);
            const envelope = parseAssistantSettingsEnvelope(await preferences.json());
            const settings = { ...restrictAssistantSettings(envelope.settings, systemAssistantSources(String(member.role), member.permissions, moduleAccess)), allowNavigation: false, allowCreate: false, maxItems: Math.min(envelope.settings.maxItems, 10) };
            if (!settings.enabled) {
                await updateRows(eventTable, { status: 'ignored' }, eventFilter);
                return;
            }
            const accessKey = JSON.stringify([member.user_id, member.role, member.permissions, member.moduleAccess]);
            let history = [];
            if (link.context_ciphertext && Date.now() - Date.parse(String(link.last_used_at)) < 30 * 60_000) {
                try {
                    const context = JSON.parse(await decryptText(String(link.context_ciphertext)));
                    if (context.accessKey === accessKey && Array.isArray(context.history))
                        history = context.history.filter((item) => typeof item === 'string' && item.length <= 2000).slice(-4);
                }
                catch { /* A damaged conversation never grants access. */ }
            }
            const data = await whatsappAssistantData(organizationId, String(member.role), member.permissions, settings, moduleAccess);
            const calendar = assistantCalendar(data, 'America/Sao_Paulo');
            const answer = answerNative({ question: message.text.body.trim(), source: 'overview', history, timeZone: 'America/Sao_Paulo' }, calendar.data, settings, calendar.now);
            reply = `${answer.text}\n\nFama IA · ${String(org.name || 'Sua empresa')}\nPara salvar ou alterar registros, revise no Fama System.`.slice(0, 4096);
            nextContext = await encryptText(JSON.stringify({ accessKey, history: [...history, message.text.body.trim()].slice(-4) }));
        }
        const [latestLink, latestConnection, latestAccess] = await Promise.all([
            selectOne(linkTable, { id: String(link.id), organization_id: organizationId, active: true }),
            selectOne(connectionTable, { id: String(connection.id), organization_id: organizationId }),
            linkedAccess(organizationId, String(link.member_id)),
        ]);
        if (!latestLink || latestLink.member_id !== link.member_id || latestConnection?.assistant_enabled !== true || latestConnection.phone_number_id !== connection.phone_number_id || !latestAccess || JSON.stringify([latestAccess.member.user_id, latestAccess.member.role, latestAccess.member.permissions, latestAccess.member.moduleAccess]) !== JSON.stringify([member.user_id, member.role, member.permissions, member.moduleAccess]) || isPlanAccessBlocked(String(latestAccess.organization.plan_status || 'trial'), String(latestAccess.organization.plan_expires_at || ''), latestAccess.organization.billing_enabled !== false, latestAccess.organization.block_on_expiry !== false)) {
            await updateRows(eventTable, { status: 'ignored' }, eventFilter);
            return;
        }
        await updateRows(eventTable, { status: 'sending' }, eventFilter);
        sending = true;
        const result = await whatsappGraph(String(connection.phone_number_id), await decryptText(String(connection.token_ciphertext)), { messaging_product: 'whatsapp', recipient_type: 'individual', to: message.from, type: 'text', text: { preview_url: false, body: reply } });
        if (!Array.isArray(result.messages) || typeof result.messages[0]?.id !== 'string')
            throw new RequestError('Resposta de envio não confirmada.', 502);
        await recordChatOutgoing(connection, message.from, result.messages[0].id, reply);
        await updateRows(eventTable, { status: 'sent' }, eventFilter);
        await updateRows(linkTable, { context_ciphertext: nextContext, last_used_at: new Date().toISOString() }, { id: String(link.id), organization_id: organizationId });
    }
    catch (error) {
        await updateRows(eventTable, { status: sending ? 'uncertain' : 'failed' }, eventFilter).catch(() => { });
        throw error;
    }
}
export async function whatsappWebhookPOST(request) {
    try {
        const signature = request.headers.get('x-hub-signature-256');
        if (!/^sha256=[0-9a-f]{64}$/i.test(signature || ''))
            throw new RequestError('Assinatura não autorizada.', 401);
        const raw = await limitedWhatsappBody(request), connection = await callbackConnection(request);
        if (!await whatsappSignature(raw, signature, await decryptText(String(connection.app_secret_ciphertext))))
            throw new RequestError('Assinatura não autorizada.', 401);
        const body = JSON.parse(raw);
        if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry))
            throw new RequestError('Evento inválido.', 400);
        const messages = [];
        const names = new Map(), statuses = [];
        for (const entry of body.entry)
            for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
                const value = change?.value;
                if (change?.field !== 'messages' || !value || value.metadata?.phone_number_id !== connection.phone_number_id)
                    continue;
                if (Array.isArray(value.messages))
                    messages.push(...value.messages);
                if (Array.isArray(value.statuses))
                    statuses.push(...value.statuses);
                for (const contact of Array.isArray(value.contacts) ? value.contacts : [])
                    if (typeof contact?.wa_id === 'string' && typeof contact.profile?.name === 'string')
                        names.set(contact.wa_id, contact.profile.name);
            }
        if (messages.length > 20 || statuses.length > 100)
            throw new RequestError('Evento com mensagens demais.', 413);
        if (!connection.verified_at || !connection.webhook_verified_at)
            return json({ received: true });
        for (const status of statuses)
            if (status && typeof status === 'object')
                await recordChatDelivery(connection, status);
        for (const message of messages) {
            if (!message || typeof message !== 'object')
                continue;
            await recordChatIncoming(connection, message, names.get(message.from) || '');
            if (connection.assistant_enabled === true)
                await processMessage(request, connection, message);
        }
        if (messages.length)
            await updateRows(connectionTable, { last_received_at: new Date().toISOString() }, { id: String(connection.id) });
        return json({ received: true });
    }
    catch (error) {
        return failure(error);
    }
}
