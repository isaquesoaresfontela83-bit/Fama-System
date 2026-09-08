"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useState } from "react";
import { ArrowRight, Building2, LogOut, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanyOnboarding({ displayName, email, signOutPath }: { displayName: string; email: string; signOutPath: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível criar a empresa.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a empresa.");
      setSaving(false);
    }
  }

  return <main className="onboarding-page">
    <section className="onboarding-panel">
      <div className="onboarding-brand">
        <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt="" /></span>
        <div><strong>Fama System</strong><small>Fama Piscinas · Gestão inteligente</small></div>
      </div>
      <span className="onboarding-icon"><Building2 /></span>
      <p className="onboarding-step">PRIMEIRO ACESSO</p>
      <h1>Crie o perfil da sua empresa</h1>
      <p>Olá, {displayName}. Este nome identifica seu ambiente privado e também aparece nos orçamentos e contratos em PDF.</p>
      <form onSubmit={createCompany}>
        <Label htmlFor="company-name">Nome da empresa</Label>
        <Input id="company-name" name="name" minLength={2} maxLength={80} required autoFocus placeholder="Ex.: JP Piscinas" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Criando ambiente…" : <>Criar empresa e começar<ArrowRight /></>}</Button>
      </form>
      <div className="onboarding-security"><ShieldCheck /><span><strong>Ambiente individual</strong>Os registros desta empresa não aparecem para outras contas.</span></div>
      <footer><span>Conectado como {email}</span><a href={signOutPath} target="_top"><LogOut />Sair</a></footer>
    </section>
  </main>;
}
