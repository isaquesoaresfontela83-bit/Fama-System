import { database } from "@/lib/database";
import { deleteRows, selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { featurePermissionIds, normalizePermissions } from "@/lib/permissions";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const permissions = normalizePermissions(body.permissions);
    if (permissions.some((permission) => !featurePermissionIds.includes(permission))) {
      return Response.json({ error: "Permissões inválidas." }, { status: 400 });
    }
    const updatedAt = new Date().toISOString();
    if (usesSupabase()) {
      const member = await selectOne<Record<string, unknown>>("organization_members", { id, organization_id: organization.id }, { select: "id,role" });
      if (!member) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
      if (member.role === "owner") return Response.json({ error: "As permissões do proprietário não podem ser reduzidas." }, { status: 400 });
      const rows = await updateRows<Record<string, unknown>>("organization_members", { permissions, updated_at: updatedAt }, { id, organization_id: organization.id });
      return Response.json({ member: rows[0] ?? { id, permissions } });
    }
    const member = await database().prepare(`SELECT id, role FROM organization_members WHERE id = ? AND organization_id = ?`).bind(id, organization.id).first<{ id: string; role: string }>();
    if (!member) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (member.role === "owner") return Response.json({ error: "As permissões do proprietário não podem ser reduzidas." }, { status: 400 });
    await database().prepare(`UPDATE organization_members SET permissions = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).bind(JSON.stringify(permissions), updatedAt, id, organization.id).run();
    return Response.json({ member: { id, permissions } });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar as permissões.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const { id } = await context.params;
    const member = usesSupabase()
      ? await selectOne<{ id: string; role: string }>("organization_members", { id, organization_id: organization.id }, { select: "id,role" })
      : await database().prepare(`SELECT id, role FROM organization_members WHERE id = ? AND organization_id = ?`)
        .bind(id, organization.id)
        .first<{ id: string; role: string }>();
    if (!member) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (member.role === "owner") return Response.json({ error: "O proprietário da empresa não pode ser removido." }, { status: 400 });
    if (member.role === "admin" && organization.role !== "owner") {
      return Response.json({ error: "Somente o proprietário pode remover administradores." }, { status: 403 });
    }
    if (usesSupabase()) await deleteRows("organization_members", { id, organization_id: organization.id });
    else await database().prepare(`DELETE FROM organization_members WHERE id = ? AND organization_id = ?`).bind(id, organization.id).run();
    return Response.json({ deleted: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível remover o usuário.");
  }
}
