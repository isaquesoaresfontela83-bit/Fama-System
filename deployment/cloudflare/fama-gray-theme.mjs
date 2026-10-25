import original from "./index.js";
export default { ...original, async fetch(request, env, ctx) {
  const response = await original.fetch(request, env, ctx);
  if (!response.headers.get("content-type")?.includes("text/html") || request.method === "HEAD") return response;
  return new HTMLRewriter()
    .on("html", { element(el) { el.setAttribute("style", (el.getAttribute("style") || "") + ";filter:grayscale(1)!important;background:#161616!important;"); } })
    .on('meta[name="theme-color"]', { element(el) { el.setAttribute("content", "#161616"); } })
    .transform(response);
} };
