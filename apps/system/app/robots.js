export default function robots() {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/entrar", "/assinar/", "/proposta/", "/configurar-asaas"] }, sitemap: "https://famasystem.online/sitemap.xml" };
}
