import { requireTenant, tenantError } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const { organization, permissions } = await requireTenant(request);
    return Response.json({
      organization: {
        id: organization.id,
        name: organization.name,
        role: organization.role,
      },
      permissions,
    });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar suas permissões.");
  }
}
