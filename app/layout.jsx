import { ThemeProvider } from "@/app/theme-provider";
import "./globals.css";

export const metadata = {
  title: "Fama System — Gestão para empresas de piscinas",
  description: "CRM, orçamentos, contratos, garantias, agenda, ordens de serviço, clientes, estoque e financeiro em uma única operação.",
  icons: { icon: [{ url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" }, { url: "/fama-piscinas-mark.png", type: "image/png", sizes: "512x512" }], shortcut: "/favicon.ico" },
};
export const viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f8fd" }, { media: "(prefers-color-scheme: dark)", color: "#061329" }], colorScheme: "light dark" };
export default function RootLayout({ children }) {
  return <html lang="pt-BR" suppressHydrationWarning><body className="antialiased"><ThemeProvider>{children}</ThemeProvider></body></html>;
}
