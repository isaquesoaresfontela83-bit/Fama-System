import { recoveryEntity, recoveryPayload } from "@/lib/recovery-payload";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
export async function canRecoverSnapshot(organization, snapshot) {
    let entity = recoveryEntity(snapshot.entity_type);
    if (entity === "attachments") {
        try {
            const record = await recoveryPayload(snapshot, organization.id);
            if (!record || String(record.organization_id) !== organization.id || String(record.id) !== String(snapshot.record_id))
                return false;
            entity = String(record.entity_type ?? "");
        }
        catch {
            return false;
        }
    }
    const permission = Object.hasOwn(entityPermissions, entity) ? entityPermissions[entity]
        : ["suppliers", "purchases", "fiscalInvoices"].includes(entity) ? "finance" : undefined;
    return Boolean(permission && hasFeaturePermission(organization.role, organization.permissions, permission, organization.moduleAccess));
}
