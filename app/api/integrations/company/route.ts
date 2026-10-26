import { econodataConfigured, EconodataLevel, lookupCompany } from "@/lib/econodata";
import { requireTenant, tenantError } from "@/lib/tenant";

const LEVELS = new Set<EconodataLevel>(["basic", "commercial", "contacts", "advanced"]);

function parseLevel(value: unknown): EconodataLevel {
  const level = String(value ?? "commercial") as EconodataLevel;
  return LEVELS.has(level) ? level : "commercial";
}

export async function GET(request: Request) {
  try {
    await requireTenant(request);
    return Response.json({
      provider: "econodata",
      configured: econodataConfigured(),
      fallback: "brasilapi",
      levels: ["basic", "commercial", "contacts", "advanced"],
    });
  } catch (error) {
    return tenantError(error, "Não foi possível verificar a integração empresarial.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { cnpj?: unknown; level?: unknown };
    const level = parseLevel(body.level);

    // Consultas enriquecidas consomem tokens da conta Econodata. Por padrão,
    // apenas owner/admin podem gerar custo. A consulta básica permanece disponível
    // aos demais membros e usa somente a BrasilAPI.
    if (level === "basic") {
      await requireTenant(request);
    } else {
      await requireTenant(request, ["owner", "admin"]);
    }

    const result = await lookupCompany(String(body.cnpj ?? ""), level);
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CNPJ inválido")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return tenantError(error, "Não foi possível consultar a empresa agora.");
  }
}
