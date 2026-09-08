import { database, requiredText } from "@/lib/database";
import { getUserOrganizations, isPlatformAdmin, requireUser, tenantError } from "@/lib/tenant";

const tenantTables = [
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
] as const;

function slugPart(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "empresa";
}

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ organizations: await getUserOrganizations(user), isPlatformAdmin: isPlatformAdmin(user) });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar suas empresas.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json() as Record<string, unknown>;
    const name = requiredText(body.name, "Nome da empresa");
    if (name.length < 2 || name.length > 80) {
      return Response.json({ error: "O nome da empresa deve ter entre 2 e 80 caracteres." }, { status: 400 });
    }

    const db = database();
    const organizationId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = `${slugPart(name)}-${crypto.randomUUID().slice(0, 6)}`;
    const mayClaimLegacyRecords = isPlatformAdmin(user);

    const statements = [
      db.prepare(`INSERT INTO organizations (id, name, slug, status, created_by_user_id, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?)`).bind(organizationId, name, slug, user.id, now, now),
      db.prepare(`INSERT INTO organization_members (id, organization_id, user_id, user_email, display_name, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`).bind(memberId, organizationId, user.id, user.email.toLocaleLowerCase("pt-BR"), user.displayName, now, now),
    ];

    if (mayClaimLegacyRecords) {
      for (const table of tenantTables) {
        statements.push(db.prepare(`UPDATE ${table} SET organization_id = ? WHERE organization_id = ''`).bind(organizationId));
      }
    }

    await db.batch(statements);
    return Response.json({ organization: { id: organizationId, name, slug, role: "owner" } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a empresa.";
    if (message.includes("obrigatório")) return Response.json({ error: message }, { status: 400 });
    return tenantError(error, "Não foi possível criar a empresa.");
  }
}
