import { database, optionalText } from "@/lib/database";
import { decryptText, encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { ensureFinanceSchema } from "@/lib/finance-schema";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { camelizeRow, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";
import { sha256 } from "@/lib/asaas";

const PREFERENCES_PROVIDER = "finance_preferences";
const PREFERENCES_HASH = "finance-preferences-v1";
const SUPPORTED_PROVIDERS = ["asaas", "mercado_pago", "pagbank"] as const;

type Provider = (typeof SUPPORTED_PROVIDERS)[number];
type PreferencePayload = { primaryProvider?: Provider; primaryConnectionId?: string };

const providerLabels: Record<Provider, string> = {
  asaas: "Asaas",
  mercado_pago: "Mercado Pago",
  pagbank: "PagBank",
};

function providerOf(value: unknown): Provider {
  const provider = optionalText(value);
  if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
    throw new RequestError("Provedor financeiro inválido.", 400);
  }
  return provider as Provider;
}

function cleanCredential(value: unknown) {
  const credential = optionalText(value);
  if (credential.length < 20 || credential.length > 4000) {
    throw new RequestError("Informe uma chave/token válido do provedor.", 400);
  }
  return credential;
}

async function readPreferences(organizationId: string): Promise<PreferencePayload> {
  const row = usesSupabase()
    ? await selectOne<Record<string, unknown>>("bank_connections", {
        organization_id: organizationId,
        provider: PREFERENCES_PROVIDER,
        item_hash: PREFERENCES_HASH,
      })
    : await database()
        .prepare("SELECT encrypted_item_id AS encryptedItemId FROM bank_connections WHERE organization_id = ? AND provider = ? AND item_hash = ? LIMIT 1")
        .bind(organizationId, PREFERENCES_PROVIDER, PREFERENCES_HASH)
        .first<Record<string, unknown>>();
  if (!row) return {};
  const item = usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row;
  try {
    return JSON.parse(await decryptText(String(item.encryptedItemId ?? "{}"))) as PreferencePayload;
  } catch {
    return {};
  }
}

async function savePreferences(organizationId: string, preferences: PreferencePayload, now: string) {
  const encrypted = await encryptText(JSON.stringify(preferences));
  if (usesSupabase()) {
    const existing = await selectOne<Record<string, unknown>>("bank_connections", {
      organization_id: organizationId,
      provider: PREFERENCES_PROVIDER,
      item_hash: PREFERENCES_HASH,
    });
    if (existing) {
      await updateRows("bank_connections", { encrypted_item_id: encrypted, updated_at: now }, { organization_id: organizationId, id: String(existing.id) });
      return;
    }
    await insertRow("bank_connections", {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      provider: PREFERENCES_PROVIDER,
      item_hash: PREFERENCES_HASH,
      encrypted_item_id: encrypted,
      institution: "Preferências financeiras",
      status: "ATIVA",
      last_synced_at: "",
      created_at: now,
      updated_at: now,
    });
    return;
  }
  const db = database();
  const existing = await db
    .prepare("SELECT id FROM bank_connections WHERE organization_id = ? AND provider = ? AND item_hash = ? LIMIT 1")
    .bind(organizationId, PREFERENCES_PROVIDER, PREFERENCES_HASH)
    .first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE bank_connections SET encrypted_item_id = ?, updated_at = ? WHERE organization_id = ? AND id = ?").bind(encrypted, now, organizationId, existing.id).run();
    return;
  }
  await db
    .prepare("INSERT INTO bank_connections (id, organization_id, provider, item_hash, encrypted_item_id, institution, status, last_synced_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Preferências financeiras', 'ATIVA', '', ?, ?)")
    .bind(crypto.randomUUID(), organizationId, PREFERENCES_PROVIDER, PREFERENCES_HASH, encrypted, now, now)
    .run();
}

function publicConnection(row: Record<string, unknown>, preferences: PreferencePayload) {
  const item = usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row;
  const provider = String(item.provider ?? "") as Provider;
  const id = String(item.id ?? "");
  return {
    id,
    provider,
    providerLabel: providerLabels[provider] ?? provider,
    institution: String(item.institution ?? providerLabels[provider] ?? provider),
    status: String(item.status ?? "ATIVA"),
    lastSyncedAt: String(item.lastSyncedAt ?? ""),
    primary: preferences.primaryProvider === provider && preferences.primaryConnectionId === id,
  };
}

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
    await ensureFinanceSchema();
    const preferences = await readPreferences(organization.id);
    const rows = usesSupabase()
      ? await selectRows<Record<string, unknown>>("bank_connections", { organization_id: organization.id }, { order: "updated_at.desc" })
      : (await database().prepare("SELECT id, provider, institution, status, last_synced_at AS lastSyncedAt FROM bank_connections WHERE organization_id = ? ORDER BY updated_at DESC").bind(organization.id).all<Record<string, unknown>>()).results;
    const connections = rows
      .map((row) => (usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row))
      .filter((row) => SUPPORTED_PROVIDERS.includes(String(row.provider ?? "") as Provider))
      .map((row) => publicConnection(row, preferences));
    return Response.json({ encryptionConfigured: isDataEncryptionConfigured(), connections, preferences });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar as conexões financeiras.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    await assertRateLimit(request, "finance_connections", user.id, 20, 60);
    if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
    if (!isDataEncryptionConfigured()) throw new RequestError("Configure a chave de criptografia do servidor antes de conectar provedores financeiros.", 503);
    await ensureFinanceSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = optionalText(body.action);
    const now = new Date().toISOString();

    if (action === "setPrimary") {
      const provider = providerOf(body.provider);
      const connectionId = optionalText(body.connectionId);
      if (!/^[\w-]{16,80}$/.test(connectionId)) throw new RequestError("Conexão principal inválida.", 400);
      await savePreferences(organization.id, { primaryProvider: provider, primaryConnectionId: connectionId }, now);
      return Response.json({ primaryProvider: provider, primaryConnectionId: connectionId });
    }

    if (action !== "connect") throw new RequestError("Ação financeira inválida.", 400);
    const provider = providerOf(body.provider);
    if (provider === "asaas") throw new RequestError("Use o botão Conectar Asaas para validar essa integração.", 400);
    const credential = cleanCredential(body.credential);
    const institution = optionalText(body.label).slice(0, 120) || providerLabels[provider];
    const itemHash = await sha256(`${provider}:${credential}`);
    const encryptedItemId = await encryptText(JSON.stringify({ provider, credential, createdAt: now }));
    let id = "";

    if (usesSupabase()) {
      const existing = await selectOne<Record<string, unknown>>("bank_connections", { organization_id: organization.id, provider, item_hash: itemHash });
      if (existing) {
        id = String(existing.id);
        await updateRows("bank_connections", { encrypted_item_id: encryptedItemId, institution, status: "ATIVA", updated_at: now }, { organization_id: organization.id, id });
      } else {
        id = crypto.randomUUID();
        await insertRow("bank_connections", { id, organization_id: organization.id, provider, item_hash: itemHash, encrypted_item_id: encryptedItemId, institution, status: "ATIVA", last_synced_at: "", created_at: now, updated_at: now });
      }
    } else {
      const db = database();
      const existing = await db.prepare("SELECT id FROM bank_connections WHERE organization_id = ? AND provider = ? AND item_hash = ? LIMIT 1").bind(organization.id, provider, itemHash).first<{ id: string }>();
      if (existing) {
        id = existing.id;
        await db.prepare("UPDATE bank_connections SET encrypted_item_id = ?, institution = ?, status = 'ATIVA', updated_at = ? WHERE organization_id = ? AND id = ?").bind(encryptedItemId, institution, now, organization.id, id).run();
      } else {
        id = crypto.randomUUID();
        await db.prepare("INSERT INTO bank_connections (id, organization_id, provider, item_hash, encrypted_item_id, institution, status, last_synced_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ATIVA', '', ?, ?)").bind(id, organization.id, provider, itemHash, encryptedItemId, institution, now, now).run();
      }
    }
    return Response.json({ connection: { id, provider, providerLabel: providerLabels[provider], institution, status: "ATIVA", lastSyncedAt: "", primary: false } }, { status: 201 });
  } catch (error) {
    return tenantError(error, "Não foi possível salvar a conexão financeira.");
  }
}
