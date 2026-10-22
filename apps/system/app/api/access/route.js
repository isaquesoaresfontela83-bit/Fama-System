import { requireTenant, tenantError } from "@/lib/tenant";
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request);
        return Response.json({
            access: {
                organizationId: organization.id,
                role: organization.role,
                permissions: organization.permissions,
                moduleAccess: organization.moduleAccess,
                plan: organization.plan,
                planFeatures: organization.planFeatures,
                planStatus: organization.planStatus,
                planExpiresAt: organization.planExpiresAt,
                billingEnabled: organization.billingEnabled,
                blockOnExpiry: organization.blockOnExpiry,
            },
        }, {
            headers: { "Cache-Control": "private, no-store, max-age=0" },
        });
    }
    catch (error) {
        return tenantError(error, "Não foi possível conferir seu acesso.");
    }
}
