export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const PASSWORD_HELP = "Use pelo menos 8 caracteres e uma senha exclusiva para esta conta.";
export class PasswordSecurityError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "PasswordSecurityError";
    }
}
export function validatePasswordLength(password) {
    if ([...password].length < MIN_PASSWORD_LENGTH)
        throw new PasswordSecurityError(PASSWORD_HELP, 400);
    if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
        throw new PasswordSecurityError("Esta senha é longa demais. Use uma frase menor, com pelo menos 8 caracteres.", 400);
    }
}
/** SHA-1 is only a lookup identifier here. Supabase still stores the password using bcrypt. */
export async function assertPasswordSafe(password) {
    validatePasswordLength(password);
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    let response;
    try {
        response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
            redirect: "manual", signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Fama-Password-Security/1.0", "Add-Padding": "true", Accept: "text/plain" },
        });
    }
    catch {
        throw new PasswordSecurityError("Não foi possível conferir a segurança da senha. Tente novamente em instantes.", 503);
    }
    const unavailable = () => new PasswordSecurityError("Não foi possível conferir a segurança da senha. Tente novamente em instantes.", 503);
    if (response.status !== 200 || !response.body) {
        await response.body?.cancel();
        throw unavailable();
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > 200 * 1024) {
                await reader.cancel();
                throw unavailable();
            }
            chunks.push(value);
        }
    }
    catch {
        throw unavailable();
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    const lines = new TextDecoder().decode(bytes).trim().split(/\r?\n/);
    if (!size || lines.some(line => !/^[A-F0-9]{35}:\d+$/i.test(line)))
        throw unavailable();
    const suffix = hash.slice(5);
    if (lines.some(line => line.slice(0, 35).toUpperCase() === suffix && Number(line.slice(36)) > 0)) {
        throw new PasswordSecurityError("Esta senha já apareceu em vazamentos. Escolha uma senha diferente e exclusiva para sua conta.", 400);
    }
}
