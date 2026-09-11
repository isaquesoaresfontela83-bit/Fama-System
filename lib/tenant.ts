import { env } from "cloudflare:workers";

import { ChatGPTUser, getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/lib/database";
import { getValidFamaAccessToken } from "@/lib/fama-auth-tokens";

export type OrganizationRole = "owner" | "admin" | "member" | "technician";
export type ModulePermission = "dashboard" | "crm" | "quotes" | "agenda" | "orders" | "warranties" | "customers" | "contracts" | "inventory" | "finance" | "team";

export const ALL_MODULES: ModulePermission[] = [
  "dashboard",
  "crm",
  "quotes",
  "agenda",
  "orders",
  "warranties",
  "customers",
  "contracts",
  "inventory",
  "finance",
  "team",
];

export type OrganizationMembership = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

type MembershipRow = OrganizationMembership & {
  memberId: string;
  organizationStatus: string;
  memberStatus: string;
};

type ControlAccess = {
  role: OrganizationRole;
  permissions: ModulePermission[];
};

export class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const SUPABASE_URL = "https://mupnsdqahoybhmkpufmx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_";
const CONTROL_API = `${SUPABASE_URL}/functions/v1/fama-control`;

const entityModules: Record<string, ModulePermission> = {
  leads: "crm",
  quotes: "quotes",
  appointments: "agenda",
  workOrders: "orders",
  warranties: "warranties",
  customers: "customers",
  contracts: "contracts",
  inventory: "inventory",
  transactions: "finance",
  employees: "team",
};

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
  const result = await db.prepare(`SELECT o.id, o.name, o.slug, m.id AS memberId, m.role,
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

async function requestedModule(request: Request): Promise<ModulePermission | null> {
  const url = new URL(request.url);
  if (url.pathname.includes("/api/warranties/") && url.pathname.endsWith("/schedule")) return "warranties";
  if (!url.pathname.startsWith("/api/records")) return null;

  let entity = "";
  if (request.method === "DELETE") {
    entity = String(url.searchParams.get("entity") ?? "");
  } else {
    try {
      const body = await request.clone().json() as { entity?: unknown };
      entity = String(body.entity ?? "");
    } catch {}
  }
  return entityModules[entity] ?? null;
}

async function controlAccess(user: ChatGPTUser, organizationName: string): Promise<ControlAccess> {
  const accessToken = await getValidFamaAccessToken();
  if (!accessToken) {
    throw new RequestError("Sua sessão de acesso expirou. Saia e entre novamente para atualizar as permissões.", 401);
  }

  const response = await fetch(CONTROL_API, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "x-access-token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "system_access", organization_name: organizationName }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as any;
  const data = payload?.data ?? payload;
  if (!response.ok || !(payload?.ok || payload?.authorized || payload?.success) || !data?.member) {
    if (response.status === 401) throw new RequestError("Sua sessão de acesso expirou. Entre novamente.", 401);
    throw new RequestError(payload?.message ?? "Seu usuário não possui acesso ativo a esta empresa.", 403);
  }

  const role = String(data.member.role ?? "member") as OrganizationRole;
  const validRoles = new Set<OrganizationRole>(["owner", "admin", "member", "technician"]);
  const safeRole: OrganizationRole = validRoles.has(role) ? role : "member";
  const rawPermissions = Array.isArray(data.permissions) ? data.permissions.map(String) : [];
  const permissions = safeRole === "owner"
    ? [...ALL_MODULES]
    : ALL_MODULES.filter((module) => rawPermissions.includes(module));

  return { role: safeRole, permissions };
}

export async function requireTenant(request: Request, roles?: OrganizationRole[]) {
  const user = await requireUser();
  const organizationId = String(request.headers.get("x-organization-id") ?? "").trim();
  if (!organizationId) throw new RequestError("Selecione uma empresa para continuar.", 400);
  await claimPendingMemberships(user);

  const db = database();
  const membership = await db.prepare(`SELECT o.id, o.name, o.slug, m.id AS memberId, m.role,
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

  let effectiveRole = membership.role;
  let permissions: ModulePermission[] = [...ALL_MODULES];

  if (membership.role !== "owner") {
    const control = await controlAccess(user, membership.name);
    effectiveRole = control.role;
    permissions = control.permissions;
    if (effectiveRole !== membership.role) {
      await db.prepare(`UPDATE organization_members SET role = ?, updated_at = ? WHERE id = ?`)
        .bind(effectiveRole, new Date().toISOString(), membership.memberId)
        .run();
    }
  }

  if (roles && !roles.includes(effectiveRole)) {
    throw new RequestError("Seu perfil não permite esta operação.", 403);
  }

  const module = await requestedModule(request);
  if (module && !permissions.includes(module)) {
    throw new RequestError("Seu usuário não possui acesso a este módulo.", 403);
  }

  return {
    user,
    permissions,
    organization: {
      id: membership.id,
      name: membership.name,
      slug: membership.slug,
      role: effectiveRole,
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
