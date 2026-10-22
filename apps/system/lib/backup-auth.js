import { env } from "cloudflare:workers";
export async function isBackupRequest(request) {
    const expected = String(env.FAMA_BACKUP_SERVICE_TOKEN ?? "");
    const actual = request.headers.get("authorization") ?? "";
    if (!expected || !actual.startsWith("Bearer "))
        return false;
    const digest = async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    const [left, right] = await Promise.all([digest(expected), digest(actual.slice(7))]);
    return left.reduce((difference, byte, index) => difference | (byte ^ right[index]), 0) === 0;
}
