import { env } from "cloudflare:workers";
export class SupabaseRequestError extends Error {
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
export function usesSupabase() {
    return clean(runtime().DATA_BACKEND).toLocaleLowerCase("pt-BR") === "supabase";
}
export function supabaseStorageBucket() {
    return clean(runtime().SUPABASE_STORAGE_BUCKET) || "fama-documents";
}
function configuration() {
    const url = clean(runtime().SUPABASE_URL).replace(/\/+$/, "");
    const key = clean(runtime().SUPABASE_SECRET_KEY);
    const bridgeSecret = clean(runtime().FAMA_DATA_BRIDGE_SECRET);
    if (!url || (!key && !bridgeSecret)) {
        throw new SupabaseRequestError("O Supabase ainda não foi configurado.", 503, "SUPABASE_NOT_CONFIGURED");
    }
    return { url, key, bridgeSecret };
}
function authHeaders(key) {
    const headers = { apikey: key };
    if (key.startsWith("eyJ"))
        headers.Authorization = `Bearer ${key}`;
    return headers;
}
async function request(path, init = {}) {
    const { url, key, bridgeSecret } = configuration();
    const headers = new Headers({
        Accept: "application/json",
        ...(key ? authHeaders(key) : {}),
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    });
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (!key) {
        headers.set("Authorization", `Bearer ${bridgeSecret}`);
        headers.set("x-fama-data-path", path);
        headers.set("x-fama-data-method", init.method ?? "GET");
    }
    const send = !key && env.FAMA_CONTROL?.fetch ? env.FAMA_CONTROL.fetch.bind(env.FAMA_CONTROL) : fetch;
    const response = await send(key ? `${url}${path}` : "https://control.famasystem.online/api/internal/data", {
        ...init,
        ...(!key ? { method: "POST" } : {}),
        headers,
        signal: init.signal ?? AbortSignal.timeout(25000),
        redirect: "manual",
    }).catch(() => { throw new SupabaseRequestError("Serviço de dados temporariamente indisponível. Tente novamente.", 503, "SUPABASE_UNAVAILABLE"); });
    if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new SupabaseRequestError("O serviço de dados retornou um redirecionamento inesperado.", 503, "SUPABASE_REDIRECT_REJECTED");
    }
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new SupabaseRequestError(payload.message || payload.error || `Supabase respondeu com status ${response.status}.`, response.status, payload.code);
    }
    if (response.status === 204)
        return undefined;
    return await response.json();
}
function query(filters, options) {
    const params = new URLSearchParams();
    params.set("select", options?.select || "*");
    for (const [column, value] of Object.entries(filters)) {
        params.set(column, value === null ? "is.null" : `eq.${String(value)}`);
    }
    if (options?.order)
        params.set("order", options.order);
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.offset)
        params.set("offset", String(options.offset));
    return params.toString();
}
export async function selectRows(table, filters = {}, options) {
    const rows = [];
    const maximum = options?.limit ?? Number.POSITIVE_INFINITY;
    if (!(maximum > 0))
        return rows;
    const primaryKeys = {
        platform_settings: ["key"], request_rate_limits: ["key_hash", "action"], fama_control_admins: ["user_id"],
        fama_internal_participants: ["thread_id", "member_id"], fama_internal_reads: ["thread_id", "member_id"],
        fama_whatsapp_events: ["connection_id", "message_hash"],
    };
    const primaryOrder = (primaryKeys[table] ?? ["id"]).map(key => `${key}.asc`).join(",");
    const order = options?.order ? `${options.order},${primaryOrder}` : primaryOrder;
    for (let offset = 0; offset < maximum; offset += 100) {
        const limit = Math.min(100, maximum - offset);
        const page = await request(`/rest/v1/${encodeURIComponent(table)}?${query(filters, { ...options, order, limit, offset })}`);
        if (!Array.isArray(page))
            throw new SupabaseRequestError("O serviço de dados retornou uma lista inválida.", 502);
        rows.push(...page);
        if (page.length < limit)
            break;
    }
    return rows;
}
export async function selectOne(table, filters, options) {
    const rows = await selectRows(table, filters, { ...options, limit: 1 });
    return rows[0] ?? null;
}
export async function insertRow(table, values) {
    const rows = await request(`/rest/v1/${encodeURIComponent(table)}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(values),
    });
    return rows[0];
}
export async function updateRows(table, values, filters) {
    return request(`/rest/v1/${encodeURIComponent(table)}?${query(filters)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(values),
    });
}
export async function deleteRows(table, filters) {
    return request(`/rest/v1/${encodeURIComponent(table)}?${query(filters)}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
    });
}
export async function callRpc(name, values) {
    return request(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify(values),
    });
}
/** Server-only identity check. The internal bridge exposes only GET of one exact UUID. */
export async function activeAuthIdentity(userId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
        return false;
    let payload;
    try {
        payload = await request(`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
    }
    catch (error) {
        if (error instanceof SupabaseRequestError && error.status === 404)
            return false;
        throw error;
    }
    const user = payload.user && typeof payload.user === 'object' ? payload.user : payload;
    const bannedUntil = user.banned_until ? Date.parse(String(user.banned_until)) : 0;
    return user.id === userId && !user.deleted_at && Number.isFinite(bannedUntil) && bannedUntil <= Date.now();
}
export async function uploadObject(path, file, contentType) {
    const bucket = supabaseStorageBucket();
    return request(`/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: { "Content-Type": contentType, "x-upsert": "false" },
        body: file,
    });
}
export async function removeObjects(paths) {
    if (!paths.length)
        return;
    return request(`/storage/v1/object/${encodeURIComponent(supabaseStorageBucket())}`, {
        method: "DELETE",
        body: JSON.stringify({ prefixes: paths }),
    });
}
export async function createSignedObjectUrl(path, expiresIn = 900) {
    const payload = await request(`/storage/v1/object/sign/${encodeURIComponent(supabaseStorageBucket())}/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        body: JSON.stringify({ expiresIn }),
    });
    const signed = payload.signedURL || payload.signedUrl || "";
    if (!signed)
        throw new SupabaseRequestError("Não foi possível gerar o acesso ao arquivo.", 503);
    if (/^https?:\/\//.test(signed))
        return signed;
    return `${configuration().url}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}
export function camelizeRow(row) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
        value,
    ]));
}
export function snakeRow(values) {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        value,
    ]));
}
