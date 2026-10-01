import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export type FamaUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
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

const ACCESS_COOKIE = "__Host-fama-access";
const REFRESH_COOKIE = "__Host-fama-refresh";
const PENDING_ACCESS_COOKIE = "__Host-fama-mfa-access";
const PENDING_REFRESH_COOKIE = "__Host-fama-mfa-refresh";
export class AuthRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function runtime() {
  return env as unknown as RuntimeEnvironment;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function authConfiguration() {
  const values = runtime();
  const url = clean(values.SUPABASE_URL).replace(/\/+$/, "");
  const publishableKey = clean(values.SUPABASE_PUBLISHABLE_KEY);
  const enabled = clean(values.SUPABASE_AUTH_ENABLED).toLowerCase() !== "false";
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
  const accessName = pending ? PENDING_ACCESS_COOKIE : ACCESS_COOKIE;
  const refreshName = pending ? PENDING_REFRESH_COOKIE : REFRESH_COOKIE;
  cookieStore.set(accessName, session.access_token, cookieOptions(Math.max(60, Number(session.expires_in ?? 3600))));
  cookieStore.set(refreshName, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
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

export async function signUpWithPassword(email: string, password: string, fullName: string, redirectTo: string) {
  return supabaseAuthRequest<SupabaseSession & { user: SupabaseAuthUser }>(
    `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      body: JSON.stringify({ email, password, data: { full_name: fullName, display_name: fullName } }),
    },
  );
}

export async function requestPasswordRecovery(email: string, redirectTo: string) {
  return supabaseAuthRequest<Record<string, unknown>>(
    `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export async function updateSupabasePassword(accessToken: string, password: string) {
  return supabaseAuthRequest<{ user: SupabaseAuthUser }>("/auth/v1/user", {
    method: "PUT",
    body: JSON.stringify({ password }),
  }, accessToken);
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

async function userFromAccessToken(accessToken: string): Promise<FamaUser> {
  const raw = await supabaseAuthRequest<SupabaseAuthUser>("/auth/v1/user", { method: "GET" }, accessToken);
  const email = clean(raw.email).toLowerCase();
  if (!raw.id || !email) throw new AuthRequestError("Sessão inválida.", 401, "INVALID_SESSION");
  const fullName = clean(raw.user_metadata?.full_name || raw.user_metadata?.display_name) || null;
  return {
    id: raw.id,
    email,
    fullName,
    displayName: fullName ?? email,
    aal: sessionAal(accessToken),
  };
}

async function getSupabaseUser(): Promise<FamaUser | null> {
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
    try { await setSupabaseSession(session); } catch { /* Server Components cannot always mutate cookies. */ }
    return await userFromAccessToken(session.access_token);
  } catch (error) {
    if (error instanceof AuthRequestError && (error.status === 400 || error.status === 401)) {
      try { await clearSupabaseSession(false); } catch { /* Read-only request context. */ }
      return null;
    }
    if (error instanceof AuthRequestError && error.code === "AUTH_NOT_CONFIGURED") return null;
    console.error("supabase_auth_user_failed", error);
    return null;
  }
}

export async function getFamaUser(): Promise<FamaUser | null> {
  return await getSupabaseUser();
}

export function appSignOutPath(returnTo = "/") {
  return `/api/auth/logout?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  let url: URL;
  try { url = new URL(value, "https://app.local"); } catch { return "/"; }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth/") || pathname === "/callback";
}
