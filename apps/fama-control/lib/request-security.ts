const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isTrustedMutation(request: Request) {
  if (!unsafeMethods.has(request.method.toUpperCase())) return true;
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}
