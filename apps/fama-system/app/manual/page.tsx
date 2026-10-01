import Link from "next/link";

import { Manual } from "@/app/manual";
import { ThemeToggle } from "@/app/theme-toggle";

export const metadata = { title: "Manual de uso | Fama System" };

export default function PublicManualPage() {
  return <main className="manual-public-page">
    <nav className="manual-public-nav"><Link href="/" className="manual-public-brand">Fama System <small>Gestão para piscinas</small></Link><div><ThemeToggle /><Link href="/" className="manual-public-back">Entrar no sistema</Link></div></nav>
    <section className="manual-public-intro"><small>GUIA OFICIAL</small><h1>Manual completo do Fama System</h1><p>Aprenda a cadastrar, vender, agendar, executar, receber e proteger a operação da sua empresa de piscinas.</p></section>
    <Manual />
      <footer className="manual-public-footer"><span>Fama System · Manual de uso</span><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/">Voltar ao sistema</Link><small>Manual atualizado em 21/09/2026</small></footer>
  </main>;
}
