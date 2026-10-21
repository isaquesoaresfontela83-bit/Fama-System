import { database, optionalText } from "@/lib/database";
import { decryptText, encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { ensureFinanceSchema } from "@/lib/finance-schema";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertPlanFeature } from "@/lib/plan-feature-access";
import { assertRateLimit } from "@/lib/security";
import { camelizeRow, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";
const PREFERENCES_PROVIDER = "finance_preferences";
const PREFERENCES_HASH = "finance-preferences-v1";
const SUPPORTED_PROVIDERS = ["asaas"];
const providerLabels = {
    asaas: "Asaas",
};
function providerOf(value) {
    const provider = optionalText(value);
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
        throw new RequestError("Provedor financeiro inválido.", 400);
    }
    return provider;
}
async function readPreferences(organizationId) {
    const row = usesSupabase()
        ? await selectOne("bank_connections", {
            organization_id: organizationId,
            provider: PREFERENCES_PROVIDER,
            item_hash: PREFERENCES_HASH,
        })
        : await database()
            .prepare("SELECT encrypted_item_id AS encryptedItemId FROM bank_connections WHERE organization_id = ? AND provider = ? AND item_hash = ? LIMIT 1")
            .bind(organizationId, PREFERENCES_PROVIDER, PREFERENCES_HASH)
            .first();
    if (!row)
        return {};
    const item = usesSupabase() ? camelizeRow(row) : row;
    try {
        const preferences = JSON.parse(await decryptText(String(item.encryptedItemId ?? "{}")));
        return preferences.primaryProvider === "asaas" && typeof preferences.primaryConnectionId === "string" ? preferences : {};
    }
    catch {
        return {};
    }
}
async function savePreferences(organizationId, preferences, now) {
    const encrypted = await encryptText(JSON.stringify(preferences));
    if (usesSupabase()) {
        const existing = await selectOne("bank_connections", {
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
        .first();
    if (existing) {
        await db.prepare("UPDATE bank_connections SET encrypted_item_id = ?, updated_at = ? WHERE organization_id = ? AND id = ?").bind(encrypted, now, organizationId, existing.id).run();
        return;
    }
    await db
        .prepare("INSERT INTO bank_connections (id, organization_id, provider, item_hash, encrypted_item_id, institution, status, last_synced_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Preferências financeiras', 'ATIVA', '', ?, ?)")
        .bind(crypto.randomUUID(), organizationId, PREFERENCES_PROVIDER, PREFERENCES_HASH, encrypted, now, now)
        .run();
}
function publicConnection(row, preferences) {
    const item = usesSupabase() ? camelizeRow(row) : row;
    const provider = String(item.provider ?? "");
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
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request);
        await assertPlanFeature(organization.plan, "finance");
        if (!hasFeaturePermission(organization.role, organization.permissions, "finance", organization.moduleAccess))
            throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
        await ensureFinanceSchema();
        const preferences = await readPreferences(organization.id);
        const rows = usesSupabase()
            ? await selectRows("bank_connections", { organization_id: organization.id }, { order: "updated_at.desc" })
            : (await database().prepare("SELECT id, provider, institution, status, last_synced_at AS lastSyncedAt FROM bank_connections WHERE organization_id = ? ORDER BY updated_at DESC").bind(organization.id).all()).results;
        const connections = rows
            .map((row) => (usesSupabase() ? camelizeRow(row) : row))
            .filter((row) => SUPPORTED_PROVIDERS.includes(String(row.provider ?? "")))
            .map((row) => publicConnection(row, preferences));
        return Response.json({ encryptionConfigured: isDataEncryptionConfigured(), connections, preferences });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar as conexões financeiras.");
    }
}
export async function POST(request) {
    try {
        const { user, organization } = await requireTenant(request, ["owner", "admin"]);
        await assertRateLimit(request, "finance_connections", user.id, 20, 60);
        await assertPlanFeature(organization.plan, "finance");
        if (!hasFeaturePermission(organization.role, organization.permissions, "finance", organization.moduleAccess))
            throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
        if (!isDataEncryptionConfigured())
            throw new RequestError("Configure a chave de criptografia do servidor antes de conectar provedores financeiros.", 503);
        await ensureFinanceSchema();
        const body = (await request.json());
        const action = optionalText(body.action);
        const now = new Date().toISOString();
        if (action === "setPrimary") {
            const provider = providerOf(body.provider);
            const connectionId = optionalText(body.connectionId);
            if (!/^[\w-]{16,80}$/.test(connectionId))
                throw new RequestError("Conexão principal inválida.", 400);
            const connection = usesSupabase()
                ? await selectOne("bank_connections", { organization_id: organization.id, id: connectionId, provider })
                : await database().prepare("SELECT id FROM bank_connections WHERE organization_id = ? AND id = ? AND provider = ?").bind(organization.id, connectionId, provider).first();
            if (!connection)
                throw new RequestError("Conexão Asaas não encontrada nesta empresa.", 404);
            await savePreferences(organization.id, { primaryProvider: provider, primaryConnectionId: connectionId }, now);
            return Response.json({ primaryProvider: provider, primaryConnectionId: connectionId });
        }
        if (action === "connect") {
            providerOf(body.provider);
            throw new RequestError("Use o botão Conectar Asaas para validar essa integração.", 400);
        }
        throw new RequestError("Ação financeira inválida.", 400);
    }
    catch (error) {
        return tenantError(error, "Não foi possível salvar a conexão financeira.");
    }
}
