import type { FamaUser } from "@/app/system-auth";
import { encryptText } from "@/lib/crypto";
import { callRpc, insertRow, selectOne, usesSupabase } from "@/lib/supabase";
import { RequestError } from "@/lib/tenant";

export const TERMS_VERSION = "2026-09-24";
export const PRIVACY_VERSION = "2026-09-24";

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export async function assertRateLimit(
  request: Request,
  action: string,
  identity = "anonymous",
  limit = 20,
  windowSeconds = 60,
) {
  if (!usesSupabase()) return;
  const keyHash = await sha256(`${requestIp(request)}|${identity.toLowerCase()}|${action}`);
  const allowed = await callRpc<boolean>("fama_consume_rate_limit", {
    p_key_hash: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (!allowed) throw new RequestError("Muitas tentativas. Aguarde um pouco e tente novamente.", 429);
}

export async function hasCurrentLegalConsent(user: FamaUser) {
  if (!usesSupabase()) return true;
  const consent = await selectOne<Record<string, unknown>>("legal_consents", {
    user_id: user.id,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    revoked_at: null,
  });
  return Boolean(consent);
}

export async function recordLegalConsent(user: Pick<FamaUser, "id" | "email">, request: Request, source: string) {
  if (!usesSupabase()) return;
  const emailHash = await sha256(user.email.trim().toLowerCase());
  await insertRow("legal_consents", {
    id: crypto.randomUUID(),
    user_id: user.id,
    email_hash: emailHash,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    source,
    ip_hash: await sha256(requestIp(request)),
    user_agent_hash: await sha256(request.headers.get("user-agent") ?? "unknown"),
    accepted_at: new Date().toISOString(),
  });
}

export async function logAudit(input: {
  organizationId?: string | null;
  actorUserId?: string | null;
  eventType: "security" | "login" | "logout" | "export" | "restore";
  entityType: string;
  recordId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!usesSupabase()) return;
  await insertRow("audit_logs", {
    organization_id: input.organizationId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    record_id: input.recordId ?? "",
    metadata: input.metadata ?? {},
    occurred_at: new Date().toISOString(),
  });
}

export async function archiveForRecovery(input: {
  organizationId: string;
  entityType: string;
  recordId: string;
  record: Record<string, unknown>;
  deletedByUserId: string;
}) {
  if (!usesSupabase()) return;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await insertRow("recovery_snapshots", {
    id: crypto.randomUUID(),
    organization_id: input.organizationId,
    entity_type: input.entityType,
    record_id: input.recordId,
    encrypted_payload: await encryptText(JSON.stringify(input.record)),
    deleted_by_user_id: input.deletedByUserId,
    deleted_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
}
