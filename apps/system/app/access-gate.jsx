"use client";
import { FAMA_VERSION } from "@/lib/fama-release";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, PASSWORD_HELP } from "@/lib/password-security";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ArrowRight, CalendarDays, Eye, EyeOff, FileSignature, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { protectLocalAiStorage, writeLocalAiAutomatic, writeLocalAiEnabled } from "@/lib/fama-ai-storage";
import { AccountSwitcher } from './account-switcher';
import { announceAccountChange } from '@/lib/account-switcher-client';
import { onboardingPath } from '@/lib/onboarding-intent';
export function AccessGate({ initialMode = "login", addingAccount = false, reconnectingAccount = false, initialEmail = '', currentAccountName } = {}) {
    const [mode, setMode] = useState(initialMode);
    const [busy, setBusy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [factorId, setFactorId] = useState("");
    const [challengeId, setChallengeId] = useState("");
    function finishLogin() {
        announceAccountChange();
        window.location.href = addingAccount ? '/' : onboardingPath(Object.fromEntries(new URLSearchParams(window.location.search)));
    }
    function switchMode(next) {
        setMode(next);
        setMessage("");
        setError("");
    }
    async function startMfa(nextFactorId) {
        const response = await fetch("/api/auth/mfa-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "challenge", factorId: nextFactorId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.challengeId)
            throw new Error(payload.error ?? "Não foi possível iniciar a verificação.");
        setFactorId(nextFactorId);
        setChallengeId(payload.challengeId);
        setMode("mfa");
    }
    async function submit(event) {
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
                const payload = await response.json();
                if (!response.ok)
                    throw new Error(payload.error ?? "Código inválido.");
                finishLogin();
                return;
            }
            if (mode === "recover") {
                const response = await fetch("/api/auth/recover", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: values.email }),
                });
                const payload = await response.json();
                if (!response.ok)
                    throw new Error(payload.error ?? "Não foi possível enviar a recuperação.");
                setMessage("Se o e-mail estiver cadastrado, você receberá o link de recuperação.");
                return;
            }
            const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
            if (mode === "signup") {
                const allow = values.localAiStorage === "on";
                writeLocalAiAutomatic(allow);
                writeLocalAiEnabled(false);
                if (allow)
                    void protectLocalAiStorage();
            }
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: values.fullName,
                    email: values.email,
                    company: values.company,
                    password: values.password,
                    accepted: values.accepted === "on",
                    plan: new URLSearchParams(window.location.search).get("plan"),
                    checkout: new URLSearchParams(window.location.search).get("checkout"),
                }),
            });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Não foi possível continuar.");
            if (payload.requiresMfa && payload.factorId) {
                await startMfa(payload.factorId);
                return;
            }
            if (payload.requiresConfirmation) {
                setMessage("Cadastro recebido. Confirme seu e-mail e depois volte para entrar.");
                setMode("login");
                return;
            }
            finishLogin();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível continuar.");
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="public-page">
    <nav className="public-nav">
      <div className="public-brand">
        <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt=""/></span>
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
        <div className="auth-card-head"><span><LockKeyhole /></span><div><small>CONTA FAMA</small><h2 id="auth-title">{mode === "login" ? reconnectingAccount ? "Reconectar conta" : addingAccount ? "Adicionar outra conta" : "Entrar no sistema" : mode === "signup" ? "Criar sua conta" : mode === "recover" ? "Recuperar senha" : "Verificação em duas etapas"}</h2></div></div>
        {reconnectingAccount && <p className="auth-add-account-hint">Confirme sua senha para conectar esta conta novamente.</p>}
        {addingAccount && currentAccountName && <p className="auth-add-account-hint">Sua conta {currentAccountName} continuará conectada.</p>}
        {!addingAccount && mode !== "recover" && mode !== "mfa" && <div className="auth-tabs" role="tablist"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Entrar</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Criar conta</button></div>}
        <form onSubmit={submit}>
          {mode === "signup" && <div className="form-field"><Label htmlFor="auth-name">Seu nome</Label><Input id="auth-name" name="fullName" autoComplete="name" minLength={2} maxLength={80} required/></div>}
          {(mode === "login" || mode === "signup" || mode === "recover") && <div className="form-field"><Label htmlFor="auth-email">E-mail</Label><Input id="auth-email" name="email" type="email" autoComplete="email" defaultValue={initialEmail} required/></div>}
          {mode === "login" && <div className="form-field"><Label htmlFor="auth-company">Empresa (opcional)</Label><Input id="auth-company" name="company" autoComplete="organization" placeholder="Nome cadastrado no Fama System"/><small className="auth-help">Use para confirmar a empresa antes do acesso.</small></div>}
          {(mode === "login" || mode === "signup") && <div className="form-field"><Label htmlFor="auth-password">Senha</Label><div className="password-field"><Input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined} maxLength={mode === "signup" ? MAX_PASSWORD_LENGTH : undefined} required/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{mode === "signup" && <small className="auth-help">{PASSWORD_HELP}</small>}</div>}
          {mode === "signup" && <label className="auth-consent"><input name="accepted" type="checkbox" required/><span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span></label>}
          {mode === "signup" && <label className="auth-consent"><input name="localAiStorage" type="checkbox"/><span><strong>Autorizar armazenamento da IA neste aparelho</strong><br />Permito salvar os modelos neste navegador e baixar automaticamente ao entrar. Voz: cerca de 70 MB; conversa local: cerca de 600 MB em aparelhos compatíveis. Pode consumir dados móveis. Posso pausar depois. Esta opção é opcional.</span></label>}
          {mode === "mfa" && <div className="form-field"><Label htmlFor="auth-code">Código do aplicativo autenticador</Label><Input id="auth-code" name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} required autoFocus/></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? <>Entrar<ArrowRight /></> : mode === "signup" ? <>Criar conta<ArrowRight /></> : mode === "recover" ? "Enviar recuperação" : "Validar código"}</Button>
        </form>
        <footer className="auth-footer">
          {mode === "login" && <button type="button" onClick={() => switchMode("recover")}>Esqueci minha senha</button>}
          {(mode === "recover" || mode === "mfa") && <button type="button" onClick={() => switchMode("login")}>Voltar para entrar</button>}
        </footer>
        {addingAccount ? <a className="auth-back-to-account" href={currentAccountName ? '/' : '/entrar'}>{currentAccountName ? 'Voltar para a conta atual' : 'Voltar para entrar'}</a> : <AccountSwitcher login/>}
      </section>
    </section>

    <section className="public-features">
      <article><FileSignature /><h2>Venda melhor</h2><p>Acompanhe leads e gere propostas e contratos profissionais.</p></article>
      <article><CalendarDays /><h2>Organize a equipe</h2><p>Centralize agenda, serviços e atendimentos de garantia.</p></article>
      <article><ShieldCheck /><h2>Proteja a operação</h2><p>Controle acessos, registre atividades e recupere exclusões.</p></article>
    </section>
    <footer className="public-legal"><span>© 2026 Fama System · v{FAMA_VERSION}</span><a href="/manual">Manual completo</a><a href="/termos">Termos de Uso</a><a href="/privacidade">Privacidade</a></footer>
  </main>;
}
