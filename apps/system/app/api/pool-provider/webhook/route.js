import { env } from "cloudflare:workers";
import { forwardPoolWebhook } from "@/lib/pool-provider-webhook";
export const dynamic = "force-dynamic";
export function POST(request) { return forwardPoolWebhook(request, { webhookToken: String(env.FAMA_POOL_WEBHOOK_TOKEN ?? ""), siteServiceToken: String(env.FAMA_POOL_SITE_SERVICE_TOKEN ?? "") }); }
