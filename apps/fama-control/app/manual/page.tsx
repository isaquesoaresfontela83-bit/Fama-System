import Link from "next/link";
import { ControlManual } from "@/app/manual";
import { ThemeToggle } from "@/app/theme-toggle";

export const metadata = { title: "Manual de uso | Fama Control", description: "Guia do painel administrativo Fama Control: empresas, usuários, segurança, auditoria, privacidade, backups e recuperação." };

export default function ControlManualPage() {
  return <main className="control-manual-page">
    <nav className="control-manual-nav"><Link href="/" className="control-manual-brand">Fama Control <small>Administração da plataforma</small></Link><div><ThemeToggle /><Link href="/">Entrar no painel</Link></div></nav>
    <header className="control-manual-intro"><small>GUIA DO PROPRIETÁRIO</small><h1>Manual completo do Fama Control</h1><p>Como acompanhar empresas, administrar acessos, proteger os dados e manter a plataforma em boas condições.</p></header>
    <ControlManual />
    <footer className="control-manual-footer"><span>Fama Control · Manual de uso</span><Link href="https://www.famasystem.online/manual" target="_blank">Manual do Fama System</Link><Link href="/">Voltar ao painel</Link></footer>
  </main>;
}
