import { loadDailyAgenda,todayInSaoPaulo,normalizeName } from '@/lib/daily-agenda';
import { agendaRecipients,recipientMessage,splitAgendaMessage } from '@/lib/agenda-delivery';
import { baileysBridge } from '@/lib/baileys-server';
import { sha256 } from '@/lib/security';
import { database } from "@/lib/database";
import { decryptRecordFields, decryptText, encryptedFieldsByEntity } from "@/lib/crypto";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { camelizeRow, selectOne, selectRows, usesSupabase } from "@/lib/supabase";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";
import { limitedWhatsappBody } from '@/lib/fama-whatsapp';
import { whatsappGraph } from '@/lib/fama-whatsapp-transport';
import { whatsappWebhookGET, whatsappWebhookPOST } from '@/lib/fama-whatsapp-server';
import { isTrustedMutation } from '@/lib/request-security';
async function configuration(organizationId) {
    const connection = usesSupabase() ? await selectOne('fama_whatsapp_connections', { organization_id: organizationId }) : null;
    return {
        configured: Boolean(connection?.verified_at),
        webhookConfigured: Boolean(connection?.webhook_verified_at),
        phoneNumberId: connection ? `${String(connection.phone_number_id).slice(0, 5)}••••` : null,
    };
}
function cleanRecipient(value) {
    const recipient = String(value ?? "").replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(recipient))
        throw new RequestError("Informe um telefone com DDI e DDD.", 400);
    return recipient;
}
async function graphRequest(path, body, organizationId) {
    const connection = usesSupabase() ? await selectOne('fama_whatsapp_connections', { organization_id: organizationId }) : null;
    if (!connection?.verified_at || path !== '/messages')
        throw new RequestError('Configure o WhatsApp oficial nas configurações da empresa.', 503);
    return whatsappGraph(String(connection.phone_number_id), await decryptText(String(connection.token_ciphertext)), body);
}
async function sendDailyAgenda(body,organization) {
    const day=String(body.date ?? todayInSaoPaulo()).slice(0,10),parsed=new Date(day+'T12:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)throw new RequestError('Informe uma data válida.',400);
    if(!hasFeaturePermission(organization.role,organization.permissions,'agenda',organization.moduleAccess)||!hasFeaturePermission(organization.role,organization.permissions,'team',organization.moduleAccess))throw new RequestError('Seu perfil precisa de acesso à Agenda e Equipe.',403);
    const data=await loadDailyAgenda(organization.id,day,{warranties:hasFeaturePermission(organization.role,organization.permissions,'warranties',organization.moduleAccess),orders:hasFeaturePermission(organization.role,organization.permissions,'orders',organization.moduleAccess)});
    let connected=false;try{connected=(await baileysBridge(organization.id,'status')).status==='connected';}catch{}
    const sent=[],skipped=[],drafts=[],only=normalizeName(body.technician);
    for(const recipient of agendaRecipients(data)){
        if(only && normalizeName(recipient.employee.name)!==only)continue;
        if(recipient.reason){skipped.push({technician:recipient.employee.name,reason:recipient.reason});continue;}
        const text=recipientMessage(recipient,day);
        if(!connected){drafts.push({technician:recipient.employee.name,text});continue;}
        const parts=splitAgendaMessage(text);
        for(let i=0;i<parts.length;i++){
            const hash=await sha256(JSON.stringify([organization.id,day,recipient.employee.id,i,parts[i]]));
            const clientId=`${hash.slice(0,8)}-${hash.slice(8,12)}-8${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
            const result=await baileysBridge(organization.id,'send',{phone:recipient.phone,text:parts[i],clientId});
            if(result.status!=='sent'||!result.id)throw new RequestError('Envio sem confirmação. Confira o WhatsApp antes de reenviar.',502);
        }
        sent.push({technician:recipient.employee.name});
    }
    return {provider:'baileys',manualShare:!connected,date:day,sent,skipped,drafts};
}
export async function POST(request) {
    if (request.headers.has('x-hub-signature-256'))
        return whatsappWebhookPOST(request);
    try {
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação não autorizada.', 403);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            throw new RequestError('Envie a solicitação em JSON.', 415);
        const body = JSON.parse(await limitedWhatsappBody(request, 20_000));
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw new RequestError('Solicitação inválida.', 400);
        if (body.object === "whatsapp_business_account") {
            throw new RequestError('Assinatura não autorizada.', 401);
        }
        const { user, organization } = await requireTenant(request, ["owner", "admin"]);
        if (body.action === "status")
            return Response.json({ provider: "meta_whatsapp_cloud", ...await configuration(organization.id) }, { headers: { 'Cache-Control': 'no-store' } });
        if (body.action !== "dailyAgenda" && !hasFeaturePermission(organization.role, organization.permissions, "crm", organization.moduleAccess))
            throw new RequestError("Seu perfil não possui acesso ao CRM.", 403);
        await assertRateLimit(request, "whatsapp_cloud_send", user.id, 30, 60);
        if (body.action === "dailyAgenda") {
            if (!hasFeaturePermission(organization.role, organization.permissions, "agenda", organization.moduleAccess))
                throw new RequestError("Seu perfil não possui acesso à agenda.", 403);
            if (!hasFeaturePermission(organization.role, organization.permissions, "team", organization.moduleAccess))
                throw new RequestError("Seu perfil não possui acesso à equipe.", 403);
            if (!hasFeaturePermission(organization.role, organization.permissions, "chat", organization.moduleAccess))
                throw new RequestError("Seu perfil não possui acesso ao WhatsApp.", 403);
            return Response.json(await sendDailyAgenda(body, organization));
        }
        const to = cleanRecipient(body.to);
        const type = String(body.type ?? "text");
        let message;
        if (type === "template") {
            const name = String(body.templateName ?? "").trim();
            const language = String(body.languageCode ?? "pt_BR").trim();
            if (!/^[a-z0-9_]+$/i.test(name))
                throw new RequestError("Informe o nome aprovado do template Meta.", 400);
            message = { messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: language }, ...(Array.isArray(body.parameters) && body.parameters.length ? { components: [{ type: "body", parameters: body.parameters.map((value) => ({ type: "text", text: String(value).slice(0, 1024) })) }] } : {}) } };
        }
        else {
            const text = String(body.text ?? "").trim();
            if (!text || text.length > 4096)
                throw new RequestError("A mensagem deve ter entre 1 e 4096 caracteres.", 400);
            message = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } };
        }
        const result = await graphRequest("/messages", message, organization.id);
        return Response.json({ sent: true, messageId: Array.isArray(result.messages) ? result.messages[0]?.id ?? null : null });
    }
    catch (error) {
        if (error instanceof SyntaxError)
            return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
        if (error instanceof Error && error.message.startsWith('body_'))
            return Response.json({ error: 'Solicitação muito grande ou interrompida.' }, { status: 413 });
        return tenantError(error, "Não foi possível enviar a mensagem pelo WhatsApp oficial.");
    }
}
