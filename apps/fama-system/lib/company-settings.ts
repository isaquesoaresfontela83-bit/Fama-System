export type CompanySettings = {
  legalName: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  logoUrl: string;
  quoteTerms: string;
  contractTerms: string;
  warrantyTerms: string;
  defaultPaymentTerms: string;
  defaultQuoteValidityDays: number;
  receiptMessage: string;
  quoteMessage: string;
  serviceReminderMessage: string;
  lowStockAlert: number;
  allowTechnicianPrices: boolean;
  requireCustomerDocument: boolean;
  notifyCrmAfterDays: number;
  fiscalProvider: string;
  fiscalEnvironment: "sandbox" | "production";
  fiscalApiBaseUrl: string;
  fiscalApiToken: string;
  fiscalMunicipalRegistration: string;
  fiscalServiceCode: string;
  fiscalTaxRegime: string;
  fiscalIssRate: string;
  fiscalPortalUrl: string;
};

export const defaultCompanySettings: CompanySettings = {
  legalName: "",
  document: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  logoUrl: "",
  quoteTerms: "Proposta sujeita a confirmação técnica, disponibilidade de agenda e aprovação do cliente.",
  contractTerms: "Serviços executados conforme escopo aprovado, com responsabilidades e prazos acordados entre as partes.",
  warrantyTerms: "Garantia válida conforme item contratado, mediante uso correto e manutenção adequada.",
  defaultPaymentTerms: "Pix ou transferência na aprovação do orçamento.",
  defaultQuoteValidityDays: 7,
  receiptMessage: "Olá! Segue o comprovante/recibo referente ao serviço realizado. Obrigado pela confiança.",
  quoteMessage: "Olá! Segue sua proposta. Qualquer dúvida, fico à disposição.",
  serviceReminderMessage: "Olá! Passando para lembrar do atendimento agendado.",
  lowStockAlert: 3,
  allowTechnicianPrices: false,
  requireCustomerDocument: false,
  notifyCrmAfterDays: 3,
  fiscalProvider: "portal_nacional",
  fiscalEnvironment: "sandbox",
  fiscalApiBaseUrl: "",
  fiscalApiToken: "",
  fiscalMunicipalRegistration: "",
  fiscalServiceCode: "",
  fiscalTaxRegime: "",
  fiscalIssRate: "",
  fiscalPortalUrl: "",
};

export function normalizeCompanySettings(value: unknown): CompanySettings {
  const input = typeof value === "object" && value ? value as Partial<CompanySettings> : {};
  const numberValue = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    legalName: String(input.legalName ?? ""),
    document: String(input.document ?? ""),
    phone: String(input.phone ?? ""),
    whatsapp: String(input.whatsapp ?? ""),
    email: String(input.email ?? ""),
    address: String(input.address ?? ""),
    logoUrl: String(input.logoUrl ?? ""),
    quoteTerms: String(input.quoteTerms ?? defaultCompanySettings.quoteTerms),
    contractTerms: String(input.contractTerms ?? defaultCompanySettings.contractTerms),
    warrantyTerms: String(input.warrantyTerms ?? defaultCompanySettings.warrantyTerms),
    defaultPaymentTerms: String(input.defaultPaymentTerms ?? defaultCompanySettings.defaultPaymentTerms),
    defaultQuoteValidityDays: numberValue(input.defaultQuoteValidityDays, defaultCompanySettings.defaultQuoteValidityDays),
    receiptMessage: String(input.receiptMessage ?? defaultCompanySettings.receiptMessage),
    quoteMessage: String(input.quoteMessage ?? defaultCompanySettings.quoteMessage),
    serviceReminderMessage: String(input.serviceReminderMessage ?? defaultCompanySettings.serviceReminderMessage),
    lowStockAlert: numberValue(input.lowStockAlert, defaultCompanySettings.lowStockAlert),
    allowTechnicianPrices: Boolean(input.allowTechnicianPrices),
    requireCustomerDocument: Boolean(input.requireCustomerDocument),
    notifyCrmAfterDays: numberValue(input.notifyCrmAfterDays, defaultCompanySettings.notifyCrmAfterDays),
    fiscalProvider: String(input.fiscalProvider ?? defaultCompanySettings.fiscalProvider),
    fiscalEnvironment: input.fiscalEnvironment === "production" ? "production" : "sandbox",
    fiscalApiBaseUrl: String(input.fiscalApiBaseUrl ?? ""),
    fiscalApiToken: String(input.fiscalApiToken ?? ""),
    fiscalMunicipalRegistration: String(input.fiscalMunicipalRegistration ?? ""),
    fiscalServiceCode: String(input.fiscalServiceCode ?? ""),
    fiscalTaxRegime: String(input.fiscalTaxRegime ?? ""),
    fiscalIssRate: String(input.fiscalIssRate ?? ""),
    fiscalPortalUrl: String(input.fiscalPortalUrl ?? ""),
  };
}
