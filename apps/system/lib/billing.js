import { env } from "cloudflare:workers";
import { AsaasError, asaasRequest, parseAsaasEnvironment, validateAsaasKey } from "@/lib/asaas";
import { database } from "@/lib/database";
import { decryptText, encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { BILLING_CYCLES, cyclePrice, getPlanSnapshot } from "@/lib/plans";
import { normalizeCpf, normalizeLookupValue, taxDocumentCode } from "@/lib/registration-lookup";
function runtime() {
    return env;
}
export function billingEnvironment() {
    return parseAsaasEnvironment(runtime().FAMA_ASAAS_ENVIRONMENT);
}
export function billingApiKey() {
    return String(runtime().FAMA_ASAAS_API_KEY ?? "").trim();
}
export function billingWebhookToken() {
    return String(runtime().FAMA_ASAAS_WEBHOOK_TOKEN ?? "").trim();
}
export function isBillingConfigured() {
    const apiKey = billingApiKey();
    if (!apiKey)
        return false;
    validateAsaasKey(apiKey, billingEnvironment());
    return true;
}
export async function ensurePlatformBillingTable() {
    await database().prepare(`CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}
export async function getPlatformBillingConfig() {
    const envKey = billingApiKey();
    if (envKey)
        return { apiKey: envKey, environment: billingEnvironment(), updatedAt: "" };
    if (!isDataEncryptionConfigured())
        return null;
    await ensurePlatformBillingTable();
    const row = await database().prepare("SELECT value, updated_at AS updatedAt FROM platform_settings WHERE key = 'asaas_billing'").first();
    if (!row?.value)
        return null;
    const stored = JSON.parse(await decryptText(row.value));
    const environment = parseAsaasEnvironment(stored.environment);
    const apiKey = String(stored.apiKey ?? "").trim();
    if (!apiKey)
        return null;
    validateAsaasKey(apiKey, environment);
    return { apiKey, environment, updatedAt: row.updatedAt };
}
export async function savePlatformBillingConfig(input) {
    if (!isDataEncryptionConfigured())
        throw new Error("Configure FAMA_DATA_ENCRYPTION_KEY antes de salvar a chave Asaas.");
    await ensurePlatformBillingTable();
    const environment = parseAsaasEnvironment(input.environment);
    const apiKey = String(input.apiKey ?? "").trim();
    validateAsaasKey(apiKey, environment);
    await asaasRequest(apiKey, environment, "/myAccount/status");
    const now = new Date().toISOString();
    const value = await encryptText(JSON.stringify({ apiKey, environment }));
    await database().prepare(`INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('asaas_billing', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
        .bind(value, now).run();
    return { environment, updatedAt: now };
}
function todayInSaoPaulo() {
    return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "America/Sao_Paulo",
    }).format(new Date());
}
export async function createAsaasPixCheckout(input) {
    let document;
    try {
        const rawDocument = String(input.buyerDocument ?? "");
        document = taxDocumentCode(rawDocument).length === 11
            ? normalizeCpf(rawDocument)
            : normalizeLookupValue("cnpj", rawDocument);
        if (/^(\d)\1{13}$/.test(document))
            throw new Error("Documento inválido.");
    }
    catch {
        throw new AsaasError(400, "Informe um CPF ou CNPJ válido do pagador para gerar a cobrança.");
    }
    const apiKey = input.billingConfig?.apiKey ?? billingApiKey();
    const environment = input.billingConfig?.environment ?? billingEnvironment();
    validateAsaasKey(apiKey, environment);
    const plan = await getPlanSnapshot(input.plan);
    const billingCycle = input.billingCycle ?? "monthly";
    const cycle = BILLING_CYCLES[billingCycle];
    const requestedInstallments = Number(input.installments ?? 1);
    if (!Number.isInteger(requestedInstallments) || requestedInstallments < 1 || requestedInstallments > 12)
        throw new Error("Informe de 1 a 12 parcelas.");
    const installments = requestedInstallments;
    const totalValue = cyclePrice(plan.priceCents, billingCycle);
    const signal = AbortSignal.timeout(20000);
    const customerPayload = {
        name: input.buyerName || input.organizationName,
        email: input.buyerEmail,
        cpfCnpj: document,
        externalReference: input.organizationId,
        notificationDisabled: true,
    };
    const phone = String(input.buyerPhone ?? "").replace(/\D/g, "");
    if (phone.length >= 10)
        customerPayload.mobilePhone = phone;
    const customer = await asaasRequest(apiKey, environment, "/customers", {
        method: "POST",
        signal,
        body: JSON.stringify(customerPayload),
    });
    const customerId = String(customer.id ?? "");
    if (!customerId)
        throw new Error("A Asaas não retornou o cliente da cobrança.");
    const payment = await asaasRequest(apiKey, environment, "/payments", {
        method: "POST",
        signal,
        body: JSON.stringify({
            customer: customerId,
            billingType: installments > 1 ? "UNDEFINED" : "PIX",
            ...(installments > 1 ? { installmentCount: installments, totalValue } : { value: totalValue }),
            dueDate: todayInSaoPaulo(),
            description: `Fama System — Plano ${plan.name} ${cycle.label}${installments > 1 ? ` em ${installments}x` : ""}`,
            externalReference: `${input.organizationId}:${input.plan}:${billingCycle}:${installments}`,
        }),
    });
    const paymentId = String(payment.id ?? "");
    if (!paymentId)
        throw new Error("A Asaas não retornou a cobrança.");
    const pix = installments > 1 ? {} : await asaasRequest(apiKey, environment, `/payments/${encodeURIComponent(paymentId)}/pixQrCode`, { signal });
    return {
        paymentId,
        customerId,
        invoiceUrl: String(payment.invoiceUrl ?? payment.bankSlipUrl ?? ""),
        pixQrCode: String(pix.encodedImage ?? ""),
        pixCopyPaste: String(pix.payload ?? ""),
        dueDate: String(payment.dueDate ?? todayInSaoPaulo()),
        installments,
    };
}
export async function getAsaasPayment(paymentId, billingConfig) {
    const apiKey = billingConfig?.apiKey ?? billingApiKey();
    const environment = billingConfig?.environment ?? billingEnvironment();
    validateAsaasKey(apiKey, environment);
    return await asaasRequest(apiKey, environment, `/payments/${encodeURIComponent(paymentId)}`);
}
export function isPaidAsaasStatus(status) {
    return ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(String(status ?? ""));
}
export function addMonths(date, months) {
    const next = new Date(date);
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
    return next.toISOString();
}
export function cycleExpiresAt(cycle, date = new Date()) {
    return addMonths(date, BILLING_CYCLES[cycle].months);
}
export function paidPlanExpiresAt(cycle, currentPlan, nextPlan, status, expiresAt) {
    const existing = Date.parse(expiresAt);
    const start = status === "active" && currentPlan === nextPlan && Number.isFinite(existing) && existing > Date.now() ? new Date(existing) : new Date();
    return cycleExpiresAt(cycle, start);
}
