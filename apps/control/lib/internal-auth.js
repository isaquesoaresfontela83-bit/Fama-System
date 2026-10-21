import { env } from "cloudflare:workers";
export async function isInternalRequest(request) {
    const expected = String(env.FAMA_DATA_BRIDGE_SECRET ?? "");
    const actual = request.headers.get("authorization") ?? "";
    if (!expected || !actual.startsWith("Bearer "))
        return false;
    const digest = async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    const [left, right] = await Promise.all([digest(actual.slice(7)), digest(expected)]);
    return left.reduce((difference, byte, index) => difference | (byte ^ right[index]), 0) === 0;
}
