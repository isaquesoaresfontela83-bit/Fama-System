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
