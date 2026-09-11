import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/app/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fama Control — Painel do proprietário",
  description: "Painel administrativo seguro do Fama System.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/fama-piscinas-mark.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#061426",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <a
            href="/manual"
            aria-label="Abrir manual administrativo do Fama Control"
            className="fixed bottom-3 right-3 z-[90] rounded-full border border-[#3b73a5] bg-[#0e3159] px-4 py-2 text-xs font-black text-white shadow-2xl shadow-black/30 transition hover:bg-[#164472] sm:bottom-5 sm:right-5 sm:text-sm"
          >
            ? Manual do Control
          </a>
        </ThemeProvider>
      </body>
    </html>
  );
}
