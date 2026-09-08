import { database } from "@/lib/database";
import { requireTenant, tenantError } from "@/lib/tenant";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const { id } = await context.params;
    const db = database();
    const member = await db.prepare(`SELECT id, role FROM organization_members WHERE id = ? AND organization_id = ?`)
      .bind(id, organization.id)
      .first<{ id: string; role: string }>();
    if (!member) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (member.role === "owner") return Response.json({ error: "O proprietário da empresa não pode ser removido." }, { status: 400 });
    if (member.role === "admin" && organization.role !== "owner") {
      return Response.json({ error: "Somente o proprietário pode remover administradores." }, { status: 403 });
    }
    await db.prepare(`DELETE FROM organization_members WHERE id = ? AND organization_id = ?`).bind(id, organization.id).run();
    return Response.json({ deleted: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível remover o usuário.");
  }
}
