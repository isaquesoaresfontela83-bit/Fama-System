import { database } from "@/lib/database";
import { selectOne, insertRow, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const settingKey = "plan_catalog";

function parseStoredPlans(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function tryInternalStore<T>(callback: (db: D1Database) => Promise<T>) {
  try {
    const db = database();
    await db.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
    )`).run();
    return await callback(db);
  } catch (error) {
    if (!usesSupabase()) throw error;
    console.warn("platform_settings_internal_store_unavailable", error);
    return null;
  }
}

function normalizePlans(value: unknown) {
  if (!Array.isArray(value)) return null;
  if (value.some((item) => !item || typeof item !== "object" || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0)) return null;
  return value.map((item) => {
    const plan = item as Record<string, unknown>;
    return {
      id: String(plan.id ?? "").trim(),
      name: String(plan.name ?? "").trim(),
      price: Math.max(0, Math.round(Number(plan.price ?? 0))),
      users: String(plan.users ?? "").trim(),
      clients: String(plan.clients ?? "").trim(),
      modules: String(plan.modules ?? "").trim(),
    };
  }).filter((item) => ["inicial", "intermediario", "profissional"].includes(item.id) && item.name);
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    const internal = await tryInternalStore(async (db) => {
      const row = await db.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(settingKey).first<{ value: string }>();
      return parseStoredPlans(row?.value);
    });
    if (internal) return Response.json({ plans: internal });

    if (usesSupabase()) {
      const row = await selectOne<Record<string, unknown>>("platform_settings", { key: settingKey }, { select: "value" });
      return Response.json({ plans: parseStoredPlans(row?.value) });
    }
    return Response.json({ plans: null });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os planos.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = await request.json() as { plans?: unknown };
    const plans = normalizePlans(body.plans);
    if (!plans?.length) return Response.json({ error: "Informe os planos." }, { status: 400 });
    const now = new Date().toISOString();
    const savedInternally = await tryInternalStore(async (db) => {
      await db.prepare(`INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
        .bind(settingKey, JSON.stringify(plans), now).run();
      return true;
    });
    if (savedInternally) return Response.json({ plans });

    if (usesSupabase()) {
      const existing = await selectOne<Record<string, unknown>>("platform_settings", { key: settingKey }, { select: "key" });
      if (existing) await updateRows("platform_settings", { value: plans, updated_at: now }, { key: settingKey });
      else await insertRow("platform_settings", { key: settingKey, value: plans, updated_at: now });
      return Response.json({ plans });
    }
    return Response.json({ error: "Banco de configurações indisponível." }, { status: 503 });
  } catch (error) {
    return tenantError(error, "Não foi possível salvar os planos.");
  }
}
