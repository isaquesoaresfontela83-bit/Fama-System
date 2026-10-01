"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, Copy, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { isPlanAccessBlocked } from "@/lib/billing-access";
import type { CurrentUser, Organization } from "./data-model";

type PlanCode = "inicial" | "intermediario" | "profissional";
type BillingCycle = "monthly" | "quarterly" | "semiannual" | "annual";
type Plan = { code: PlanCode; name: string; priceCents: number; description: string; highlights: string[] };
type BillingPayload = {
  billing?: { billingEnabled?: boolean; blockOnExpiry?: boolean; plan: string; planStatus: string; planExpiresAt: string; billingPaymentId?: string; billingCycle?: BillingCycle; pendingPlan?: string; pendingBillingCycle?: BillingCycle; billingProvider?: string };
  plans?: Plan[];
  billingCycles?: Record<BillingCycle, { label: string; shortLabel: string; months: number; discountPercent: number }>;
  provider?: { name: string; environment: string; configured: boolean };
  error?: string;
};
type Checkout = { paymentId: string; invoiceUrl: string; pixQrCode: string; pixCopyPaste: string; dueDate: string; provider?: string; qrImagePath?: string; installments?: number };

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const defaultCycles: NonNullable<BillingPayload["billingCycles"]> = {
  monthly: { label: "Mensal", shortLabel: "mês", months: 1, discountPercent: 0 },
  quarterly: { label: "Trimestral", shortLabel: "trimestre", months: 3, discountPercent: 5 },
  semiannual: { label: "Semestral", shortLabel: "semestre", months: 6, discountPercent: 10 },
  annual: { label: "Anual", shortLabel: "ano", months: 12, discountPercent: 15 },
};

function cyclePriceCents(monthlyPriceCents: number, cycle: BillingCycle, cycles = defaultCycles) {
  const item = cycles[cycle] ?? defaultCycles.monthly;
  return Math.round(monthlyPriceCents * item.months * (100 - item.discountPercent) / 100);
}

function billingLabel(value: string) {
  return {
    trial: "Teste ativo",
    active: "Ativo",
    pending_payment: "Aguardando Pix",
    payment_attention: "Atenção no pagamento",
    suspended: "Suspenso",
    expired: "Vencido",
    cancelled: "Cancelado",
  }[value] ?? value;
}

function isExpired(value?: string) {
  if (!value) return false;
  const expiresAt = Date.parse(value);
  return !Number.isFinite(expiresAt) || expiresAt < Date.now();
}

function dateLabel(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

async function readPayload<T>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string };
  try { return JSON.parse(text) as T & { error?: string }; }
  catch { return { error: text.slice(0, 160) } as T & { error?: string }; }
}

export function BillingCenter({ organization, currentUser }: { organization: Organization; currentUser: CurrentUser }) {
  const [state, setState] = useState<BillingPayload>({});
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>((organization.plan as PlanCode) || "inicial");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [manualPaying, setManualPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  useEffect(() => {
    let disposed = false;
    fetch("/api/billing", { headers: { "x-organization-id": organization.id }, cache: "no-store" })
      .then(async (response) => {
        const payload = await readPayload<BillingPayload>(response);
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os planos.");
        if (disposed) return;
        setState(payload);
        if (payload.billing?.plan) setSelectedPlan((payload.billing.pendingPlan || payload.billing.plan) as PlanCode);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar os planos."))
      .finally(() => { if (!disposed) setLoading(false); });
  

  return () => { disposed = true; };
  }, [organization.id, organization.billingEnabled, organization.blockOnExpiry, organization.planExpiresAt]);

  useEffect(() => {
    if (!state.billing?.pendingPlan || state.billing.billingProvider !== "asaas") return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const controller = new AbortController();
    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/billing", { headers: { "x-organization-id": organization.id }, cache: "no-store", signal: controller.signal });
        const payload = await readPayload<BillingPayload>(response);
        if (disposed) return;
        if (response.ok && payload.billing) {
          setState(payload);
          if (payload.billing.planStatus === "active" && !payload.billing.pendingPlan) {
            toast.success("Pagamento confirmado. Seu plano foi ativado.");
            window.location.reload();
            return;
          }
        }
      } catch { /* The manual check remains available if connectivity is interrupted. */ }
      if (!disposed && attempts < 60) timer = setTimeout(poll, 10000);
    };
    timer = setTimeout(poll, 10000);
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [organization.id, state.billing?.billingPaymentId, state.billing?.pendingPlan, state.billing?.billingProvider]);

  const currentPlan = useMemo(() => state.plans?.find((plan) => plan.code === (state.billing?.plan || organization.plan)) ?? state.plans?.[0], [state.plans, state.billing?.plan, organization.plan]);
  const selected = state.plans?.find((plan) => plan.code === selectedPlan);
  const cycles = state.billingCycles ?? defaultCycles;
  const isUpgrade = Boolean(currentPlan && selected && selected.priceCents > currentPlan.priceCents);
  const isPlanChange = Boolean(currentPlan && selected && selected.code !== currentPlan.code);
  const billing = state.billing ?? { plan: organization.plan ?? "inicial", planStatus: organization.planStatus ?? "trial", planExpiresAt: organization.planExpiresAt ?? "", billingEnabled: organization.billingEnabled, blockOnExpiry: organization.blockOnExpiry, billingCycle: "monthly" as BillingCycle };
  const blocked = isPlanAccessBlocked(billing.planStatus, billing.planExpiresAt, billing.billingEnabled, billing.blockOnExpiry);

  async function refreshPayment() {
    setChecking(true);
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": organization.id },
        body: JSON.stringify({ action: "check" }),
      });
      const payload = await readPayload<{ billing?: BillingPayload["billing"] }>(response);
      if (!response.ok || !payload.billing) throw new Error(payload.error ?? "Não foi possível conferir o pagamento.");
      setState((current) => ({ ...current, billing: payload.billing }));
      toast.success(payload.billing.planStatus === "active" && !payload.billing.pendingPlan ? "Plano confirmado como ativo." : "Pagamento ainda não confirmado.");
      if (payload.billing.planStatus === "active" && !payload.billing.pendingPlan) window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível conferir o pagamento.");
    } finally {
      setChecking(false);
    }
  }

  async function submitCheckout(body: Record<string, FormDataEntryValue | string>, mode: "auto" | "manual") {
    const response = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-organization-id": organization.id },
      body: JSON.stringify({ ...body, plan: selectedPlan, billingCycle, installments: mode === "manual" ? 1 : installments, action: mode === "manual" ? "manual" : "checkout" }),
    });
    const payload = await readPayload<{ checkout?: Checkout; billing?: BillingPayload["billing"] }>(response);
    if (!response.ok || !payload.checkout) throw new Error(payload.error ?? "Não foi possível gerar a cobrança.");
    setCheckout(payload.checkout);
    if (payload.billing) setState((current) => ({ ...current, billing: payload.billing }));
    toast.success(payload.checkout.provider === "manual_pix" ? "Pix manual gerado. Envie o comprovante ao suporte para liberação." : installments > 1 ? "Link parcelado gerado." : "Cobrança Pix gerada.");
  }

  async function createCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaying(true);
    setCheckout(null);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await submitCheckout(body, "auto");
    } catch (error) {
      toast.error(error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Não foi possível gerar o pagamento. Tente novamente ou use Pix manual.");
    } finally {
      setPaying(false);
    }
  }

  async function createManualCheckout() {
    setManualPaying(true);
    setCheckout(null);
    const body = {
      buyerName: currentUser.displayName || organization.name,
      buyerEmail: currentUser.email,
      buyerDocument: "",
      buyerPhone: "",
    };
    try {
      await submitCheckout(body, "manual");
    } catch (error) {
      toast.error(error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Não foi possível gerar o Pix manual agora.");
    } finally {
      setManualPaying(false);
    }
  }

  async function copyPix() {
    if (!checkout?.pixCopyPaste) return;
    await navigator.clipboard.writeText(checkout.pixCopyPaste);
    toast.success("Pix copia e cola copiado.");
  }

  if (billing.billingEnabled === false) return <section className="billing-center"><div className="section-heading"><div><p className="eyebrow">MEU PLANO</p><h2>Acesso gratuito liberado</h2></div><Badge variant="secondary"><ShieldCheck /> Isenta de mensalidade</Badge></div><div className="panel" style={{ padding: 24, marginTop: 20 }}><h3>{organization.name}</h3><p>Esta empresa está liberada pela administração, sem mensalidade e sem prazo de teste.</p><p>Seus usuários podem utilizar os módulos permitidos. A cobrança e o bloqueio por vencimento só serão habilitados pelo Fama Control.</p><strong>Plano de recursos: {(state.plans ?? []).find(plan => plan.code === billing.plan)?.name ?? billing.plan}</strong></div></section>;

  return (
    <div className="billing-layout">
      <section className="surface billing-hero">
        <div>
          <small>PLANOS E PAGAMENTOS</small>
          <h2>Assinatura da {organization.name}</h2>
          <p>O cliente tem 7 dias grátis. Depois do vencimento, o acesso aos módulos fica bloqueado até o pagamento do plano.</p>
        </div>
        <div className="billing-status-card">
          <BadgeDollarSign />
          <span>Plano atual</span>
          <strong>{currentPlan?.name ?? "Inicial"}</strong>
          <Badge variant={blocked ? "destructive" : "secondary"}>{billingLabel(billing.planStatus)}</Badge>
          {billing.planExpiresAt && <small>{blocked ? "Vencido em" : billing.planStatus === "trial" ? "Teste até" : "Ativo até"} {dateLabel(billing.planExpiresAt)}</small>}
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshPayment()} disabled={checking}>
            {checking ? <><Loader2 className="spin-icon" />Conferindo</> : "Conferir pagamento"}
          </Button>
        </div>
      </section>

      <div className="billing-grid">
        <section className="surface billing-plans">
          <div className="panel-heading">
            <div><small>ESCOLHA DO CLIENTE</small><h2>Planos disponíveis</h2></div>
            {loading && <Loader2 className="spin-icon" />}
          </div>
          <div className="billing-upgrade-note">
            <ShieldCheck />
            <p>{blocked ? "Teste grátis vencido. Gere o Pix para liberar novamente o acesso do cliente." : isPlanChange ? (isUpgrade ? "Você está fazendo upgrade. Gere o Pix e, após confirmação, os novos limites ficam ativos automaticamente." : "Você está alterando o plano. A troca será registrada após o novo pagamento.") : "Selecione um plano diferente para upgrade ou alteração da assinatura."}</p>
          </div>
          <div className="pricing-grid">
            {(state.plans ?? []).map((plan) => (
              <button type="button" className={`pricing-card ${selectedPlan === plan.code ? "selected" : ""}`} key={plan.code} onClick={() => setSelectedPlan(plan.code)}>
                <span>{plan.name}</span>
                <strong>{money(cyclePriceCents(plan.priceCents, billingCycle, cycles))}<small>/{cycles[billingCycle].shortLabel}</small></strong>
                <p>{plan.description}</p>
                <ul>{plan.highlights.map((item) => <li key={item}><CheckCircle2 />{item}</li>)}</ul>
              </button>
            ))}
          </div>
          {!state.provider?.configured && (
            <div className="billing-warning">
              <ShieldCheck />
              <p>A cobrança automática ainda não está ativa. Mesmo assim, o cliente consegue gerar o Pix manual de reserva e enviar o comprovante para liberação.</p>
            </div>
          )}
        </section>

        <section className="surface billing-checkout">
          <div className="panel-heading">
            <div><small>PAGAMENTO AUTOMÁTICO</small><h2>Gerar Pix do plano</h2></div>
            <CreditCard />
          </div>
          <form className="record-form" onSubmit={createCheckout}>
            <div className="form-field span-2">
              <Label htmlFor="billing-plan">Plano selecionado</Label>
              <NativeSelect id="billing-plan" value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as PlanCode)}>
                {(state.plans ?? []).map((plan) => <NativeSelectOption key={plan.code} value={plan.code}>{plan.name} — {money(plan.priceCents)}/mês</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="form-field span-2">
              <Label htmlFor="billing-cycle">Ciclo de pagamento</Label>
              <NativeSelect id="billing-cycle" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}>
                {(Object.keys(cycles) as BillingCycle[]).map((cycle) => (
                  <NativeSelectOption key={cycle} value={cycle}>
                    {cycles[cycle].label}{selected ? ` — ${money(cyclePriceCents(selected.priceCents, cycle, cycles))}` : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="form-field span-2">
              <Label htmlFor="billing-installments">Forma pelo link</Label>
              <NativeSelect id="billing-installments" value={String(installments)} onChange={(event) => setInstallments(Number(event.target.value))}>
                <NativeSelectOption value="1">À vista no Pix</NativeSelectOption>
                {Array.from({ length: 11 }, (_, index) => index + 2).map((count) => (
                  <NativeSelectOption key={count} value={String(count)}>{count}x pelo link de pagamento</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="form-field"><Label htmlFor="buyerName">Nome do responsável</Label><Input id="buyerName" name="buyerName" defaultValue={currentUser.displayName || organization.name} required /></div>
            <div className="form-field"><Label htmlFor="buyerEmail">E-mail financeiro</Label><Input id="buyerEmail" name="buyerEmail" type="email" defaultValue={currentUser.email} required /></div>
            <div className="form-field"><Label htmlFor="buyerDocument">CPF/CNPJ</Label><Input id="buyerDocument" name="buyerDocument" inputMode="numeric" placeholder="Opcional, recomendado" /></div>
            <div className="form-field"><Label htmlFor="buyerPhone">WhatsApp</Label><Input id="buyerPhone" name="buyerPhone" inputMode="tel" placeholder="Opcional" /></div>
            {blocked && <div className="billing-warning span-2"><ShieldCheck /><p>O acesso operacional está bloqueado porque o teste grátis terminou ou há pendência de pagamento. O Pix confirmado reativa o sistema automaticamente.</p></div>}
            <Button className="span-2" type="submit" disabled={paying || manualPaying || !selected}>
              {paying ? <><Loader2 className="spin-icon" />Gerando pagamento…</> : <><QrCode />{installments > 1 ? "Gerar link parcelado" : blocked ? "Pagar e liberar acesso" : isUpgrade ? "Gerar Pix do upgrade" : "Gerar Pix seguro"}</>}
            </Button>
            <Button className="span-2" type="button" variant="outline" onClick={() => void createManualCheckout()} disabled={paying || manualPaying || !selected}>
              {manualPaying ? <><Loader2 className="spin-icon" />Gerando Pix manual…</> : <><QrCode />Gerar Pix manual de reserva</>}
            </Button>
          </form>

          {checkout && (
            <div className="pix-result">
              <Separator />
              <h3>{checkout.installments && checkout.installments > 1 ? `Link parcelado em ${checkout.installments}x` : "Pix gerado"}</h3>
              {checkout.provider === "manual_pix" && <div className="billing-warning"><ShieldCheck /><p>Pagamento manual de reserva. Após pagar, envie o comprovante pelo suporte para liberarmos o plano.</p></div>}
              {checkout.qrImagePath && <img src={checkout.qrImagePath} alt="QR Code Pix manual do plano Fama System" />}
              {checkout.pixQrCode && <img src={`data:image/png;base64,${checkout.pixQrCode}`} alt="QR Code Pix do plano Fama System" />}
              {checkout.pixCopyPaste && <Button type="button" variant="outline" onClick={() => void copyPix()}><Copy />Copiar Pix copia e cola</Button>}
              {checkout.invoiceUrl && <a href={checkout.invoiceUrl} target="_blank" rel="noreferrer">Abrir cobrança da Asaas</a>}
              <p>Quando a Asaas confirmar o pagamento, o webhook muda o plano para ativo automaticamente.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
