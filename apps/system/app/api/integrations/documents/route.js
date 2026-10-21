import { requireTenant, tenantError, RequestError } from '@/lib/tenant';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit, logAudit } from '@/lib/security';
import { integrationStatus, attachmentForIntegration, copyDocumentToDrive, extractDocumentText, emailDocument } from '@/lib/selected-integrations-server';
const headers = { 'Cache-Control': 'private,no-store' };
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request, ['owner','admin']);
        const items = await integrationStatus(organization.id);
        const configured = provider => items.find(item => item.provider === provider)?.configured === true;
        return Response.json({ drive: { configured: configured('drive') }, resend: { configured: configured('resend') }, ocrspace: { configured: configured('ocrspace') } }, { headers });
    } catch (error) { return tenantError(error, 'Não foi possível consultar as ações dos documentos.'); }
}
export async function POST(request) {
    try {
        const { organization, user } = await requireTenant(request, ['owner','admin']);
        const input = await readJsonObject(request, 16 * 1024);
        if (!['drive', 'resend', 'ocrspace'].includes(input.provider)) throw new RequestError('Ação de documento inválida.', 400);
        if (input.provider === 'resend' && !['owner', 'admin'].includes(organization.role)) throw new RequestError('Seu perfil não permite enviar documentos por e-mail.', 403);
        await assertRateLimit(request, `integration_document_${input.provider}`, `${organization.id}:${user.id}`, 10, 60);
        const { attachment, bytes } = await attachmentForIntegration(organization, input.attachmentId, input.provider === 'ocrspace' ? 1024 * 1024 : 5 * 1024 * 1024);
        const result = input.provider === 'drive' ? await copyDocumentToDrive(organization.id, attachment, bytes)
            : input.provider === 'ocrspace' ? await extractDocumentText(organization.id, bytes, attachment.mime_type, attachment.file_name)
            : await emailDocument(organization.id, attachment, bytes, input);
        await logAudit({ organizationId: organization.id, actorUserId: user.id, eventType: 'integration_document_action', entityType: 'attachments', recordId: attachment.id, metadata: { provider: input.provider } });
        return Response.json(result, { headers });
    } catch (error) { return tenantError(error, 'Não foi possível concluir a ação do documento.'); }
}
