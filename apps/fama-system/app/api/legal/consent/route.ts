import { recordLegalConsent } from "@/lib/security";
import { requireUser, tenantError } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await recordLegalConsent(user, request, "existing_account");
    return Response.json({ accepted: true });
  } catch (error) {
    return tenantError(error, "Não foi possível registrar o aceite.");
  }
}
