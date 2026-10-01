"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfirmAccountPage() {
  const [status, setStatus] = useState("Confirmando sua conta…");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const values = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = values.get("access_token");
    const refreshToken = values.get("refresh_token");
    if (!accessToken || !refreshToken) {
      window.setTimeout(() => setStatus("Este link é inválido ou expirou. Volte para entrar ou solicite um novo e-mail."), 0);
      return;
    }
    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken, expiresIn: values.get("expires_in") ?? 3600 }),
    }).then(async (response) => {
      const payload = await response.json() as { error?: string; requiresMfa?: boolean };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível confirmar a conta.");
      window.history.replaceState({}, "", window.location.pathname);
      setSuccess(!payload.requiresMfa);
      setStatus(payload.requiresMfa ? "Conta confirmada. Entre novamente para concluir a verificação em duas etapas." : "Conta confirmada. Seu acesso está pronto.");
    }).catch((error) => setStatus(error instanceof Error ? error.message : "Não foi possível confirmar a conta."));
  }, []);

  return <main className="legal-page"><section className="legal-document auth-result"><span className="legal-brand">Fama System</span><h1>{success ? "Tudo certo" : "Confirmação da conta"}</h1><p>{status}</p><Link href="/">Ir para o Fama System</Link></section></main>;
}
