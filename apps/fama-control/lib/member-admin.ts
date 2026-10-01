import { accountInput, assertCompanyIdentity, updateAccount } from "@/lib/admin-accounts";
import { defaultFeaturePermissions, effectiveFeaturePermissions, featurePermissionIds, normalizePermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/security";
import { selectOne, selectRows, updateRows } from "@/lib/supabase";
import { RequestError } from "@/lib/tenant";

export function publicMember(row: Record<string, unknown>) {
  return { id: String(row.id), email: String(row.user_email), displayName: String(row.display_name ?? ""), role: String(row.role), status: String(row.status), permissions: effectiveFeaturePermissions(row.permissions) };
}

function samePermissions(left: unknown, right: unknown) {
  const a = normalizePermissions(left).sort(), b = normalizePermissions(right).sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export async function editCompanyMember(id: string, body: Record<string, unknown>, actorId: string) {
  const member = await selectOne<Record<string, unknown>>("organization_members", { id });
  if (!member) throw new RequestError("Usuário não encontrado.", 404);
  const organizationId = String(member.organization_id);
  const company = await selectOne("organizations", { id: organizationId });
  if (!company || company.status === "deleted") throw new RequestError("Empresa não encontrada.", 404);
  const userId = String(member.user_id ?? "");
  const oldEmail = String(member.user_email ?? "").toLowerCase();
  assertCompanyIdentity(oldEmail, userId);
  const fields: Record<string, unknown> = {};
  const identity: { email?: string; displayName?: string; password?: string } = {};
  const account = accountInput({
    displayName: body.displayName ?? (member.display_name || oldEmail),
    email: body.email ?? oldEmail,
    // A blank password during editing preserves the current password.
    password: body.password === undefined || body.password === "" ? "validation-placeholder" : body.password,
  });
  assertCompanyIdentity(account.email, userId);
  if ("displayName" in body) { fields.display_name = account.displayName; identity.displayName = account.displayName; }
  if ("email" in body && account.email !== oldEmail) {
    if (!userId) throw new RequestError("Este usuário ainda não ativou a conta. Conclua o acesso antes de alterar o e-mail.", 409);
    const [duplicates, memberships] = await Promise.all([
      selectRows("organization_members", { user_email: account.email }),
      selectRows("organization_members", { user_id: userId }),
    ]);
    if (duplicates.some(row => row.id !== id)) throw new RequestError("Este e-mail já pertence a outro usuário.", 409);
    if (memberships.length > 1) throw new RequestError("Esta conta participa de mais de uma empresa. O e-mail deve ser alterado pelo fluxo da conta.", 409);
    fields.user_email = account.email; identity.email = account.email;
  }
  if (body.password !== undefined && body.password !== "") {
    if (!userId) throw new RequestError("Este usuário ainda não possui uma conta de acesso ativa.", 409);
    identity.password = account.password;
  }
  if ("role" in body) {
    const role = String(body.role);
    if (!["admin", "member", "technician"].includes(role) && !(member.role === "owner" && role === "owner")) throw new RequestError("Escolha uma função válida para o usuário.", 400);
    if (member.role === "owner" && role !== "owner") throw new RequestError("O proprietário da empresa não pode ser rebaixado.", 400);
    fields.role = role;
  }
  if ("status" in body) {
    const status = String(body.status);
    if (!["active", "inactive"].includes(status) && !(status === "invited" && member.status === "invited")) throw new RequestError("Escolha uma situação válida para o usuário.", 400);
    if (member.role === "owner" && status !== "active") throw new RequestError("O proprietário da empresa não pode ser desativado.", 400);
    if (status === "active" && !userId) throw new RequestError("O convite deve ser aceito antes de ativar esta conta.", 409);
    fields.status = status;
  }
  if ("permissions" in body) {
    if (!Array.isArray(body.permissions) || body.permissions.some(value => typeof value !== "string" || !featurePermissionIds.includes(value as typeof featurePermissionIds[number]))) throw new RequestError("Envie uma lista válida de módulos.", 400);
    const permissions = normalizePermissions(body.permissions);
    if (member.role === "owner" && !samePermissions(permissions, defaultFeaturePermissions())) throw new RequestError("O proprietário mantém acesso a todos os módulos.", 400);
    fields.permissions = permissions;
  }
  if (!Object.keys(fields).length && !identity.password) throw new RequestError("Informe o que deseja atualizar.", 400);
  const updatedAt = new Date().toISOString();
  const undo = Object.fromEntries([...Object.keys(fields), "updated_at"].map(key => [key, member[key] ?? null]));
  if (Object.keys(fields).length) {
    const result = await updateRows("organization_members", { ...fields, updated_at: updatedAt }, { id });
    if (!result.length) throw new RequestError("Usuário não encontrado.", 404);
  }
  try {
    if (userId && Object.keys(identity).length) await updateAccount(userId, identity);
  } catch (error) {
    if (Object.keys(fields).length) {
      await updateRows("organization_members", undo, { id }).catch(() => console.warn("admin_member_edit_rollback_failed"));
    }
    throw error;
  }
  const persisted = await selectOne<Record<string, unknown>>("organization_members", { id });
  if (!persisted || Object.entries(fields).some(([key, value]) => key === "permissions" ? !samePermissions(persisted[key], value) : persisted[key] !== value)) throw new RequestError("O banco não confirmou a atualização. Recarregue os usuários para conferir os dados.", 409);
  await logAudit({ organizationId, actorUserId: actorId, eventType: "security", entityType: "organization_members", recordId: id, metadata: { action: "admin_member_edit", fields: Object.keys(fields), passwordChanged: Boolean(identity.password) } }).catch(() => console.warn("admin_member_edit_audit_unavailable"));
  return { updated: true, verified: true, id, member: publicMember(persisted), permissions: effectiveFeaturePermissions(persisted.permissions), updatedAt: String(persisted.updated_at ?? updatedAt) };
}
