"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecoverPasswordPage() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Validando o link de recuperação…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null);

  useEffect(() => {
    const values = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = values.get("access_token");
    const refreshToken = values.get("refresh_token");
    if (!accessToken || !refreshToken) {
      window.setTimeout(() => setMessage("Este link é inválido ou expirou. Solicite uma nova recuperação."), 0);
      return;
    }
    fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, refreshToken, expiresIn: values.get("expires_in") ?? 3600 }) })
      .then(async (response) => {
        const payload = await response.json() as { error?: string; requiresMfa?: boolean; factorId?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível validar o link.");
        window.history.replaceState({}, "", window.location.pathname);
        if (payload.requiresMfa && payload.factorId) {
          const challengeResponse = await fetch("/api/auth/mfa-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "challenge", factorId: payload.factorId }) });
          const challenge = await challengeResponse.json() as { challengeId?: string; error?: string };
          if (!challengeResponse.ok || !challenge.challengeId) throw new Error(challenge.error ?? "Não foi possível iniciar a verificação.");
          setMfa({ factorId: payload.factorId, challengeId: challenge.challengeId });
          setMessage("Digite o código do aplicativo autenticador.");
        } else {
          setReady(true);
          setMessage("Defina uma nova senha para sua conta.");
        }
      }).catch((cause) => setMessage(cause instanceof Error ? cause.message : "Não foi possível validar o link."));
  }, []);

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfa) return;
    setBusy(true);
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const response = await fetch("/api/auth/mfa-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId: mfa.factorId, challengeId: mfa.challengeId, code }) });
    const payload = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(payload.error ?? "Código inválido.");
    setMfa(null);
    setReady(true);
    setMessage("Defina uma nova senha para sua conta.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (password !== confirmation) { setBusy(false); setError("As senhas não conferem."); return; }
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const payload = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(payload.error ?? "Não foi possível alterar a senha.");
    setReady(false);
    setMessage("Senha alterada com sucesso. Você já pode continuar.");
  }

  return <main className="legal-page"><section className="legal-document auth-result"><span className="legal-brand">Fama System</span><h1>Recuperar senha</h1><p>{message}</p>{mfa && <form onSubmit={verifyMfa}><div className="form-field"><Label htmlFor="recovery-code">Código do autenticador</Label><Input id="recovery-code" name="code" inputMode="numeric" minLength={6} maxLength={10} required autoFocus /></div>{error && <p className="form-error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Validando…" : "Validar código"}</Button></form>}{ready && <form onSubmit={updatePassword}><div className="form-field"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" name="password" type="password" minLength={8} required /></div><div className="form-field"><Label htmlFor="new-password-confirmation">Confirme a nova senha</Label><Input id="new-password-confirmation" name="confirmation" type="password" minLength={8} required /></div>{error && <p className="form-error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button></form>}<Link href="/">Voltar ao Fama System</Link></section></main>;
}
