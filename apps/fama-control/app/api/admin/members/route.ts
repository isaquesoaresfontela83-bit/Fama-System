import { database } from "@/lib/database";
import { camelizeRow, selectRows, usesSupabase } from "@/lib/supabase";
import { effectiveFeaturePermissions } from "@/lib/permissions";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformAdmin();
    if (usesSupabase()) {
      const [members, organizations] = await Promise.all([
        selectRows<Record<string, unknown>>("organization_members", {}, { order: "user_email.asc" }),
        selectRows<Record<string, unknown>>("organizations", {}, { select: "id,name" }),
      ]);
      const names = new Map(organizations.map((organization) => [String(organization.id), String(organization.name)]));
      return Response.json({ members: members.map((row) => {
        const member = camelizeRow<Record<string, unknown>>(row);
        return {
          id: String(member.id),
          organizationId: String(member.organizationId),
          organizationName: names.get(String(member.organizationId)) ?? "Empresa",
          email: String(member.userEmail ?? ""),
          displayName: String(member.displayName ?? ""),
          role: String(member.role ?? "member"),
          status: String(member.status ?? "invited"),
          permissions: effectiveFeaturePermissions(member.permissions),
        };
      }) });
    }
    const result = await database().prepare(`SELECT m.id, m.organization_id AS organizationId, o.name AS organizationName,
      m.user_email AS email, m.display_name AS displayName, m.role, m.status, m.permissions
      FROM organization_members m JOIN organizations o ON o.id = m.organization_id
      ORDER BY m.user_email ASC`).all<Record<string, unknown>>();
    return Response.json({ members: result.results.map((member: Record<string, unknown>) => ({ ...member, permissions: effectiveFeaturePermissions(member.permissions) })) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os acessos da plataforma.");
  }
}
