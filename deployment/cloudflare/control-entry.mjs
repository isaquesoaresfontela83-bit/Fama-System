import app from "./index.js";

const APP = "control";
const ASSET_PREFIX = "/assets/";
const ALLOWED_STATIC_PATH = (path) => path.startsWith(ASSET_PREFIX)
  || path === "/fama-client-assets.json"
  || path === "/fama-supabase-schema.sql"
  || path.startsWith("/.vite/");

async function findStaticAsset(request, env, ctx) {
  if (!["GET", "HEAD"].includes(request.method)) return null;

  const url = new URL(request.url);
  if (!ALLOWED_STATIC_PATH(url.pathname) || !env.FAMA_STATIC_ASSETS) return null;

  const cache = globalThis.caches?.default;
  const cacheKey = new Request(url.href, { method: "GET" });
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return request.method === "HEAD" ? new Response(null, cached) : cached;
    } catch {}
  }

  const row = await env.FAMA_STATIC_ASSETS
    .prepare("SELECT body_base64, content_type, sha256 FROM static_assets WHERE app = ? AND path = ?")
    .bind(APP, url.pathname)
    .first();

  if (!row?.body_base64) return null;

  const decoded = atob(row.body_base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);

  const headers = new Headers({
    "Content-Type": row.content_type || "application/octet-stream",
    "Cache-Control": url.pathname.startsWith(ASSET_PREFIX)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60",
    "ETag": '"' + row.sha256 + '"',
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(bytes.length),
  });

  const response = new Response(request.method === "HEAD" ? null : bytes, {
    status: 200,
    headers,
  });

  if (cache && request.method === "GET" && ctx?.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const asset = await findStaticAsset(request, env, ctx);
      if (asset) return asset;
    } catch {}

    return app.fetch(request, env, ctx);
  },
};
