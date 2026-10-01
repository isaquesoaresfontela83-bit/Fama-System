import { deleteRows, removeObjects, selectOne, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const url = new URL(request.url);
    const entityType = String(url.searchParams.get("entity") ?? "");
    const permission = entityPermissions[entityType];
    if (!permission || !hasFeaturePermission(organization.role, organization.permissions, permission)) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    if (!usesSupabase()) return Response.json({ error: "Armazenamento indisponível." }, { status: 503 });
    const { id } = await context.params;
    const attachment = await selectOne<Record<string, unknown>>("attachments", {
      id,
      organization_id: organization.id,
    }, { select: "id,object_path" });
    if (!attachment) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    await removeObjects([String(attachment.object_path)]);
    await deleteRows("attachments", { id, organization_id: organization.id });
    return Response.json({ deleted: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível excluir o arquivo.");
  }
}
