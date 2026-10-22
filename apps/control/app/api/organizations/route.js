import { getUserOrganizations, requireUser, tenantError } from "@/lib/tenant";
import { POST as createAdminCompany } from "@/app/api/admin/organizations/route";
export async function GET() {
    try {
        const user = await requireUser();
        return Response.json({ organizations: await getUserOrganizations(user), isPlatformAdmin: true });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar suas empresas.");
    }
}
// Keep the legacy URL on the same validated, atomic administrator flow.
export const POST = createAdminCompany;
