import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const out = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...cors,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
  },
});

async function serviceFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", SERVICE);
  headers.set("Authorization", `Bearer ${SERVICE}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(URL + path, { ...init, headers });
}

async function serviceJson(path: string, init: RequestInit = {}) {
  const response = await serviceFetch(path, init);
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

async function first(path: string) {
  const data = await serviceJson(path);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function audit(uid: string, event: string, metadata: Record<string, unknown> = {}) {
  try {
    await serviceFetch("/rest/v1/audit_logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ actor_user_id: uid, event_type: "login", entity_type: "control_auth", record_id: uid, metadata: { stage: event, source: "control-auth-v7", ...metadata } }),
    });
  } catch {}
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!URL || !SERVICE) return out(500, { ok: false, authorized: false, success: false, error: "server_configuration_error", message: "Configuração do servidor indisponível." });

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return out(401, { ok: false, authorized: false, success: false, error: "missing_authorization", message: "Sessão não informada." });

  try {
    const userResponse = await fetch(`${URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: SERVICE } });
    if (!userResponse.ok) return out(401, { ok: false, authorized: false, success: false, error: "invalid_session", message: "Sessão inválida. Entre novamente." });

    const user = await userResponse.json();
    if (!user?.id || !user?.email) return out(401, { ok: false, authorized: false, success: false, error: "invalid_session", message: "Sessão inválida. Entre novamente." });

    const uid = String(user.id);
    const email = String(user.email).trim().toLowerCase();

    let admin = await first(`/rest/v1/fama_control_admins?select=user_id,email,enabled&user_id=eq.${encodeURIComponent(uid)}&enabled=eq.true&limit=1`);
    if (!admin) admin = await first(`/rest/v1/fama_control_admins?select=user_id,email,enabled&email=eq.${encodeURIComponent(email)}&enabled=eq.true&limit=1`);

    let member = await first(`/rest/v1/organization_members?select=id,organization_id,user_id,user_email,display_name,role,status,permissions&user_id=eq.${encodeURIComponent(uid)}&role=eq.owner&status=eq.active&limit=1`);
    if (!member) member = await first(`/rest/v1/organization_members?select=id,organization_id,user_id,user_email,display_name,role,status,permissions&user_email=eq.${encodeURIComponent(email)}&role=eq.owner&status=eq.active&limit=1`);

    const adminOk = !!admin && admin.enabled !== false && String(admin.email ?? email).toLowerCase() === email;
    const ownerOk = !!member && member.role === "owner" && member.status === "active" && (String(member.user_id ?? "") === uid || String(member.user_email ?? "").toLowerCase() === email);

    if (!adminOk && !ownerOk) {
      await audit(uid, "authorization_denied");
      return out(403, { ok: false, authorized: false, success: false, error: "owner_not_authorized", message: "Esta conta não está autorizada para o Fama Control." });
    }

    const payload = { ok: true, authorized: true, success: true, user: { id: uid, email: user.email }, member: member ?? null, platform_admin: adminOk, role: member?.role ?? "owner", status: "active" };
    await audit(uid, "authorization_ok", { platform_admin: adminOk, owner: ownerOk });
    return out(200, { ...payload, data: payload });
  } catch (error) {
    console.error("control-auth", error);
    return out(503, { ok: false, authorized: false, success: false, error: "authorization_service_unavailable", message: "Não foi possível validar a autorização agora." });
  }
});