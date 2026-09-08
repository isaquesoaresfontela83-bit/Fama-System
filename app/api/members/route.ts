import { database, optionalText, requiredText } from "@/lib/database";
import { requireTenant, tenantError } from "@/lib/tenant";

const roles = new Set(["admin", "member", "technician"]);

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const db = database();
    const result = await db.prepare(`SELECT id, user_email AS email, display_name AS displayName, role, status, created_at AS createdAt
      FROM organization_members WHERE organization_id = ? ORDER BY role ASC, user_email ASC`)
      .bind(organization.id)
      .all();
    return Response.json({ members: result.results });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os usuários.");
  }
}

export async function POST(request: Request) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const body = await request.json() as Record<string, unknown>;
    const email = requiredText(body.email, "E-mail").toLocaleLowerCase("pt-BR");
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    const requestedRole = optionalText(body.role);
    const role = roles.has(requestedRole) ? requestedRole : "member";
    if (organization.role !== "owner" && role === "admin") {
      return Response.json({ error: "Somente o proprietário pode adicionar administradores." }, { status: 403 });
    }

    const db = database();
    const record = {
      id: crypto.randomUUID(),
      email,
      displayName: optionalText(body.displayName),
      role,
      status: "invited",
      createdAt: new Date().toISOString(),
    };
    await db.prepare(`INSERT INTO organization_members (id, organization_id, user_id, user_email, display_name, role, status, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, ?, 'invited', ?, ?)`)
      .bind(record.id, organization.id, record.email, record.displayName, record.role, record.createdAt, record.createdAt)
      .run();
    return Response.json({ member: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível adicionar o usuário.";
    if (message.includes("UNIQUE")) return Response.json({ error: "Este e-mail já pertence à empresa." }, { status: 409 });
    if (message.includes("obrigatório")) return Response.json({ error: message }, { status: 400 });
    return tenantError(error, "Não foi possível adicionar o usuário.");
  }
}
