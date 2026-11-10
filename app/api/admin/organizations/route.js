import { database } from "@/lib/database";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const db = database();
    const result = await db.prepare(`SELECT o.id, o.name, o.slug, o.status, o.created_at AS createdAt,
        COUNT(m.id) AS memberCount
      FROM organizations o
      LEFT JOIN organization_members m ON m.organization_id = o.id
      GROUP BY o.id, o.name, o.slug, o.status, o.created_at
      ORDER BY o.created_at DESC`).all();
    return Response.json({ organizations: result.results });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar as empresas da plataforma.");
  }
}
