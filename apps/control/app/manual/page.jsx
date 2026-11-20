import Link from "next/link";
import { ControlManual } from "@/app/manual";
import { ThemeToggle } from "@/app/theme-toggle";
import { FAMA_RELEASE_DATE, FAMA_VERSION } from "@/lib/fama-release";
export const metadata = { title: "Manual de uso | Water Control", description: "Guia do painel administrativo Water Control: empresas, usuários, blocos do sistema, IA, segurança, auditoria, privacidade, backups e recuperação." };
export default function ControlManualPage() {
    return <main className="control-manual-page">
    <nav className="control-manual-nav"><Link href="/" className="control-manual-brand">Water Control <small>Administração da plataforma</small></Link><div><ThemeToggle /><Link href="/">Entrar no painel</Link></div></nav>
    <header className="control-manual-intro"><small>GUIA DO PROPRIETÁRIO</small><h1>Manual completo do Water Control</h1><p>Como acompanhar empresas, administrar acessos, proteger os dados e manter a plataforma em boas condições.</p></header>
    <ControlManual />
    <footer className="control-manual-footer"><span>Water Control · v{FAMA_VERSION} · Manual de uso · {FAMA_RELEASE_DATE}</span><Link href="https://watersystem.online/manual" target="_blank">Manual do Water System</Link><Link href="/">Voltar ao painel</Link></footer>
  </main>;
}
