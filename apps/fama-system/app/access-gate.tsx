"use client";

/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useState } from "react";
import { ArrowRight, CalendarDays, Eye, EyeOff, FileSignature, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup" | "recover" | "mfa";

export function AccessGate() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("signup") === "1" ? "signup" : "login";
  });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setError("");
  }

  async function startMfa(nextFactorId: string) {
    const response = await fetch("/api/auth/mfa-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "challenge", factorId: nextFactorId }),
    });
    const payload = await response.json() as { challengeId?: string; error?: string };
    if (!response.ok || !payload.challengeId) throw new Error(payload.error ?? "Não foi possível iniciar a verificação.");
    setFactorId(nextFactorId);
    setChallengeId(payload.challengeId);
    setMode("mfa");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (mode === "mfa") {
        const response = await fetch("/api/auth/mfa-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", factorId, challengeId, code: values.code }),
        });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Código inválido.");
        window.location.reload();
        return;
      }

      if (mode === "recover") {
        const response = await fetch("/api/auth/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: values.email }),
        });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível enviar a recuperação.");
        setMessage("Se o e-mail estiver cadastrado, você receberá o link de recuperação.");
        return;
      }

      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          company: values.company,
          password: values.password,
          accepted: values.accepted === "on",
        }),
      });
      const payload = await response.json() as { error?: string; authenticated?: boolean; requiresConfirmation?: boolean; requiresMfa?: boolean; factorId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível continuar.");
      if (payload.requiresMfa && payload.factorId) {
        await startMfa(payload.factorId);
        return;
      }
      if (payload.requiresConfirmation) {
        setMessage("Cadastro recebido. Confirme seu e-mail e depois volte para entrar.");
        setMode("login");
        return;
      }
      if (mode === "signup") {
        window.location.href = `/${window.location.search}`;
      } else {
        window.location.reload();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="public-page">
    <nav className="public-nav">
      <div className="public-brand">
        <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt="" /></span>
        <div><strong>Fama System</strong><small>Gestão inteligente para piscinas</small></div>
      </div>
      <div className="public-nav-actions">
        <a href="/planos" className="public-manual-link">Planos e valores</a>
        <a href="/manual" className="public-manual-link">Manual de uso</a>
        <ThemeToggle />
      </div>
    </nav>

    <section className="public-hero public-hero-auth">
      <div className="public-copy">
        <span className="public-kicker"><Sparkles />Gestão completa para empresas de piscinas</span>
        <h1>Sua operação inteira, organizada em um só lugar.</h1>
        <p>CRM, orçamentos em PDF, agenda, ordens de serviço, garantias, contratos, estoque, financeiro e equipe — com uma área privada para cada empresa.</p>
        <div className="public-trust"><ShieldCheck /><span><strong>Dados isolados por empresa</strong>Criptografia, histórico de segurança e recuperação de exclusões.</span></div>
        <section className="login-product-visual" aria-label="Prévia ilustrativa dos módulos do Fama System">
          <div className="login-product-top"><span>FAMA SYSTEM <i>AMBIENTE DE GESTÃO</i></span><b>● Operação</b></div>
          <div className="login-product-body"><aside><strong>F</strong><span>Visão geral</span><span>Clientes</span><span>Agenda</span><span>Financeiro</span></aside><div className="login-product-main"><small>RESUMO DA OPERAÇÃO</small><h3>Hoje, em um só lugar</h3><div className="login-product-stats"><span><small>Visitas</small><b>Agenda</b></span><span><small>Atendimentos</small><b>Ordens de serviço</b></span><span><small>Contas</small><b>Financeiro</b></span></div><div className="login-product-flow"><i>CRM</i><span>→</span><i>Orçamento</i><span>→</span><i>Serviço</i><span>→</span><i>Recebimento</i></div></div></div>
          <p>Prévia ilustrativa · acesse o manual para ver cada área</p>
        </section>
      </div>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-head"><span><LockKeyhole /></span><div><small>CONTA FAMA</small><h2 id="auth-title">{mode === "login" ? "Entrar no sistema" : mode === "signup" ? "Criar sua conta" : mode === "recover" ? "Recuperar senha" : "Verificação em duas etapas"}</h2></div></div>
        {mode !== "recover" && mode !== "mfa" && <div className="auth-tabs" role="tablist"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Entrar</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Criar conta</button></div>}
        <form onSubmit={submit}>
          {mode === "signup" && <div className="form-field"><Label htmlFor="auth-name">Seu nome</Label><Input id="auth-name" name="fullName" autoComplete="name" minLength={2} maxLength={80} required /></div>}
          {(mode === "login" || mode === "signup" || mode === "recover") && <div className="form-field"><Label htmlFor="auth-email">E-mail</Label><Input id="auth-email" name="email" type="email" autoComplete="email" required /></div>}
          {mode === "login" && <div className="form-field"><Label htmlFor="auth-company">Empresa (opcional)</Label><Input id="auth-company" name="company" autoComplete="organization" placeholder="Nome cadastrado no Fama System" /><small className="auth-help">Use para confirmar a empresa antes do acesso.</small></div>}
          {(mode === "login" || mode === "signup") && <div className="form-field"><Label htmlFor="auth-password">Senha</Label><div className="password-field"><Input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{mode === "signup" && <small className="auth-help">Use pelo menos 8 caracteres.</small>}</div>}
          {mode === "signup" && <label className="auth-consent"><input name="accepted" type="checkbox" required /><span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span></label>}
          {mode === "mfa" && <div className="form-field"><Label htmlFor="auth-code">Código do aplicativo autenticador</Label><Input id="auth-code" name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} required autoFocus /></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? <>Entrar<ArrowRight /></> : mode === "signup" ? <>Criar conta<ArrowRight /></> : mode === "recover" ? "Enviar recuperação" : "Validar código"}</Button>
        </form>
        <footer className="auth-footer">
          {mode === "login" && <button type="button" onClick={() => switchMode("recover")}>Esqueci minha senha</button>}
          {(mode === "recover" || mode === "mfa") && <button type="button" onClick={() => switchMode("login")}>Voltar para entrar</button>}
        </footer>
      </section>
    </section>

    <section className="public-features">
      <article><FileSignature /><h2>Venda melhor</h2><p>Acompanhe leads e gere propostas e contratos profissionais.</p></article>
      <article><CalendarDays /><h2>Organize a equipe</h2><p>Centralize agenda, serviços e atendimentos de garantia.</p></article>
      <article><ShieldCheck /><h2>Proteja a operação</h2><p>Controle acessos, registre atividades e recupere exclusões.</p></article>
    </section>
    <footer className="public-legal"><span>© 2026 Fama System · v15.0</span><a href="/manual">Manual completo</a><a href="/termos">Termos de Uso</a><a href="/privacidade">Privacidade</a></footer>
  </main>;
}
