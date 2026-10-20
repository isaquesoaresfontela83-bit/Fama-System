"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, Receipt, RotateCcw } from "lucide-react";

const stages = [
  { name: "Orçamento", icon: FileText, title: "Uma proposta clara para o cliente", status: "Aguardando aprovação", action: "Simular aprovação", description: "Apresente o serviço, os materiais e o valor. O cliente pode aprovar a proposta pelo link compartilhado.", items: ["Manutenção da piscina", "Limpeza e tratamento da água", "Materiais discriminados na proposta"] },
  { name: "Serviço", icon: CalendarDays, title: "A proposta vira ordem de serviço", status: "Serviço agendado", action: "Simular conclusão", description: "Converta o orçamento aprovado em uma ordem de serviço e organize o atendimento na agenda da equipe.", items: ["Responsável pelo atendimento", "Data e endereço do serviço", "Checklist e registro da execução"] },
  { name: "Financeiro", icon: Receipt, title: "Acompanhe a cobrança do serviço", status: "Aguardando recebimento", action: "Simular recebimento", description: "A partir do Plus, acompanhe contas a receber e as cobranças da sua empresa. A integração de pagamentos exige configuração.", items: ["Valor e vencimento definidos", "Situação do recebimento", "Histórico financeiro do atendimento"] },
  { name: "Histórico", icon: CheckCircle2, title: "Tudo conectado ao atendimento", status: "Exemplo concluído", action: "Recomeçar demonstração", description: "Consulte os registros do cliente e continue o relacionamento com sua empresa, da próxima visita aos novos orçamentos.", items: ["Cliente e piscina cadastrados", "Orçamento e serviço registrados", "Próximo atendimento organizado"] },
];

export function ProductDemo() {
  const [active, setActive] = useState(0);
  const stage = stages[active];
  const Icon = stage.icon;
  return <section className="product-demo" id="demonstracao" aria-labelledby="demo-title">
    <div className="product-section-heading"><span className="product-eyebrow">DO PRIMEIRO CONTATO AO HISTÓRICO</span><h2 id="demo-title">Veja o fluxo acontecer.</h2><p>Explore um exemplo antes de criar sua conta.</p></div>
    <div className="product-demo-window">
      <div className="product-demo-bar"><span><i aria-hidden="true"/>Fama System</span><small>Demonstração · dados fictícios</small></div>
      <div className="product-demo-layout">
        <nav className="product-demo-stages" aria-label="Etapas da demonstração">{stages.map((item, index) => <button type="button" key={item.name} aria-pressed={active === index} onClick={() => setActive(index)}><item.icon aria-hidden="true"/><span>{item.name}</span><small>0{index + 1}</small></button>)}</nav>
        <div className="product-demo-content" aria-live="polite" aria-atomic="true">
          <div className="product-demo-label"><Icon aria-hidden="true"/><span>{stage.name}</span><b>{stage.status}</b></div>
          <h3>{stage.title}</h3><p>{stage.description}</p>
          <article className="product-demo-record"><div><small>CLIENTE DE EXEMPLO</small><strong>Condomínio Horizonte</strong><span>Atendimento de manutenção de piscina</span></div><span className="product-demo-value"><small>VALOR ILUSTRATIVO</small><strong>R$ 280,00</strong></span></article>
          <ul className="product-demo-checklist">{stage.items.map(item => <li key={item}><CheckCircle2 aria-hidden="true"/>{item}</li>)}</ul>
          <button type="button" className="button" onClick={() => setActive((active + 1) % stages.length)}>{stage.action}{active === 3 ? <RotateCcw aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</button>
          <small className="product-demo-disclaimer">Esta simulação não cria cadastros, serviços ou cobranças.</small>
        </div>
      </div>
    </div>
  </section>;
}
