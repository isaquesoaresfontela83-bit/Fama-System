import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/app/theme-provider";
import { ModuleAccessGuard } from "@/app/module-access-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fama System — Gestão para empresas de piscinas",
  description:
    "CRM, orçamentos, contratos, garantias, agenda, ordens de serviço, clientes, estoque e financeiro em uma única operação.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/fama-piscinas-mark.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f8fd" },
    { media: "(prefers-color-scheme: dark)", color: "#061329" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <ModuleAccessGuard />
          <a
            href="/manual"
            aria-label="Abrir manual de uso do Fama System"
            className="fixed bottom-3 right-3 z-[90] rounded-full border border-sky-300/70 bg-[#0b3158] px-4 py-2 text-xs font-black text-white shadow-2xl shadow-slate-950/30 transition hover:bg-[#124875] sm:bottom-5 sm:right-5 sm:text-sm"
          >
            ? Manual de uso
          </a>
        </ThemeProvider>
      </body>
    </html>
  );
}
