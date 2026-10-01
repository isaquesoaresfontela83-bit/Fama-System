import { database } from "@/lib/database";
import { camelizeRow, selectRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

async function ensureAdminBillingColumns() {
  if (usesSupabase()) return;
  const db = database();
  const info = await db.prepare("PRAGMA table_info(organizations)").all<{ name: string }>();
  const columns = new Set(info.results.map((entry) => entry.name));
  if (!columns.has("plan")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'inicial'").run();
  if (!columns.has("plan_status")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'").run();
  if (!columns.has("plan_expires_at")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_expires_at TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_payment_id")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_payment_id TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_provider")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_provider TEXT NOT NULL DEFAULT ''").run();
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureAdminBillingColumns();
    if (usesSupabase()) {
      const [organizations, members] = await Promise.all([
        selectRows<Record<string, unknown>>("organizations", {}, { order: "created_at.desc" }),
        selectRows<Record<string, unknown>>("organization_members", {}, { select: "id,organization_id" }),
      ]);
      return Response.json({ organizations: organizations.map((row) => {
        const organization = camelizeRow<Record<string, unknown>>(row);
        return {
          ...organization,
          memberCount: members.filter((member) => member.organization_id === row.id).length,
        };
      }) });
    }
    const db = database();
    const result = await db.prepare(`SELECT o.id, o.name, o.slug, o.status, o.plan, o.plan_status AS planStatus,
        o.plan_expires_at AS planExpiresAt, o.billing_provider AS billingProvider, o.billing_payment_id AS billingPaymentId,
        o.created_at AS createdAt,
        COUNT(m.id) AS memberCount
      FROM organizations o
      LEFT JOIN organization_members m ON m.organization_id = o.id
      GROUP BY o.id, o.name, o.slug, o.status, o.plan, o.plan_status, o.plan_expires_at, o.billing_provider, o.billing_payment_id, o.created_at
      ORDER BY o.created_at DESC`).all();
    return Response.json({ organizations: result.results });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar as empresas da plataforma.");
  }
}
