export default function sitemap() {
  return ["", "/planos", "/manual", "/termos", "/privacidade"].map(path => ({ url: `https://watersystem.online${path}`, changeFrequency: path === "" || path === "/planos" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/planos" ? .9 : .5 }));
}
