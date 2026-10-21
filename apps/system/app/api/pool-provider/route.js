import { env } from "cloudflare:workers";
import { asaasRequest, AsaasError, parseAsaasEnvironment, validateAsaasKey, sha256 } from "@/lib/asaas";
export const dynamic = "force-dynamic";
export async function POST(request) {
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    try {
        const secret = typeof env.FAMA_POOL_BRIDGE_SECRET === "string" ? env.FAMA_POOL_BRIDGE_SECRET : "", given = request.headers.get("x-pool-authorization") ?? "";
        if (!secret || given.length > 300 || await sha256(secret) !== await sha256(given))
            return Response.json({ error: "Acesso não autorizado." }, { status: 401, headers });
        const raw = await request.text();
        if (raw.length > 32000)
            return Response.json({ error: "Requisição excede o limite." }, { status: 413, headers });
        const input = JSON.parse(raw);
        const allowedGet = /^\/(myAccount\/status|finance\/balance|accounts\?limit=100(?:&offset=\d{1,5})?|customers\?externalReference=pool%3A[a-zA-Z0-9%:_-]+|payments\?externalReference=pool%3A[a-zA-Z0-9%:_-]+|payments\/pay_[a-zA-Z0-9_]+(?:\/(pixQrCode|refunds))?|transfers\?limit=100|transfers\/[a-zA-Z0-9_-]+|webhooks\?limit=100)$/;
        const allowedPost = /^\/(customers|payments|transfers|payments\/pay_[a-zA-Z0-9_]+\/refund|webhooks)$/;
        if (!((input.method === "GET" && allowedGet.test(input.path)) || (input.method === "POST" && allowedPost.test(input.path)) || (input.method === "PUT" && /^\/webhooks\/[a-zA-Z0-9_-]+$/.test(input.path)) || (input.method === "DELETE" && /^\/payments\/pay_[a-zA-Z0-9_]+$/.test(input.path))))
            return Response.json({ error: "Operação indisponível para esta integração." }, { status: 403, headers });
        if (input.method === "POST" && ["/customers", "/payments", "/transfers"].includes(input.path) && !String(input.body?.externalReference ?? "").startsWith("pool:"))
            return Response.json({ error: "Referência da operação inválida." }, { status: 422, headers });
        const webhookTarget = "https://famasystem.online/api/pool-provider/webhook", legacyTarget = "https://fama-pool-servicos.isaquesoaresfontela8.chatgpt.site/api/asaas/webhook";
        if (["POST", "PUT"].includes(input.method) && input.path.startsWith("/webhooks") && input.body?.url !== webhookTarget)
            return Response.json({ error: "Destino não autorizado." }, { status: 403, headers });
        const key = String(env.FAMA_ASAAS_API_KEY ?? ""), environment = parseAsaasEnvironment(env.FAMA_ASAAS_ENVIRONMENT);
        validateAsaasKey(key, environment);
        if (environment !== "production")
            return Response.json({ error: "A conexão Fama Pool exige o ambiente de produção.", uncertain: false }, { status: 422, headers });
        if (input.method === "PUT") {
            const current = await asaasRequest(key, environment, input.path, { method: "GET" });
            if (current.url !== webhookTarget && current.url !== legacyTarget)
                return Response.json({ error: "Esta configuração pertence a outra integração." }, { status: 403, headers });
        }
        const data = await asaasRequest(key, environment, input.path, { method: input.method, ...(input.body ? { body: JSON.stringify(input.body) } : {}) });
        return Response.json({ data, environment }, { headers });
    }
    catch (error) {
        return Response.json({ error: error instanceof AsaasError ? error.message : "Não foi possível concluir a operação financeira.", uncertain: !(error instanceof AsaasError) && !(error instanceof SyntaxError) }, { status: error instanceof AsaasError ? error.status : error instanceof SyntaxError ? 400 : 503, headers });
    }
}
