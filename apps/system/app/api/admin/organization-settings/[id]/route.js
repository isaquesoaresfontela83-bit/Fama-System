import { database } from "@/lib/database";
import { defaultCompanySettings, normalizeCompanySettings } from "@/lib/company-settings";
import { decryptText, encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { selectOne, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError, RequestError } from "@/lib/tenant";
import { isFiscalProvider } from "@/lib/integration-providers";
import { validateAsaasKey, AsaasError } from "@/lib/asaas";
const FISCAL_TOKEN_MASK = "•••••••• configurado";
async function ensureSettingsTable() {
    await database().prepare(`CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id TEXT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}
async function organizationExists(id) {
    if (usesSupabase())
        return Boolean(await selectOne("organizations", { id }, { select: "id" }));
    return Boolean(await database().prepare("SELECT id FROM organizations WHERE id = ?").bind(id).first());
}
async function readSettings(organizationId) {
    await ensureSettingsTable();
    const row = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
        .bind(organizationId).first();
    const settings = normalizeCompanySettings(row?.settingsJson ? JSON.parse(row.settingsJson) : defaultCompanySettings);
    if (settings.fiscalApiToken)
        settings.fiscalApiToken = FISCAL_TOKEN_MASK;
    return settings;
}
async function writeSettings(organizationId, settings) {
    const input = settings && typeof settings === "object" ? settings : {};
    if (input.fiscalProvider !== undefined && !isFiscalProvider(input.fiscalProvider))
        throw new RequestError("Selecione a Asaas ou um emissor oficial para notas fiscais.", 400);
    await ensureSettingsTable();
    const now = new Date().toISOString();
    const previous = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
        .bind(organizationId).first();
    const current = normalizeCompanySettings(previous?.settingsJson ? JSON.parse(previous.settingsJson) : defaultCompanySettings);
    const normalized = normalizeCompanySettings(settings);
    const incomingToken = normalized.fiscalApiToken.trim();
    if (normalized.fiscalProvider !== "asaas") {
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
    if (normalized.fiscalProvider === "asaas" && normalized.fiscalApiToken) {
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
    return { ...normalized, fiscalApiToken: normalized.fiscalApiToken ? FISCAL_TOKEN_MASK : "" };
}
export async function GET(_request, context) {
    try {
        await requirePlatformAdmin();
        const { id } = await context.params;
        if (!await organizationExists(id))
            return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
        return Response.json({ settings: await readSettings(id) });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar as configurações da empresa.");
    }
}
export async function POST(request, context) {
    try {
        await requirePlatformAdmin();
        const { id } = await context.params;
        if (!await organizationExists(id))
            return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
        const body = await request.json();
        return Response.json({ settings: await writeSettings(id, body.settings) });
    }
    catch (error) {
        return tenantError(error, "Não foi possível salvar as configurações da empresa.");
    }
}
