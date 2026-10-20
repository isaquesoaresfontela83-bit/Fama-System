import { env } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { database } from '@/lib/database';
import { RequestError } from '@/lib/request-error';
import { readLimitedBody } from '@/lib/request-body';
import { selectedIntegrations } from '@/lib/selected-integrations';
import { createSignedObjectUrl, selectOne } from '@/lib/supabase';
import { entityPermissions, hasFeaturePermission } from '@/lib/permissions';
import { assertPlanFeature } from '@/lib/plan-feature-access';
import { integrationBackend } from '@/lib/integration-backend';

export async function integrationTables() {
    await database().prepare(`CREATE TABLE IF NOT EXISTS fama_integration_operations (
        organization_id TEXT NOT NULL, provider TEXT NOT NULL, operation_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL, status TEXT NOT NULL, result_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
        PRIMARY KEY (organization_id, provider, operation_id)
    )`).run();
}
async function digest(value) {
    return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
}
export function validEmail(value) {
    return typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(value);
}
export async function integrationStatus(organizationId) {
    const { data } = await integrationBackend('fama-system-integrations', 'integration_status', { organization_id: organizationId });
    return selectedIntegrations.map(definition => {
        if (typeof data[definition.statusKey]?.configured !== 'boolean') throw new RequestError('Status de integração incompleto.', 502);
        return { provider: definition.id, configured: data[definition.statusKey].configured, managedBy: 'platform' };
    });
}
export async function readIntegration(organizationId, provider) {
    if (!selectedIntegrations.some(item => item.id === provider)) throw new RequestError('Esta integração é administrada no Fama Control.', 410);
    return (await integrationStatus(organizationId)).find(item => item.provider === provider);
}
function providerFile(bytes, mimeType, name) {
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new RequestError('Envie documentos de até 5 MB.', 413);
    return { name: String(name || 'documento').slice(0, 160), mime_type: mimeType, base64: Buffer.from(bytes).toString('base64') };
}
export async function extractDocumentText(organizationId, bytes, mimeType, filename = 'documento') {
    if (!bytes.length || bytes.length > 1024 * 1024) throw new RequestError('Na leitura gratuita, envie arquivos de até 1 MB.', 413);
    const signatures = { 'application/pdf': [37,80,68,70,45], 'image/png': [137,80,78,71,13,10,26,10], 'image/jpeg': [255,216,255] };
    if (!signatures[mimeType]?.every((byte,index) => bytes[index] === byte)) throw new RequestError('Escolha um PDF, JPG ou PNG válido para ler o texto.', 400);
    const { data } = await integrationBackend('fama-system-integrations', 'ocr_extract', { organization_id: organizationId, language: 'por', file: providerFile(bytes, mimeType, filename) });
    if (typeof data.text !== 'string') throw new RequestError('O serviço não confirmou o texto reconhecido.', 502);
    return { text: data.text, partial: data.partial === true };
}
export async function copyDocumentToDrive(organizationId, attachment, bytes) {
    const { data } = await integrationBackend('fama-system-integrations', 'drive_upload', { organization_id: organizationId, file: providerFile(bytes, attachment.mime_type, attachment.file_name) });
    if (!/^[A-Za-z0-9_-]{5,200}$/.test(String(data.id || ''))) throw new RequestError('O Google não confirmou o arquivo enviado.', 502);
    return { fileId: data.id, url: `https://drive.google.com/file/d/${data.id}/view` };
}
export async function sendSentryEvent(organizationId, input) {
    const kind = ['browser_error', 'unhandled_rejection', 'react_boundary', 'integration_test'].includes(input.kind) ? input.kind : 'browser_error';
    const { data } = await integrationBackend('fama-system-integrations', 'sentry_capture', { organization_id: organizationId, message: kind === 'integration_test' ? 'Verificação da integração Fama System' : 'Falha técnica no navegador Fama System' });
    if (!data.event_id) throw new RequestError('O Sentry não confirmou o evento.', 502);
    return { eventId: data.event_id, accepted: true };
}

export async function attachmentForIntegration(organization, attachmentId, maximumBytes = 10 * 1024 * 1024) {
    if (typeof attachmentId !== 'string' || attachmentId.length > 100) throw new RequestError('Selecione um documento do registro.', 400);
    const attachment = await selectOne('attachments', { id: attachmentId, organization_id: organization.id });
    if (!attachment) throw new RequestError('Documento não encontrado nesta empresa.', 404);
    const permission = entityPermissions[attachment.entity_type] ?? (['suppliers', 'purchases', 'fiscalInvoices'].includes(attachment.entity_type) ? 'finance' : null);
    if (!permission || !hasFeaturePermission(organization.role, organization.permissions, permission, organization.moduleAccess)) throw new RequestError('Seu perfil não tem acesso a este documento.', 403);
    if (attachment.entity_type === 'fiscalInvoices') await assertPlanFeature(organization.plan, 'invoices');
    if (!String(attachment.object_path).startsWith(organization.id + '/') || String(attachment.object_path).includes('..')) throw new RequestError('Documento inválido.', 400);
    if (Number(attachment.size_bytes) > maximumBytes) throw new RequestError(maximumBytes === 1024 * 1024 ? 'A leitura gratuita aceita arquivos de até 1 MB.' : 'O documento excede 10 MB.', 413);
    const signedUrl = new URL(await createSignedObjectUrl(attachment.object_path));
    if (signedUrl.protocol !== 'https:' || signedUrl.origin !== new URL(env.SUPABASE_URL).origin || !signedUrl.pathname.startsWith('/storage/v1/object/sign/')) throw new RequestError('Endereço do documento inválido.', 503);
    let response;
    try { response = await fetch(signedUrl, { redirect: 'manual', signal: AbortSignal.timeout(20000) }); }
    catch { throw new RequestError('Não foi possível carregar o documento.', 502); }
    if (!response.ok) { await response.body?.cancel(); throw new RequestError('Não foi possível carregar o documento.', 502); }
    const bytes = await readLimitedBody(response, maximumBytes, 20000);
    if (!bytes.length) throw new RequestError('O documento está vazio.', 400);
    return { attachment, bytes };
}


export async function emailDocument(organizationId, attachment, bytes, input) {
    await integrationTables();
    if (!validEmail(input.recipient)) throw new RequestError('Informe um único e-mail destinatário válido.', 400);
    const subject = String(input.subject || `Documento: ${attachment.file_name}`).trim();
    const message = String(input.message || 'Segue o documento enviado pelo Fama System.');
    if (!subject || subject.length > 180 || /[\r\n]/.test(subject) || message.length > 4000) throw new RequestError('Confira o assunto e a mensagem do e-mail.', 400);
    if (!/^[a-f0-9-]{36}$/i.test(String(input.operationId || ''))) throw new RequestError('Abra novamente o envio para continuar.', 400);
    const operationId = input.operationId.toLowerCase();
    const payloadHash = await digest(JSON.stringify([attachment.id, input.recipient, subject, message]));
    const db = database();
    let operation = await db.prepare('SELECT * FROM fama_integration_operations WHERE organization_id=? AND provider=? AND operation_id=?').bind(organizationId, 'resend', operationId).first();
    if (operation) {
        if (operation.payload_hash !== payloadHash) throw new RequestError('A tentativa anterior possui outro conteúdo. Abra um novo envio.', 409);
        if (operation.status === 'sent') return { ...JSON.parse(operation.result_json), alreadySent: true };
        if (operation.status !== 'failed') throw new RequestError('O envio anterior está em confirmação. Confira o Resend antes de repetir.', 409);
        const retry = await db.prepare("UPDATE fama_integration_operations SET status='processing' WHERE organization_id=? AND provider='resend' AND operation_id=? AND status='failed'").bind(organizationId, operationId).run();
        if (!retry.meta?.changes) throw new RequestError('Este envio já está sendo processado.', 409);
    } else {
        const now = new Date().toISOString();
        const claim = await db.prepare(`INSERT INTO fama_integration_operations (organization_id,provider,operation_id,payload_hash,status,created_at) VALUES (?,?,?,?,'processing',?) ON CONFLICT DO NOTHING`).bind(organizationId, 'resend', operationId, payloadHash, now).run();
        if (!claim.meta?.changes) throw new RequestError('Este envio já está sendo processado.', 409);
    }
    let result;
    try {
        result = (await integrationBackend('fama-system-integrations', 'resend_send', {
            organization_id: organizationId, to: input.recipient, subject, text: message,
            request_id: operationId, file: providerFile(bytes, attachment.mime_type, attachment.file_name),
        })).data;
    } catch (error) {
        const status = error instanceof RequestError && error.status >= 400 && error.status < 500 ? 'failed' : 'uncertain';
        await db.prepare('UPDATE fama_integration_operations SET status=? WHERE organization_id=? AND provider=? AND operation_id=?').bind(status, organizationId, 'resend', operationId).run();
        if (status === 'uncertain') throw new RequestError('O envio não foi confirmado. Confira o painel Resend antes de repetir para evitar duplicidade.', 502);
        throw error;
    }
    const status = result?.id ? 'sent' : 'uncertain';
    const receipt = { id: String(result?.id || '').slice(0, 100), accepted: true };
    await db.prepare('UPDATE fama_integration_operations SET status=?,result_json=? WHERE organization_id=? AND provider=? AND operation_id=?').bind(status, JSON.stringify(receipt), organizationId, 'resend', operationId).run();
    if (status !== 'sent') throw new RequestError('Confira o painel Resend antes de repetir: a confirmação do envio foi incompleta.', 502);
    return receipt;
}

