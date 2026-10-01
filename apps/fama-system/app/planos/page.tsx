import { ArrowRight, BadgeDollarSign, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/app/theme-toggle";
import { BILLING_CYCLES, cyclePriceCents, getPlanCatalog, type BillingCycle, type PlanCode } from "@/lib/plans";

export const metadata = { title: "Planos e valores | Fama System" };

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const planOrder: PlanCode[] = ["inicial", "intermediario", "profissional"];
const cycleOrder: BillingCycle[] = ["monthly", "quarterly", "semiannual", "annual"];

export default async function PlansPage() {
  const plans = await getPlanCatalog();
  return (
    <main className="plans-public-page">
      <nav className="public-nav">
        <Link className="public-brand plans-brand" href="/">
          <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt="" /></span>
          <div><strong>Fama System</strong><small>Planos para empresas de piscinas</small></div>
        </Link>
        <div className="public-nav-actions">
          <Link href="/entrar" className="public-manual-link">Entrar</Link>
          <ThemeToggle />
        </div>
      </nav>

      <section className="plans-public-hero">
        <span className="public-kicker"><Sparkles />Gestão para empresas de piscinas</span>
        <h1>Comece com 7 dias grátis e escolha o plano depois.</h1>
        <p>CRM, agenda, orçamentos, ordens de serviço, garantias, contratos, equipe, financeiro e suporte em uma plataforma simples para operação diária.</p>
        <div className="plans-public-actions">
          <a href="#planos" className="button">Ver planos <ArrowRight /></a>
          <a href="/entrar" className="button secondary">Já tenho conta</a>
        </div>
      </section>

      <section id="planos" className="plans-public-grid" aria-label="Planos do Fama System">
        {planOrder.map((code) => {
          const plan = plans[code];
          return (
            <article className={`plans-public-card ${code === "intermediario" ? "featured" : ""}`} key={code}>
              {code === "intermediario" && <span className="plans-ribbon">Mais indicado</span>}
              <BadgeDollarSign />
              <h2>{plan.name}</h2>
              <strong>{money(plan.priceCents)}<small>/mês</small></strong>
              <div className="plans-cycle-list">
                {cycleOrder.map((cycle) => (
                  <a key={cycle} href={`/assinar/${code}?cycle=${cycle}`}>
                    <span>{BILLING_CYCLES[cycle].label}</span>
                    <strong>{money(cyclePriceCents(plan.priceCents, cycle))}</strong>
                    {BILLING_CYCLES[cycle].discountPercent > 0 && <small>-{BILLING_CYCLES[cycle].discountPercent}%</small>}
                  </a>
                ))}
              </div>
              <p>{plan.description}</p>
              <ul>
                {plan.highlights.map((item) => <li key={item}><CheckCircle2 />{item}</li>)}
              </ul>
              <a className="button" href={`/entrar?signup=1&plan=${code}`}>Começar teste grátis <ArrowRight /></a>
              <a className="plans-pay-link" href={`/assinar/${code}`}>Pagar agora sem teste mensal</a>
            </article>
          );
        })}
      </section>

      <section className="surface plans-public-note">
        <ShieldCheck />
        <div>
          <strong>Implantação segura</strong>
          <p>O cliente cria a conta em teste grátis por 7 dias. Depois, o proprietário escolhe o plano e paga por Pix dentro do Fama System para continuar usando.</p>
        </div>
      </section>
    </main>
  );
}
