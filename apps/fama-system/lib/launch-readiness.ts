import { env } from "cloudflare:workers";

import { AsaasError, asaasRequest, type AsaasEnvironment } from "@/lib/asaas";
import { billingWebhookToken, getPlatformBillingConfig } from "@/lib/billing";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { decryptText } from "@/lib/crypto";
import { database } from "@/lib/database";
import { selectRows, usesSupabase } from "@/lib/supabase";
import { RequestError } from "@/lib/tenant";

export const BILLING_WEBHOOK_URL = "https://famasystem.online/api/billing/asaas-webhook";
export const BILLING_WEBHOOK_EVENTS = [
  "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE",
  "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE",
];

function validWebhookToken(token: string) {
  return token.length >= 32 && token.length <= 255 && !/\s/.test(token) && !token.startsWith("$aact_");
}

async function webhooks(apiKey: string, environment: AsaasEnvironment) {
  const payload = await asaasRequest(apiKey, environment, "/webhooks?limit=100&offset=0", { redirect: "manual" });
  if (!Array.isArray(payload.data) || payload.hasMore === true) throw new RequestError("Não foi possível conferir todos os webhooks da Asaas.", 503);
  return payload.data as Record<string, unknown>[];
}

function webhookState(row?: Record<string, unknown>) {
  const events = Array.isArray(row?.events) ? row.events.map(String) : [];
  return {
    configured: Boolean(row),
    enabled: row?.enabled === true,
    interrupted: row?.interrupted !== false,
    missingEvents: BILLING_WEBHOOK_EVENTS.filter(event => !events.includes(event)),
    url: BILLING_WEBHOOK_URL,
  };
}

async function probeBillingReceiver() {
  const token = billingWebhookToken();
  if (!validWebhookToken(token)) return false;
  try {
    const response = await fetch(BILLING_WEBHOOK_URL, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "asaas-access-token": token, "User-Agent": "Fama-System/1.0" },
      // An unhandled event verifies authentication and reachability without changing any payment.
      body: JSON.stringify({ event: "FAMA_LAUNCH_PROBE" }),
    });
    const result = await response.json() as Record<string, unknown>;
    return response.ok && result.ok === true && result.ignored === true;
  } catch { return false; }
}

export async function configureBillingWebhook() {
  const config = await getPlatformBillingConfig();
  if (!config) throw new RequestError("Configure a conta Asaas da plataforma.", 503);
  const token = billingWebhookToken();
  if (!validWebhookToken(token)) throw new RequestError("Configure um segredo de webhook válido.", 503);
  const status = await asaasRequest(config.apiKey, config.environment, "/myAccount/status", { redirect: "manual" });
  if (status.general !== "APPROVED") throw new RequestError("A conta Asaas precisa estar aprovada.", 409);
  if (!await probeBillingReceiver()) throw new RequestError("A confirmação de pagamentos precisa estar acessível antes de configurar a Asaas.", 503);
  const existing = (await webhooks(config.apiKey, config.environment)).find(row => row.url === BILLING_WEBHOOK_URL);
  const runtime = env as unknown as { PLATFORM_OWNER_EMAIL?: string };
  const email = String(runtime.PLATFORM_OWNER_EMAIL ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new RequestError("Configure o e-mail do responsável pela plataforma.", 503);
  const payload = {
    name: "Fama System — assinaturas", url: BILLING_WEBHOOK_URL, email,
    enabled: true, interrupted: false, apiVersion: 3, authToken: token, sendType: "SEQUENTIALLY",
    events: [...new Set([...(Array.isArray(existing?.events) ? existing.events.map(String) : []), ...BILLING_WEBHOOK_EVENTS])],
  };
  if (existing && !existing.id) throw new RequestError("A Asaas não retornou o identificador do webhook existente.", 503);
  await asaasRequest(config.apiKey, config.environment, existing ? `/webhooks/${encodeURIComponent(String(existing.id))}` : "/webhooks", {
    method: existing ? "PUT" : "POST", redirect: "manual", body: JSON.stringify(payload),
  });
  const verified = (await webhooks(config.apiKey, config.environment)).find(row => row.url === BILLING_WEBHOOK_URL);
  const state = webhookState(verified);
  if (!state.configured || !state.enabled || state.interrupted || state.missingEvents.length) throw new RequestError("A Asaas ainda não confirmou a configuração completa do webhook.", 503);
  return { ...state, environment: config.environment, receiverVerified: true };
}

export async function launchReadiness() {
  let billing: Record<string, unknown> = { configured: false, ready: false };
  try {
    const config = await getPlatformBillingConfig();
    if (config) {
      const [status, rows, receiverVerified] = await Promise.all([
        asaasRequest(config.apiKey, config.environment, "/myAccount/status", { redirect: "manual" }),
        webhooks(config.apiKey, config.environment), probeBillingReceiver(),
      ]);
      const state = webhookState(rows.find(row => row.url === BILLING_WEBHOOK_URL));
      billing = { configured: true, environment: config.environment, accountStatus: String(status.general ?? "UNKNOWN"), webhookTokenConfigured: validWebhookToken(billingWebhookToken()), webhook: state, receiverVerified,
        ready: config.environment === "production" && status.general === "APPROVED" && state.enabled && !state.interrupted && !state.missingEvents.length && receiverVerified };
    }
  } catch (error) {
    billing = { configured: false, ready: false, status: error instanceof AsaasError ? error.status : 503 };
  }
  const connections = usesSupabase()
    ? await selectRows<Record<string, unknown>>("bank_connections", { provider: "asaas" }, { select: "id,organization_id,institution,encrypted_item_id", limit: 50 })
    : (await database().prepare("SELECT id, organization_id, institution, encrypted_item_id FROM bank_connections WHERE provider = 'asaas' LIMIT 50").all<Record<string, unknown>>()).results;
  const accounts = await Promise.all(connections.map(async connection => {
    const environment = String(connection.institution).includes("Sandbox") ? "sandbox" : "production";
    const info = { connectionId: String(connection.id), organizationId: String(connection.organization_id), environment };
    try {
      const status = await asaasRequest(await decryptText(String(connection.encrypted_item_id)), environment, "/myAccount/status", { redirect: "manual" });
      return { ...info, accountStatus: String(status.general ?? "UNKNOWN"), approved: status.general === "APPROVED" };
    } catch (error) { return { ...info, approved: false, status: error instanceof AsaasError ? error.status : 503 }; }
  }));
  const settings = (await database().prepare("SELECT organization_id, settings_json FROM organization_settings LIMIT 50").all<{ organization_id: string; settings_json: string }>()).results;
  const fiscal = settings.map(row => {
    const company = normalizeCompanySettings(JSON.parse(row.settings_json));
    if (company.fiscalProvider.startsWith("portal_") || !company.fiscalApiToken) {
      const fields = { legalName: Boolean(company.legalName.trim()), document: /^\d{11}$|^\d{14}$/.test(company.document.replace(/\D/g, "")) };
      return { organizationId: row.organization_id, provider: company.fiscalProvider.startsWith("portal_") ? company.fiscalProvider : "portal_nacional", mode: "official_portal", status: "requires_official_portal_issuance", apiRequired: false, missing: Object.entries(fields).filter(([, configured]) => !configured).map(([name]) => name) };
    }
    const iss = Number(company.fiscalIssRate.replace(",", "."));
    const fields = {
      apiKey: Boolean(company.fiscalApiToken), production: company.fiscalEnvironment === "production",
      legalName: Boolean(company.legalName.trim()), document: /^\d{11}$|^\d{14}$/.test(company.document.replace(/\D/g, "")),
      serviceCode: Boolean(company.fiscalServiceCode.trim()), municipalRegistration: Boolean(company.fiscalMunicipalRegistration.trim()),
      taxRegime: Boolean(company.fiscalTaxRegime.trim()), issRate: Boolean(company.fiscalIssRate.trim()) && Number.isFinite(iss) && iss >= 0 && iss <= 100,
    };
    return { organizationId: row.organization_id, provider: company.fiscalProvider, status: "requires_provider_validation", missing: Object.entries(fields).filter(([, configured]) => !configured).map(([name]) => name) };
  });
  return { checkedAt: new Date().toISOString(), billing, accounts, fiscal };
}
