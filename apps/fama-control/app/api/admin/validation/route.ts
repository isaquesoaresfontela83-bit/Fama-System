import { executeValidation, readValidation, type ValidationStage } from "@/lib/access-validation";
import { isTrustedMutation } from "@/lib/request-security";
import { assertRateLimit } from "@/lib/security";
import { usesSupabase } from "@/lib/supabase";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin();
    return Response.json({ run: await readValidation(admin.id, new URL(request.url).searchParams.get("run_id") || undefined) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return tenantError(error, "Não foi possível carregar a validação."); }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin();
    if (!isTrustedMutation(request)) throw new RequestError("Origem da solicitação inválida.", 403);
    if (!usesSupabase()) throw new RequestError("Configure o serviço de contas para validar o acesso.", 503);
    const body = await request.json() as { stage?: string; runId?: string };
    if (typeof body.stage !== "string" || !["start", "members", "access", "cleanup"].includes(body.stage)) throw new RequestError("Etapa inválida.", 400);
    await assertRateLimit(request, "admin_access_validation", admin.id, 12, 60);
    if (body.stage === "start") await assertRateLimit(request, "admin_access_validation_start", admin.id, 1, 60);
    const run = await executeValidation(request, admin.id, body.stage as ValidationStage, body.runId);
    return Response.json({ run }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return tenantError(error, "Não foi possível executar a validação."); }
}
