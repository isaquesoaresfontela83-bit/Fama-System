import { getChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://mupnsdqahoybhmkpufmx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_";

function serviceKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function json(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function serviceFetch(path: string, init: RequestInit = {}) {
  const secret = serviceKey();
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", secret);
  headers.set("Authorization", `Bearer ${secret}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers, cache: "no-store" });
}

async function serviceJson(path: string, init: RequestInit = {}) {
  const response = await serviceFetch(path, init);
  let data: any = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.message || data?.msg || data?.error || `SUPABASE_${response.status}`);
  return data;
}

async function isAuthorizedOwner(email: string) {
  const normalized = email.trim().toLowerCase();
  const admin = await serviceJson(
    `/rest/v1/fama_control_admins?select=user_id,email,enabled&email=eq.${encodeURIComponent(normalized)}&enabled=eq.true&limit=1`,
  ).catch(() => []);
  if (Array.isArray(admin) && admin.length) return true;

  const owner = await serviceJson(
    `/rest/v1/organization_members?select=id,user_email,role,status&user_email=eq.${encodeURIComponent(normalized)}&role=eq.owner&status=eq.active&limit=1`,
  ).catch(() => []);
  return Array.isArray(owner) && owner.length > 0;
}

function tokenHashFromGenerateLink(payload: any): string {
  const direct = payload?.properties?.hashed_token ?? payload?.properties?.token_hash ?? payload?.hashed_token;
  if (direct) return String(direct);
  const actionLink = payload?.properties?.action_link ?? payload?.action_link;
  if (!actionLink) return "";
  try {
    const url = new URL(String(actionLink));
    return url.searchParams.get("token") ?? url.searchParams.get("token_hash") ?? "";
  } catch {
    return "";
  }
}

async function verifyTokenHash(tokenHash: string, generated: any) {
  const hinted = String(generated?.properties?.verification_type ?? generated?.verification_type ?? "").toLowerCase();
  const types = [...new Set([hinted, "magiclink", "email"].filter(Boolean))];
  let lastMessage = "Não foi possível validar a sessão Supabase.";

  for (const type of types) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ type, token_hash: tokenHash }),
      cache: "no-store",
    });
    let data: any = null;
    try { data = await response.json(); } catch {}
    if (response.ok && data?.access_token) return data;
    lastMessage = data?.message || data?.msg || data?.error || `VERIFY_${response.status}`;
  }

  throw new Error(lastMessage);
}

export async function POST() {
  const chatgptUser = await getChatGPTUser();
  if (!chatgptUser?.email) {
    return json(401, { ok: false, error: "chatgpt_session_required", message: "Entre com ChatGPT para acessar o Fama Control." });
  }

  if (!serviceKey()) {
    return json(500, {
      ok: false,
      error: "missing_supabase_secret",
      message: "Configure SUPABASE_SECRET_KEY no ambiente do Fama Control.",
    });
  }

  const email = chatgptUser.email.trim().toLowerCase();
  if (!(await isAuthorizedOwner(email))) {
    return json(403, {
      ok: false,
      error: "owner_not_authorized",
      message: "Esta conta do ChatGPT não está autorizada para o Fama Control.",
    });
  }

  try {
    // O ChatGPT Sites já autenticou a identidade. O servidor valida essa identidade
    // contra o Fama Control e cria uma sessão Supabase de uso normal, sem pedir senha.
    const generated = await serviceJson("/auth/v1/admin/generate_link", {
      method: "POST",
      body: JSON.stringify({ type: "magiclink", email }),
    });

    const tokenHash = tokenHashFromGenerateLink(generated);
    if (!tokenHash) throw new Error("TOKEN_HASH_NOT_RETURNED");
    const session = await verifyTokenHash(tokenHash, generated);

    return json(200, {
      ok: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? "",
      expires_in: session.expires_in ?? 3600,
      user: {
        id: session.user?.id ?? null,
        email,
        chatgpt_user_id: chatgptUser.id,
        display_name: chatgptUser.displayName,
      },
    });
  } catch (error) {
    console.error("fama_control_chatgpt_session_failed", error);
    return json(503, {
      ok: false,
      error: "supabase_session_bridge_failed",
      message: "Não foi possível iniciar a sessão administrativa no Supabase.",
    });
  }
}
