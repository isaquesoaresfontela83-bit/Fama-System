import type { CompanySettings } from "@/lib/company-settings";

export const NATIONAL_NFSE_PORTAL = "https://www.nfse.gov.br/EmissorNacional/";
export const NATIONAL_NFSE_CONSULTATION = "https://www.nfse.gov.br/ConsultaPublica/";
export const NFSE_GUIDANCE = "https://www.gov.br/pt-br/servicos/emitir-nota-fiscal-de-servico-eletronica";
export const NFE_PORTAL = "https://www.nfe.fazenda.gov.br/portal/principal.aspx";
export const NFE_CONSULTATION = "https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ%2BgAVw2g%3D";

export type PortalProvider = "portal_nacional" | "portal_municipal" | "portal_estadual";
export type FiscalInvoice = {
  id: string; type: "nfse" | "nfe";
  status: "rascunho" | "registrada" | "processando" | "emitida" | "cancelada" | "cancelando" | "erro";
  customerName: string; customerDocument: string; customerEmail: string;
  serviceDescription: string; city: string; amountCents: number; issueDate: string;
  officialNumber: string; accessKey: string; xmlUrl: string; pdfUrl: string;
  provider: string; providerReference: string; notes: string; createdAt: string;
};
export type FiscalPortalSettings = Pick<CompanySettings, "legalName" | "document" | "address" | "phone" | "email" | "fiscalPortalUrl"> & { provider: string; apiEnabled: boolean };

export function safePortalUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href.slice(0, 2000);
  } catch { return ""; }
}

export function fiscalPortalSettings(settings: CompanySettings): FiscalPortalSettings {
  return {
    legalName: settings.legalName, document: settings.document, address: settings.address,
    phone: settings.phone, email: settings.email, fiscalPortalUrl: safePortalUrl(settings.fiscalPortalUrl),
    provider: settings.fiscalProvider, apiEnabled: settings.fiscalProvider === "notaas" && Boolean(settings.fiscalApiToken),
  };
}

export function portalForInvoice(invoice: Pick<FiscalInvoice, "type" | "provider"> & { providerReference?: string }, settings: FiscalPortalSettings) {
  let savedUrl = "";
  try { savedUrl = safePortalUrl(JSON.parse(invoice.providerReference || "{}").portalUrl); } catch { /* Provider references from older connectors are opaque. */ }
  if (invoice.type === "nfe") {
    const issuerUrl = savedUrl || (settings.provider === "portal_estadual" ? settings.fiscalPortalUrl : "");
    return { provider: "portal_estadual" as const, url: issuerUrl || NFE_PORTAL, consultation: NFE_CONSULTATION, label: issuerUrl ? "Abrir emissor da SEFAZ" : "Orientações da SEFAZ" };
  }
  const municipal = invoice.provider === "portal_municipal" || (!invoice.provider && settings.provider === "portal_municipal");
  return municipal
    ? { provider: "portal_municipal" as const, url: savedUrl || settings.fiscalPortalUrl, consultation: savedUrl || settings.fiscalPortalUrl, label: "Abrir emissor municipal" }
    : { provider: "portal_nacional" as const, url: NATIONAL_NFSE_PORTAL, consultation: NATIONAL_NFSE_CONSULTATION, label: "Abrir emissor nacional" };
}

export function portalInvoiceText(invoice: FiscalInvoice, settings: FiscalPortalSettings) {
  return [
    "DADOS PARA EMISSÃO NO PORTAL OFICIAL — RASCUNHO",
    `Prestador: ${settings.legalName || "Conferir no portal"}`,
    `CPF/CNPJ do prestador: ${settings.document || "Conferir no portal"}`,
    `Tomador: ${invoice.customerName}`, `CPF/CNPJ do tomador: ${invoice.customerDocument || "Não informado"}`,
    invoice.customerEmail ? `E-mail do tomador: ${invoice.customerEmail}` : "",
    `Data/competência: ${invoice.issueDate}`, invoice.city ? `Município da prestação: ${invoice.city}` : "",
    `Descrição: ${invoice.serviceDescription}`,
    `Valor: ${(invoice.amountCents / 100).toFixed(2).replace(".", ",")}`,
    invoice.notes ? `Informações complementares: ${invoice.notes}` : "",
  ].filter(Boolean).join("\n");
}

export function portalRegistration(body: Record<string, unknown>, invoiceType: string) {
  const provider = String(body.provider || "");
  if (invoiceType === "nfe" ? provider !== "portal_estadual" : !["portal_nacional", "portal_municipal"].includes(provider)) throw new Error("Selecione o portal correspondente ao tipo da nota.");
  if (body.productionConfirmed !== true) throw new Error("Confirme a emissão e a consulta da nota no portal oficial de produção.");
  const officialNumber = String(body.officialNumber || "").trim();
  if (!officialNumber || officialNumber.length > 80) throw new Error("Informe o número da nota emitida.");
  const accessKey = String(body.accessKey || "").replace(/\s/g, "");
  if (provider === "portal_nacional" && !/^\d{50}$/.test(accessKey)) throw new Error("A chave da NFS-e nacional deve conter 50 dígitos.");
  if (provider === "portal_estadual" && !/^\d{44}$/.test(accessKey)) throw new Error("A chave da NF-e deve conter 44 dígitos.");
  if (provider === "portal_municipal" && (!/^[a-zA-Z0-9._/-]{3,120}$/.test(accessKey))) throw new Error("Informe a chave ou o código de verificação do emissor municipal.");
  const attachmentId = String(body.attachmentId || "").trim();
  if (!attachmentId) throw new Error("Anexe o PDF ou XML baixado do portal oficial.");
  const portalUrl = provider === "portal_nacional" ? NATIONAL_NFSE_PORTAL : safePortalUrl(body.portalUrl);
  if (provider === "portal_municipal" && !portalUrl) throw new Error("Informe o endereço HTTPS do emissor autorizado pela prefeitura.");
  return { provider: provider as PortalProvider, officialNumber, accessKey, attachmentId, portalUrl };
}
