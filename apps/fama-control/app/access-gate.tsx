"use client";

/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Mode = "login" | "setup" | "mfa";

function ControlScreenPreview() {
  return <div className="control-login-visual" aria-label="Prévia ilustrativa do painel Fama Control">
    <div className="control-login-visual-top"><strong>Fama Control</strong><span>PAINEL DO PROPRIETÁRIO</span></div>
    <div className="control-login-visual-body"><nav><b>Visão geral</b><span>Empresas</span><span>Usuários</span><span>Segurança</span><span>Auditoria</span><span>Privacidade</span></nav><div className="control-login-visual-main"><small>SAÚDE DA PLATAFORMA</small><div className="control-login-visual-cards"><article><i>◫</i><span>Empresas</span><b>Gestão</b></article><article><i>◉</i><span>Acessos</span><b>Por módulo</b></article><article><i>✓</i><span>Segurança</span><b>Auditoria</b></article></div><div className="control-login-visual-row"><span>Permissões individuais</span><b>Proprietário controla</b></div><div className="control-login-visual-row"><span>Operações e acessos</span><b>Eventos registrados</b></div></div></div>
    <p>Prévia ilustrativa · consulte o manual completo</p>
  </div>;
}

export function AccessGate() {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");

  async function startMfa(nextFactorId: string) {
    const response = await fetch("/api/auth/mfa-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "challenge", factorId: nextFactorId }) });
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
        const response = await fetch("/api/auth/mfa-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId, challengeId, code: values.code }) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Código inválido.");
        window.location.reload();
        return;
      }
      const response = await fetch(mode === "setup" ? "/api/auth/setup" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: values.email, password: values.password }) });
      const payload = await response.json() as { error?: string; requiresConfirmation?: boolean; requiresMfa?: boolean; factorId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível entrar.");
      if (payload.requiresConfirmation) {
        setMessage("Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre normalmente.");
        setMode("login");
        return;
      }
      if (payload.requiresMfa && payload.factorId) { await startMfa(payload.factorId); return; }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="control-locked">
    <aside className="control-login-showcase" aria-hidden="true">
      <div className="control-login-brand control-login-brand-light"><span><img src="/fama-piscinas-mark.png" alt="" /></span><div><small>FAMA SYSTEM</small><strong>Fama Control</strong></div></div>
      <div className="control-showcase-copy"><p>GESTÃO CENTRAL</p><h2>Seu negócio inteiro,<br />sob controle.</h2><span>Administre empresas, pessoas, permissões e segurança em um ambiente reservado ao proprietário.</span></div>
      <ul><li><CheckCircle2 /> Acesso protegido</li><li><CheckCircle2 /> Permissões individuais</li><li><CheckCircle2 /> Auditoria completa</li></ul>
      <ControlScreenPreview />
    </aside>
    <section className="control-login-panel" aria-labelledby="control-login-title">
      <header className="control-login-mobile-head"><div className="control-login-brand"><span><img src="/fama-piscinas-mark.png" alt="" /></span><div><small>FAMA SYSTEM</small><strong>Fama Control</strong></div></div><ThemeToggle /></header>
      <div className="control-login-form-wrap">
      <p className="control-kicker">ACESSO ADMINISTRATIVO</p>
      <div className="control-login-mobile-preview"><ControlScreenPreview /></div>
      <h1 id="control-login-title">{mode === "login" ? "Bem-vindo de volta" : mode === "setup" ? "Criar acesso proprietário" : "Verificação em duas etapas"}</h1>
      <p className="control-login-intro">{mode === "login" ? "Entre com a conta do proprietário para acessar o painel de controle." : mode === "setup" ? "Cadastre somente o e-mail autorizado do proprietário." : "Digite o código atual do seu aplicativo autenticador."}</p>
      <form onSubmit={submit}>
        {mode !== "mfa" ? <>
          <div className="form-field"><Label htmlFor="control-email">E-mail</Label><Input id="control-email" name="email" type="email" autoComplete="email" required autoFocus /></div>
          <div className="form-field"><Label htmlFor="control-password">Senha</Label><div className="password-field"><Input id="control-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "setup" ? "new-password" : "current-password"} minLength={mode === "setup" ? 8 : undefined} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{mode === "setup" && <small className="control-login-help">Use pelo menos 8 caracteres.</small>}</div>
        </> : <div className="form-field"><Label htmlFor="control-code">Código do autenticador</Label><Input id="control-code" name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} required autoFocus /></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <Button className="control-login-submit" type="submit" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? <>Entrar no painel<ArrowRight /></> : mode === "setup" ? "Criar acesso seguro" : "Validar código"}</Button>
      </form>
      <button className="control-login-back" type="button" onClick={() => { setMode(mode === "login" ? "setup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Primeiro acesso do proprietário" : "Voltar para o login"}</button>
      <Link className="control-login-manual" href="/manual">Abrir manual completo do Fama Control</Link>
      <footer><ShieldCheck /><span>Ambiente exclusivo do proprietário, protegido pelo Supabase Auth.</span></footer>
      </div>
    </section>
  </main>;
}
