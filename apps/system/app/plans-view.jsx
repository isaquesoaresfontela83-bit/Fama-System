"use client";
import { ArrowRight, BadgeDollarSign, CalendarDays, CheckCircle2, FileText, Layers3, Package, Receipt, ShieldCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/app/theme-toggle";
import { PlanConsultation } from "@/app/plan-consultation";
import { ProductDemo } from "@/app/product-demo";
import { BILLING_CYCLES, cyclePriceCents } from "@/lib/plans";
function money(cents) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
const planOrder = ["inicial", "intermediario", "profissional"];
const cycleOrder = ["monthly", "quarterly", "semiannual", "annual"];
export function PlansView({ plans }) {
    return (<main className="plans-public-page">
      <nav className="public-nav">
        <Link className="public-brand plans-brand" href="/">
          <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt=""/></span>
          <div><strong>Fama System</strong><small>Planos para empresas de piscinas</small></div>
        </Link>
        <div className="public-nav-actions">
          <a href="#demonstracao" className="public-manual-link">Conheça o sistema</a>
          <a href="#planos" className="public-manual-link">Planos</a>
          <Link href="/entrar" className="public-manual-link">Entrar</Link>
          <ThemeToggle />
        </div>
      </nav>

      <section className="plans-public-hero">
        <span className="public-kicker"><Sparkles />Gestão para empresas de piscinas</span>
        <h1>Sua empresa de piscinas,<br />no controle.</h1>
        <p>Do orçamento à visita da equipe, mantenha clientes, serviços e informações conectados. Mais controle. Mais resultado. Mais Fama.</p>
        <div className="plans-public-actions">
          <a href="#planos" className="button">Começar com 7 dias grátis <ArrowRight /></a>
          <a href="#demonstracao" className="button secondary">Explorar demonstração</a>
        </div>
        <div className="product-trust-row"><span><CheckCircle2 aria-hidden="true"/>Teste sem cobrança inicial</span><span><ShieldCheck aria-hidden="true"/>Acessos por empresa e função</span><span><Layers3 aria-hidden="true"/>No computador e no celular</span></div>
      </section>

      <ProductDemo />
      <section className="product-modules" aria-labelledby="modules-title">
        <div className="product-section-heading"><span className="product-eyebrow">UMA ROTINA CONECTADA</span><h2 id="modules-title">Cada parte da operação encontra seu lugar.</h2><p>Escolha os recursos que acompanham o momento da sua empresa.</p></div>
        <div className="product-modules-grid">{[
          { icon: Users, title: "Clientes e oportunidades", text: "Cadastros, piscinas e contatos organizados, com CRM para acompanhar cada negociação.", plan: "Desde o Basic" },
          { icon: CalendarDays, title: "Agenda e planejamento", text: "Organize visitas recorrentes, consulte o clima e planeje a semana com mapa, duração e estimativa de deslocamento.", plan: "Desde o Basic" },
          { icon: FileText, title: "Orçamentos profissionais", text: "Prepare propostas em PDF e avance do orçamento aprovado para a execução do serviço.", plan: "Desde o Basic" },
          { icon: Receipt, title: "Financeiro da empresa", text: "Acompanhe contas a pagar e receber, cobranças e integração com Asaas e Pix.", plan: "Desde o Plus" },
          { icon: Package, title: "Equipe, estoque e contratos", text: "Coordene responsáveis, leia códigos de barras no estoque e acompanhe contratos e garantias.", plan: "Desde o Plus" },
          { icon: Sparkles, title: "Fama IA e operação ampliada", text: "Use texto ou voz para consultar a operação, receba apoio da IA ao planejamento e calcule frete entre CEPs.", plan: "No Pro" },
        ].map(({ icon: Icon, title, text, plan }) => <article className="product-module" key={title}><Icon aria-hidden="true"/><h3>{title}</h3><p>{text}</p><small>{plan}</small></article>)}</div>
      </section>
      <PlanConsultation className="plans-public-consultation"/>

      <div className="product-plans-heading product-section-heading"><span className="product-eyebrow">PLANOS PARA CADA MOMENTO</span><h2>Comece com 7 dias grátis.</h2><p>Selecione seu plano para experimentar. O teste não gera uma cobrança automática no cadastro.</p></div>
      <section id="planos" className="plans-public-grid" aria-label="Planos do Fama System">
        {!plans && <p role="status">Carregando os planos atuais…</p>}
        {planOrder.filter(code => plans?.[code]).map((code) => {
            const plan = plans[code];
            return (<article className={`plans-public-card ${code === "intermediario" ? "featured" : ""}`} key={code}>
              {code === "intermediario" && <span className="plans-ribbon">Para crescer</span>}
              <BadgeDollarSign />
              <h2>{plan.name}</h2>
              <strong>{money(plan.priceCents)}<small>/mês</small></strong>
              <p className="product-cycle-note">Valor total de cada período:</p>
              <div className="plans-cycle-list">
                {cycleOrder.map((cycle) => (<a key={cycle} href={`/assinar/${code}?cycle=${cycle}`}>
                    <span>{BILLING_CYCLES[cycle].label}</span>
                    <strong>{money(cyclePriceCents(plan.priceCents, cycle))}</strong>
                    {BILLING_CYCLES[cycle].discountPercent > 0 && <small>-{BILLING_CYCLES[cycle].discountPercent}%</small>}
                  </a>))}
              </div>
              <p>{plan.description}</p>
              <ul>
                {plan.highlights.map((item) => <li key={item}><CheckCircle2 />{item}</li>)}
              </ul>
              <a className="button" href={`/entrar?signup=1&plan=${code}`}>Começar teste grátis <ArrowRight /></a>
              <a className="plans-pay-link" href={`/assinar/${code}`}>Pagar agora sem teste mensal</a>
            </article>);
        })}
      </section>

      <section className="surface plans-public-note">
        <ShieldCheck />
        <div>
          <strong>Recursos para toda a operação</strong>
          <p>O Plus inclui tudo do Basic; o Pro inclui tudo do Plus. O financeiro está disponível a partir do Plus. Cada plano libera seus recursos e limites. As permissões da empresa e do Fama Control definem quem pode usar os recursos contratados.</p>
          <p>Integrações financeiras e fiscais dependem da configuração do provedor. A Fama IA se adapta à capacidade do aparelho.</p>
          <p>O cliente cria a conta em teste grátis por 7 dias. Depois, o proprietário escolhe o plano e paga por Pix dentro do Fama System para continuar usando.</p>
        </div>
      </section>

      <section className="product-faq" aria-labelledby="faq-title"><div className="product-section-heading"><span className="product-eyebrow">ANTES DE COMEÇAR</span><h2 id="faq-title">Dúvidas frequentes.</h2></div>
        <details><summary>Como funcionam os 7 dias grátis?</summary><p>Crie sua conta e a empresa com o plano escolhido. O cadastro não cria cobrança. Ao terminar o teste, escolha uma contratação para continuar usando os módulos operacionais.</p></details>
        <details><summary>O financeiro está em todos os planos?</summary><p>O financeiro está disponível a partir do Plus. O Pro inclui os recursos do Plus e acrescenta Fama IA, frete automático e os recursos fiscais descritos no plano. A emissão automática exige configuração fiscal e integração com o provedor.</p></details>
        <details><summary>Preciso instalar algum programa?</summary><p>O acesso principal funciona no navegador do computador ou do celular. Câmera, microfone, localização e notificações dependem da compatibilidade e das permissões do aparelho. Recursos de digitalização por scanner podem exigir uma conexão ou um conector local compatível.</p></details>
        <details><summary>Posso escolher quem acessa cada área?</summary><p>Sim. Os acessos combinam o plano contratado, o vínculo com a empresa e as permissões atribuídas a cada usuário.</p></details>
        <details><summary>Onde encontro ajuda para começar?</summary><p>Consulte o <Link href="/manual">manual de uso</Link>, abra um chamado pelo sistema ou use o contato de consultoria acima para entender qual plano atende sua operação.</p></details>
      </section>
      <footer className="product-public-footer"><span>© {new Date().getFullYear()} Fama System · Mais controle. Mais resultado. Mais Fama.</span><nav aria-label="Informações do Fama System"><Link href="/manual">Manual</Link><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/entrar">Entrar</Link></nav></footer>
    </main>);
}
