import { selectRows } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const rows = await selectRows<Record<string, unknown>>("recovery_snapshots", {
      organization_id: organization.id,
      restored_at: null,
    }, { order: "deleted_at.desc", limit: 100 });
    const now = Date.now();
    return Response.json({ records: rows.filter((row) => new Date(String(row.expires_at)).getTime() > now).map((row) => ({
      id: String(row.id),
      entityType: String(row.entity_type),
      recordId: String(row.record_id),
      deletedAt: String(row.deleted_at),
      expiresAt: String(row.expires_at),
    })) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar a lixeira.");
  }
}
