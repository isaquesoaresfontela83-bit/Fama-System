import { MessageCircle } from "lucide-react";
import { PLAN_CONSULTATION_PHONE, PLAN_CONSULTATION_URL, PLAN_PRICE_NOTICE } from "@/lib/plans";
export function PlanConsultation({ className = "" }) {
    return <aside className={`plan-consultation ${className}`} aria-label="Consultoria para escolher seu plano">
    <div><strong>Qual plano combina com sua empresa?</strong><p>Converse pelo WhatsApp para entender os recursos e escolher o plano mais adequado à sua equipe e ao volume de clientes.</p></div>
    <a href={PLAN_CONSULTATION_URL} target="_blank" rel="noopener noreferrer"><MessageCircle />Consultoria · {PLAN_CONSULTATION_PHONE}</a>
    <p className="plan-price-notice">{PLAN_PRICE_NOTICE}</p>
  </aside>;
}
