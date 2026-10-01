import { database } from "@/lib/database";
import { defaultCompanySettings, normalizeCompanySettings } from "@/lib/company-settings";
import { encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { selectOne, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const FISCAL_TOKEN_MASK = "•••••••• configurado";

async function ensureSettingsTable() {
  await database().prepare(`CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id TEXT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

async function organizationExists(id: string) {
  if (usesSupabase()) return Boolean(await selectOne<Record<string, unknown>>("organizations", { id }, { select: "id" }));
  return Boolean(await database().prepare("SELECT id FROM organizations WHERE id = ?").bind(id).first());
}

async function readSettings(organizationId: string) {
  await ensureSettingsTable();
  const row = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
    .bind(organizationId).first<{ settingsJson: string }>();
  const settings = normalizeCompanySettings(row?.settingsJson ? JSON.parse(row.settingsJson) : defaultCompanySettings);
  if (settings.fiscalApiToken) settings.fiscalApiToken = FISCAL_TOKEN_MASK;
  return settings;
}

async function writeSettings(organizationId: string, settings: unknown) {
  await ensureSettingsTable();
  const now = new Date().toISOString();
  const previous = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
    .bind(organizationId).first<{ settingsJson: string }>();
  const current = normalizeCompanySettings(previous?.settingsJson ? JSON.parse(previous.settingsJson) : defaultCompanySettings);
  const normalized = normalizeCompanySettings(settings);
  const incomingToken = normalized.fiscalApiToken.trim();
  if (!incomingToken || incomingToken === FISCAL_TOKEN_MASK) {
    normalized.fiscalApiToken = current.fiscalApiToken;
  } else {
    if (!isDataEncryptionConfigured()) throw new Error("Configure FAMA_DATA_ENCRYPTION_KEY antes de salvar token fiscal.");
    normalized.fiscalApiToken = await encryptText(incomingToken);
  }
  const settingsJson = JSON.stringify(normalized);
  await database().prepare(`INSERT INTO organization_settings (organization_id, settings_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`)
    .bind(organizationId, settingsJson, now).run();
  return { ...normalized, fiscalApiToken: normalized.fiscalApiToken ? FISCAL_TOKEN_MASK : "" };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    if (!await organizationExists(id)) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    return Response.json({ settings: await readSettings(id) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar as configurações da empresa.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    if (!await organizationExists(id)) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    const body = await request.json() as { settings?: unknown };
    return Response.json({ settings: await writeSettings(id, body.settings) });
  } catch (error) {
    return tenantError(error, "Não foi possível salvar as configurações da empresa.");
  }
}
