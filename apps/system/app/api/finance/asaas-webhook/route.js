import { ASAAS_INVOICE_EVENTS, asaasFiscalWebhookToken } from "@/lib/asaas-fiscal-webhook";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { decryptText } from "@/lib/crypto";
import { database } from "@/lib/database";
import { asaasFiscalRequest, asaasInvoiceState } from "@/lib/fiscal";
import { RequestError, tenantError } from "@/lib/tenant";
export async function POST(request) {
    try {
        const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
        if (!organizationId || organizationId.length > 120)
            return Response.json({ error: "Empresa não informada." }, { status: 400 });
        const expected = await asaasFiscalWebhookToken(organizationId);
        if (request.headers.get("asaas-access-token") !== expected)
            return Response.json({ error: "Webhook não autorizado." }, { status: 401 });
        const body = await request.json();
        if (!ASAAS_INVOICE_EVENTS.includes(String(body.event ?? "")))
            return Response.json({ ok: true, ignored: true });
        const invoice = body.invoice;
        const reference = String(invoice?.id ?? "");
        if (!reference || reference.length > 120)
            return Response.json({ error: "Referência fiscal inválida." }, { status: 400 });
        const db = database();
        const local = await db.prepare("SELECT id FROM fiscal_invoices WHERE organization_id = ? AND provider = 'asaas' AND (provider_reference = ? OR (id = ? AND provider_reference = ''))")
            .bind(organizationId, reference, String(invoice?.externalReference ?? "")).first();
        if (!local)
            return Response.json({ ok: true, ignored: "invoice_not_found" });
        const row = await db.prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
            .bind(organizationId).first();
        const settings = normalizeCompanySettings(row?.settingsJson ? JSON.parse(row.settingsJson) : {});
        // Read the current provider state so delayed or repeated events cannot restore an old status.
        const payload = await asaasFiscalRequest(settings, await decryptText(settings.fiscalApiToken), `/invoices/${encodeURIComponent(reference)}`);
        const state = asaasInvoiceState(payload, reference);
        if (state.providerReference !== reference || (payload.externalReference && payload.externalReference !== local.id))
            throw new RequestError("A referência fiscal não corresponde ao rascunho da empresa.", 409);
        await db.prepare("UPDATE fiscal_invoices SET status = CASE WHEN status = 'cancelada' THEN status WHEN status IN ('emitida', 'cancelando') AND ? = 'processando' THEN status ELSE ? END, official_number = CASE WHEN ? <> '' THEN ? ELSE official_number END, access_key = CASE WHEN ? <> '' THEN ? ELSE access_key END, xml_url = CASE WHEN ? <> '' THEN ? ELSE xml_url END, pdf_url = CASE WHEN ? <> '' THEN ? ELSE pdf_url END, provider_reference = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND provider = 'asaas'")
            .bind(state.status, state.status, state.officialNumber, state.officialNumber, state.accessKey, state.accessKey, state.xmlUrl, state.xmlUrl, state.pdfUrl, state.pdfUrl, reference, new Date().toISOString(), local.id, organizationId).run();
        return Response.json({ ok: true });
    }
    catch (error) {
        return tenantError(error, "Não foi possível atualizar a nota fiscal. A Asaas poderá reenviar a confirmação.");
    }
}
