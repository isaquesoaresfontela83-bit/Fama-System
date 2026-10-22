import { env } from "cloudflare:workers";
import { cookies, headers } from "next/headers";
import { safeReturnPath } from "@/lib/request-security";
import { ACTIVE_ACCOUNT_COOKIE, ACCOUNT_LIMIT, accountAccessCookie, accountCookieOptions, accountSessionsEnabled, readAccountSessions, saveAccountSession, forgetAccountSession, expireAccountCookie, publicAccount } from '@/lib/account-sessions';
const ACCESS_COOKIE = "__Host-fama-access";
const REFRESH_COOKIE = "__Host-fama-refresh";
const PENDING_ACCESS_COOKIE = "__Host-fama-mfa-access";
const PENDING_REFRESH_COOKIE = "__Host-fama-mfa-refresh";
export class AuthRequestError extends Error {
    status;
    code;
    constructor(message, status, code = "") {
        super(message);
        this.status = status;
        this.code = code;
    }
}
function runtime() {
    return env;
}
function clean(value) {
    return String(value ?? "").trim();
}
function accountSecret() {
    return clean(runtime().FAMA_SESSION_SECRET || runtime().FAMA_DATA_ENCRYPTION_KEY);
}
function tokenSubject(token) {
    try {
        const part = token.split('.')[1];
        return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))).sub ?? '';
    } catch { return ''; }
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
function isRejectedSession(error) {
    return error instanceof AuthRequestError && ([400, 401].includes(error.status) || (error.status === 403 && error.code === 'session_not_found'));
}
function clearLegacyCookies(store, includePending = true) {
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ...(includePending ? [PENDING_ACCESS_COOKIE, PENDING_REFRESH_COOKIE] : [])]) expireAccountCookie(store, name);
}
export async function setSupabaseSession(session, pending = false, { activate = true, preservePending = false } = {}) {
    const cookieStore = await cookies();
    const useAccounts = !pending && accountSessionsEnabled(accountSecret());
    if (useAccounts) {
        const user = await userFromAccessToken(session.access_token);
        if (user.mfaRequired && user.aal !== 'aal2')
            throw new AuthRequestError('Confirme a verificação em duas etapas.', 403, 'MFA_REQUIRED');
        await saveAccountSession(cookieStore, accountSecret(), user, session, { activate });
        if (activate) {
            clearLegacyCookies(cookieStore, false);
        }
    }
    const accessName = pending ? PENDING_ACCESS_COOKIE : ACCESS_COOKIE;
    const refreshName = pending ? PENDING_REFRESH_COOKIE : REFRESH_COOKIE;
    if (!useAccounts || (!activate && !cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value)) {
        cookieStore.set(accessName, session.access_token, cookieOptions(Math.max(60, Number(session.expires_in ?? 3600))));
        cookieStore.set(refreshName, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
    }
    if (!pending && !preservePending) {
        expireAccountCookie(cookieStore, PENDING_ACCESS_COOKIE);
        expireAccountCookie(cookieStore, PENDING_REFRESH_COOKIE);
    }
}
export async function clearSupabaseSession(includePending = true) {
    const cookieStore = await cookies();
    const selected = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value || tokenSubject(cookieStore.get(ACCESS_COOKIE)?.value || '');
    const account = (await readAccountSessions(cookieStore, accountSecret())).find(item => item.id === selected);
    if (account) forgetAccountSession(cookieStore, account);
    expireAccountCookie(cookieStore, ACTIVE_ACCOUNT_COOKIE);
    clearLegacyCookies(cookieStore, includePending);
}
export async function getSupabaseAccessToken(pending = false) {
    const cookieStore = await cookies();
    if (pending) return cookieStore.get(PENDING_ACCESS_COOKIE)?.value ?? '';
    const selected = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
    let token = cookieStore.get(ACCESS_COOKIE)?.value ?? '';
    if (selected && accountSessionsEnabled(accountSecret())) {
        const user = await getSupabaseUser();
        if (!user || user.id !== selected || (user.mfaRequired && user.aal !== 'aal2')) return '';
        const account = (await readAccountSessions(cookieStore, accountSecret())).find(item => item.id === selected);
        token = account ? cookieStore.get(accountAccessCookie(account.slot))?.value ?? '' : '';
        if (tokenSubject(token) !== selected) return '';
    }
    const expected = (await headers()).get('x-fama-account');
    return expected && tokenSubject(token) !== expected ? '' : token;
}
export async function signInWithPassword(email, password) {
    return supabaseAuthRequest("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}
export async function signUpWithPassword(email, password, fullName, redirectTo) {
    return supabaseAuthRequest(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        body: JSON.stringify({ email, password, data: { full_name: fullName, display_name: fullName } }),
    });
}
export async function requestPasswordRecovery(email, redirectTo) {
    return supabaseAuthRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: JSON.stringify({ email }) });
}
export async function updateSupabasePassword(accessToken, password) {
    return supabaseAuthRequest("/auth/v1/user", {
        method: "PUT",
        body: JSON.stringify({ password }),
    }, accessToken);
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
    return {
        id: raw.id,
        email,
        fullName,
        displayName: fullName ?? email,
        aal: sessionAal(accessToken),
        mfaRequired: Boolean(raw.factors?.some(factor => factor.status === "verified")),
    };
}
async function getSupabaseUser({ throwOnUnavailable = false } = {}) {
    let selectedAccount, cookieStore;
    try {
        cookieStore = await cookies();
        const selected = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
        if (selected && accountSessionsEnabled(accountSecret())) {
            selectedAccount = (await readAccountSessions(cookieStore, accountSecret())).find(item => item.id === selected);
            if (!selectedAccount) return null;
        }
        const accessToken = cookieStore.get(selectedAccount ? accountAccessCookie(selectedAccount.slot) : ACCESS_COOKIE)?.value ?? "";
        if (accessToken) {
            try {
                const user = await userFromAccessToken(accessToken);
                if (selectedAccount && user.id !== selectedAccount.id)
                    throw new AuthRequestError('Sessão inválida.', 401, 'INVALID_SESSION');
                return user;
            }
            catch (error) {
                if (!(error instanceof AuthRequestError) || error.status !== 401)
                    throw error;
            }
        }
        const refreshToken = selectedAccount?.refreshToken ?? cookieStore.get(REFRESH_COOKIE)?.value ?? "";
        if (!refreshToken)
            return null;
        const session = await supabaseAuthRequest("/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const user = await userFromAccessToken(session.access_token);
        if (selectedAccount && user.id !== selectedAccount.id)
            throw new AuthRequestError('Sessão inválida.', 401, 'INVALID_SESSION');
        try {
            await setSupabaseSession(session, false, { activate: false, preservePending: true });
        }
        catch { /* Server Components cannot always mutate cookies. */ }
        return user;
    }
    catch (error) {
        if (isRejectedSession(error)) {
            try {
                if (selectedAccount) {
                    forgetAccountSession(cookieStore, selectedAccount);
                    expireAccountCookie(cookieStore, ACTIVE_ACCOUNT_COOKIE);
                }
                else await clearSupabaseSession(false);
            }
            catch { /* Read-only request context. */ }
            return null;
        }
        if (error instanceof AuthRequestError && error.code === "AUTH_NOT_CONFIGURED")
            return null;
        if (throwOnUnavailable) throw error;
        console.error("supabase_auth_user_failed", error);
        return null;
    }
}
export async function getFamaUser(options) {
    const user = await getSupabaseUser(options);
    const expected = (await headers()).get('x-fama-account');
    if (expected && user?.id !== expected) return null;
    return user?.mfaRequired && user.aal !== 'aal2' ? null : user;
}
async function rememberCurrentAccount(user) {
    if (!user || !accountSessionsEnabled(accountSecret()) || (user.mfaRequired && user.aal !== 'aal2')) return;
    const store = await cookies();
    const known = await readAccountSessions(store, accountSecret());
    if (known.some(account => account.id === user.id)) return;
    const refresh = store.get(REFRESH_COOKIE)?.value;
    const access = store.get(ACCESS_COOKIE)?.value;
    if (refresh && access) await saveAccountSession(store, accountSecret(), user, { access_token: access, refresh_token: refresh }, { activate: false });
}
export async function prepareAccountSignIn(email) {
    if (!accountSessionsEnabled(accountSecret())) return;
    await rememberCurrentAccount(await getFamaUser());
    const accounts = await readAccountSessions(await cookies(), accountSecret());
    if (accounts.length >= ACCOUNT_LIMIT && !accounts.some(account => account.email === clean(email).toLowerCase()))
        throw new AuthRequestError('Duas contas já estão conectadas. Remova uma para adicionar outra.', 409, 'ACCOUNT_LIMIT');
}
export async function listFamaAccounts() {
    const store = await cookies();
    const secret = accountSecret();
    const remembered = await readAccountSessions(store, secret);
    const selected = store.get(ACTIVE_ACCOUNT_COOKIE)?.value;
    if (accountSessionsEnabled(secret) && remembered.length && (selected || !store.get(ACCESS_COOKIE)?.value)) {
        return { enabled: true, limit: ACCOUNT_LIMIT, activeId: remembered.some(account => account.id === selected) ? selected : null, accounts: remembered.map(publicAccount) };
    }
    const user = await getFamaUser({ throwOnUnavailable: true });
    await rememberCurrentAccount(user);
    const accounts = await readAccountSessions(await cookies(), accountSecret());
    return { enabled: accountSessionsEnabled(accountSecret()), limit: ACCOUNT_LIMIT, activeId: user && (!user.mfaRequired || user.aal === 'aal2') ? user.id : null, accounts: accounts.map(publicAccount) };
}
export async function switchFamaAccount(id) {
    const store = await cookies();
    const account = (await readAccountSessions(store, accountSecret())).find(item => item.id === id);
    if (!account) throw new AuthRequestError('Esta conta não está conectada neste navegador.', 404, 'ACCOUNT_NOT_CONNECTED');
    const accessToken = store.get(accountAccessCookie(account.slot))?.value;
    if (accessToken) {
        let raw;
        try {
            raw = await supabaseAuthRequest('/auth/v1/user', { method: 'GET' }, accessToken);
        } catch (error) {
            if (error instanceof AuthRequestError && error.status === 403 && error.code === 'session_not_found') {
                forgetAccountSession(store, account);
                throw new AuthRequestError('A sessão desta conta foi encerrada. Entre nela novamente.', 401, 'ACCOUNT_SESSION_EXPIRED');
            }
            if (!(error instanceof AuthRequestError) || error.status !== 401) throw error;
        }
        if (raw) {
            if (raw.id !== account.id) throw new AuthRequestError('Não foi possível confirmar esta conta.', 401, 'INVALID_SESSION');
            const verified = raw.factors?.find(item => item.status === 'verified');
            if (verified && sessionAal(accessToken) !== 'aal2') {
                const factor = raw.factors.find(item => item.status === 'verified' && item.factor_type === 'totp');
                if (!factor) throw new AuthRequestError('Confirme a verificação em duas etapas.', 403, 'MFA_REQUIRED');
                await setSupabaseSession({ access_token: accessToken, refresh_token: account.refreshToken }, true);
                return { requiresMfa: true, factorId: factor.id };
            }
            // Selecting an already valid session must not rotate or overwrite its refresh token.
            store.set(ACTIVE_ACCOUNT_COOKIE, account.id, accountCookieOptions());
            clearLegacyCookies(store);
            return { activeId: account.id };
        }
    }
    let session;
    try {
        session = await supabaseAuthRequest('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: account.refreshToken }) });
    } catch (error) {
        if (isRejectedSession(error)) {
            forgetAccountSession(store, account);
            throw new AuthRequestError('A sessão desta conta expirou. Entre nela novamente.', 401, 'ACCOUNT_SESSION_EXPIRED');
        }
        throw error;
    }
    const raw = await supabaseAuthRequest('/auth/v1/user', { method: 'GET' }, session.access_token);
    if (raw.id !== account.id) throw new AuthRequestError('Não foi possível confirmar esta conta.', 401, 'INVALID_SESSION');
    const factor = raw.factors?.find(item => item.status === 'verified' && item.factor_type === 'totp');
    if (factor && sessionAal(session.access_token) !== 'aal2') {
        // Preserve the rotated credential without promoting a lower-assurance session.
        await saveAccountSession(store, accountSecret(), { id: raw.id, email: raw.email, displayName: account.name }, session, { activate: false });
        await setSupabaseSession(session, true);
        return { requiresMfa: true, factorId: factor.id };
    }
    await setSupabaseSession(session);
    return { activeId: account.id };
}
async function revokeAccount(account, store) {
    try {
        let token = store.get(accountAccessCookie(account.slot))?.value;
        if (!token) {
            const session = await supabaseAuthRequest('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: account.refreshToken }) });
            token = session.access_token;
        }
        if (tokenSubject(token) === account.id)
            await supabaseAuthRequest('/auth/v1/logout?scope=local', { method: 'POST' }, token);
    } catch { /* Removing local browser credentials remains available during outages. */ }
}
export async function removeFamaAccount(id, all = false) {
    const store = await cookies();
    await rememberCurrentAccount(await getFamaUser());
    const accounts = await readAccountSessions(store, accountSecret());
    const targets = all ? accounts : accounts.filter(account => account.id === id);
    if (!all && !targets.length) throw new AuthRequestError('Esta conta não está conectada neste navegador.', 404, 'ACCOUNT_NOT_CONNECTED');
    const selected = store.get(ACTIVE_ACCOUNT_COOKIE)?.value || tokenSubject(store.get(ACCESS_COOKIE)?.value || '');
    await Promise.all(targets.map(account => revokeAccount(account, store)));
    for (const account of targets) forgetAccountSession(store, account);
    const activeRemoved = all || targets.some(account => account.id === selected);
    if (activeRemoved) await clearSupabaseSession();
    return { removed: true, activeRemoved };
}
export function appSignOutPath(returnTo = "/") {
    return `/api/auth/logout?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
