import { selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { defaultPoolQuoteConfig, isPoolQuoteConfig } from "@/lib/pool-quote-catalog";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformAdmin();
    if (!usesSupabase()) return Response.json({ config: defaultPoolQuoteConfig });
    const row = await selectOne<{ config: unknown }>("fama_quote_config", { id: "pool-catalog" }, { select: "config" });
    return Response.json({ config: isPoolQuoteConfig(row?.config) ? row.config : defaultPoolQuoteConfig });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar a configuração de orçamentos.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    const { config } = await request.json() as { config?: unknown };
    if (!config || typeof config !== "object" || Array.isArray(config) || JSON.stringify(config).length > 150000) {
      return Response.json({ error: "Configuração inválida ou muito grande." }, { status: 400 });
    }
    if (!isPoolQuoteConfig(config)) {
      return Response.json({ error: "Revise título, categorias, serviços, campos e valores do catálogo." }, { status: 400 });
    }
    if (!usesSupabase()) return Response.json({ error: "O catálogo compartilhado requer o backend Supabase." }, { status: 503 });
    const updated = await updateRows("fama_quote_config", { config, updated_at: new Date().toISOString() }, { id: "pool-catalog" });
    if (!updated.length) throw new Error("Registro de configuração não encontrado.");
    return Response.json({ config, saved: true });
  } catch (error) {
    return tenantError(error, "Não foi possível salvar a configuração de orçamentos.");
  }
}
