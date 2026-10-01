import { database } from "@/lib/database";
import { usesSupabase } from "@/lib/supabase";
import { featurePermissionIds, normalizePermissions } from "@/lib/permissions";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";
import { editCompanyMember } from "@/lib/member-admin";
import { isTrustedMutation } from "@/lib/request-security";
import { assertRateLimit } from "@/lib/security";

function samePermissions(left: unknown, right: unknown) {
  const normalizedLeft = normalizePermissions(left).sort();
  const normalizedRight = normalizePermissions(right).sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((permission, index) => permission === normalizedRight[index]);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    if (!isTrustedMutation(request)) throw new RequestError("Origem da solicitação inválida.", 403);
    await assertRateLimit(request, "admin_member_edit", admin.id, 30, 60);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (usesSupabase()) return Response.json(await editCompanyMember(id, body, admin.id));
    if (Object.keys(body).some(key => key !== "permissions")) throw new RequestError("Configure o serviço de contas para editar os dados de acesso.", 503);
    const rawPermissions = body.permissions;
    if (!Array.isArray(rawPermissions) || rawPermissions.some((permission) => typeof permission !== "string" || !featurePermissionIds.includes(permission as typeof featurePermissionIds[number]))) {
      return Response.json({ error: "Envie uma lista válida de módulos." }, { status: 400 });
    }
    const permissions = normalizePermissions(rawPermissions);
    const updatedAt = new Date().toISOString();
    const member = await database().prepare(`SELECT id, role FROM organization_members WHERE id = ?`).bind(id).first<{ id: string; role: string }>();
    if (!member) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (member.role === "owner") return Response.json({ error: "As permissões do proprietário não podem ser reduzidas." }, { status: 400 });
    await database().prepare(`UPDATE organization_members SET permissions = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(permissions), updatedAt, id).run();
    const persisted = await database().prepare(`SELECT permissions, updated_at AS updatedAt FROM organization_members WHERE id = ?`).bind(id).first<{ permissions: string; updatedAt: string }>();
    if (!persisted || !samePermissions(persisted.permissions, permissions)) {
      return Response.json({ error: "O banco não confirmou a alteração. Tente novamente." }, { status: 409 });
    }
    return Response.json({ updated: true, verified: true, id, permissions: normalizePermissions(persisted.permissions), updatedAt: persisted.updatedAt });
  } catch (error) {
    return tenantError(error, "Não foi possível salvar as permissões.");
  }
}
