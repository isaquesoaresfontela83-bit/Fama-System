import { decryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { camelizeRow, selectRows } from "@/lib/supabase";
import { logAudit } from "@/lib/security";
import { requireTenant, tenantError } from "@/lib/tenant";

const collections = [
  ["leads", "leads"],
  ["quotes", "quotes"],
  ["appointments", "appointments"],
  ["workOrders", "work_orders"],
  ["customers", "customers"],
  ["inventory", "inventory_items"],
  ["transactions", "transactions"],
  ["employees", "employees"],
  ["warranties", "warranties"],
  ["contracts", "contracts"],
  ["suppliers", "suppliers"],
  ["purchases", "purchases"],
  ["bankAccounts", "bank_accounts"],
  ["bankMovements", "bank_movements"],
] as const;

export async function GET(request: Request) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    const entries = await Promise.all(collections.map(async ([entity, table]) => {
      const rows = await selectRows<Record<string, unknown>>(table, { organization_id: organization.id }, { order: "created_at.desc" });
      return [entity, await Promise.all(rows.map((row) => decryptRecordFields(camelizeRow<Record<string, unknown>>(row), encryptedFieldsByEntity[entity] ?? [])))] as const;
    }));
    const [members, attachments] = await Promise.all([
      selectRows<Record<string, unknown>>("organization_members", { organization_id: organization.id }, { order: "created_at.asc" }),
      selectRows<Record<string, unknown>>("attachments", { organization_id: organization.id }, { order: "created_at.desc" }),
    ]);
    const exportData = {
      format: "fama-system-backup-v1",
      exportedAt: new Date().toISOString(),
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      data: Object.fromEntries(entries),
      members: members.map((row) => ({ id: row.id, email: row.user_email, displayName: row.display_name, role: row.role, permissions: row.permissions, status: row.status, createdAt: row.created_at })),
      attachments: attachments.map((row) => ({ id: row.id, entityType: row.entity_type, entityId: row.entity_id, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes, createdAt: row.created_at })),
      note: "Os arquivos anexados não estão incorporados neste JSON; a lista de metadados permite conferência.",
    };
    await logAudit({ organizationId: organization.id, actorUserId: user.id, eventType: "export", entityType: "organization_backup", recordId: organization.id });
    const safeName = organization.slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 60) || "empresa";
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fama-backup-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return tenantError(error, "Não foi possível gerar a exportação.");
  }
}
