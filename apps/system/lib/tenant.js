import { isPlanAccessBlocked } from "@/lib/billing-access";
export { isPlanAccessBlocked } from "@/lib/billing-access";
import { env } from "cloudflare:workers";
import { RequestError } from "@/lib/request-error";
export { RequestError } from "@/lib/request-error";
import { isTrustedMutation } from "@/lib/request-security";
import { getFamaUser } from "@/app/system-auth";
import { database } from "@/lib/database";
import { effectiveFeaturePermissions } from "@/lib/permissions";
import { memberBlockAccess } from "@/lib/fama-blocks-server";
import { readActivePlanFeatures } from "@/lib/plan-policy-server";
import { planBlockAccess } from "@/lib/fama-blocks";
import { selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
function allowsExpiredPlanAccess(request) {
    const path = new URL(request.url).pathname;
    return path.startsWith("/api/billing")
        || path.startsWith("/api/access")
        || path.startsWith("/api/support")
        || path.startsWith("/api/privacy")
        || path.startsWith("/api/legal/consent")
        || path.startsWith("/api/auth/logout");
}
function platformOwnerEmail() {
    const runtime = env;
    return String(runtime.PLATFORM_OWNER_EMAIL ?? "").trim().toLocaleLowerCase("pt-BR");
}
function platformOwnerUserId() {
    const runtime = env;
    return String(runtime.PLATFORM_OWNER_USER_ID ?? "").trim();
}
export function isPlatformAdmin(user) {
    const ownerEmail = platformOwnerEmail();
    const ownerId = platformOwnerUserId();
    return (Boolean(ownerEmail) && user.email.toLocaleLowerCase("pt-BR") === ownerEmail)
        || (Boolean(ownerId) && user.id === ownerId);
}
async function claimPendingMemberships(user) {
    if (usesSupabase()) {
        const pending = await selectRows("organization_members", {
            user_email: user.email.toLocaleLowerCase("pt-BR"),
            status: "invited",
        });
        const now = new Date().toISOString();
        await Promise.all(pending
            .filter((member) => !member.user_id || member.user_id === user.id)
            .map((member) => updateRows("organization_members", {
            user_id: user.id,
            display_name: user.displayName,
            status: "active",
            updated_at: now,
        }, { id: String(member.id) })));
        return;
    }
    const db = database();
    const now = new Date().toISOString();
    await db.prepare(`UPDATE organization_members
    SET user_id = ?, display_name = ?, status = 'active', updated_at = ?
    WHERE user_email = ? AND status = 'invited' AND (user_id = '' OR user_id = ?)`)
        .bind(user.id, user.displayName, now, user.email.toLocaleLowerCase("pt-BR"), user.id)
        .run();
}
export async function getUserOrganizations(user) {
    await claimPendingMemberships(user);
    if (usesSupabase()) {
        const members = await selectRows("organization_members", {
            user_email: user.email.toLocaleLowerCase("pt-BR"),
            status: "active",
        }, { order: "role.asc" });
        const organizations = await Promise.all(members.map(async (member) => {
            if (member.user_id && String(member.user_id) !== user.id)
                return null;
            const organization = await selectOne("organizations", {
                id: String(member.organization_id),
                status: "active",
            });
            if (!organization)
                return null;
            return {
                id: String(organization.id),
                name: String(organization.name),
                slug: String(organization.slug),
                role: String(member.role),
                permissions: effectiveFeaturePermissions(member.permissions),
                moduleAccess: await memberBlockAccess(member, organization.plan ?? "inicial"),
                plan: String(organization.plan ?? "inicial"),
                planFeatures: await readActivePlanFeatures(organization.plan ?? "inicial"),
                planStatus: String(organization.plan_status ?? "trial"),
                planExpiresAt: String(organization.plan_expires_at ?? ""),
                billingEnabled: organization.billing_enabled !== false,
                blockOnExpiry: organization.block_on_expiry !== false,
            };
        }));
        return organizations.filter((organization) => organization !== null)
            .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    }
    const db = database();
    const result = await db.prepare(`SELECT o.id, o.name, o.slug, m.role, m.permissions,
      o.plan, o.plan_status AS planStatus, o.plan_expires_at AS planExpiresAt,
      o.billing_enabled AS billingEnabled, o.block_on_expiry AS blockOnExpiry,
      o.status AS organizationStatus, m.status AS memberStatus
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE (m.user_id = ? OR (m.user_email = ? AND m.user_id = ''))
      AND m.status = 'active' AND o.status = 'active'
    ORDER BY o.name ASC`)
        .bind(user.id, user.email.toLocaleLowerCase("pt-BR"))
        .all();
    return result.results.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        role: row.role,
        permissions: effectiveFeaturePermissions(row.permissions),
        moduleAccess: planBlockAccess(row.role, row.permissions, row.plan ?? "inicial"),
        plan: row.plan || "inicial",
        planStatus: row.planStatus || "trial",
        planExpiresAt: row.planExpiresAt || "",
        billingEnabled: Boolean(row.billingEnabled),
        blockOnExpiry: Boolean(row.blockOnExpiry),
    }));
}
export async function requireUser() {
    const user = await getFamaUser();
    if (!user)
        throw new RequestError("Entre na sua conta para continuar.", 401);
    if (user.mfaRequired && user.aal !== "aal2")
        throw new RequestError("Confirme o código de verificação em duas etapas para continuar.", 403);
    return user;
}
export async function requireTenant(request, roles) {
    if (!isTrustedMutation(request))
        throw new RequestError("Origem da solicitação inválida.", 403);
    const user = await requireUser();
    const organizationId = String(request.headers.get("x-organization-id") ?? new URL(request.url).searchParams.get("organization_id") ?? "").trim();
    if (!organizationId)
        throw new RequestError("Selecione uma empresa para continuar.", 400);
    await claimPendingMemberships(user);
    if (usesSupabase()) {
        const member = await selectOne("organization_members", {
            organization_id: organizationId,
            user_email: user.email.toLocaleLowerCase("pt-BR"),
        });
        const organization = member
            ? await selectOne("organizations", { id: organizationId })
            : null;
        if (!member || member.status !== "active" || (member.user_id && String(member.user_id) !== user.id)) {
            throw new RequestError("Você não possui acesso a esta empresa.", 403);
        }
        if (!organization || organization.status !== "active") {
            throw new RequestError("Esta empresa está temporariamente suspensa.", 403);
        }
        const role = String(member.role);
        if (roles && !roles.includes(role)) {
            throw new RequestError("Seu perfil não permite esta operação.", 403);
        }
        const result = {
            user,
            organization: {
                id: String(organization.id),
                name: String(organization.name),
                slug: String(organization.slug),
                role,
                permissions: effectiveFeaturePermissions(member.permissions),
                moduleAccess: await memberBlockAccess(member, organization.plan ?? "inicial"),
                plan: String(organization.plan ?? "inicial"),
                planFeatures: await readActivePlanFeatures(organization.plan ?? "inicial"),
                planStatus: String(organization.plan_status ?? "trial"),
                planExpiresAt: String(organization.plan_expires_at ?? ""),
                billingEnabled: organization.billing_enabled !== false,
                blockOnExpiry: organization.block_on_expiry !== false,
            },
        };
        if (isPlanAccessBlocked(result.organization.planStatus, result.organization.planExpiresAt, result.organization.billingEnabled, result.organization.blockOnExpiry) && !allowsExpiredPlanAccess(request)) {
            throw new RequestError("O acesso desta empresa aguarda a regularização do plano. Consulte Meu plano ou o suporte.", 402);
        }
        return result;
    }
    const db = database();
    const membership = await db.prepare(`SELECT o.id, o.name, o.slug, m.role, m.permissions,
      o.plan, o.plan_status AS planStatus, o.plan_expires_at AS planExpiresAt,
      o.billing_enabled AS billingEnabled, o.block_on_expiry AS blockOnExpiry,
      o.status AS organizationStatus, m.status AS memberStatus
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE o.id = ? AND (m.user_id = ? OR (m.user_email = ? AND m.user_id = ''))
    LIMIT 1`)
        .bind(organizationId, user.id, user.email.toLocaleLowerCase("pt-BR"))
        .first();
    if (!membership || membership.memberStatus !== "active") {
        throw new RequestError("Você não possui acesso a esta empresa.", 403);
    }
    if (membership.organizationStatus !== "active") {
        throw new RequestError("Esta empresa está temporariamente suspensa.", 403);
    }
    if (roles && !roles.includes(membership.role)) {
        throw new RequestError("Seu perfil não permite esta operação.", 403);
    }
    const result = {
        user,
        organization: {
            id: membership.id,
            name: membership.name,
            slug: membership.slug,
            role: membership.role,
            permissions: effectiveFeaturePermissions(membership.permissions),
            moduleAccess: planBlockAccess(membership.role, membership.permissions, membership.plan ?? "inicial"),
            plan: String(membership.plan ?? "inicial"),
            planStatus: String(membership.planStatus ?? "trial"),
            planExpiresAt: String(membership.planExpiresAt ?? ""),
            billingEnabled: Boolean(membership.billingEnabled),
            blockOnExpiry: Boolean(membership.blockOnExpiry),
        },
    };
    if (isPlanAccessBlocked(result.organization.planStatus, result.organization.planExpiresAt, result.organization.billingEnabled, result.organization.blockOnExpiry) && !allowsExpiredPlanAccess(request)) {
        throw new RequestError("O acesso desta empresa aguarda a regularização do plano. Consulte Meu plano ou o suporte.", 402);
    }
    return result;
}
export async function requirePlatformAdmin() {
    const user = await requireUser();
    if (!isPlatformAdmin(user))
        throw new RequestError("Acesso restrito à administração da plataforma.", 403);
    return user;
}
export function tenantError(error, fallback) {
    if (error instanceof RequestError) {
        return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("tenant_request_failed", error);
    return Response.json({ error: fallback }, { status: 503 });
}
