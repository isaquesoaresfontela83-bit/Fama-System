import 'leaflet/dist/leaflet.css';
import { ThemeProvider } from "@/app/theme-provider";
import "./globals.css";
import "./refined-layout.css";
import "./operations-center.css";
import "./professional.css";
import "./account-switcher.css";
import "./workspace-navigation.css";
import "./selected-integrations.css";
export const metadata = {
    metadataBase: new URL("https://famasystem.online"),
    title: "Fama System — Gestão para empresas de piscinas",
    description: "CRM, orçamentos, contratos, garantias, agenda, ordens de serviço, clientes, estoque e financeiro em uma única operação.",
    applicationName: "Fama System",
    manifest: "/site.webmanifest",
    openGraph: { type: "website", locale: "pt_BR", siteName: "Fama System", title: "Fama System — Gestão para empresas de piscinas", description: "Mais controle. Mais resultado. Mais Fama. Conheça os planos e experimente por 7 dias.", images: [{ url: "/fama-piscinas-logo.png", alt: "Fama System" }] },
    twitter: { card: "summary", title: "Fama System", description: "Gestão para empresas de piscinas. Experimente por 7 dias." },
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
