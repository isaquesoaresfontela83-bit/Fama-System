"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type BillingSettings = {
  configured: boolean;
  environment: "production" | "sandbox";
  updatedAt: string;
};

export default function ConfigureAsaasPage() {
  const [settings, setSettings] = useState<BillingSettings>({ configured: false, environment: "production", updatedAt: "" });
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/billing", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as Partial<BillingSettings> & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Entre como administrador da plataforma.");
        const next = {
          configured: Boolean(payload.configured),
          environment: payload.environment === "sandbox" ? "sandbox" : "production",
          updatedAt: payload.updatedAt ?? "",
        } satisfies BillingSettings;
        setSettings(next);
        setEnvironment(next.environment);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar a configuração."))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, environment }),
      });
      const payload = await response.json() as Partial<BillingSettings> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a chave Asaas.");
      setSettings({
        configured: true,
        environment: payload.environment === "sandbox" ? "sandbox" : "production",
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      });
      setApiKey("");
      toast.success("Asaas configurada. O Pix automático já pode ser usado no checkout.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a chave Asaas.");
    } finally {
      setSaving(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("A área de transferência está vazia.");
      setApiKey(text.trim());
      toast.success("Chave colada da área de transferência.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a área de transferência.");
    }
  }

  return <main className="asaas-config-page">
    <section className="asaas-config-card">
      <Link className="asaas-back-link" href="/"><ArrowLeft />Voltar ao sistema</Link>
      <div className="asaas-config-head">
        <span><KeyRound /></span>
        <div>
          <small>ASAAS PRODUÇÃO</small>
          <h1>Configurar API de cobrança</h1>
          <p>Cole aqui a chave gerada na Asaas. Ela é validada, criptografada no servidor e não aparece novamente.</p>
        </div>
        <Badge variant={settings.configured ? "default" : "secondary"}>{settings.configured ? "Configurada" : "Pendente"}</Badge>
      </div>

      <div className="asaas-config-status">
        <ShieldCheck />
        <div>
          <strong>{settings.configured ? "Checkout automático ativo" : "Aguardando chave Asaas"}</strong>
          <p>{settings.configured ? `Ambiente ${settings.environment === "production" ? "produção" : "sandbox"}${settings.updatedAt ? `, atualizado em ${new Date(settings.updatedAt).toLocaleString("pt-BR")}` : ""}.` : "Enquanto a chave não for salva, o sistema mantém o Pix manual como reserva."}</p>
        </div>
      </div>

      <form className="asaas-config-form" onSubmit={save} action="/configurar-asaas/submit" method="post">
        <label>
          Ambiente
          <NativeSelect name="environment" value={environment} onChange={(event) => setEnvironment(event.target.value === "sandbox" ? "sandbox" : "production")} disabled={loading || saving}>
            <NativeSelectOption value="production">Produção</NativeSelectOption>
            <NativeSelectOption value="sandbox">Sandbox</NativeSelectOption>
          </NativeSelect>
        </label>
        <label>
          Chave de API Asaas
          <Textarea name="apiKey" className="asaas-key-input" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={environment === "production" ? "$aact_prod_..." : "$aact_hmlg_..."} autoComplete="off" disabled={loading || saving} spellCheck={false} />
        </label>
        <Button type="button" variant="outline" onClick={() => void pasteFromClipboard()} disabled={loading || saving}>Colar chave</Button>
        <Button type="submit" disabled={loading || saving}>{saving ? "Validando..." : "Salvar chave"}</Button>
      </form>

      <div className="asaas-config-help">
        <CheckCircle2 />
        <p>No celular: abra Asaas, vá em <strong>Minha Conta &gt; Integração &gt; Chaves de API</strong>, gere a chave e cole aqui sem mandar no chat.</p>
      </div>
    </section>
  </main>;
}
