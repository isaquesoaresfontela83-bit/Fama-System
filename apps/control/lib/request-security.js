const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function isTrustedMutation(request) {
    if (!unsafeMethods.has(request.method.toUpperCase()))
        return true;
    const requestOrigin = requestPublicUrl(request).origin;
    const origin = request.headers.get("origin");
    if (origin && origin !== requestOrigin)
        return false;
    const fetchSite = request.headers.get("sec-fetch-site");
    return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}
export function safeReturnPath(value) {
    if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value))
        return "/";
    try {
        const url = new URL(value, "https://fama.local");
        if (url.origin !== "https://fama.local" || url.pathname.startsWith("/api/auth/") || url.pathname === "/callback")
            return "/";
        return `${url.pathname}${url.search}${url.hash}`;
    }
    catch {
        return "/";
    }
}

// The reverse proxy terminates HTTPS; use the configured public URL for security
// checks and provider callbacks rather than trusting forwarded client headers.
export function requestPublicUrl(request) {
    const url = new URL(request.url);
    if (!["vps", "hybrid"].includes(process.env.FAMA_RUNTIME) || !process.env.FAMA_PUBLIC_URL) return url;
    const origin = new URL(process.env.FAMA_PUBLIC_URL);
    if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
        throw new Error("Endereço público da aplicação inválido.");
    }
    url.protocol = origin.protocol;
    url.host = origin.host;
    url.port = origin.port;
    return url;
}
