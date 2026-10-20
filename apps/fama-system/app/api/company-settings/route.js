import { database } from "@/lib/database";
import { defaultCompanySettings, normalizeCompanySettings } from "@/lib/company-settings";
import { decryptText, encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";
import { validateAsaasKey, AsaasError } from "@/lib/asaas";
import { isFiscalProvider } from "@/lib/integration-providers";
import { planIncludesFeature } from "@/lib/plan-features";
const FISCAL_TOKEN_MASK = "•••••••• configurado";
function settingsForPlan(settings, plan) {
    const visible = { ...settings };
    for (const key of Object.keys(visible)) {
        if ((key.startsWith('fiscal') && !planIncludesFeature(plan, 'invoices')) || (key.startsWith('freight') && !planIncludesFeature(plan, 'freight')))
            Object.assign(visible, { [key]: defaultCompanySettings[key] });
    }
    if (visible.fiscalApiToken)
        visible.fiscalApiToken = FISCAL_TOKEN_MASK;
    return visible;
}
async function ensureSettingsTable() {
    await database().prepare(`CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id TEXT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}
async function readSettings(organizationId, plan) {
    await ensureSettingsTable();
    const row = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
        .bind(organizationId).first();
    const settings = normalizeCompanySettings(row?.settingsJson ? JSON.parse(row.settingsJson) : defaultCompanySettings);
    return settingsForPlan(settings, plan);
}
async function writeSettings(organizationId, settings, plan) {
    const input = settings && typeof settings === "object" ? settings : {};
    if (planIncludesFeature(plan, 'freight') && input.freightOriginCep !== undefined && input.freightOriginCep !== "" && (typeof input.freightOriginCep !== "string" || !/^\d{5}-?\d{3}$/.test(input.freightOriginCep)))
        throw new RequestError("Informe um CEP de origem com 8 dígitos.", 400);
    if (planIncludesFeature(plan, 'freight') && input.freightRateCentsPerKm !== undefined && (typeof input.freightRateCentsPerKm !== "number" || !Number.isSafeInteger(input.freightRateCentsPerKm) || input.freightRateCentsPerKm < 0 || input.freightRateCentsPerKm > 1_000_000))
        throw new RequestError("Informe um valor por quilômetro válido.", 400);
    if (planIncludesFeature(plan, 'invoices') && input.fiscalProvider !== undefined && !isFiscalProvider(input.fiscalProvider))
        throw new RequestError("Selecione a Asaas ou um emissor oficial para notas fiscais.", 400);
    await ensureSettingsTable();
    const now = new Date().toISOString();
    const previous = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
        .bind(organizationId).first();
    const current = normalizeCompanySettings(previous?.settingsJson ? JSON.parse(previous.settingsJson) : defaultCompanySettings);
    const normalized = normalizeCompanySettings(settings);
    for (const key of Object.keys(normalized)) {
        if ((key.startsWith('fiscal') && !planIncludesFeature(plan, 'invoices')) || (key.startsWith('freight') && !planIncludesFeature(plan, 'freight')))
            Object.assign(normalized, { [key]: current[key] });
    }
    const incomingToken = normalized.fiscalApiToken.trim();
    if (!planIncludesFeature(plan, 'invoices')) {
        normalized.fiscalApiToken = current.fiscalApiToken;
    }
    else if (normalized.fiscalProvider !== "asaas") {
        normalized.fiscalApiToken = "";
    }
    else if (!incomingToken || incomingToken === FISCAL_TOKEN_MASK) {
        normalized.fiscalApiToken = current.fiscalProvider === "asaas" ? current.fiscalApiToken : "";
    }
    else {
        if (!isDataEncryptionConfigured())
            throw new Error("Configure FAMA_DATA_ENCRYPTION_KEY antes de salvar token fiscal.");
        normalized.fiscalApiToken = await encryptText(incomingToken);
    }
    if (planIncludesFeature(plan, 'invoices') && normalized.fiscalProvider === "asaas" && normalized.fiscalApiToken) {
        try {
            validateAsaasKey(await decryptText(normalized.fiscalApiToken), normalized.fiscalEnvironment);
        }
        catch (error) {
            if (error instanceof AsaasError)
                throw new RequestError(error.message, error.status);
            throw error;
        }
    }
    const settingsJson = JSON.stringify(normalized);
    await database().prepare(`INSERT INTO organization_settings (organization_id, settings_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`)
        .bind(organizationId, settingsJson, now).run();
    return settingsForPlan(normalized, plan);
}
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request, ["owner", "admin"]);
        return Response.json({ settings: await readSettings(organization.id, organization.plan) });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar as configurações da empresa.");
    }
}
export async function POST(request) {
    try {
        const { organization } = await requireTenant(request, ["owner", "admin"]);
        const body = await request.json();
        return Response.json({ settings: await writeSettings(organization.id, body.settings, organization.plan) });
    }
    catch (error) {
        return tenantError(error, "Não foi possível salvar as configurações da empresa.");
    }
}
