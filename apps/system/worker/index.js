/** Cloudflare Worker entry point for the Fama application. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { readerRefreshResponse } from "../lib/reader-refresh";
import { isTrustedMutation } from "../lib/request-security";
function withSecurityHeaders(response) {
    const headers = new Headers(response.headers);
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self), payment=()");
    headers.set("Cross-Origin-Opener-Policy", headers.get("Content-Type")?.includes("text/html") ? "same-origin-allow-popups" : "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; frame-src 'self' https://www.openstreetmap.org https://accounts.google.com https://embed.waze.com; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client; worker-src 'self'; connect-src 'self' http://127.0.0.1:17843 https://accounts.google.com https://www.googleapis.com https://cep.awesomeapi.com.br https://brasilapi.com.br https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://*.supabase.co https://huggingface.co https://*.hf.co https://*.huggingface.co; form-action 'self'");
    if (headers.get("Content-Type")?.includes("text/html"))
        headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };
const worker = {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/atualizar-leitor")
            return withSecurityHeaders(readerRefreshResponse());
        if (["GET", "HEAD"].includes(request.method) && /^\/(?:fama-ai-runtime|assets)\/[\w.-]+\.wasm$/.test(url.pathname)) {
            const compressedUrl = new URL(request.url);
            compressedUrl.pathname += ".gz";
            const encoded = await env.ASSETS.fetch(new Request(compressedUrl, { method: request.method }));
            if (encoded.ok) {
                const headers = new Headers(encoded.headers);
                headers.set("Content-Type", "application/wasm");
                headers.delete("Content-Encoding");
                headers.delete("Content-Length");
                const body = request.method === "HEAD" ? null : encoded.body?.pipeThrough(new DecompressionStream("gzip"));
                return withSecurityHeaders(new Response(body, { status: encoded.status, headers }));
            }
            await encoded.body?.cancel();
            return withSecurityHeaders(await env.ASSETS.fetch(request));
        }
        if (["GET", "HEAD"].includes(request.method) && /^\/assets\/fama-local-ai\.worker-[\w-]+\.js$/.test(url.pathname)) {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404)
                return withSecurityHeaders(asset);
            const fallback = await env.ASSETS.fetch(new Request(new URL("/fama-ai-runtime/fama-local-ai.worker.js", request.url), { method: request.method }));
            const response = withSecurityHeaders(fallback);
            response.headers.set("Cache-Control", "no-cache");
            return response;
        }
        if (["GET", "HEAD"].includes(request.method) && url.pathname.startsWith("/assets/")) {
            return withSecurityHeaders(await env.ASSETS.fetch(request));
        }
        // With run_worker_first enabled, public assets must be served explicitly.
        if (["GET", "HEAD"].includes(request.method) && !url.pathname.startsWith("/api/")) {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404)
                return withSecurityHeaders(asset);
            await asset.body?.cancel();
        }
        if (url.pathname.startsWith("/api/") && !isTrustedMutation(request)) {
            return withSecurityHeaders(Response.json({ error: "Origem da solicitação não autorizada." }, { status: 403 }));
        }
        if (url.pathname === "/_vinext/image") {
            const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
            return withSecurityHeaders(await handleImageOptimization(request, {
                fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
                transformImage: async (body, { width, format, quality }) => {
                    const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
                    return result.response();
                },
            }, allowedWidths));
        }
        const response = await handler.fetch(request, env, ctx);
        const queued = response.headers.get('X-Fama-Push-Queue');
        if (queued && /^[a-f0-9-]{36}$/.test(queued)) {
            ctx.waitUntil(import('../lib/firebase-push').then(module => module.dispatchQueuedPush(queued)).catch(() => undefined));
            const clean = new Response(response.body, response);
            clean.headers.delete('X-Fama-Push-Queue');
            return withSecurityHeaders(clean);
        }
        return withSecurityHeaders(response);
    },
};
export default worker;
