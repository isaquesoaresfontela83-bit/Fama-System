import { env } from "cloudflare:workers";

import { ChatGPTUser, getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/lib/database";

export type OrganizationRole = "owner" | "admin" | "member" | "technician";

export type OrganizationMembership = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

type MembershipRow = OrganizationMembership & {
  organizationStatus: string;
  memberStatus: string;
};

export class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function platformOwnerEmail() {
  const runtime = env as unknown as { PLATFORM_OWNER_EMAIL?: string };
  return String(runtime.PLATFORM_OWNER_EMAIL ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function isPlatformAdmin(user: ChatGPTUser) {
  const ownerEmail = platformOwnerEmail();
  return Boolean(ownerEmail) && user.email.toLocaleLowerCase("pt-BR") === ownerEmail;
}

async function claimPendingMemberships(user: ChatGPTUser) {
  const db = database();
  const now = new Date().toISOString();
  await db.prepare(`UPDATE organization_members
    SET user_id = ?, display_name = ?, status = 'active', updated_at = ?
    WHERE user_email = ? AND status = 'invited' AND (user_id = '' OR user_id = ?)`)
    .bind(user.id, user.displayName, now, user.email.toLocaleLowerCase("pt-BR"), user.id)
    .run();
}

export async function getUserOrganizations(user: ChatGPTUser): Promise<OrganizationMembership[]> {
  await claimPendingMemberships(user);
  const db = database();
  const result = await db.prepare(`SELECT o.id, o.name, o.slug, m.role,
      o.status AS organizationStatus, m.status AS memberStatus
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE (m.user_id = ? OR m.user_email = ?)
      AND m.status = 'active' AND o.status = 'active'
    ORDER BY o.name ASC`)
    .bind(user.id, user.email.toLocaleLowerCase("pt-BR"))
    .all<MembershipRow>();
  return result.results.map((row) => ({ id: row.id, name: row.name, slug: row.slug, role: row.role }));
}

export async function requireUser() {
  const user = await getChatGPTUser();
  if (!user) throw new RequestError("Entre na sua conta para continuar.", 401);
  return user;
}

export async function requireTenant(request: Request, roles?: OrganizationRole[]) {
  const user = await requireUser();
  const organizationId = String(request.headers.get("x-organization-id") ?? "").trim();
  if (!organizationId) throw new RequestError("Selecione uma empresa para continuar.", 400);
  await claimPendingMemberships(user);

  const db = database();
  const membership = await db.prepare(`SELECT o.id, o.name, o.slug, m.role,
      o.status AS organizationStatus, m.status AS memberStatus
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE o.id = ? AND (m.user_id = ? OR m.user_email = ?)
    LIMIT 1`)
    .bind(organizationId, user.id, user.email.toLocaleLowerCase("pt-BR"))
    .first<MembershipRow>();

  if (!membership || membership.memberStatus !== "active") {
    throw new RequestError("Você não possui acesso a esta empresa.", 403);
  }
  if (membership.organizationStatus !== "active") {
    throw new RequestError("Esta empresa está temporariamente suspensa.", 403);
  }
  if (roles && !roles.includes(membership.role)) {
    throw new RequestError("Seu perfil não permite esta operação.", 403);
  }

  return {
    user,
    organization: {
      id: membership.id,
      name: membership.name,
      slug: membership.slug,
      role: membership.role,
    } satisfies OrganizationMembership,
  };
}

export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!isPlatformAdmin(user)) throw new RequestError("Acesso restrito à administração da plataforma.", 403);
  return user;
}

export function tenantError(error: unknown, fallback: string) {
  if (error instanceof RequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("tenant_request_failed", error);
  return Response.json({ error: fallback }, { status: 503 });
}
