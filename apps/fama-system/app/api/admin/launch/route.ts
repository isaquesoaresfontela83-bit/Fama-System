import { env } from "cloudflare:workers";

import { AsaasError, sha256 } from "@/lib/asaas";
import { configureBillingWebhook, launchReadiness } from "@/lib/launch-readiness";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) { await requirePlatformAdmin(); return; }
  const runtime = env as unknown as { FAMA_LAUNCH_CHECK_TOKEN?: string; FAMA_LAUNCH_CHECK_EXPIRES_AT?: string };
  const expected = String(runtime.FAMA_LAUNCH_CHECK_TOKEN ?? "");
  const expires = Date.parse(String(runtime.FAMA_LAUNCH_CHECK_EXPIRES_AT ?? ""));
  const remaining = expires - Date.now();
  const actual = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!/^[0-9a-f]{64}$/.test(expected) || !Number.isFinite(remaining) || remaining <= 0 || remaining > 3600000 || actual.length !== 64) throw new RequestError("Verificação não autorizada.", 401);
  const [left, right] = await Promise.all([sha256(actual), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  if (difference) throw new RequestError("Verificação não autorizada.", 401);
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const text = await request.text();
    if (text.length > 1024) throw new RequestError("Requisição inválida.", 400);
    const body = JSON.parse(text) as { action?: string };
    if (body.action === "readiness") return Response.json(await launchReadiness(), { headers: { "Cache-Control": "no-store" } });
    if (body.action === "configureBillingWebhook") return Response.json({ webhook: await configureBillingWebhook() }, { headers: { "Cache-Control": "no-store" } });
    throw new RequestError("Ação inválida.", 400);
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Requisição inválida." }, { status: 400 });
    return tenantError(error, "Não foi possível concluir a verificação de lançamento.");
  }
}
