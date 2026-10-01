import { isPoolQuoteConfig, poolQuoteConfigError } from "@/lib/pool-quote-catalog";
import { readQuoteConfig, writeQuoteConfig } from "@/lib/quote-config";
import { requireTenant, tenantError } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    return Response.json({ config: await readQuoteConfig(organization.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar o catálogo de piscinas.");
  }
}

export async function POST(request: Request) {
  try {
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const body = await request.json() as { config?: unknown };
    if (!isPoolQuoteConfig(body.config)) {
      return Response.json({ error: poolQuoteConfigError(body.config) }, { status: 400 });
    }
    await writeQuoteConfig(organization.id, body.config);
    return Response.json({ config: body.config });
  } catch (error) {
    return tenantError(error, "Não foi possível salvar o catálogo da empresa.");
  }
}
