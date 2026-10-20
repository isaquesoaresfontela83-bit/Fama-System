import Link from "next/link";
import { ControlManual } from "@/app/manual";
import { ThemeToggle } from "@/app/theme-toggle";
import { FAMA_RELEASE_DATE, FAMA_VERSION } from "@/lib/fama-release";
export const metadata = { title: "Manual de uso | Fama Control", description: "Guia do painel administrativo Fama Control: empresas, usuários, blocos do sistema, IA, segurança, auditoria, privacidade, backups e recuperação." };
export default function ControlManualPage() {
    return <main className="control-manual-page">
    <nav className="control-manual-nav"><Link href="/" className="control-manual-brand">Fama Control <small>Administração da plataforma</small></Link><div><ThemeToggle /><Link href="/">Entrar no painel</Link></div></nav>
    <header className="control-manual-intro"><small>GUIA DO PROPRIETÁRIO</small><h1>Manual completo do Fama Control</h1><p>Como acompanhar empresas, administrar acessos, proteger os dados e manter a plataforma em boas condições.</p></header>
    <ControlManual />
    <footer className="control-manual-footer"><span>Fama Control · v{FAMA_VERSION} · Manual de uso · {FAMA_RELEASE_DATE}</span><Link href="https://famasystem.online/manual" target="_blank">Manual do Fama System</Link><Link href="/">Voltar ao painel</Link></footer>
  </main>;
}
