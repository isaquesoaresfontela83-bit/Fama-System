import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODULES = ["dashboard","crm","quotes","agenda","orders","warranties","customers","contracts","inventory","finance","team"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...cors,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
  },
});

async function sf(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", SERVICE);
  headers.set("Authorization", `Bearer ${SERVICE}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(URL + path, { ...init, headers });
}

async function sj(path: string, init: RequestInit = {}) {
  const response = await sf(path, init);
  let json: any = null;
  try { json = await response.json(); } catch {}
  if (!response.ok) throw new Error(json?.message || json?.msg || json?.error || `HTTP_${response.status}`);
  return json;
}

async function first(path: string) {
  const data = await sj(path).catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function audit(uid: string, stage: string, metadata: Record<string, unknown> = {}) {
  try {
    await sf("/rest/v1/audit_logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ actor_user_id: uid, event_type: "login", entity_type: "fama_control_bootstrap", record_id: uid, metadata: { stage, source: "fama-control-v10", ...metadata } }),
    });
  } catch {}
}

async function validate(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;

  const userResponse = await fetch(`${URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: SERVICE } });
  if (!userResponse.ok) return null;

  const user = await userResponse.json();
  if (!user?.id || !user?.email) return null;

  const uid = String(user.id);
  const email = String(user.email).trim().toLowerCase();

  let admin = await first(`/rest/v1/fama_control_admins?select=user_id,email,enabled&user_id=eq.${encodeURIComponent(uid)}&enabled=eq.true&limit=1`);
  if (!admin) admin = await first(`/rest/v1/fama_control_admins?select=user_id,email,enabled&email=eq.${encodeURIComponent(email)}&enabled=eq.true&limit=1`);

  let owner = await first(`/rest/v1/organization_members?select=id,organization_id,user_id,user_email,display_name,role,status,permissions&user_id=eq.${encodeURIComponent(uid)}&role=eq.owner&status=eq.active&limit=1`);
  if (!owner) owner = await first(`/rest/v1/organization_members?select=id,organization_id,user_id,user_email,display_name,role,status,permissions&user_email=eq.${encodeURIComponent(email)}&role=eq.owner&status=eq.active&limit=1`);

  const adminOk = !!admin && admin.enabled !== false && String(admin.email ?? email).toLowerCase() === email;
  const ownerOk = !!owner && owner.role === "owner" && owner.status === "active" && (String(owner.user_id ?? "") === uid || String(owner.user_email ?? "").toLowerCase() === email);
  if (!adminOk && !ownerOk) {
    await audit(uid, "authorization_denied");
    return null;
  }

  return { id: uid, email: user.email, adminOk, owner, ownerOk };
}

async function directBootstrap(req: Request) {
  const user = await validate(req);
  if (!user) return respond(401, { ok: false, authorized: false, success: false, error: "invalid_or_unauthorized_session", message: "Sessão inválida ou conta não autorizada para o Fama Control." });

  await audit(user.id, "authorized", { platform_admin: user.adminOk, owner: user.ownerOk });
  try {
    const [organizations, members] = await Promise.all([
      sj("/rest/v1/organizations?select=*&order=created_at.asc"),
      sj("/rest/v1/organization_members?select=*&order=created_at.asc"),
    ]);

    let health: any = {};
    let auth_users: any[] = [];
    try { health = await sj("/rest/v1/rpc/fama_control_health", { method: "POST", body: "{}" }) ?? {}; } catch {}
    try { auth_users = await sj("/rest/v1/rpc/fama_control_auth_directory", { method: "POST", body: "{}" }) ?? []; } catch {}

    const payload = {
      organizations: organizations ?? [],
      members: members ?? [],
      health,
      auth_users,
      modules: MODULES,
      authorized: true,
      success: true,
      user: { id: user.id, email: user.email },
      member: user.owner ?? null,
      platform_admin: user.adminOk,
    };

    await audit(user.id, "bootstrap_ok", { organizations: payload.organizations.length, members: payload.members.length });
    return respond(200, { ok: true, ...payload, data: payload });
  } catch (error) {
    await audit(user.id, "bootstrap_failed");
    console.error("fama-control bootstrap", error);
    return respond(503, { ok: false, authorized: true, success: false, message: "Não foi possível carregar os dados do Fama Control." });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!URL || !SERVICE) return respond(500, { ok: false, message: "Configuração do servidor indisponível." });

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("health") === "1") return respond(200, { ok: true, status: "online", service: "fama-control" });
    return respond(405, { ok: false, message: "Método não permitido." });
  }
  if (req.method !== "POST") return respond(405, { ok: false, message: "Método não permitido." });

  let raw = "";
  let body: any = {};
  try { raw = await req.text(); body = raw ? JSON.parse(raw) : {}; }
  catch { return respond(400, { ok: false, message: "Requisição inválida." }); }

  const action = String(body.action ?? "bootstrap");
  if (["bootstrap","load","init","session","authorize"].includes(action)) return directBootstrap(req);

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return respond(401, { ok: false, message: "Sessão inválida. Entre novamente." });

  const core = new Set(["create_org","update_org","create_user","update_member","delete_member"]);
  const target = core.has(action) ? "fama-control-core" : "fama-control-admin";
  try {
    const response = await fetch(`${URL}/functions/v1/${target}`, {
      method: "POST",
      headers: { Authorization: authorization, apikey: SERVICE, "Content-Type": "application/json" },
      body: raw || JSON.stringify(body),
    });
    const text = await response.text();
    let payload: any = {};
    try { payload = text ? JSON.parse(text) : {}; }
    catch { payload = { ok: false, message: "Resposta inválida do servidor." }; }
    return respond(response.status, payload);
  } catch (error) {
    console.error(`fama-control ${target}`, error);
    return respond(503, { ok: false, message: "Não foi possível carregar esta função do Fama Control." });
  }
});