"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Proposal = { id: string; quoteNumber: string; clientName: string; service: string; totalCents: number; validUntil: string; status: string; paymentTerms: string; items: string };
const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function PublicProposalPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [quote, setQuote] = useState<Proposal | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!params.id || !token) return;
    fetch(`/api/public/quotes/${encodeURIComponent(params.id)}/approval?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setQuote(payload.quote); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar a proposta."));
  }, [params.id, token]);
  async function respond(decision: "aprovado" | "recusado") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/public/quotes/${encodeURIComponent(params.id)}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, decision, customerName: name, reason, confirmed }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Não foi possível registrar sua resposta.");
      setQuote((value) => value ? { ...value, status: payload.status } : value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar sua resposta."); }
    finally { setBusy(false); }
  }
  const statusLabel: Record<string, string> = { aprovado: "Proposta aprovada", recusado: "Proposta recusada", enviado: "Aguardando sua resposta", rascunho: "Rascunho" };
  return <main className="public-proposal"><article className="public-proposal-card"><small>PROPOSTA COMERCIAL</small><h1>{quote ? quote.quoteNumber : "Proposta"}</h1>{error && <p className="public-proposal-error" role="alert">{error}</p>}{quote && <><p>Olá, {quote.clientName}</p><h2>{quote.service}</h2><p className="public-proposal-total">{brl(quote.totalCents)}</p>{quote.validUntil && <p>Válida até {new Date(`${quote.validUntil}T12:00:00`).toLocaleDateString("pt-BR")}</p>}{quote.paymentTerms && <p>Condições: {quote.paymentTerms}</p>}{quote.items && <details><summary>Ver itens e medidas</summary><pre>{(() => { try { return JSON.stringify(JSON.parse(quote.items), null, 2); } catch { return quote.items; } })()}</pre></details>}<p className="public-proposal-status">{statusLabel[quote.status] ?? quote.status}</p>{quote.status === "enviado" && <section className="public-proposal-response"><label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label><label>Observação (opcional)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label><label className="public-proposal-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo que esta resposta representa minha decisão sobre a proposta.</label><div><button disabled={busy || !confirmed || name.trim().length < 2} onClick={() => void respond("aprovado")}>Aprovar proposta</button><button className="secondary" disabled={busy || !confirmed || name.trim().length < 2} onClick={() => void respond("recusado")}>Recusar</button></div></section>}</>}</article></main>;
}
