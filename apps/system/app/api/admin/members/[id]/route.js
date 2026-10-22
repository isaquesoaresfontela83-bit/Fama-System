import { database } from "@/lib/database";
import { selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { featurePermissionIds, normalizePermissions } from "@/lib/permissions";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";
export async function PATCH(request, context) {
    try {
        await requirePlatformAdmin();
        const { id } = await context.params;
        const body = await request.json();
        const rawPermissions = body.permissions;
        if (!Array.isArray(rawPermissions) || rawPermissions.some((permission) => typeof permission !== "string" || !featurePermissionIds.includes(permission))) {
            return Response.json({ error: "Envie uma lista válida de módulos." }, { status: 400 });
        }
        const permissions = normalizePermissions(rawPermissions);
        const updatedAt = new Date().toISOString();
        if (usesSupabase()) {
            const member = await selectOne("organization_members", { id }, { select: "id,role" });
            if (!member)
                return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
            if (String(member.role) === "owner")
                return Response.json({ error: "As permissões do proprietário não podem ser reduzidas." }, { status: 400 });
            const rows = await updateRows("organization_members", { permissions, updated_at: updatedAt }, { id });
            return Response.json({ updated: true, id, permissions: rows[0]?.permissions ?? permissions });
        }
        const member = await database().prepare(`SELECT id, role FROM organization_members WHERE id = ?`).bind(id).first();
        if (!member)
            return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
        if (member.role === "owner")
            return Response.json({ error: "As permissões do proprietário não podem ser reduzidas." }, { status: 400 });
        await database().prepare(`UPDATE organization_members SET permissions = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(permissions), updatedAt, id).run();
        return Response.json({ updated: true, id, permissions });
    }
    catch (error) {
        return tenantError(error, "Não foi possível salvar as permissões.");
    }
}
