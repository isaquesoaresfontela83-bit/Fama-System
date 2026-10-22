import { sha256 } from "@/lib/asaas";
import { billingWebhookToken } from "@/lib/billing";
import { asaasFiscalRequest } from "@/lib/fiscal";
import { RequestError } from "@/lib/tenant";
export const ASAAS_INVOICE_EVENTS = [
    "INVOICE_CREATED", "INVOICE_UPDATED", "INVOICE_SYNCHRONIZED", "INVOICE_AUTHORIZED",
    "INVOICE_PROCESSING_CANCELLATION", "INVOICE_CANCELED", "INVOICE_CANCELLATION_DENIED", "INVOICE_ERROR",
];
export async function asaasFiscalWebhookToken(organizationId) {
    const secret = billingWebhookToken();
    if (!secret)
        throw new RequestError("A confirmação fiscal da Asaas ainda não está configurada no servidor.", 503);
    return await sha256(`fama-fiscal:${organizationId}:${secret}`);
}
export async function configureAsaasFiscalWebhook(settings, token, organizationId) {
    const authToken = await asaasFiscalWebhookToken(organizationId);
    const email = settings.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email))
        throw new RequestError("Informe o e-mail da empresa para receber avisos fiscais da Asaas.", 400);
    const url = `https://famasystem.online/api/finance/asaas-webhook?organizationId=${encodeURIComponent(organizationId)}`;
    const rows = await asaasFiscalRequest(settings, token, "/webhooks?limit=100&offset=0");
    if (!Array.isArray(rows.data) || rows.hasMore === true)
        throw new RequestError("Não foi possível conferir todos os webhooks fiscais da Asaas.", 503);
    const existing = rows.data.find(row => row.url === url);
    if (existing && !existing.id)
        throw new RequestError("A Asaas não retornou o identificador do webhook fiscal.", 503);
    const payload = {
        name: "Fama System - NFS-e", url, email, authToken,
        enabled: true, interrupted: false, apiVersion: 3, sendType: "SEQUENTIALLY",
        events: [...new Set([...(Array.isArray(existing?.events) ? existing.events.map(String) : []), ...ASAAS_INVOICE_EVENTS])],
    };
    const saved = await asaasFiscalRequest(settings, token, existing ? `/webhooks/${encodeURIComponent(String(existing.id))}` : "/webhooks", {
        method: existing ? "PUT" : "POST", body: JSON.stringify(payload),
    });
    const events = Array.isArray(saved.events) ? saved.events : [];
    if (!saved.id || saved.enabled !== true || saved.interrupted !== false || ASAAS_INVOICE_EVENTS.some(event => !events.includes(event))) {
        throw new RequestError("A Asaas não confirmou a configuração do webhook fiscal.", 503);
    }
}
