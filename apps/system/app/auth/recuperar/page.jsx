"use client";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, PASSWORD_HELP } from "@/lib/password-security";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function RecoverPasswordPage() {
    const [ready, setReady] = useState(false);
    const [message, setMessage] = useState("Validando o link de recuperação…");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [canRequestLink, setCanRequestLink] = useState(false);
    const [mfa, setMfa] = useState(null);
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get("pool_return") === "1" && query.get("code")) {
            const target = new URL("https://fama-pool-servicos.isaquesoaresfontela8.chatgpt.site/api/auth/callback");
            target.searchParams.set("code", query.get("code"));
            window.location.replace(target.href);
            return;
        }
        const values = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = values.get("access_token");
        const refreshToken = values.get("refresh_token");
        if (!accessToken || !refreshToken) {
            window.history.replaceState({}, "", window.location.pathname + window.location.search);
            window.setTimeout(() => {
                setMessage("Este link não pode mais ser usado. Abra o e-mail mais recente ou solicite outro link abaixo.");
                setCanRequestLink(true);
            }, 0);
            return;
        }
        fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, refreshToken, expiresIn: values.get("expires_in") ?? 3600 }) })
            .then(async (response) => {
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Não foi possível validar o link.");
            window.history.replaceState({}, "", window.location.pathname);
            if (payload.requiresMfa && payload.factorId) {
                const challengeResponse = await fetch("/api/auth/mfa-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "challenge", factorId: payload.factorId }) });
                const challenge = await challengeResponse.json();
                if (!challengeResponse.ok || !challenge.challengeId)
                    throw new Error(challenge.error ?? "Não foi possível iniciar a verificação.");
                setMfa({ factorId: payload.factorId, challengeId: challenge.challengeId });
                setMessage("Digite o código do aplicativo autenticador.");
            }
            else {
                setReady(true);
                setMessage("Defina uma nova senha para sua conta.");
            }
        }).catch((cause) => {
            setMessage(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Falha de conexão ao validar o link. Tente novamente ou solicite outro e-mail.");
            setCanRequestLink(true);
        });
    }, []);
    async function requestLink(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
        try {
            const response = await fetch("/api/auth/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const payload = await response.json();
            if (!response.ok || !payload.sent)
                throw new Error(payload.error ?? "Não foi possível solicitar o e-mail.");
            setCanRequestLink(false);
            setMessage("Solicitação enviada. Se este e-mail possui uma conta, você receberá um novo link. Confira também o spam e abra apenas a mensagem mais recente.");
        }
        catch (cause) {
            setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Falha de conexão. Tente solicitar o e-mail novamente.");
        }
        finally {
            setBusy(false);
        }
    }
    async function verifyMfa(event) {
        event.preventDefault();
        if (!mfa)
            return;
        setBusy(true);
        setError("");
        const code = String(new FormData(event.currentTarget).get("code") ?? "");
        try {
            const response = await fetch("/api/auth/mfa-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId: mfa.factorId, challengeId: mfa.challengeId, code }) });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Código inválido.");
            setMfa(null);
            setReady(true);
            setMessage("Defina uma nova senha para sua conta.");
        }
        catch (cause) {
            setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Falha de conexão. Tente validar o código novamente.");
        }
        finally {
            setBusy(false);
        }
    }
    async function updatePassword(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const values = new FormData(event.currentTarget);
        const password = String(values.get("password") ?? "");
        const confirmation = String(values.get("confirmation") ?? "");
        if (password !== confirmation) {
            setBusy(false);
            setError("As senhas não conferem.");
            return;
        }
        try {
            const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Não foi possível alterar a senha.");
            setReady(false);
            setMessage("Senha alterada com sucesso. Você já pode continuar.");
        }
        catch (cause) {
            setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Falha de conexão. Tente salvar a senha novamente.");
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="legal-page"><section className="legal-document auth-result"><span className="legal-brand">Fama System</span><h1>Recuperar senha</h1><p role="status" aria-live="polite">{message}</p>{canRequestLink && <form onSubmit={requestLink}><div className="form-field"><Label htmlFor="recovery-email">E-mail da sua conta</Label><Input id="recovery-email" name="email" type="email" autoComplete="email" required/></div>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Solicitando…" : "Solicitar novo link"}</Button></form>}{mfa && <form onSubmit={verifyMfa}><div className="form-field"><Label htmlFor="recovery-code">Código do autenticador</Label><Input id="recovery-code" name="code" inputMode="numeric" minLength={6} maxLength={10} required autoFocus/></div>{error && <p className="form-error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Validando…" : "Validar código"}</Button></form>}{ready && <form onSubmit={updatePassword}><div className="form-field"><Label htmlFor="new-password">Nova senha</Label><small>{PASSWORD_HELP}</small><Input id="new-password" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" required/></div><div className="form-field"><Label htmlFor="new-password-confirmation">Confirme a nova senha</Label><Input id="new-password-confirmation" name="confirmation" type="password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" required/></div>{error && <p className="form-error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button></form>}<Link href="/">Voltar ao Fama System</Link></section></main>;
}
