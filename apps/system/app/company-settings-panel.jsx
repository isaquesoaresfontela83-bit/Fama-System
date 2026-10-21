"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption, } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { defaultCompanySettings } from "@/lib/company-settings";
import { fiscalProviders } from "@/lib/integration-providers";
import { lookupProviders } from "@/lib/registration-lookup";
import { NFSE_GUIDANCE, NATIONAL_NFSE_PORTAL } from "@/lib/fiscal-portal";
import { CompanyWeatherSettings } from "./company-weather-settings";
import { FamaWhatsappPanel } from './fama-whatsapp-panel';
import { BaileysPanel } from './baileys-panel';
import { planIncludesFeature } from '@/lib/plan-features';
import { SelectedIntegrationsPanel } from './selected-integrations-panel';
export function CompanySettingsPanel({ organization }) {
    const freightEnabled = planIncludesFeature(organization.plan, 'freight');
    const invoicesEnabled = planIncludesFeature(organization.plan, 'invoices');
    const [settings, setSettings] = useState(defaultCompanySettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [reload, setReload] = useState(0);
    useEffect(() => {
        let disposed = false;
        fetch("/api/company-settings", { headers: { "x-organization-id": organization.id }, cache: "no-store" })
            .then(async (response) => {
            const payload = await response.json();
            if (!response.ok || !payload.settings)
                throw new Error(payload.error ?? "Não foi possível carregar as configurações.");
            if (!disposed) {
                setSettings(payload.settings);
                setLoadError("");
            }
        })
            .catch((error) => { if (!disposed)
            setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as configurações da empresa."); })
            .finally(() => { if (!disposed)
            setLoading(false); });
        return () => { disposed = true; };
    }, [organization.id, organization.plan, reload]);
    const update = (key, value) => {
        setSettings((current) => ({ ...current, [key]: value }));
    };
    async function save(event) {
        event.preventDefault();
        setSaving(true);
        try {
            const response = await fetch("/api/company-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-organization-id": organization.id },
                body: JSON.stringify({ settings }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.settings)
                throw new Error(payload.error ?? "Não foi possível salvar.");
            setSettings(payload.settings);
            toast.success("Configurações da empresa salvas.");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
        }
        finally {
            setSaving(false);
        }
    }
    if (loading)
        return <div className="loading"><i /><p>Carregando configurações…</p></div>;
    if (loadError)
        return <section className="surface settings-section"><p role="alert">{loadError}</p><Button onClick={() => { setLoading(true); setReload(value => value + 1); }}>Tentar novamente</Button></section>;
    return <div className="company-settings-layout"><form className="company-settings-layout" onSubmit={save}>
    <section className="surface settings-hero">
      <Settings2 />
      <div><small>CONFIGURAÇÕES DA EMPRESA</small><h2>{organization.name}</h2><p>Controle dados usados em PDFs, mensagens, financeiro, estoque e regras internas desta empresa.</p></div>
      <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="spin-icon"/>Salvando</> : <><Save />Salvar</>}</Button>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>IDENTIDADE</small><h2>Dados da empresa</h2></div></div>
      <div className="settings-grid">
        <Field label="Razão social / nome para documentos" value={settings.legalName} onChange={(value) => update("legalName", value)}/>
        <Field label="CPF/CNPJ" value={settings.document} onChange={(value) => update("document", value)}/>
        <Field label="Telefone" value={settings.phone} onChange={(value) => update("phone", value)}/>
        <Field label="WhatsApp" value={settings.whatsapp} onChange={(value) => update("whatsapp", value)}/>
        <Field label="E-mail" type="email" value={settings.email} onChange={(value) => update("email", value)}/>
        <Field label="Logo URL" value={settings.logoUrl} onChange={(value) => update("logoUrl", value)}/>
        <TextField label="Endereço" value={settings.address} onChange={(value) => update("address", value)}/>
      </div>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>CONSULTAS DE CADASTRO</small><h2>APIs disponíveis</h2></div></div>
      <p>Em Clientes e piscinas, abra Novo cliente para consultar CEP ou CNPJ e revisar os dados antes de usá-los no cadastro. CNPJ e CEP não precisam de chave.</p>

      <div className="settings-grid">{lookupProviders.map(provider => <div key={provider.id}><strong>{provider.label}</strong><p>{provider.types.join(' e ').toUpperCase()}{provider.id === 'receitaws' ? ' · até 3 consultas por minuto' : ''}</p></div>)}</div>
    </section>

    {freightEnabled && <section className="surface settings-section">
      <div className="panel-heading"><div><small>FRETE</small><h2>Origem e valor por quilômetro</h2></div></div>
      <div className="settings-grid">
        <Field label="CEP de origem" value={settings.freightOriginCep} onChange={value => update("freightOriginCep", value)}/>
        <label className="form-field"><Label>Valor por km (R$)</Label><Input type="number" min="0" max="10000" step="0.01" value={settings.freightRateCentsPerKm / 100} onChange={event => update("freightRateCentsPerKm", Math.round(Number(event.target.value) * 100))}/></label>
      </div>
    </section>}

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>DOCUMENTOS</small><h2>Textos padrão</h2></div></div>
      <div className="settings-grid">
        <TextField label="Condições padrão do orçamento" value={settings.quoteTerms} onChange={(value) => update("quoteTerms", value)}/>
        {planIncludesFeature(organization.plan, 'contracts') && <TextField label="Cláusulas padrão de contrato" value={settings.contractTerms} onChange={(value) => update("contractTerms", value)}/>}
        {planIncludesFeature(organization.plan, 'warranties') && <TextField label="Termo padrão de garantia" value={settings.warrantyTerms} onChange={(value) => update("warrantyTerms", value)}/>}
        <Field label="Condição de pagamento padrão" value={settings.defaultPaymentTerms} onChange={(value) => update("defaultPaymentTerms", value)}/>
        <Field label="Validade padrão do orçamento (dias)" type="number" value={settings.defaultQuoteValidityDays} onChange={(value) => update("defaultQuoteValidityDays", Number(value))}/>
      </div>
    </section>

    {invoicesEnabled && <section className="surface settings-section">
      <div className="panel-heading"><div><small>FISCAL</small><h2>Emissão oficial de nota fiscal</h2></div></div>
      <p className="finance-help">Emita NFS-e pela Asaas ou registre documentos emitidos pelo portal oficial.</p>
      <div className="settings-grid">
        <label className="form-field">
          <Label>Como emitir</Label>
          <NativeSelect value={settings.fiscalProvider} onChange={(event) => update("fiscalProvider", event.target.value)}>
            {fiscalProviders.map(provider => <NativeSelectOption key={provider.id} value={provider.id}>{provider.label}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        {settings.fiscalProvider.startsWith("portal_") ? <>
          {settings.fiscalProvider !== "portal_nacional" && <Field label="Endereço HTTPS do emissor autorizado" value={settings.fiscalPortalUrl} onChange={value => update("fiscalPortalUrl", value)}/>}
          <p className="finance-help">Confira a atividade e os tributos no portal, conforme o cadastro da empresa. MEI usa o emissor nacional; demais empresas dependem da habilitação municipal. NF-e de produtos é emitida pelo emissor autorizado pela SEFAZ estadual.</p>
          <div className="fiscal-portal-actions"><Button asChild type="button" variant="outline"><a href={NATIONAL_NFSE_PORTAL} target="_blank" rel="noopener noreferrer">Emissor nacional</a></Button><Button asChild type="button" variant="outline"><a href={NFSE_GUIDANCE} target="_blank" rel="noopener noreferrer">Orientações oficiais</a></Button></div>
        </> : settings.fiscalProvider === "asaas" ? <>
        <label className="form-field">
          <Label>Ambiente</Label>
          <NativeSelect value={settings.fiscalEnvironment} onChange={(event) => update("fiscalEnvironment", event.target.value)}>
            <NativeSelectOption value="sandbox">Teste / homologação</NativeSelectOption>
            <NativeSelectOption value="production">Produção</NativeSelectOption>
          </NativeSelect>
        </label>
        <Field label="Chave API Asaas da empresa" type="password" value={settings.fiscalApiToken} onChange={(value) => update("fiscalApiToken", value)}/>
        <Field label="Inscrição municipal" value={settings.fiscalMunicipalRegistration} onChange={(value) => update("fiscalMunicipalRegistration", value)}/>
        {settings.fiscalProvider === "asaas" && <label className="form-field">
          <Label>Identificação do serviço na Asaas</Label>
          <NativeSelect value={settings.fiscalServiceCodeType} onChange={(event) => update("fiscalServiceCodeType", event.target.value)}>
            <NativeSelectOption value="code">Código municipal / Portal Nacional</NativeSelectOption>
            <NativeSelectOption value="id">ID retornado pela Asaas</NativeSelectOption>
          </NativeSelect>
        </label>}
        <Field label={settings.fiscalProvider === "asaas" ? "Código ou ID do serviço municipal" : "Código de serviço / CNAE"} value={settings.fiscalServiceCode} onChange={(value) => update("fiscalServiceCode", value)}/>
        <Field label="Regime tributário" value={settings.fiscalTaxRegime} onChange={(value) => update("fiscalTaxRegime", value)}/>
        <Field label="Alíquota de ISS (%)" value={settings.fiscalIssRate} onChange={(value) => update("fiscalIssRate", value)}/>
        {settings.fiscalProvider === "asaas" && <>
          <Toggle label="ISS retido pelo tomador" checked={settings.fiscalRetainIss} onChange={(value) => update("fiscalRetainIss", value)}/>
          <Field label="COFINS (%)" value={settings.fiscalCofinsRate} onChange={(value) => update("fiscalCofinsRate", value)}/>
          <Field label="CSLL (%)" value={settings.fiscalCsllRate} onChange={(value) => update("fiscalCsllRate", value)}/>
          <Field label="INSS (%)" value={settings.fiscalInssRate} onChange={(value) => update("fiscalInssRate", value)}/>
          <Field label="IR (%)" value={settings.fiscalIrRate} onChange={(value) => update("fiscalIrRate", value)}/>
          <Field label="PIS (%)" value={settings.fiscalPisRate} onChange={(value) => update("fiscalPisRate", value)}/>
          <p className="finance-help">Habilite a emissão fiscal na conta Asaas e confira os tributos com a contabilidade. A confirmação automática é configurada na conta da empresa ao emitir a primeira nota.</p>
        </>}
        </> : null}
      </div>
    </section>}

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>OPERAÇÃO</small><h2>Regras e automações</h2></div></div>
      <div className="settings-grid">
        <Field label="Alerta de estoque baixo" type="number" value={settings.lowStockAlert} onChange={(value) => update("lowStockAlert", Number(value))}/>
        <Field label="Lembrete CRM após quantos dias" type="number" value={settings.notifyCrmAfterDays} onChange={(value) => update("notifyCrmAfterDays", Number(value))}/>
        <Toggle label="Exigir CPF/CNPJ no cadastro de cliente" checked={settings.requireCustomerDocument} onChange={(value) => update("requireCustomerDocument", value)}/>
        <Toggle label="Permitir técnico ver valores" checked={settings.allowTechnicianPrices} onChange={(value) => update("allowTechnicianPrices", value)}/>
      </div>
    </section>

    <section className="surface settings-section">
      <div className="panel-heading"><div><small>WHATSAPP</small><h2>Modelos de mensagem</h2></div></div>
      <div className="settings-grid">
        <TextField label="Mensagem de orçamento" value={settings.quoteMessage} onChange={(value) => update("quoteMessage", value)}/>
        <TextField label="Mensagem de lembrete de serviço" value={settings.serviceReminderMessage} onChange={(value) => update("serviceReminderMessage", value)}/>
        <TextField label="Mensagem de recibo/comprovante" value={settings.receiptMessage} onChange={(value) => update("receiptMessage", value)}/>
      </div>
    </section>

    <section className="surface settings-safe-box">
      <ShieldCheck />
      <p><strong>Controle isolado por empresa.</strong> Essas configurações afetam apenas a empresa ativa. O Fama Control pode ajustar a mesma tela em caso de suporte ou necessidade administrativa.</p>
    </section>
  </form><BaileysPanel key={organization.id+':baileys'} organizationId={organization.id} canManage={true}/><SelectedIntegrationsPanel key={organization.id + ':integrations'} organizationId={organization.id}/><CompanyWeatherSettings key={organization.id + ":weather"} organizationId={organization.id}/>{planIncludesFeature(organization.plan, 'assistant') && <FamaWhatsappPanel key={organization.id} organizationId={organization.id}/>}</div>;
}
function Field({ label, value, onChange, type = "text" }) {
    return <label className="form-field"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)}/></label>;
}
function TextField({ label, value, onChange }) {
    return <label className="form-field span-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)}/></label>;
}
function Toggle({ label, checked, onChange }) {
    return <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span>{label}</span></label>;
}
