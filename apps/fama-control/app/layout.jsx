import { ThemeProvider } from "@/app/theme-provider";
import "./globals.css";
import "./control-premium.css";
import "./control-integrations.css";
import "./professional.css";
export const metadata = {
    title: "Fama Control — Administração privada",
    description: "Painel privado do proprietário para administrar o Fama System com segurança.",
    robots: { index: false, follow: false, nocache: true },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
            { url: "/fama-piscinas-mark.png", type: "image/png", sizes: "512x512" },
        ],
        shortcut: "/favicon.ico",
    },
};
export const viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f3f8fd" },
        { media: "(prefers-color-scheme: dark)", color: "#061329" },
    ],
    colorScheme: "light dark",
};
export default function RootLayout({ children, }) {
    return (<html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased"><a className="skip-link" href="#conteudo">Pular para o conteúdo</a><ThemeProvider><div id="conteudo" tabIndex={-1}>{children}</div></ThemeProvider></body>
    </html>);
}
