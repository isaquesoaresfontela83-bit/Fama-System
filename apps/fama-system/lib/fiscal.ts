import type { CompanySettings } from "@/lib/company-settings";
import { RequestError } from "@/lib/tenant";

export function notaasBaseUrl(settings: CompanySettings) {
  const url = new URL(settings.fiscalApiBaseUrl || "https://platform.notaas.com.br/api/v1");
  if (url.protocol !== "https:" || url.hostname !== "platform.notaas.com.br" || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/+$/, "") !== "/api/v1") {
    throw new RequestError("Use a URL oficial da API Notaas: https://platform.notaas.com.br/api/v1.", 400);
  }
  return url.href.replace(/\/+$/, "");
}

export function notaasInvoicePayload(settings: CompanySettings, invoice: Record<string, unknown>) {
  if (String(invoice.type ?? "nfse") !== "nfse") throw new RequestError("Selecione NFS-e para emitir serviços pela Notaas.", 400);
  const document = String(invoice.customerDocument ?? "").replace(/\D/g, "");
  if (![11, 14].includes(document.length)) throw new RequestError("Informe CPF ou CNPJ do tomador.", 400);
  const rate = Number(settings.fiscalIssRate.replace(",", "."));
  if (!settings.fiscalIssRate.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new RequestError("Informe a alíquota de ISS nas configurações fiscais da empresa.", 400);
  const amount = Number(invoice.amountCents);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RequestError("Informe um valor válido para a nota.", 400);
  return {
    tomador: {
      nome: String(invoice.customerName ?? ""),
      email: String(invoice.customerEmail ?? "") || undefined,
      ...(document.length === 14 ? { cnpj: document } : { cpf: document }),
    },
    servico: {
      descricao: String(invoice.serviceDescription ?? ""),
      codigo: settings.fiscalServiceCode || undefined,
      informacoesComplementares: String(invoice.notes ?? "") || undefined,
    },
    valores: { total: amount / 100, aliquotaIss: rate, issRetido: false },
    competencia: String(invoice.issueDate ?? "").slice(0, 7),
    referencia: String(invoice.id ?? ""),
    ambiente: settings.fiscalEnvironment === "production" ? "producao" : "sandbox",
  };
}

export function fiscalProviderState(payload: Record<string, unknown>, reference = "") {
  const statuses: Record<string, string> = { issued: "emitida", cancelled: "cancelada", error: "erro", queued: "processando", processing: "processando" };
  const safeUrl = (value: unknown) => {
    const text = String(value ?? "");
    try { return new URL(text).protocol === "https:" ? text.slice(0, 2000) : ""; } catch { return ""; }
  };
  return {
    status: statuses[String(payload.status ?? "queued")] ?? "processando",
    provider: "notaas",
    providerReference: String(payload.invoiceId ?? payload.id ?? reference).slice(0, 120),
    officialNumber: String(payload.numeroNfe ?? payload.numeroNfse ?? payload.number ?? payload.officialNumber ?? "").slice(0, 80),
    accessKey: String(payload.chNFSe ?? payload.accessKey ?? payload.chaveAcesso ?? "").slice(0, 120),
    xmlUrl: safeUrl(payload.xmlUrl ?? payload.xml),
    pdfUrl: safeUrl(payload.pdfUrl ?? payload.danfseUrl ?? payload.pdf),
    errorMessage: String(payload.errorMessage ?? "").slice(0, 500),
  };
}

export async function notaasRequest(settings: CompanySettings, token: string, path: string, init: RequestInit = {}) {
  if (!token || token.includes("configurado")) throw new RequestError("Cadastre a API Key da Notaas nas configurações da empresa.", 400);
  if (settings.fiscalEnvironment === "sandbox" && !token.startsWith("sk_test_")) throw new RequestError("Para testar, use a API Key de Sandbox da Notaas. Chaves de produção exigem selecionar Produção.", 400);
  if (settings.fiscalEnvironment === "production" && token.startsWith("sk_test_")) throw new RequestError("A chave informada pertence ao Sandbox. Selecione o ambiente de teste.", 400);
  const response = await fetch(`${notaasBaseUrl(settings)}${path}`, {
    ...init,
    headers: { "x-api-key": token, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) throw new RequestError("A Notaas retornou um redirecionamento inesperado.", 502);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new RequestError(String(payload.error ?? payload.message ?? "A Notaas não concluiu a solicitação."), response.status >= 400 && response.status < 500 ? response.status : 502);
  return payload;
}
