"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ArrowRight, Building2, CheckCircle2, FileCheck2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/app/theme-toggle";
import { PlanConsultation } from "./plan-consultation";
import { FamaLocalAiProvider } from "@/hooks/use-fama-local-ai";
import { useFamaAiSettings } from "@/hooks/use-fama-ai-settings";
import { FamaAiPreparation } from "./fama-ai-startup";
import { AccountSwitcher } from './account-switcher';
import { useAccountSession } from '@/hooks/use-account-session';
function money(cents) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export function CompanyOnboarding({ currentUser, displayName, email, signOutPath, plans, initialPlan = "inicial", initialCheckoutId = "" }) {
    useAccountSession(currentUser?.id);
    const ai = useFamaAiSettings();
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const selectedPlan = initialPlan;
    const checkoutId = initialCheckoutId;
    async function createCompany(event) {
        event.preventDefault();
        setError("");
        setSaving(true);
        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
            const body = { name: values.name, plan: selectedPlan };
            body.legalAccepted = values.legalAccepted === "on";
            if (checkoutId) {
                body.plan = selectedPlan;
                body.checkoutId = checkoutId;
            }
            const response = await fetch("/api/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Não foi possível criar a empresa.");
            window.location.reload();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível criar a empresa.");
            setSaving(false);
        }
    }
    return <FamaLocalAiProvider prepareOnOpen={Boolean(ai.value?.settings.enabled)}><main className="onboarding-page">
    <section className="onboarding-panel">
      <div className="onboarding-head">
        <div className="onboarding-brand">
          <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt=""/></span>
          <div><strong>Fama System</strong><small>Fama Piscinas · Gestão inteligente</small></div>
        </div>
        <div className="onboarding-head-actions">{currentUser && <AccountSwitcher currentUser={currentUser}/>}<ThemeToggle /></div>
      </div>
      <span className="onboarding-icon"><Building2 /></span>
      <p className="onboarding-step">PRIMEIRO ACESSO</p>
      <h1>Crie o perfil da sua empresa</h1>
      <p>Olá, {displayName}. Este nome identifica seu ambiente privado e também aparece nos orçamentos e contratos em PDF.</p>
      {ai.value?.settings.enabled && <FamaAiPreparation />}
      <div className="onboarding-plan">
        <span>Plano selecionado</span>
        <strong>{plans[selectedPlan].name} · {money(plans[selectedPlan].priceCents)}/mês</strong>
        <small>{checkoutId ? "Pagamento validado antes da criação do ambiente." : "Teste grátis de 7 dias. Depois disso o acesso será bloqueado até o pagamento do plano."}</small>
      </div>
      <PlanConsultation />
      <div className="onboarding-flow" aria-label="Etapas de ativação">
        <span className={checkoutId ? "done" : ""}><CheckCircle2 />7 dias grátis</span>
        <span><FileCheck2 />Políticas</span>
        <span><Building2 />Empresa</span>
        <span><ShieldCheck />Acesso</span>
      </div>
      <form onSubmit={createCompany}>
        <Label htmlFor="company-name">Nome da empresa</Label>
        <Input id="company-name" name="name" minLength={2} maxLength={80} required autoFocus placeholder="Ex.: JP Piscinas"/>
        <label className="auth-consent company-policy-consent">
          <input name="legalAccepted" type="checkbox" required/>
          <span>
            Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>, incluindo regras de pagamento, dados financeiros, Asaas/Pix, suporte, IA e responsabilidades da empresa.
          </span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Criando ambiente…" : <>Criar empresa e começar<ArrowRight /></>}</Button>
      </form>
      <div className="onboarding-security"><ShieldCheck /><span><strong>Ambiente individual</strong>Os registros desta empresa não aparecem para outras contas.</span></div>
      <footer><span>Conectado como {email}</span><a href={signOutPath} target="_top"><LogOut />Sair</a></footer>
    </section>
  </main></FamaLocalAiProvider>;
}
