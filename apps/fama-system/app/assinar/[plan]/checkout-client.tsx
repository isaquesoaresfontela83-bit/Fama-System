"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { BILLING_CYCLES, cyclePriceCents, type BillingCycle, type PlanCode, type PlanSnapshot } from "@/lib/plans";

type CheckoutResponse = {
  checkout?: {
    id: string;
    status?: string;
    signupUrl?: string;
    invoiceUrl?: string;
    encodedImage?: string;
    payload?: string;
    qrImagePath?: string;
    provider?: string;
    installments?: number;
  };
  error?: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function CheckoutClient({ planCode, plan, initialCycle = "monthly" }: { planCode: PlanCode; plan: PlanSnapshot; initialCycle?: BillingCycle }) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const [installments, setInstallments] = useState(1);
  const [checkout, setCheckout] = useState<NonNullable<CheckoutResponse["checkout"]> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [proofSent, setProofSent] = useState(false);

  async function createCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planCode,
          billingCycle,
          installments,
          buyerName: values.buyerName,
          buyerEmail: values.buyerEmail,
          buyerDocument: values.buyerDocument,
          buyerPhone: values.buyerPhone,
        }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (!response.ok || !payload.checkout) throw new Error(payload.error ?? "Não foi possível gerar o Pix.");
      setCheckout(payload.checkout);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o Pix.");
    } finally {
      setBusy(false);
    }
  }

  async function checkPayment() {
    if (!checkout?.id) return;
    setError("");
    setChecking(true);
    try {
      const response = await fetch(`/api/public/checkout?id=${encodeURIComponent(checkout.id)}`, { cache: "no-store" });
      const payload = await response.json() as CheckoutResponse;
      if (!response.ok || !payload.checkout) throw new Error(payload.error ?? "Não foi possível conferir o pagamento.");
      const nextCheckout = payload.checkout;
      setCheckout((current) => ({ ...(current ?? checkout), ...nextCheckout, id: nextCheckout.id }));
      if (nextCheckout.signupUrl) window.location.href = nextCheckout.signupUrl;
      else setError("Pagamento ainda não confirmado. Aguarde alguns segundos e confira novamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível conferir o pagamento.");
    } finally {
      setChecking(false);
    }
  }

  async function sendProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkout?.id) return;
    setError("");
    setChecking(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/public/checkout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkout.id, proofText: values.proofText }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (!response.ok || !payload.checkout) throw new Error(payload.error ?? "Não foi possível enviar o comprovante.");
      const nextCheckout = payload.checkout;
      setCheckout((current) => ({ ...(current ?? checkout), ...nextCheckout, id: nextCheckout.id }));
      setProofSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o comprovante.");
    } finally {
      setChecking(false);
    }
  }

  async function copyPix() {
    if (!checkout?.payload) return;
    await navigator.clipboard.writeText(checkout.payload);
  }

  async function copyPaymentLink() {
    if (!checkout?.invoiceUrl) return;
    await navigator.clipboard.writeText(checkout.invoiceUrl);
  }

  return (
    <section className="checkout-public-grid">
      <article className="checkout-public-summary">
        <span>Plano escolhido</span>
        <h1>{plan.name}</h1>
        <strong>{money(cyclePriceCents(plan.priceCents, billingCycle))}<small>/{BILLING_CYCLES[billingCycle].shortLabel}</small></strong>
        <p>{plan.description}</p>
        <ul>
          {plan.highlights.map((item) => <li key={item}><CheckCircle2 />{item}</li>)}
        </ul>
        <div><ShieldCheck /><p>O teste grátis libera a criação da empresa por 7 dias. O pagamento Pix é opcional para quem já quer ativar o plano agora.</p></div>
      </article>

      <article className="checkout-public-card">
        {!checkout ? (
          <>
            <small>Teste grátis disponível</small>
            <h2>Comece sem pagar agora</h2>
            <p className="checkout-trial-copy">Crie a conta e use o Fama System por 7 dias. Quando o teste acabar, o sistema bloqueia os módulos e solicita o pagamento do plano.</p>
            <a className="button checkout-trial-button" href={`/entrar?signup=1&plan=${planCode}`}>Começar teste grátis <ArrowRight /></a>
            <details className="checkout-pay-now">
              <summary>Pagar agora sem usar o teste grátis</summary>
              <form onSubmit={createCheckout}>
                <Label htmlFor="billingCycle">Ciclo do plano</Label>
                <NativeSelect id="billingCycle" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}>
                  {(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((cycle) => (
                    <NativeSelectOption key={cycle} value={cycle}>
                      {BILLING_CYCLES[cycle].label} — {money(cyclePriceCents(plan.priceCents, cycle))}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Label htmlFor="installments">Forma pelo link</Label>
                <NativeSelect id="installments" value={String(installments)} onChange={(event) => setInstallments(Number(event.target.value))}>
                  <NativeSelectOption value="1">À vista no Pix</NativeSelectOption>
                  {Array.from({ length: 11 }, (_, index) => index + 2).map((count) => (
                    <NativeSelectOption key={count} value={String(count)}>
                      {count}x pelo link de pagamento
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Label htmlFor="buyerName">Nome ou empresa</Label>
                <Input id="buyerName" name="buyerName" minLength={2} maxLength={100} required placeholder="Ex.: Fama Piscinas" />
                <Label htmlFor="buyerEmail">E-mail de acesso</Label>
                <Input id="buyerEmail" name="buyerEmail" type="email" required placeholder="voce@empresa.com" />
                <Label htmlFor="buyerDocument">CPF/CNPJ</Label>
                <Input id="buyerDocument" name="buyerDocument" inputMode="numeric" placeholder="Opcional, melhora a identificação no Pix" />
                <Label htmlFor="buyerPhone">WhatsApp</Label>
                <Input id="buyerPhone" name="buyerPhone" inputMode="tel" placeholder="Opcional" />
                {error && <p className="form-error" role="alert">{error}</p>}
                <Button type="submit" disabled={busy}>{busy ? <><Loader2 className="spin-icon" />Preparando pagamento</> : <>{installments > 1 ? "Gerar link parcelado" : "Continuar para Pix"} <ArrowRight /></>}</Button>
              </form>
            </details>
          </>
        ) : (
          <div className="checkout-public-result">
            <small>{checkout.installments && checkout.installments > 1 ? "Link parcelado" : checkout.provider === "manual_pix" ? "Pix Mercado Pago" : "Pix gerado"}</small>
            <h2>{checkout.installments && checkout.installments > 1 ? "Abra o link para pagar parcelado" : "Pague e envie o comprovante"}</h2>
            {checkout.qrImagePath && <img src={checkout.qrImagePath} alt="QR Code Pix Mercado Pago" />}
            {checkout.encodedImage && <img src={`data:image/png;base64,${checkout.encodedImage}`} alt="QR Code Pix" />}
            {checkout.payload && <textarea readOnly value={checkout.payload} aria-label="Pix copia e cola" />}
            {checkout.payload && <Button type="button" variant="outline" onClick={() => void copyPix()}><Copy />Copiar Pix copia e cola</Button>}
            {checkout.invoiceUrl && <Button type="button" variant="outline" onClick={() => void copyPaymentLink()}><Copy />Copiar link de pagamento</Button>}
            {checkout.invoiceUrl && <a href={checkout.invoiceUrl} target="_blank" rel="noreferrer">Abrir cobrança no Asaas</a>}
            {checkout.installments && checkout.installments > 1 && <p className="checkout-trial-copy">O pagamento parcelado acontece pelo link da Asaas. Depois da confirmação, clique em conferir pagamento para criar a conta.</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            {checkout.signupUrl ? (
              <a className="button" href={checkout.signupUrl}>Pagamento confirmado. Criar conta <ArrowRight /></a>
            ) : checkout.status === "awaiting_review" || proofSent ? (
              <div className="checkout-review-note">
                <CheckCircle2 />
                <p>Comprovante enviado. Agora aguarde a aprovação no Fama Control. Depois clique em “Conferir aprovação”.</p>
                <Button type="button" onClick={() => void checkPayment()} disabled={checking}>{checking ? <><Loader2 className="spin-icon" />Conferindo</> : "Conferir aprovação"}</Button>
              </div>
            ) : (
              <form className="checkout-proof-form" onSubmit={sendProof}>
                <Label htmlFor="proofText">Comprovante ou ID da transação</Label>
                <textarea id="proofText" name="proofText" minLength={6} maxLength={2000} required placeholder="Cole o ID da transação, nome de quem pagou, horário do pagamento ou observação do comprovante." />
                <Button type="submit" disabled={checking}>{checking ? <><Loader2 className="spin-icon" />Enviando</> : "Enviar comprovante para aprovação"}</Button>
              </form>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
