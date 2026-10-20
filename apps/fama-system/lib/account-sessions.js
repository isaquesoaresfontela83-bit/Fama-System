export const ACCOUNT_LIMIT = 2;
export const ACCOUNT_MAX_AGE = 60 * 60 * 24 * 30;
export const ACTIVE_ACCOUNT_COOKIE = '__Host-fama-current-account';
const purpose = 'fama-account-session:v1';
export const accountCookie = slot => `__Host-fama-account-${slot}`;
export const accountAccessCookie = slot => `${accountCookie(slot)}-access`;
export const accountCookieOptions = (maxAge = ACCOUNT_MAX_AGE) => ({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge });
export function expireAccountCookie(store, name) {
    // __Host- cookies require Secure even when they are being removed.
    store.set(name, '', { ...accountCookieOptions(0), expires: new Date(0) });
}

export class AccountSessionError extends Error {
    constructor(message, status = 409, code = 'ACCOUNT_LIMIT') {
        super(message);
        this.status = status;
        this.code = code;
    }
}
export function accountSessionsEnabled(secret) {
    return typeof secret === 'string' && secret.length >= 32;
}
function encode(bytes) {
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}
async function key(secret) {
    const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}:${secret}`));
    return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function validRecord(value, now) {
    return value?.v === 1 && typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.id)
        && typeof value.email === 'string' && value.email.length <= 254 && /^\S+@\S+\.\S+$/.test(value.email)
        && typeof value.name === 'string' && value.name.length <= 160
        && typeof value.refreshToken === 'string' && value.refreshToken.length > 0 && value.refreshToken.length <= 2048
        && Number.isFinite(value.expiresAt) && value.expiresAt > now;
}
export async function readAccountSessions(store, secret, now = Date.now()) {
    if (!accountSessionsEnabled(secret)) return [];
    const output = [];
    for (let slot = 0; slot < ACCOUNT_LIMIT; slot++) {
        const value = store.get(accountCookie(slot))?.value;
        if (!value || value.length > 3800) continue;
        try {
            const [iv, ciphertext, extra] = value.split('.');
            if (!iv || !ciphertext || extra) continue;
            const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(`${purpose}:${slot}`) }, await key(secret), decode(ciphertext));
            const data = JSON.parse(new TextDecoder().decode(clear));
            if (!validRecord(data, now) || output.some(account => account.id === data.id)) continue;
            output.push({ slot, id: data.id, email: data.email, name: data.name, refreshToken: data.refreshToken, expiresAt: data.expiresAt });
        } catch { /* Invalid or expired browser credentials never authenticate an account. */ }
    }
    return output;
}
export async function saveAccountSession(store, secret, user, session, { activate = true } = {}) {
    const accounts = await readAccountSessions(store, secret);
    const existing = accounts.find(account => account.id === user.id);
    const slot = existing?.slot ?? Array.from({ length: ACCOUNT_LIMIT }, (_, index) => index).find(index => !accounts.some(account => account.slot === index));
    if (slot === undefined) throw new AccountSessionError('Duas contas já estão conectadas. Remova uma para adicionar outra.');
    const data = { v: 1, id: user.id, email: user.email, name: String(user.displayName || user.fullName || user.email).slice(0, 160), refreshToken: session.refresh_token, expiresAt: Date.now() + ACCOUNT_MAX_AGE * 1000 };
    if (!validRecord(data, Date.now())) throw new AccountSessionError('Não foi possível guardar esta sessão.', 401, 'INVALID_SESSION');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`${purpose}:${slot}`) }, await key(secret), new TextEncoder().encode(JSON.stringify(data)));
    const value = `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
    if (value.length > 3800) throw new AccountSessionError('Não foi possível guardar esta sessão.', 503, 'SESSION_TOO_LARGE');
    store.set(accountCookie(slot), value, accountCookieOptions());
    store.set(accountAccessCookie(slot), session.access_token, accountCookieOptions(Math.max(60, Math.min(86400, Number(session.expires_in) || 3600))));
    // Refreshes only update their own slot. They cannot switch another tab's account.
    if (activate) store.set(ACTIVE_ACCOUNT_COOKIE, user.id, accountCookieOptions());
    return { ...data, slot };
}
export function forgetAccountSession(store, account) {
    expireAccountCookie(store, accountCookie(account.slot));
    expireAccountCookie(store, accountAccessCookie(account.slot));
}
export function publicAccount(account) {
    return { id: account.id, email: account.email, displayName: account.name };
}
