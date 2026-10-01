"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Save, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { defaultCompanySettings, type CompanySettings } from "@/lib/company-settings";
import { NFSE_GUIDANCE, NATIONAL_NFSE_PORTAL } from "@/lib/fiscal-portal";
import type { Organization } from "./data-model";

export function CompanySettingsPanel({ organization }: { organization: Organization }) {
  const [settings, setSettings] = useState<CompanySettings>(defaultCompanySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let disposed = false;
    fetch("/api/company-settings", { headers: { "x-organization-id": organization.id }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { settings?: CompanySettings; error?: string };
        if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Não foi possível carregar as configurações.");
        if (!disposed) { setSettings(payload.settings); setLoadError(""); }
      })
      .catch((error) => { if (!disposed) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as configurações da empresa."); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [organization.id, reload]);

  const update = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": organization.id },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json() as { settings?: CompanySettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Não foi possível salvar.");
      setSettings(payload.settings);
      toast.success("Configurações da empresa salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading"><i /><p>Carregando configurações…</p></div>;
  if (loadError) return <section className="surface settings-section"><p role="alert">{loadError}</p><Button onClick={() => { setLoading(true); setReload(value => value + 1); }}>Tentar novamente</Button></section>;

  return <form className="company-settings-layout" onSubmit={save}>
    <section className="surface settings-hero">
      <Settings2 />
      <div><small>CONFIGURAÇÕES DA EMPRESA</small><h2>{organization.name}</h2><p>Controle dados usados em PDFs, mensagens, financeiro, estoque e regras internas desta empresa.</p></div>
      <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="spin-icon" />Salvando</> : <><Save />Salvar</>}</Button>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>IDENTIDADE</small><h2>Dados da empresa</h2></div></div>
      <div className="settings-grid">
        <Field label="Razão social / nome para documentos" value={settings.legalName} onChange={(value) => update("legalName", value)} />
        <Field label="CPF/CNPJ" value={settings.document} onChange={(value) => update("document", value)} />
        <Field label="Telefone" value={settings.phone} onChange={(value) => update("phone", value)} />
        <Field label="WhatsApp" value={settings.whatsapp} onChange={(value) => update("whatsapp", value)} />
        <Field label="E-mail" type="email" value={settings.email} onChange={(value) => update("email", value)} />
        <Field label="Logo URL" value={settings.logoUrl} onChange={(value) => update("logoUrl", value)} />
        <TextField label="Endereço" value={settings.address} onChange={(value) => update("address", value)} />
      </div>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>DOCUMENTOS</small><h2>Textos padrão</h2></div></div>
      <div className="settings-grid">
        <TextField label="Condições padrão do orçamento" value={settings.quoteTerms} onChange={(value) => update("quoteTerms", value)} />
        <TextField label="Cláusulas padrão de contrato" value={settings.contractTerms} onChange={(value) => update("contractTerms", value)} />
        <TextField label="Termo padrão de garantia" value={settings.warrantyTerms} onChange={(value) => update("warrantyTerms", value)} />
        <Field label="Condição de pagamento padrão" value={settings.defaultPaymentTerms} onChange={(value) => update("defaultPaymentTerms", value)} />
        <Field label="Validade padrão do orçamento (dias)" type="number" value={settings.defaultQuoteValidityDays} onChange={(value) => update("defaultQuoteValidityDays", Number(value))} />
      </div>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>FISCAL</small><h2>Emissão oficial de nota fiscal</h2></div></div>
      <p className="finance-help">Pelo portal oficial, você emite sem cadastrar API. No Financeiro, prepare os dados e depois guarde a nota baixada do emissor.</p>
      <div className="settings-grid">
        <label className="form-field">
          <Label>Como emitir</Label>
          <NativeSelect value={settings.fiscalProvider} onChange={(event) => update("fiscalProvider", event.target.value)}>
            <NativeSelectOption value="portal_nacional">Portal nacional NFS-e — sem API</NativeSelectOption>
            <NativeSelectOption value="portal_municipal">Emissor da prefeitura — sem API</NativeSelectOption>
            <NativeSelectOption value="portal_estadual">Emissor da SEFAZ (NF-e) — sem API</NativeSelectOption>
            <NativeSelectOption value="notaas">Notaas — integração opcional</NativeSelectOption>
            <NativeSelectOption value="none">Não conectado</NativeSelectOption>
            <NativeSelectOption value="nuvem_fiscal">Nuvem Fiscal</NativeSelectOption>
            <NativeSelectOption value="focus_nfe">Focus NFe</NativeSelectOption>
            <NativeSelectOption value="plugnotas">PlugNotas</NativeSelectOption>
            <NativeSelectOption value="tecnospeed">TecnoSpeed</NativeSelectOption>
            <NativeSelectOption value="custom">Conector próprio</NativeSelectOption>
          </NativeSelect>
        </label>
        {settings.fiscalProvider.startsWith("portal_") ? <>
          {settings.fiscalProvider !== "portal_nacional" && <Field label="Endereço HTTPS do emissor autorizado" value={settings.fiscalPortalUrl} onChange={value => update("fiscalPortalUrl", value)} />}
          <p className="finance-help">Confira a atividade e os tributos no portal, conforme o cadastro da empresa. MEI usa o emissor nacional; demais empresas dependem da habilitação municipal. NF-e de produtos é emitida pelo emissor autorizado pela SEFAZ estadual.</p>
          <div className="fiscal-portal-actions"><Button asChild type="button" variant="outline"><a href={NATIONAL_NFSE_PORTAL} target="_blank" rel="noopener noreferrer">Emissor nacional</a></Button><Button asChild type="button" variant="outline"><a href={NFSE_GUIDANCE} target="_blank" rel="noopener noreferrer">Orientações oficiais</a></Button></div>
        </> : <>
        <label className="form-field">
          <Label>Ambiente</Label>
          <NativeSelect value={settings.fiscalEnvironment} onChange={(event) => update("fiscalEnvironment", event.target.value as CompanySettings["fiscalEnvironment"])}>
            <NativeSelectOption value="sandbox">Teste / homologação</NativeSelectOption>
            <NativeSelectOption value="production">Produção</NativeSelectOption>
          </NativeSelect>
        </label>
        <Field label="URL da API fiscal" value={settings.fiscalApiBaseUrl} onChange={(value) => update("fiscalApiBaseUrl", value)} />
        <Field label="API Key / token fiscal" type="password" value={settings.fiscalApiToken} onChange={(value) => update("fiscalApiToken", value)} />
        <Field label="Inscrição municipal" value={settings.fiscalMunicipalRegistration} onChange={(value) => update("fiscalMunicipalRegistration", value)} />
        <Field label="Código de serviço / CNAE" value={settings.fiscalServiceCode} onChange={(value) => update("fiscalServiceCode", value)} />
        <Field label="Regime tributário" value={settings.fiscalTaxRegime} onChange={(value) => update("fiscalTaxRegime", value)} />
        <Field label="Alíquota de ISS (%)" value={settings.fiscalIssRate} onChange={(value) => update("fiscalIssRate", value)} />
        </>}
      </div>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>OPERAÇÃO</small><h2>Regras e automações</h2></div></div>
      <div className="settings-grid">
        <Field label="Alerta de estoque baixo" type="number" value={settings.lowStockAlert} onChange={(value) => update("lowStockAlert", Number(value))} />
        <Field label="Lembrete CRM após quantos dias" type="number" value={settings.notifyCrmAfterDays} onChange={(value) => update("notifyCrmAfterDays", Number(value))} />
        <Toggle label="Exigir CPF/CNPJ no cadastro de cliente" checked={settings.requireCustomerDocument} onChange={(value) => update("requireCustomerDocument", value)} />
        <Toggle label="Permitir técnico ver valores" checked={settings.allowTechnicianPrices} onChange={(value) => update("allowTechnicianPrices", value)} />
      </div>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>WHATSAPP</small><h2>Modelos de mensagem</h2></div></div>
      <div className="settings-grid">
        <TextField label="Mensagem de orçamento" value={settings.quoteMessage} onChange={(value) => update("quoteMessage", value)} />
        <TextField label="Mensagem de lembrete de serviço" value={settings.serviceReminderMessage} onChange={(value) => update("serviceReminderMessage", value)} />
        <TextField label="Mensagem de recibo/comprovante" value={settings.receiptMessage} onChange={(value) => update("receiptMessage", value)} />
      </div>
    </section>

    <section className="surface settings-safe-box">
      <ShieldCheck />
      <p><strong>Controle isolado por empresa.</strong> Essas configurações afetam apenas a empresa ativa. O Fama Control pode ajustar a mesma tela em caso de suporte ou necessidade administrativa.</p>
    </section>
  </form>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="form-field"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="form-field span-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
