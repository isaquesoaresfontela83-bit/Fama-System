const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function isTrustedMutation(request) {
    if (!unsafeMethods.has(request.method.toUpperCase()))
        return true;
    const requestOrigin = new URL(request.url).origin;
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
