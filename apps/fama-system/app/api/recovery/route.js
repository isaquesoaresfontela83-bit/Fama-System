import { selectRows } from "@/lib/supabase";
import { canRecoverSnapshot } from "@/lib/recovery-access";
import { requireTenant, tenantError } from "@/lib/tenant";
import { encryptionPrefix } from "@/lib/crypto";
import { recoveryEntity } from "@/lib/recovery-payload";
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request, ["owner", "admin"]);
        const rows = await selectRows("recovery_snapshots", {
            organization_id: organization.id,
            restored_at: null,
        }, { order: "deleted_at.desc", limit: 100 });
        const now = Date.now();
        const visible = await Promise.all(rows.map(async (row) => new Date(String(row.expires_at)).getTime() > now && await canRecoverSnapshot(organization, row) ? row : null));
        const copies = new Map();
        for (const row of visible) {
            if (!row)
                continue;
            const key = `${recoveryEntity(row.entity_type)}:${row.record_id}`;
            const previous = copies.get(key);
            if (!previous || (!String(previous.encrypted_payload).startsWith(encryptionPrefix) && String(row.encrypted_payload).startsWith(encryptionPrefix)))
                copies.set(key, row);
        }
        return Response.json({ records: [...copies.values()].map((row) => ({
                id: String(row.id),
                entityType: recoveryEntity(row.entity_type),
                recordId: String(row.record_id),
                deletedAt: String(row.deleted_at),
                expiresAt: String(row.expires_at),
            })) });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar a lixeira.");
    }
}
