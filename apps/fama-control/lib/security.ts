import { callRpc, insertRow, usesSupabase } from "@/lib/supabase";
import { RequestError } from "@/lib/tenant";

export const TERMS_VERSION = "2026-09-09";
export const PRIVACY_VERSION = "2026-09-09";

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function assertRateLimit(request: Request, action: string, identity = "anonymous", limit = 20, windowSeconds = 60) {
  if (!usesSupabase()) return;
  const keyHash = await sha256(`${requestIp(request)}|${identity.toLowerCase()}|${action}`);
  const allowed = await callRpc<boolean>("fama_consume_rate_limit", { p_key_hash: keyHash, p_action: action, p_limit: limit, p_window_seconds: windowSeconds });
  if (!allowed) throw new RequestError("Muitas tentativas. Aguarde um pouco e tente novamente.", 429);
}

export async function logAudit(input: { organizationId?: string | null; actorUserId?: string | null; eventType: "security" | "login" | "logout" | "export" | "restore"; entityType: string; recordId?: string; metadata?: Record<string, unknown> }) {
  if (!usesSupabase()) return;
  await insertRow("audit_logs", { organization_id: input.organizationId ?? null, actor_user_id: input.actorUserId ?? null, event_type: input.eventType, entity_type: input.entityType, record_id: input.recordId ?? "", metadata: input.metadata ?? {}, occurred_at: new Date().toISOString() });
}
