"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ArrowRight, FileCheck2, LogOut, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/app/theme-toggle";

export function LegalConsentGate({ displayName, signOutPath }: { displayName: string; signOutPath: string }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!accepted) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/legal/consent", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível registrar o aceite.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o aceite.");
      setBusy(false);
    }
  }

  return <main className="onboarding-page">
    <section className="onboarding-panel legal-gate">
      <div className="onboarding-head"><div className="onboarding-brand"><span className="brand-mark"><img src="/fama-piscinas-mark.png" alt="" /></span><div><strong>Fama System</strong><small>Atualização de segurança e privacidade</small></div></div><ThemeToggle /></div>
      <span className="onboarding-icon"><FileCheck2 /></span>
      <p className="onboarding-step">ANTES DE CONTINUAR</p>
      <h1>Confirme os documentos da plataforma</h1>
      <p>Olá, {displayName}. Atualizamos as regras de uso e privacidade para deixar claras a separação entre empresas, a proteção dos dados e as responsabilidades de cada conta.</p>
      <div className="legal-summary"><span><ShieldCheck /></span><div><strong>O que está protegido</strong><p>Dados separados por empresa, campos sensíveis criptografados, auditoria de alterações e recuperação de registros excluídos.</p></div></div>
      <label className="auth-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button onClick={() => void confirm()} disabled={!accepted || busy}>{busy ? "Registrando…" : <>Aceitar e continuar<ArrowRight /></>}</Button>
      <footer><span>Você pode consultar os documentos a qualquer momento.</span><a href={signOutPath} target="_top"><LogOut />Sair</a></footer>
    </section>
  </main>;
}
