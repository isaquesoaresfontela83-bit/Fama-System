import { accountInput, createAccount, removeCreatedAccount } from "@/lib/admin-accounts";
import { defaultFeaturePermissions, normalizePermissions, featurePermissionIds } from "@/lib/permissions";
import { publicMember } from "@/lib/member-admin";
import { selectOne, selectRows, insertRow, deleteRows, usesSupabase } from "@/lib/supabase";
import { assertRateLimit, logAudit } from "@/lib/security";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";
import { isTrustedMutation } from "@/lib/request-security";

type Context = { params: Promise<{ id: string }> };
async function company(id: string) {
  if (!usesSupabase()) throw new RequestError("O serviço de contas não está configurado.", 503);
  const organization = await selectOne<Record<string, unknown>>("organizations", { id });
  if (!organization || organization.status === "deleted") throw new RequestError("Empresa não encontrada.", 404);
  return organization;
}

export async function GET(_request: Request, context: Context) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    await company(id);
    return Response.json({ members: (await selectRows<Record<string, unknown>>("organization_members", { organization_id: id }, { order: "user_email.asc" })).map(publicMember) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return tenantError(error, "Não foi possível carregar os usuários da empresa."); }
}

export async function POST(request: Request, context: Context) {
  let createdUserId = "";
  let memberId = "";
  let organizationId = "";
  try {
    const admin = await requirePlatformAdmin();
    if (!isTrustedMutation(request)) throw new RequestError("Origem da solicitação inválida.", 403);
    await assertRateLimit(request, "admin_member_create", admin.id, 20, 60);
    const { id } = await context.params;
    organizationId = id;
    await company(id);
    const body = await request.json() as Record<string, unknown>;
    const account = accountInput(body);
    const role = String(body.role ?? "member");
    if (!["admin", "member", "technician"].includes(role)) throw new RequestError("Escolha administrador, funcionário ou técnico.", 400);
    if (body.permissions !== undefined && (!Array.isArray(body.permissions) || body.permissions.some(value => !featurePermissionIds.includes(value as typeof featurePermissionIds[number])))) throw new RequestError("Escolha módulos válidos.", 400);
    const permissions = body.permissions === undefined ? defaultFeaturePermissions() : normalizePermissions(body.permissions);
    if (await selectOne("organization_members", { user_email: account.email })) throw new RequestError("Este e-mail já está cadastrado. Use um novo e-mail para criar esta conta.", 409);
    const user = await createAccount(account);
    createdUserId = user.id;
    const now = new Date().toISOString();
    memberId = crypto.randomUUID();
    await insertRow("organization_members", { id: memberId, organization_id: id, user_id: user.id, user_email: user.email, display_name: user.displayName, role, status: "active", permissions, created_at: now, updated_at: now });
    const stored = await selectOne<Record<string, unknown>>("organization_members", { id: memberId, organization_id: id, user_id: user.id, status: "active" });
    if (!stored) throw new RequestError("O banco não confirmou o usuário na empresa.", 502);
    await logAudit({ organizationId: id, actorUserId: admin.id, eventType: "security", entityType: "organization_members", recordId: memberId, metadata: { action: "admin_member_create", role, permissions, accountUserId: user.id } }).catch(() => console.warn("admin_member_audit_unavailable"));
    return Response.json({ created: true, verified: true, member: publicMember(stored), account: user }, { status: 201 });
  } catch (error) {
    if (memberId && organizationId) await deleteRows("organization_members", { id: memberId, organization_id: organizationId }).catch(() => console.warn("admin_member_cleanup_failed"));
    if (createdUserId) {
      const safeToRemove = !memberId || await selectOne("organization_members", { user_id: createdUserId }).then(row => !row).catch(() => false);
      if (safeToRemove) await removeCreatedAccount(createdUserId).catch(() => console.warn("admin_member_account_cleanup_failed"));
    }
    return tenantError(error, "Não foi possível cadastrar o usuário.");
  }
}
