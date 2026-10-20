import { recoveryEntity, recoveryPayload } from "@/lib/recovery-payload";
import { insertRow, selectOne, updateRows } from "@/lib/supabase";
import { logAudit } from "@/lib/security";
import { assertRateLimit } from "@/lib/security";
import { canRecoverSnapshot } from "@/lib/recovery-access";
import { requireTenant, tenantError } from "@/lib/tenant";
const restoreTables = {
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
export async function POST(request, context) {
    try {
        const { user, organization } = await requireTenant(request, ["owner", "admin"]);
        await assertRateLimit(request, "record_restore", user.id, 20, 60);
        const { id } = await context.params;
        const snapshot = await selectOne("recovery_snapshots", { id, organization_id: organization.id, restored_at: null });
        const expiry = snapshot ? new Date(String(snapshot.expires_at)).getTime() : NaN;
        if (!snapshot || !Number.isFinite(expiry) || expiry <= Date.now())
            return Response.json({ error: "Este registro não está mais disponível para recuperação." }, { status: 404 });
        const entityType = recoveryEntity(snapshot.entity_type);
        const table = Object.hasOwn(restoreTables, entityType) ? restoreTables[entityType] : undefined;
        if (!table)
            return Response.json({ error: "Tipo de registro não recuperável." }, { status: 400 });
        if (!await canRecoverSnapshot(organization, snapshot))
            return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
        const record = await recoveryPayload(snapshot, organization.id);
        if (String(record.organization_id ?? "") !== organization.id || String(record.id ?? "") !== String(snapshot.record_id)) {
            return Response.json({ error: "A cópia de recuperação falhou na validação de segurança." }, { status: 409 });
        }
        const existing = await selectOne(table, { id: String(record.id), organization_id: organization.id }, { select: "id" });
        if (existing)
            return Response.json({ error: "Já existe um registro com este identificador." }, { status: 409 });
        await insertRow(table, record);
        const restoredAt = new Date().toISOString();
        for (const type of new Set([entityType, table])) {
            await updateRows("recovery_snapshots", { restored_at: restoredAt, restored_by_user_id: user.id }, { organization_id: organization.id, entity_type: type, record_id: String(record.id), restored_at: null });
        }
        await logAudit({ organizationId: organization.id, actorUserId: user.id, eventType: "restore", entityType, recordId: String(record.id) });
        return Response.json({ restored: true, entityType, recordId: record.id });
    }
    catch (error) {
        console.error("recovery_restore_failed", error);
        return tenantError(error, "Não foi possível restaurar o registro.");
    }
}
