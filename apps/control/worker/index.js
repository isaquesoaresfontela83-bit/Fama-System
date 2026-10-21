/** Cloudflare Worker entry point for the Fama application. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { isTrustedMutation } from "../lib/request-security";
function withSecurityHeaders(response) {
    const headers = new Headers(response.headers);
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; frame-src 'none'; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' https://*.supabase.co https://huggingface.co https://*.hf.co https://*.huggingface.co; form-action 'self'");
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
        return withSecurityHeaders(await handler.fetch(request, env, ctx));
    },
};
export default worker;
