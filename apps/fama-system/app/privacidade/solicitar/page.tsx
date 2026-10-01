"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export default function PrivacyRequestPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/privacy/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string; protocol?: string };
      if (!response.ok || !payload.protocol) throw new Error(payload.error ?? "Não foi possível enviar a solicitação.");
      setProtocol(payload.protocol);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="legal-page"><article className="legal-document privacy-form-page">
    <header><Link href="/privacidade" className="legal-brand">Fama System</Link><span>Canal de Privacidade</span></header>
    <h1>Solicitação sobre dados pessoais</h1>
    <p>Informe um e-mail para contato e descreva seu pedido. Os dados deste formulário são criptografados e acessíveis somente pela administração autorizada.</p>
    {protocol ? <div className="privacy-success"><strong>Solicitação registrada</strong><p>Guarde o protocolo: <b>{protocol}</b></p><Link href="/">Voltar ao Fama System</Link></div> : <form className="record-form" onSubmit={submit}>
      <div className="form-field span-2"><Label htmlFor="privacy-email">E-mail para contato</Label><Input id="privacy-email" name="email" type="email" required /></div>
      <div className="form-field span-2"><Label htmlFor="privacy-type">Tipo de solicitação</Label><NativeSelect id="privacy-type" name="requestType" defaultValue="access"><NativeSelectOption value="access">Confirmar ou acessar dados</NativeSelectOption><NativeSelectOption value="correction">Corrigir dados</NativeSelectOption><NativeSelectOption value="export">Exportar ou portar dados</NativeSelectOption><NativeSelectOption value="deletion">Eliminar dados</NativeSelectOption><NativeSelectOption value="revocation">Revogar consentimento ou se opor</NativeSelectOption></NativeSelect></div>
      <div className="form-field span-2"><Label htmlFor="privacy-details">Detalhes</Label><Textarea id="privacy-details" name="details" minLength={10} maxLength={3000} required /></div>
      {error && <p className="form-error span-2" role="alert">{error}</p>}
      <Button className="span-2" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitação"}</Button>
    </form>}
    <footer><Link href="/privacidade">Política de Privacidade</Link><Link href="/termos">Termos de Uso</Link></footer>
  </article></main>;
}
