"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Copy, ExternalLink, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NFSE_GUIDANCE, portalForInvoice, portalInvoiceText, safePortalUrl, type FiscalInvoice, type FiscalPortalSettings, type PortalProvider } from "@/lib/fiscal-portal";
import { RecordAttachments } from "./record-attachments";

type FiscalAttachment = { id: string; fileName: string; mimeType: string; metadata?: { provider: PortalProvider; officialNumber: string; accessKey: string } };

export function FiscalPortalPanel({ invoice, settings, organizationId, onClose, onSaved }: { invoice: FiscalInvoice; settings: FiscalPortalSettings; organizationId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const initial = portalForInvoice(invoice, settings);
  const [provider, setProvider] = useState<PortalProvider>(initial.provider);
  const [portalUrl, setPortalUrl] = useState(initial.provider === "portal_nacional" ? "" : initial.url);
  const [officialNumber, setOfficialNumber] = useState(invoice.officialNumber);
  const [accessKey, setAccessKey] = useState(invoice.accessKey);
  const [attachment, setAttachment] = useState<FiscalAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [cancellationConfirmed, setCancellationConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const draft = invoice.status === "rascunho";
  const portal = portalForInvoice({ ...invoice, provider, providerReference: "" }, { ...settings, provider, fiscalPortalUrl: safePortalUrl(portalUrl) });
  const headers = { "x-organization-id": organizationId };

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ entity: "fiscalInvoices", entityId: invoice.id });
    fetch(`/api/attachments?${query}`, { headers: { "x-organization-id": organizationId }, cache: "no-store" }).then(async response => {
      const result = await response.json() as { attachments?: FiscalAttachment[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os documentos.");
      const file = result.attachments?.find(item => ["application/pdf", "application/xml"].includes(item.mimeType));
      if (active && file) {
        setAttachment(file);
        if (draft && file.metadata?.accessKey) { setOfficialNumber(file.metadata.officialNumber); setAccessKey(file.metadata.accessKey); setProvider(file.metadata.provider); }
      }
    }).catch(error => { if (active) toast.error(error instanceof Error ? error.message : "Falha ao carregar os documentos."); }).finally(() => { if (active) setLoadingFiles(false); });
    return () => { active = false; };
  }, [invoice.id, organizationId, draft]);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("Copiado. Cole no portal oficial."); }
    catch { toast.error("Não foi possível copiar. Selecione e copie o texto exibido."); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = new FormData(); data.set("entity", "fiscalInvoices"); data.set("entityId", invoice.id); data.set("file", file);
      const response = await fetch("/api/attachments", { method: "POST", headers, body: data });
      const result = await response.json() as { attachment?: FiscalAttachment; fiscalMetadata?: FiscalAttachment["metadata"]; error?: string };
      if (!response.ok || !result.attachment) throw new Error(result.error || "Não foi possível anexar o documento.");
      setAttachment(result.attachment);
      if (result.fiscalMetadata) { setOfficialNumber(result.fiscalMetadata.officialNumber); setAccessKey(result.fiscalMetadata.accessKey); setProvider(result.fiscalMetadata.provider); }
      setConfirmed(false);
      toast.success(result.fiscalMetadata ? "XML conferido; número e chave preenchidos." : "PDF guardado. Informe o número e a chave da nota.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao anexar o documento."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/finance", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "registerPortalInvoice", id: invoice.id, provider, portalUrl, officialNumber, accessKey, attachmentId: attachment?.id, productionConfirmed: confirmed }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a nota.");
      toast.success("Nota registrada com o documento oficial."); await onSaved(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao registrar a nota."); }
    finally { setBusy(false); }
  }

  async function registerCancellation() {
    setBusy(true);
    try {
      const response = await fetch("/api/finance", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "registerPortalCancellation", id: invoice.id, productionConfirmed: cancellationConfirmed }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar o cancelamento.");
      toast.success("Cancelamento registrado no histórico."); await onSaved(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao registrar o cancelamento."); }
    finally { setBusy(false); }
  }

  const copies = [
    ["CPF/CNPJ do prestador", settings.document || "Conferir no portal"],
    ["Cliente", invoice.customerName], ["CPF/CNPJ do cliente", invoice.customerDocument || "Não informado"],
    ["Descrição", invoice.serviceDescription], ["Valor do serviço/produto", (invoice.amountCents / 100).toFixed(2).replace(".", ",")],
    ["Data/competência", invoice.issueDate], ...(invoice.city ? [["Município da prestação", invoice.city]] : []),
  ];

  return <Sheet open onOpenChange={open => !open && !busy && onClose()}><SheetContent className="fiscal-portal-sheet sm:max-w-2xl">
    <SheetHeader><SheetTitle>{draft ? "Emitir pelo portal oficial" : `Nota ${invoice.officialNumber || "registrada"}`}</SheetTitle><SheetDescription>{invoice.customerName} · {(invoice.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</SheetDescription></SheetHeader>
    <div className="fiscal-portal-content">
      {draft && <section className="fiscal-step"><h3>1. Dados prontos para copiar</h3><p>Confira a empresa e os dados do cliente. Selecione a atividade e a tributação conforme seu cadastro no emissor oficial.</p>
        <dl className="fiscal-copy-list">{copies.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><span>{value}</span><Button type="button" variant="ghost" size="icon-sm" aria-label={`Copiar ${label}`} onClick={() => void copy(value)}><Copy /></Button></dd></div>)}</dl>
        <Button type="button" variant="outline" onClick={() => void copy(portalInvoiceText(invoice, settings))}><Copy />Copiar todos os dados</Button>
      </section>}
      <section className="fiscal-step"><h3>{draft ? "2. Emitir no portal" : "Documento e consulta"}</h3>
        {draft && invoice.type === "nfse" && <label className="form-field"><Label>Onde sua empresa emite NFS-e</Label><NativeSelect value={provider} onChange={event => { setProvider(event.target.value as PortalProvider); setConfirmed(false); }}><NativeSelectOption value="portal_nacional">Emissor nacional</NativeSelectOption><NativeSelectOption value="portal_municipal">Emissor da prefeitura</NativeSelectOption></NativeSelect></label>}
        {draft && provider !== "portal_nacional" && <label className="form-field"><Label>{provider === "portal_municipal" ? "Endereço do emissor autorizado pela prefeitura" : "Endereço do emissor da SEFAZ (opcional)"}</Label><Input type="url" placeholder="https://…" value={portalUrl} onChange={event => setPortalUrl(event.target.value)} /></label>}
        <p>{invoice.type === "nfe" ? "Para produtos, emita a NF-e no emissor autorizado pela SEFAZ do seu estado." : "MEI usa o emissor nacional. Outras empresas usam o emissor habilitado pelo município. Entre com o acesso do titular, confira os dados e confirme a emissão em produção."}</p>
        <div className="fiscal-portal-actions">{portal.url ? <Button asChild><a href={portal.url} target="_blank" rel="noopener noreferrer"><ExternalLink />{portal.label}</a></Button> : <p>Informe o endereço do emissor da prefeitura para abrir.</p>}
          {invoice.type === "nfse" && <Button asChild variant="outline"><a href={NFSE_GUIDANCE} target="_blank" rel="noopener noreferrer">Orientações oficiais</a></Button>}
        </div>
        {!draft && <><p className="fiscal-key">Chave / código: {invoice.accessKey}</p><div className="fiscal-portal-actions"><Button variant="outline" onClick={() => void copy(invoice.accessKey)}><Copy />Copiar chave</Button>{portal.consultation && <Button asChild variant="outline"><a href={portal.consultation} target="_blank" rel="noopener noreferrer"><ExternalLink />Consultar autenticidade</a></Button>}</div><p>A situação fiscal atual é consultada no portal oficial.</p><RecordAttachments organizationId={organizationId} entity="fiscalInvoices" recordId={invoice.id} canDelete={false} /></>}
      </section>
      {draft && <form className="fiscal-step" onSubmit={save}><h3>3. Guardar a nota emitida</h3><p>Baixe o PDF ou XML no portal. O XML preenche o número e a chave e confere os dados com este rascunho.</p>
        <label className="form-field"><Label>Documento oficial</Label><Input type="file" accept="application/pdf,.xml" onChange={event => void upload(event)} disabled={busy || loadingFiles} /></label>
        {attachment && <p className="fiscal-file-saved"><FileCheck2 />{attachment.fileName} guardado</p>}
        <label className="form-field"><Label>Número da nota</Label><Input required value={officialNumber} maxLength={80} onChange={event => { setOfficialNumber(event.target.value); setConfirmed(false); }} /></label>
        <label className="form-field"><Label>{provider === "portal_municipal" ? "Chave ou código de verificação" : `Chave de acesso (${provider === "portal_nacional" ? 50 : 44} dígitos)`}</Label><Input required value={accessKey} maxLength={120} onChange={event => { setAccessKey(event.target.value); setConfirmed(false); }} /></label>
        <div className="fiscal-portal-actions"><Button type="button" variant="outline" disabled={!accessKey} onClick={() => void copy(accessKey)}><Copy />Copiar chave</Button>{portal.consultation && <Button asChild type="button" variant="outline"><a href={portal.consultation} target="_blank" rel="noopener noreferrer"><ExternalLink />Consultar no portal</a></Button>}</div>
        <label className="fiscal-confirm"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Emiti a nota em produção, conferi empresa, cliente e valor e consultei a autenticidade e a situação no portal oficial.</label>
        <Button disabled={busy || loadingFiles || !attachment || !confirmed}>{busy ? <Loader2 className="spin-icon" /> : <FileCheck2 />}Registrar nota emitida</Button>
        <p className="finance-help">O rascunho é uma preparação. A nota fiscal válida é o documento emitido pelo portal autorizado.</p>
      </form>}
      {invoice.status === "registrada" && <section className="fiscal-step"><Button variant="outline" onClick={() => setCancelling(value => !value)}>Registrar cancelamento no histórico</Button>{cancelling && <><p>Cancele primeiro no emissor e aguarde a confirmação oficial. Depois, atualize este registro.</p><label className="fiscal-confirm"><input type="checkbox" checked={cancellationConfirmed} onChange={event => setCancellationConfirmed(event.target.checked)} />Conferi que o cancelamento foi efetivado no portal oficial.</label><Button variant="destructive" disabled={busy || !cancellationConfirmed} onClick={() => void registerCancellation()}>Guardar cancelamento confirmado</Button></>}</section>}
    </div>
  </SheetContent></Sheet>;
}
