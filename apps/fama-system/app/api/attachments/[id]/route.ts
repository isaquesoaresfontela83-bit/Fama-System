import { deleteRows, selectOne, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { archiveForRecovery, assertRateLimit } from "@/lib/security";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    await assertRateLimit(request, "attachment_delete", user.id, 20, 60);
    const url = new URL(request.url);
    const entityType = String(url.searchParams.get("entity") ?? "");
    const permission = entityPermissions[entityType] ?? (["suppliers", "purchases", "fiscalInvoices"].includes(entityType) ? "finance" : undefined);
    if (!permission || !hasFeaturePermission(organization.role, organization.permissions, permission)) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    if (!usesSupabase()) return Response.json({ error: "Armazenamento indisponível." }, { status: 503 });
    const { id } = await context.params;
    const attachment = await selectOne<Record<string, unknown>>("attachments", {
      id,
      organization_id: organization.id,
      entity_type: entityType,
    });
    if (!attachment) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    if (entityType === "fiscalInvoices") return Response.json({ error: "Documentos fiscais são preservados no histórico da nota." }, { status: 409 });
    await archiveForRecovery({ organizationId: organization.id, entityType: "attachments", recordId: id, record: attachment, deletedByUserId: user.id });
    await deleteRows("attachments", { id, organization_id: organization.id });
    return Response.json({ deleted: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível excluir o arquivo.");
  }
}
