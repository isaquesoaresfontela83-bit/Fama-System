import { AsaasError, asaasRequest, validateAsaasKey } from "@/lib/asaas";
import { RequestError } from "@/lib/tenant";
export function asaasInvoicePayload(settings, invoice, customer = "") {
    if (String(invoice.type ?? "nfse") !== "nfse")
        throw new RequestError("A Asaas emite NFS-e de serviços. Para NF-e de produtos, use o emissor autorizado da SEFAZ.", 400);
    const document = String(invoice.customerDocument ?? "").replace(/\D/g, "");
    if (![11, 14].includes(document.length))
        throw new RequestError("Informe CPF ou CNPJ do tomador.", 400);
    if (!String(invoice.customerName ?? "").trim())
        throw new RequestError("Informe o nome do tomador.", 400);
    const amount = Number(invoice.amountCents);
    if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new RequestError("Informe um valor válido para a nota.", 400);
    const description = String(invoice.serviceDescription ?? "").trim();
    if (!description)
        throw new RequestError("Informe a descrição do serviço.", 400);
    const effectiveDate = String(invoice.issueDate ?? "");
    const date = new Date(effectiveDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== effectiveDate)
        throw new RequestError("Informe uma data de emissão válida.", 400);
    const serviceCode = settings.fiscalServiceCode.trim();
    if (!serviceCode)
        throw new RequestError("Informe o código ou ID do serviço municipal nas configurações fiscais.", 400);
    const rate = (value, label) => {
        const parsed = Number(value.replace(",", "."));
        if (!value.trim() || !Number.isFinite(parsed) || parsed < 0 || parsed > 100)
            throw new RequestError(`Informe a alíquota de ${label} nas configurações fiscais da empresa.`, 400);
        return parsed;
    };
    return {
        customer: customer || undefined,
        externalReference: String(invoice.id ?? ""),
        serviceDescription: description,
        observations: String(invoice.notes ?? ""),
        value: amount / 100,
        deductions: 0,
        effectiveDate,
        ...(settings.fiscalServiceCodeType === "id" ? { municipalServiceId: serviceCode } : { municipalServiceCode: serviceCode }),
        municipalServiceName: description.slice(0, 160),
        taxes: {
            retainIss: settings.fiscalRetainIss,
            iss: rate(settings.fiscalIssRate, "ISS"),
            cofins: rate(settings.fiscalCofinsRate, "COFINS"),
            csll: rate(settings.fiscalCsllRate, "CSLL"),
            inss: rate(settings.fiscalInssRate, "INSS"),
            ir: rate(settings.fiscalIrRate, "IR"),
            pis: rate(settings.fiscalPisRate, "PIS"),
        },
    };
}
export function asaasInvoiceState(payload, reference = "") {
    const statuses = {
        SCHEDULED: "processando", SYNCHRONIZED: "processando", PROCESSING: "processando",
        AUTHORIZED: "emitida", PROCESSING_CANCELLATION: "cancelando", CANCELLATION_DENIED: "emitida",
        CANCELED: "cancelada", CANCELLED: "cancelada", ERROR: "erro",
    };
    const safeUrl = (value) => {
        const text = String(value ?? "");
        try {
            const url = new URL(text);
            return url.protocol === "https:" && !url.username && !url.password ? text.slice(0, 2000) : "";
        }
        catch {
            return "";
        }
    };
    return {
        status: statuses[String(payload.status ?? "SCHEDULED").toUpperCase()] ?? "processando",
        provider: "asaas",
        providerReference: String(payload.id ?? reference).slice(0, 120),
        officialNumber: String(payload.number ?? "").slice(0, 80),
        accessKey: String(payload.accessKey ?? payload.validationCode ?? "").slice(0, 120),
        xmlUrl: safeUrl(payload.xmlUrl),
        pdfUrl: safeUrl(payload.pdfUrl),
        errorMessage: String(payload.statusDescription ?? payload.errorMessage ?? "").slice(0, 500),
    };
}
export async function asaasFiscalRequest(settings, token, path, init = {}) {
    try {
        validateAsaasKey(token, settings.fiscalEnvironment);
        return await asaasRequest(token, settings.fiscalEnvironment, path, init);
    }
    catch (error) {
        if (error instanceof AsaasError)
            throw new RequestError(error.message, error.status);
        throw error;
    }
}
export async function issueAsaasInvoice(settings, token, invoice) {
    const body = asaasInvoicePayload(settings, invoice);
    const document = String(invoice.customerDocument ?? "").replace(/\D/g, "");
    const customers = await asaasFiscalRequest(settings, token, `/customers?cpfCnpj=${encodeURIComponent(document)}&limit=1`);
    if (!Array.isArray(customers.data))
        throw new RequestError("A Asaas não confirmou a consulta do tomador. Confira a conta antes de tentar novamente.", 502);
    const existing = customers.data[0];
    const customer = existing ?? await asaasFiscalRequest(settings, token, "/customers", {
        method: "POST", body: JSON.stringify({ name: String(invoice.customerName), cpfCnpj: document, email: String(invoice.customerEmail ?? "") || undefined }),
    });
    if (!customer.id)
        throw new RequestError("A Asaas não retornou a referência do tomador.", 502);
    const payload = await asaasFiscalRequest(settings, token, "/invoices", { method: "POST", body: JSON.stringify({ ...body, customer: String(customer.id) }) });
    const state = asaasInvoiceState(payload);
    if (!state.providerReference)
        throw new RequestError("A Asaas não retornou a referência da emissão. Confira o painel antes de tentar novamente.", 502);
    return state;
}
