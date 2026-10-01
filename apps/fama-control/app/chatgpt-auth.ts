import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export type ChatGPTUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: "supabase";
  aal: "aal1" | "aal2" | null;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  user?: SupabaseAuthUser;
};

export type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  factors?: Array<{ id: string; factor_type?: string; status?: string; friendly_name?: string }>;
};

type RuntimeEnvironment = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_AUTH_ENABLED?: string;
};

const ACCESS_COOKIE = "__Host-fama-control-access";
const REFRESH_COOKIE = "__Host-fama-control-refresh";
const PENDING_ACCESS_COOKIE = "__Host-fama-control-mfa-access";
const PENDING_REFRESH_COOKIE = "__Host-fama-control-mfa-refresh";

export class AuthRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function authConfiguration() {
  const runtime = env as unknown as RuntimeEnvironment;
  const url = clean(runtime.SUPABASE_URL).replace(/\/+$/, "");
  const publishableKey = clean(runtime.SUPABASE_PUBLISHABLE_KEY);
  const enabled = clean(runtime.SUPABASE_AUTH_ENABLED).toLowerCase() !== "false";
  if (!enabled || !url || !publishableKey) {
    throw new AuthRequestError("A autenticação ainda não foi configurada.", 503, "AUTH_NOT_CONFIGURED");
  }
  return { url, publishableKey };
}

export async function supabaseAuthRequest<T>(path: string, init: RequestInit = {}, accessToken?: string) {
  const { url, publishableKey } = authConfiguration();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: publishableKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as { msg?: string; message?: string; error_description?: string; error?: string; code?: string; error_code?: string };
    throw new AuthRequestError(
      error.msg || error.message || error.error_description || error.error || "Não foi possível autenticar agora.",
      response.status,
      error.code || error.error_code || "",
    );
  }
  return payload as T;
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}

export async function setSupabaseSession(session: SupabaseSession, pending = false) {
  const cookieStore = await cookies();
  cookieStore.set(pending ? PENDING_ACCESS_COOKIE : ACCESS_COOKIE, session.access_token, cookieOptions(Math.max(60, Number(session.expires_in ?? 3600))));
  cookieStore.set(pending ? PENDING_REFRESH_COOKIE : REFRESH_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
  if (!pending) {
    cookieStore.delete(PENDING_ACCESS_COOKIE);
    cookieStore.delete(PENDING_REFRESH_COOKIE);
  }
}

export async function clearSupabaseSession(includePending = true) {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  if (includePending) {
    cookieStore.delete(PENDING_ACCESS_COOKIE);
    cookieStore.delete(PENDING_REFRESH_COOKIE);
  }
}

export async function getSupabaseAccessToken(pending = false) {
  const cookieStore = await cookies();
  return cookieStore.get(pending ? PENDING_ACCESS_COOKIE : ACCESS_COOKIE)?.value ?? "";
}

export async function signInWithPassword(email: string, password: string) {
  return supabaseAuthRequest<SupabaseSession>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signUpOwner(email: string, password: string) {
  return supabaseAuthRequest<Partial<SupabaseSession> & { user: SupabaseAuthUser }>("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: { display_name: "Proprietário Fama Control" },
    }),
  });
}

export async function getSupabaseFactors(accessToken: string) {
  const user = await supabaseAuthRequest<SupabaseAuthUser>("/auth/v1/user", { method: "GET" }, accessToken);
  return user.factors ?? [];
}

export function sessionAal(accessToken: string): "aal1" | "aal2" | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(normalized)) as { aal?: string };
    return parsed.aal === "aal2" ? "aal2" : parsed.aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}

async function userFromAccessToken(accessToken: string): Promise<ChatGPTUser> {
  const raw = await supabaseAuthRequest<SupabaseAuthUser>("/auth/v1/user", { method: "GET" }, accessToken);
  const email = clean(raw.email).toLowerCase();
  if (!raw.id || !email) throw new AuthRequestError("Sessão inválida.", 401, "INVALID_SESSION");
  const fullName = clean(raw.user_metadata?.full_name || raw.user_metadata?.display_name) || null;
  return { id: raw.id, email, fullName, displayName: fullName ?? email, provider: "supabase", aal: sessionAal(accessToken) };
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? "";
    if (accessToken) {
      try { return await userFromAccessToken(accessToken); } catch (error) {
        if (!(error instanceof AuthRequestError) || error.status !== 401) throw error;
      }
    }
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? "";
    if (!refreshToken) return null;
    const session = await supabaseAuthRequest<SupabaseSession>("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    try { await setSupabaseSession(session); } catch { /* Server Components can be read-only. */ }
    return await userFromAccessToken(session.access_token);
  } catch (error) {
    if (error instanceof AuthRequestError && (error.status === 400 || error.status === 401)) {
      try { await clearSupabaseSession(false); } catch { /* Read-only request context. */ }
      return null;
    }
    if (error instanceof AuthRequestError && error.code === "AUTH_NOT_CONFIGURED") return null;
    console.error("supabase_control_auth_failed", error);
    return null;
  }
}

export function appSignOutPath(returnTo = "/") {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/api/auth/logout?return_to=${encodeURIComponent(safeReturnTo)}`;
}
