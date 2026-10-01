import { selectRows } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const rows = await selectRows<Record<string, unknown>>("audit_logs", {}, { order: "occurred_at.desc", limit: 200 });
    return Response.json({ audit: rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      actorUserId: row.actor_user_id,
      eventType: row.event_type,
      entityType: row.entity_type,
      recordId: row.record_id,
      metadata: row.metadata,
      occurredAt: row.occurred_at,
    })) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar a auditoria.");
  }
}
