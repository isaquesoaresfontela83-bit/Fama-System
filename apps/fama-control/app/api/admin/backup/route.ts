import { decryptText, encryptText } from "@/lib/crypto";
import { selectRows } from "@/lib/supabase";
import { logAudit } from "@/lib/security";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const collections = [
  ["leads", "leads"], ["quotes", "quotes"], ["appointments", "appointments"], ["workOrders", "work_orders"],
  ["customers", "customers"], ["inventory", "inventory_items"], ["transactions", "transactions"], ["employees", "employees"],
  ["warranties", "warranties"], ["contracts", "contracts"],
] as const;

export async function GET(request: Request) {
  try {
    const user = await requirePlatformAdmin();
    const organizations = await selectRows<Record<string, unknown>>("organizations", {}, { order: "created_at.asc" });
    const members = await selectRows<Record<string, unknown>>("organization_members", {}, { order: "created_at.asc" });
    const attachments = await selectRows<Record<string, unknown>>("attachments", {}, { order: "created_at.asc" });
    const data = await Promise.all(organizations.map(async (organization) => {
      const organizationId = String(organization.id);
      const entries = await Promise.all(collections.map(async ([entity, table]) => {
        const rows = await selectRows<Record<string, unknown>>(table, { organization_id: organizationId }, { order: "created_at.asc" });
        return [entity, rows] as const;
      }));
      return {
        organization,
        data: Object.fromEntries(entries),
        members: members.filter((row) => String(row.organization_id) === organizationId),
        attachments: attachments.filter((row) => String(row.organization_id) === organizationId),
      };
    }));
    const exportedAt = new Date().toISOString();
    const encryptedPayload = await encryptText(JSON.stringify({ organizations: data }));
    if (new URL(request.url).searchParams.get("verify") === "1") {
      const restored = JSON.parse(await decryptText(encryptedPayload)) as { organizations?: Array<{ data?: Record<string, unknown[]>; members?: unknown[]; attachments?: unknown[] }> };
      if (!Array.isArray(restored.organizations)) throw new Error("O conteúdo recuperado do backup não contém organizações válidas.");
      const recordCount = restored.organizations.reduce((total, item) => total + Object.values(item.data ?? {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0), 0);
      const memberCount = restored.organizations.reduce((total, item) => total + (item.members?.length ?? 0), 0);
      const attachmentCount = restored.organizations.reduce((total, item) => total + (item.attachments?.length ?? 0), 0);
      await logAudit({ actorUserId: user.id, eventType: "security", entityType: "platform_backup_verify", metadata: { organizations: restored.organizations.length, recordCount, memberCount, attachmentCount } });
      return Response.json({ valid: true, format: "fama-platform-backup-v2", encrypted: true, organizations: restored.organizations.length, records: recordCount, members: memberCount, attachments: attachmentCount, checkedAt: exportedAt }, { headers: { "Cache-Control": "no-store" } });
    }
    await logAudit({ actorUserId: user.id, eventType: "export", entityType: "platform_backup" });
    return new Response(JSON.stringify({
      format: "fama-platform-backup-v2",
      exportedAt,
      encrypted: true,
      algorithm: "AES-256-GCM",
      payload: encryptedPayload,
    }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fama-platform-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return tenantError(error, "Não foi possível gerar o backup da plataforma.");
  }
}
