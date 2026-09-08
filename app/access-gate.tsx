/* eslint-disable @next/next/no-img-element */

import { ArrowRight, CalendarDays, FileSignature, ShieldCheck, Sparkles } from "lucide-react";

export function AccessGate({ signInPath }: { signInPath: string }) {
  return <main className="public-page">
    <nav className="public-nav">
      <div className="public-brand">
        <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt="" /></span>
        <div><strong>Fama System</strong><small>Fama Piscinas · Gestão inteligente</small></div>
      </div>
      <a className="public-login" href={signInPath} target="_top">Entrar</a>
    </nav>

    <section className="public-hero">
      <div className="public-copy">
        <span className="public-kicker"><Sparkles />Gestão completa para empresas de piscinas</span>
        <h1>Sua operação inteira, organizada em um só lugar.</h1>
        <p>CRM, orçamentos em PDF, agenda, ordens de serviço, garantias, contratos, estoque, financeiro e equipe — com uma área privada para cada empresa.</p>
        <a className="public-cta" href={signInPath} target="_top">Criar minha empresa<ArrowRight /></a>
        <small>Conta protegida com Entrar com ChatGPT. Seus dados ficam separados dos dados das demais empresas.</small>
      </div>

      <div className="public-preview" aria-label="Recursos do Fama System">
        <div className="preview-logo"><img src="/fama-piscinas-logo.png" alt="Fama Piscinas" /></div>
        <div className="preview-heading"><span>Fama System</span><b>Operação em dia</b></div>
        <article><FileSignature /><div><strong>Orçamentos e contratos</strong><small>Documentos profissionais em PDF</small></div><span>Pronto</span></article>
        <article><CalendarDays /><div><strong>Agenda integrada</strong><small>Visitas, serviços e garantias</small></div><span>Hoje</span></article>
        <article><ShieldCheck /><div><strong>Dados individuais</strong><small>Uma área segura para cada empresa</small></div><span>Privado</span></article>
      </div>
    </section>

    <section className="public-features">
      <article><b>01</b><h2>Venda melhor</h2><p>Acompanhe leads, prepare propostas e transforme aprovações em execução.</p></article>
      <article><b>02</b><h2>Organize a equipe</h2><p>Centralize agenda, rotas, ordens de serviço e atendimentos de garantia.</p></article>
      <article><b>03</b><h2>Controle a empresa</h2><p>Veja clientes, contratos, estoque e financeiro sem misturar informações.</p></article>
    </section>
  </main>;
}
