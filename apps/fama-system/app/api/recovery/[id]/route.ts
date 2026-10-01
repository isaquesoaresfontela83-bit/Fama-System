import { decryptText } from "@/lib/crypto";
import { insertRow, selectOne, updateRows } from "@/lib/supabase";
import { logAudit } from "@/lib/security";
import { requireTenant, tenantError } from "@/lib/tenant";

const restoreTables: Record<string, string> = {
  leads: "leads",
  quotes: "quotes",
  appointments: "appointments",
  workOrders: "work_orders",
  customers: "customers",
  inventory: "inventory_items",
  transactions: "transactions",
  employees: "employees",
  warranties: "warranties",
  contracts: "contracts",
  attachments: "attachments",
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    const { id } = await context.params;
    const snapshot = await selectOne<Record<string, unknown>>("recovery_snapshots", { id, organization_id: organization.id, restored_at: null });
    if (!snapshot || new Date(String(snapshot.expires_at)).getTime() <= Date.now()) return Response.json({ error: "Este registro não está mais disponível para recuperação." }, { status: 404 });
    const entityType = String(snapshot.entity_type);
    const table = restoreTables[entityType];
    if (!table) return Response.json({ error: "Tipo de registro não recuperável." }, { status: 400 });
    const record = JSON.parse(await decryptText(String(snapshot.encrypted_payload))) as Record<string, unknown>;
    if (String(record.organization_id ?? "") !== organization.id || String(record.id ?? "") !== String(snapshot.record_id)) {
      return Response.json({ error: "A cópia de recuperação falhou na validação de segurança." }, { status: 409 });
    }
    const existing = await selectOne<Record<string, unknown>>(table, { id: String(record.id), organization_id: organization.id }, { select: "id" });
    if (existing) return Response.json({ error: "Já existe um registro com este identificador." }, { status: 409 });
    await insertRow(table, record);
    await updateRows("recovery_snapshots", { restored_at: new Date().toISOString(), restored_by_user_id: user.id }, { id, organization_id: organization.id });
    await logAudit({ organizationId: organization.id, actorUserId: user.id, eventType: "restore", entityType, recordId: String(record.id) });
    return Response.json({ restored: true, entityType, recordId: record.id });
  } catch (error) {
    console.error("recovery_restore_failed", error);
    return tenantError(error, "Não foi possível restaurar o registro.");
  }
}
