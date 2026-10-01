import { database, optionalText, requiredText } from "@/lib/database";
import { camelizeRow, insertRow, selectRows, SupabaseRequestError, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { defaultFeaturePermissions, effectiveFeaturePermissions } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { getPlanSnapshot, isPlanCode } from "@/lib/plans";

const roles = new Set(["admin", "member", "technician"]);

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    if (usesSupabase()) {
      const rows = await selectRows<Record<string, unknown>>("organization_members", { organization_id: organization.id }, { order: "role.asc,user_email.asc" });
      return Response.json({ members: rows.map((row) => {
        const member = camelizeRow<Record<string, unknown>>(row);
        return { ...member, email: member.userEmail, displayName: member.displayName, permissions: effectiveFeaturePermissions(member.permissions), userEmail: undefined };
      }) });
    }
    const db = database();
    const result = await db.prepare(`SELECT id, user_email AS email, display_name AS displayName, role, permissions, status, created_at AS createdAt
      FROM organization_members WHERE organization_id = ? ORDER BY role ASC, user_email ASC`)
      .bind(organization.id)
      .all();
    return Response.json({ members: result.results.map((member: Record<string, unknown>) => ({
      ...member,
      permissions: effectiveFeaturePermissions(member.permissions),
    })) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os usuários.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    await assertRateLimit(request, "member_invite", user.id, 20, 60 * 60);
    const body = await request.json() as Record<string, unknown>;
    const email = requiredText(body.email, "E-mail").toLocaleLowerCase("pt-BR");
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    const requestedRole = optionalText(body.role);
    const role = roles.has(requestedRole) ? requestedRole : "member";
    if (organization.role !== "owner" && role === "admin") {
      return Response.json({ error: "Somente o proprietário pode adicionar administradores." }, { status: 403 });
    }

    const db = database();
    const plan = await getPlanSnapshot(isPlanCode(organization.plan) ? organization.plan : "inicial");
    const count = usesSupabase()
      ? (await selectRows<Record<string, unknown>>("organization_members", { organization_id: organization.id }, { select: "id,status" })).filter(member => ["active", "invited"].includes(String(member.status))).length
      : (await db.prepare("SELECT COUNT(*) AS count FROM organization_members WHERE organization_id = ? AND status IN ('active', 'invited')").bind(organization.id).first<{ count: number }>())?.count ?? 0;
    if (count >= plan.limits.users) return Response.json({ error: `O plano ${plan.name} permite até ${plan.limits.users} usuários. Atualize o plano para adicionar mais.` }, { status: 409 });
    const record = {
      id: crypto.randomUUID(),
      email,
      displayName: optionalText(body.displayName),
      role,
      permissions: defaultFeaturePermissions(),
      status: "invited",
      createdAt: new Date().toISOString(),
    };
    if (usesSupabase()) {
      await insertRow("organization_members", {
        id: record.id,
        organization_id: organization.id,
        user_id: "",
        user_email: record.email,
        display_name: record.displayName,
        role: record.role,
        permissions: record.permissions,
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.createdAt,
      });
      return Response.json({ member: record }, { status: 201 });
    }
    await db.prepare(`INSERT INTO organization_members (id, organization_id, user_id, user_email, display_name, role, permissions, status, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, ?, ?, 'invited', ?, ?)`)
      .bind(record.id, organization.id, record.email, record.displayName, record.role, JSON.stringify(record.permissions), record.createdAt, record.createdAt)
      .run();
    return Response.json({ member: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível adicionar o usuário.";
    if (message.includes("UNIQUE") || (error instanceof SupabaseRequestError && error.code === "23505")) return Response.json({ error: "Este e-mail já pertence à empresa." }, { status: 409 });
    if (message.includes("obrigatório")) return Response.json({ error: message }, { status: 400 });
    return tenantError(error, "Não foi possível adicionar o usuário.");
  }
}
