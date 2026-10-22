import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { safeReturnPath } from "@/lib/request-security";
const ACCESS_COOKIE = "__Host-fama-control-access";
const REFRESH_COOKIE = "__Host-fama-control-refresh";
const PENDING_ACCESS_COOKIE = "__Host-fama-control-mfa-access";
const PENDING_REFRESH_COOKIE = "__Host-fama-control-mfa-refresh";
export class AuthRequestError extends Error {
    status;
    code;
    constructor(message, status, code = "") {
        super(message);
        this.status = status;
        this.code = code;
    }
}
function clean(value) {
    return String(value ?? "").trim();
}
function authConfiguration() {
    const runtime = env;
    const url = clean(runtime.SUPABASE_URL).replace(/\/+$/, "");
    const publishableKey = clean(runtime.SUPABASE_PUBLISHABLE_KEY);
    const enabled = clean(runtime.SUPABASE_AUTH_ENABLED).toLowerCase() !== "false";
    if (!enabled || !url || !publishableKey) {
        throw new AuthRequestError("A autenticação ainda não foi configurada.", 503, "AUTH_NOT_CONFIGURED");
    }
    return { url, publishableKey };
}
export async function supabaseAuthRequest(path, init = {}, accessToken) {
    const { url, publishableKey } = authConfiguration();
    const response = await fetch(`${url}${path}`, {
        ...init,
        redirect: "manual",
        signal: init.signal ?? AbortSignal.timeout(10000),
        headers: {
            Accept: "application/json",
            apikey: publishableKey,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(init.headers ?? {}),
        },
    }).catch(() => { throw new AuthRequestError("Serviço de acesso temporariamente indisponível. Tente novamente.", 503, "AUTH_UNAVAILABLE"); });
    if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new AuthRequestError("O serviço de acesso retornou uma resposta inesperada. Tente novamente.", 503, "AUTH_REDIRECT_REJECTED");
    }
    const payload = response.status === 204 ? null : await response.json().catch(() => {
        if (response.ok)
            throw new AuthRequestError("O serviço de acesso retornou uma resposta inválida. Tente novamente.", 503, "AUTH_INVALID_RESPONSE");
        return {};
    });
    if (!response.ok) {
        const error = payload;
        throw new AuthRequestError(error.msg || error.message || error.error_description || error.error || "Não foi possível autenticar agora.", response.status, error.code || error.error_code || "");
    }
    return payload;
}
function cookieOptions(maxAge) {
    return { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge };
}
export async function setSupabaseSession(session, pending = false) {
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
export async function signInWithPassword(email, password) {
    return supabaseAuthRequest("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}
export async function signUpOwner(email, password) {
    return supabaseAuthRequest("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({
            email,
            password,
            data: { display_name: "Proprietário Fama Control" },
        }),
    });
}
export async function getSupabaseFactors(accessToken) {
    const user = await supabaseAuthRequest("/auth/v1/user", { method: "GET" }, accessToken);
    return user.factors ?? [];
}
export function sessionAal(accessToken) {
    try {
        const payload = accessToken.split(".")[1];
        if (!payload)
            return null;
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
        const parsed = JSON.parse(atob(normalized));
        return parsed.aal === "aal2" ? "aal2" : parsed.aal === "aal1" ? "aal1" : null;
    }
    catch {
        return null;
    }
}
async function userFromAccessToken(accessToken) {
    const raw = await supabaseAuthRequest("/auth/v1/user", { method: "GET" }, accessToken);
    const email = clean(raw.email).toLowerCase();
    if (!raw.id || !email)
        throw new AuthRequestError("Sessão inválida.", 401, "INVALID_SESSION");
    const fullName = clean(raw.user_metadata?.full_name || raw.user_metadata?.display_name) || null;
    return { id: raw.id, email, fullName, displayName: fullName ?? email, provider: "supabase", aal: sessionAal(accessToken), mfaRequired: Boolean(raw.factors?.some(factor => factor.status === "verified")) };
}
export async function getFamaUser() {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? "";
        if (accessToken) {
            try {
                return await userFromAccessToken(accessToken);
            }
            catch (error) {
                if (!(error instanceof AuthRequestError) || error.status !== 401)
                    throw error;
            }
        }
        const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? "";
        if (!refreshToken)
            return null;
        const session = await supabaseAuthRequest("/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        try {
            await setSupabaseSession(session);
        }
        catch { /* Server Components can be read-only. */ }
        return await userFromAccessToken(session.access_token);
    }
    catch (error) {
        if (error instanceof AuthRequestError && (error.status === 400 || error.status === 401)) {
            try {
                await clearSupabaseSession(false);
            }
            catch { /* Read-only request context. */ }
            return null;
        }
        if (error instanceof AuthRequestError && error.code === "AUTH_NOT_CONFIGURED")
            return null;
        console.error("supabase_control_auth_failed", error);
        return null;
    }
}
export function appSignOutPath(returnTo = "/") {
    return `/api/auth/logout?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
