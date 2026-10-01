import { getPlatformBillingConfig, savePlatformBillingConfig } from "@/lib/billing";
import { AsaasError } from "@/lib/asaas";
import { requiredText } from "@/lib/database";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const config = await getPlatformBillingConfig();
    return Response.json({
      configured: Boolean(config?.apiKey),
      environment: config?.environment ?? "production",
      updatedAt: config?.updatedAt ?? "",
    });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar a configuração da Asaas.");
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = await request.json() as Record<string, unknown>;
    const apiKey = requiredText(body.apiKey, "Chave Asaas");
    const config = await savePlatformBillingConfig({ apiKey, environment: body.environment });
    return Response.json({ configured: true, ...config });
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    return tenantError(error, "Não foi possível validar e salvar a chave Asaas.");
  }
}
