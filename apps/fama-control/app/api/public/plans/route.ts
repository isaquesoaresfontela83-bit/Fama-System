import { database } from "@/lib/database";
import { selectOne, usesSupabase } from "@/lib/supabase";

const settingKey = "plan_catalog";

const fallbackPlans = [
  { id: "inicial", name: "Inicial", price: 4990, users: "2 usuários", clients: "200 clientes", modules: "CRM, agenda, financeiro e manual" },
  { id: "intermediario", name: "Intermediário", price: 9990, users: "6 usuários", clients: "1.000 clientes", modules: "Contratos, garantias e integrações financeiras" },
  { id: "profissional", name: "Profissional", price: 19990, users: "20 usuários", clients: "5.000 clientes", modules: "IA, conciliação e operação completa" },
];

function parsePlans(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return fallbackPlans;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.length ? parsed : fallbackPlans;
  } catch {
    return fallbackPlans;
  }
}

export async function GET() {
  try {
    const internal = await database().prepare("SELECT value FROM platform_settings WHERE key = ?").bind(settingKey).first<{ value: string }>().catch(() => null);
    if (internal?.value) return Response.json({ plans: parsePlans(internal.value) }, { headers: { "Cache-Control": "no-store" } });
    if (usesSupabase()) {
      const row = await selectOne<Record<string, unknown>>("platform_settings", { key: settingKey }, { select: "value" });
      return Response.json({ plans: parsePlans(row?.value) }, { headers: { "Cache-Control": "no-store" } });
    }
    await database().prepare(`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run();
    const row = await database().prepare("SELECT value FROM platform_settings WHERE key = ?").bind(settingKey).first<{ value: string }>();
    return Response.json({ plans: parsePlans(row?.value) }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch {
    return Response.json({ plans: fallbackPlans }, { headers: { "Cache-Control": "no-store" } });
  }
}
