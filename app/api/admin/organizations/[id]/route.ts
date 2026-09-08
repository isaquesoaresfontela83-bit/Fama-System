import { database, optionalText } from "@/lib/database";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const statuses = new Set(["active", "suspended"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const status = optionalText(body.status);
    if (!statuses.has(status)) return Response.json({ error: "Situação inválida." }, { status: 400 });
    const db = database();
    const now = new Date().toISOString();
    const result = await db.prepare(`UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run();
    if (!result.meta.changes) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    return Response.json({ updated: true, id, status });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar a empresa.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const db = database();
    const organization = await db.prepare("SELECT id FROM organizations WHERE id = ?").bind(id).first<{ id: string }>();
    if (!organization) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });

    const tables = [
      "leads",
      "quotes",
      "appointments",
      "work_orders",
      "customers",
      "inventory_items",
      "transactions",
      "employees",
      "warranties",
      "contracts",
      "organization_members",
    ];
    await db.batch([
      ...tables.map((table) => db.prepare(`DELETE FROM ${table} WHERE organization_id = ?`).bind(id)),
      db.prepare("DELETE FROM organizations WHERE id = ?").bind(id),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível excluir a empresa.");
  }
}
