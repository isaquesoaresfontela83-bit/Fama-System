import { cents, database, optionalText } from "@/lib/database";
import { defaultCompanySettings, normalizeCompanySettings } from "@/lib/company-settings";
import { camelizeRow, deleteRows, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError, RequestError } from "@/lib/tenant";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { parseBankStatementCsv } from "@/lib/bank-statement";
import { decryptRecordFields, decryptText, encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { ensureFinanceSchema } from "@/lib/finance-schema";
import { fiscalProviderState, notaasInvoicePayload, notaasRequest } from "@/lib/fiscal";
import { fiscalPortalSettings, portalRegistration, safePortalUrl } from "@/lib/fiscal-portal";

function need(value: unknown, label: string) {
  const text = optionalText(value);
  if (!text) throw new RequestError(`${label} é obrigatório.`, 400);
  return text;
}

function optionalDate(value: unknown, label: string) {
  const date = optionalText(value);
  if (!date) return "";
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts || new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))).toISOString().slice(0, 10) !== date) {
    throw new RequestError(`${label} inválida.`, 400);
  }
  return date;
}

function toSupplier(values: Record<string, unknown>, id: string, organizationId: string, createdAt: string) {
  return { id, organizationId, name: need(values.name, "Nome do fornecedor").slice(0, 160), document: optionalText(values.document).replace(/\D/g, "").slice(0, 14), email: optionalText(values.email).slice(0, 254), phone: optionalText(values.phone).slice(0, 32), notes: optionalText(values.notes).slice(0, 2000), createdAt, updatedAt: createdAt };
}

async function readCompanySettings(organizationId: string) {
  await database().prepare(`CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id TEXT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  const row = await database().prepare("SELECT settings_json AS settingsJson FROM organization_settings WHERE organization_id = ?")
    .bind(organizationId).first<{ settingsJson: string }>();
  return normalizeCompanySettings(row?.settingsJson ? JSON.parse(row.settingsJson) : defaultCompanySettings);
}

async function issueThroughNotaas(settings: Awaited<ReturnType<typeof readCompanySettings>>, token: string, invoice: Record<string, unknown>) {
  const body = notaasInvoicePayload(settings, invoice);
  const payload = await notaasRequest(settings, token, "/emitir", { method: "POST", body: JSON.stringify(body) });
  const state = fiscalProviderState(payload);
  if (!state.providerReference) throw new RequestError("A Notaas não retornou a referência da emissão. Confira o envio no painel fiscal antes de tentar novamente.", 502);
  return state;
}

async function issueThroughFiscalProvider(organizationId: string, invoice: Record<string, unknown>) {
  const settings = await readCompanySettings(organizationId);
  if (settings.fiscalProvider.startsWith("portal_") || !settings.fiscalApiToken)
    throw new RequestError("Emita pelo portal oficial e use Registrar nota emitida para guardar o documento no Fama.", 400);
  if (!settings.fiscalProvider || settings.fiscalProvider === "none")
    throw new RequestError("Configure um provedor fiscal nas configurações da empresa antes de emitir oficialmente.", 400);
  if (settings.fiscalProvider !== "notaas" && !settings.fiscalApiBaseUrl)
    throw new RequestError("Informe a URL da API fiscal da empresa.", 400);
  if (!settings.fiscalApiToken)
    throw new RequestError("Informe a API Key/token fiscal da empresa.", 400);
  const fiscalApiToken = await decryptText(settings.fiscalApiToken);
  if (!fiscalApiToken || fiscalApiToken.includes("configurado"))
    throw new RequestError("Reinforme e salve o token fiscal antes de emitir oficialmente.", 400);
  if (settings.fiscalProvider === "notaas") return await issueThroughNotaas(settings, fiscalApiToken, invoice);
  const endpoint = `${settings.fiscalApiBaseUrl.replace(/\/+$/, "")}/fiscal/invoices`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${fiscalApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: settings.fiscalProvider,
      environment: settings.fiscalEnvironment,
      municipalRegistration: settings.fiscalMunicipalRegistration,
      serviceCode: settings.fiscalServiceCode,
      taxRegime: settings.fiscalTaxRegime,
      invoice,
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status >= 300 && response.status < 400) throw new RequestError("O provedor fiscal retornou um redirecionamento inesperado.", 502);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok)
    throw new RequestError(String(payload.error ?? payload.message ?? "O provedor fiscal recusou a emissão."), response.status >= 400 && response.status < 500 ? response.status : 502);
  return {
    ...fiscalProviderState(payload),
    provider: settings.fiscalProvider,
    providerReference: optionalText(payload.id ?? payload.reference ?? payload.providerReference).slice(0, 120),
    officialNumber: optionalText(payload.number ?? payload.officialNumber).slice(0, 80),
    accessKey: optionalText(payload.accessKey ?? payload.chaveAcesso).slice(0, 120),
    xmlUrl: safePortalUrl(payload.xmlUrl ?? payload.xml),
    pdfUrl: safePortalUrl(payload.pdfUrl ?? payload.danfeUrl ?? payload.danfseUrl),
  };
}

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
    await ensureFinanceSchema();
    const result = usesSupabase()
      ? await Promise.all([
          selectRows<Record<string, unknown>>("suppliers", { organization_id: organization.id }, { order: "name.asc" }),
          selectRows<Record<string, unknown>>("purchases", { organization_id: organization.id }, { order: "purchase_date.desc" }),
          selectRows<Record<string, unknown>>("bank_accounts", { organization_id: organization.id }, { order: "name.asc" }),
          selectRows<Record<string, unknown>>("bank_movements", { organization_id: organization.id }, { order: "posted_at.desc", limit: 1000 }),
          database().prepare("SELECT id, type, status, customer_name AS customerName, customer_document AS customerDocument, customer_email AS customerEmail, service_description AS serviceDescription, city, amount_cents AS amountCents, issue_date AS issueDate, official_number AS officialNumber, access_key AS accessKey, xml_url AS xmlUrl, pdf_url AS pdfUrl, provider, provider_reference AS providerReference, notes, created_at AS createdAt FROM fiscal_invoices WHERE organization_id = ? ORDER BY issue_date DESC, created_at DESC").bind(organization.id).all<Record<string, unknown>>(),
        ])
      : await Promise.all([
          database().prepare("SELECT id, name, document, email, phone, notes, created_at AS createdAt FROM suppliers WHERE organization_id = ? ORDER BY name").bind(organization.id).all<Record<string, unknown>>(),
          database().prepare("SELECT id, supplier_id AS supplierId, supplier_name AS supplierName, invoice_number AS invoiceNumber, purchase_date AS purchaseDate, due_date AS dueDate, amount_cents AS amountCents, status, payable_id AS payableId, notes, created_at AS createdAt FROM purchases WHERE organization_id = ? ORDER BY purchase_date DESC").bind(organization.id).all<Record<string, unknown>>(),
          database().prepare("SELECT id, name, institution, account_type AS accountType, opening_balance_cents AS openingBalanceCents, active, provider, current_balance_cents AS currentBalanceCents, created_at AS createdAt FROM bank_accounts WHERE organization_id = ? ORDER BY name").bind(organization.id).all<Record<string, unknown>>(),
          database().prepare("SELECT id, account_id AS accountId, posted_at AS postedAt, description, amount_cents AS amountCents, status, matched_transaction_id AS matchedTransactionId, provider, created_at AS createdAt FROM bank_movements WHERE organization_id = ? ORDER BY posted_at DESC LIMIT 1000").bind(organization.id).all<Record<string, unknown>>(),
          database().prepare("SELECT id, type, status, customer_name AS customerName, customer_document AS customerDocument, customer_email AS customerEmail, service_description AS serviceDescription, city, amount_cents AS amountCents, issue_date AS issueDate, official_number AS officialNumber, access_key AS accessKey, xml_url AS xmlUrl, pdf_url AS pdfUrl, provider, provider_reference AS providerReference, notes, created_at AS createdAt FROM fiscal_invoices WHERE organization_id = ? ORDER BY issue_date DESC, created_at DESC").bind(organization.id).all<Record<string, unknown>>(),
        ]);
    const collections = result.map((part: unknown) => Array.isArray(part) ? part : (part as { results?: Record<string, unknown>[] }).results ?? []);
    const suppliers = await Promise.all(collections[0].map((row: Record<string, unknown>) => decryptRecordFields(usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row, encryptedFieldsByEntity.suppliers)));
    const purchases = collections[1].map((row: Record<string, unknown>) => usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row);
    const bankAccounts = collections[2].map((row: Record<string, unknown>) => ({ ...(usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row), active: Boolean(row.active) }));
    const bankMovements = await Promise.all(collections[3].map((row: Record<string, unknown>) => decryptRecordFields(usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row, encryptedFieldsByEntity.bankMovements)));
    const fiscalInvoices = collections[4];
    const fiscalSettings = fiscalPortalSettings(await readCompanySettings(organization.id));
    return Response.json({ suppliers, purchases, bankAccounts, bankMovements, fiscalInvoices, fiscalSettings });
  } catch (error) { return tenantError(error, "Não foi possível carregar os dados financeiros."); }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    await assertRateLimit(request, "finance_create", user.id, 60, 60);
    if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
    const body = await request.json() as Record<string, unknown>;
    const action = optionalText(body.action);
    const db = database();
    const now = new Date().toISOString();
    await ensureFinanceSchema();

    if (action === "supplier") {
      const supplier = toSupplier(body, crypto.randomUUID(), organization.id, now);
      const protectedSupplier = await encryptRecordFields(supplier, encryptedFieldsByEntity.suppliers);
      if (usesSupabase()) await insertRow("suppliers", { id: protectedSupplier.id, organization_id: organization.id, name: protectedSupplier.name, document: protectedSupplier.document, email: protectedSupplier.email, phone: protectedSupplier.phone, notes: protectedSupplier.notes, created_at: now, updated_at: now });
      else await db.prepare("INSERT INTO suppliers (id, organization_id, name, document, email, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(supplier.id, organization.id, supplier.name, protectedSupplier.document, protectedSupplier.email, protectedSupplier.phone, protectedSupplier.notes, now, now).run();
      return Response.json({ supplier }, { status: 201 });
    }

    if (action === "bankAccount") {
      const openingBalanceCents = cents(body.openingBalance);
      if (Math.abs(openingBalanceCents) > 1_000_000_000) throw new RequestError("O saldo inicial está fora do limite permitido.", 400);
      const account = { id: crypto.randomUUID(), organizationId: organization.id, name: need(body.name, "Nome da conta").slice(0, 120), institution: optionalText(body.institution).slice(0, 120), accountType: ["corrente", "poupanca", "caixa", "cartao"].includes(optionalText(body.accountType)) ? optionalText(body.accountType) : "corrente", openingBalanceCents, active: true, createdAt: now };
      if (usesSupabase()) await insertRow("bank_accounts", { id: account.id, organization_id: organization.id, name: account.name, institution: account.institution, account_type: account.accountType, opening_balance_cents: account.openingBalanceCents, active: true, created_at: now, updated_at: now });
      else await db.prepare("INSERT INTO bank_accounts (id, organization_id, name, institution, account_type, opening_balance_cents, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(account.id, organization.id, account.name, account.institution, account.accountType, account.openingBalanceCents, now, now).run();
      return Response.json({ account }, { status: 201 });
    }

    if (action === "purchase") {
      const supplierId = need(body.supplierId, "Fornecedor");
      const supplier = usesSupabase()
        ? await selectOne<Record<string, unknown>>("suppliers", { id: supplierId, organization_id: organization.id })
        : await db.prepare("SELECT id, name FROM suppliers WHERE id = ? AND organization_id = ?").bind(supplierId, organization.id).first<Record<string, unknown>>();
      if (!supplier) throw new RequestError("Selecione um fornecedor cadastrado nesta empresa.", 400);
      const amountCents = cents(body.amount);
      if (amountCents <= 0 || amountCents > 1_000_000_000) throw new RequestError("Informe um valor de compra válido.", 400);
      const id = crypto.randomUUID();
      const payableId = crypto.randomUUID();
      const supplierName = String(supplier.name);
      const purchaseDate = need(optionalDate(body.purchaseDate, "Data da compra"), "Data da compra");
      const dueDate = need(optionalDate(body.dueDate, "Vencimento"), "Vencimento");
      const invoiceNumber = optionalText(body.invoiceNumber).slice(0, 80);
      const notes = optionalText(body.notes).slice(0, 2000);
      if (usesSupabase()) {
        const clearPayable = { id: payableId, organizationId: organization.id, description: `Compra · ${supplierName}${invoiceNumber ? ` · NF ${invoiceNumber}` : ""}`, type: "despesa", category: "Compras", amountCents, dueDate: dueDate || purchaseDate, status: "pendente", createdAt: now, updatedAt: now };
        const securePayable = await encryptRecordFields(clearPayable, encryptedFieldsByEntity.transactions);
        await insertRow<Record<string, unknown>>("transactions", { id: securePayable.id, organization_id: organization.id, description: securePayable.description, type: securePayable.type, category: securePayable.category, amount_cents: amountCents, due_date: dueDate || purchaseDate, status: "pendente", created_at: now, updated_at: now });
        try {
          await insertRow("purchases", { id, organization_id: organization.id, supplier_id: supplierId, supplier_name: supplierName, invoice_number: invoiceNumber, purchase_date: purchaseDate, due_date: dueDate, amount_cents: amountCents, status: "pendente", payable_id: payableId, notes, created_at: now, updated_at: now });
        } catch (error) { await deleteRows("transactions", { id: payableId, organization_id: organization.id }); throw error; }
        return Response.json({ purchase: { id, supplierId, supplierName, invoiceNumber, purchaseDate, dueDate, amountCents, status: "pendente", payableId, notes, createdAt: now }, payable: clearPayable }, { status: 201 });
      }
      await db.batch([
        db.prepare("INSERT INTO transactions (id, organization_id, description, type, category, amount_cents, due_date, status, created_at, updated_at) VALUES (?, ?, ?, 'despesa', 'Compras', ?, ?, 'pendente', ?, ?)").bind(payableId, organization.id, `Compra · ${supplierName}${invoiceNumber ? ` · NF ${invoiceNumber}` : ""}`, amountCents, dueDate || purchaseDate, now, now),
        db.prepare("INSERT INTO purchases (id, organization_id, supplier_id, supplier_name, invoice_number, purchase_date, due_date, amount_cents, status, payable_id, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?)").bind(id, organization.id, supplierId, supplierName, invoiceNumber, purchaseDate, dueDate, amountCents, payableId, notes, now, now),
      ]);
      const payable = { id: payableId, description: `Compra · ${supplierName}${invoiceNumber ? ` · NF ${invoiceNumber}` : ""}`, type: "despesa", category: "Compras", amountCents, dueDate: dueDate || purchaseDate, status: "pendente" };
      return Response.json({ purchase: { id, supplierId, supplierName, invoiceNumber, purchaseDate, dueDate, amountCents, status: "pendente", payableId, notes, createdAt: now }, payable }, { status: 201 });
    }

    if (action === "fiscalInvoice") {
      const amountCents = cents(body.amount);
      if (amountCents <= 0 || amountCents > 1_000_000_000) throw new RequestError("Informe um valor válido para a nota.", 400);
      const fiscalType = ["nfse", "nfe"].includes(optionalText(body.type)) ? optionalText(body.type) : "nfse";
      const issueDate = need(optionalDate(body.issueDate, "Data de emissão"), "Data de emissão");
      const invoice = {
        id: crypto.randomUUID(),
        type: fiscalType,
        status: "rascunho",
        customerName: need(body.customerName, "Cliente").slice(0, 180),
        customerDocument: optionalText(body.customerDocument).replace(/\D/g, "").slice(0, 14),
        customerEmail: optionalText(body.customerEmail).slice(0, 254),
        serviceDescription: need(body.serviceDescription, "Descrição").slice(0, 500),
        city: optionalText(body.city).slice(0, 120),
        amountCents,
        issueDate,
        officialNumber: optionalText(body.officialNumber).slice(0, 80),
        accessKey: optionalText(body.accessKey).slice(0, 80),
        notes: optionalText(body.notes).slice(0, 2000),
        createdAt: now,
      };
      await db.prepare(`INSERT INTO fiscal_invoices (id, organization_id, type, status, customer_name, customer_document, customer_email, service_description, city, amount_cents, issue_date, official_number, access_key, notes, created_at, updated_at)
        VALUES (?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(invoice.id, organization.id, invoice.type, invoice.customerName, invoice.customerDocument, invoice.customerEmail, invoice.serviceDescription, invoice.city, invoice.amountCents, invoice.issueDate, invoice.officialNumber, invoice.accessKey, invoice.notes, now, now)
        .run();
      return Response.json({ fiscalInvoice: invoice }, { status: 201 });
    }

    if (action === "registerPortalInvoice") {
      const id = need(body.id, "Rascunho fiscal");
      const invoice = await db.prepare("SELECT id, type, status, provider, official_number AS officialNumber, access_key AS accessKey FROM fiscal_invoices WHERE id = ? AND organization_id = ?").bind(id, organization.id).first<Record<string, unknown>>();
      if (!invoice) throw new RequestError("Nota fiscal não encontrada nesta empresa.", 404);
      let registration: ReturnType<typeof portalRegistration>;
      try { registration = portalRegistration(body, String(invoice.type)); }
      catch (error) { throw new RequestError(error instanceof Error ? error.message : "Dados da nota inválidos.", 400); }
      const { provider, officialNumber, accessKey, attachmentId, portalUrl } = registration;
      if (invoice.status === "registrada" && invoice.provider === provider && invoice.officialNumber === officialNumber && invoice.accessKey === accessKey) return Response.json({ registered: true, status: "registrada" });
      if (invoice.status !== "rascunho") throw new RequestError("Este registro já foi enviado ou concluído. Abra a nota correspondente.", 409);
      if (!usesSupabase()) throw new RequestError("O armazenamento de documentos está indisponível.", 503);
      const attachment = await selectOne<Record<string, unknown>>("attachments", { id: attachmentId, organization_id: organization.id, entity_type: "fiscalInvoices", entity_id: id });
      if (!attachment || !["application/pdf", "application/xml"].includes(String(attachment.mime_type))) throw new RequestError("Anexe o PDF ou XML ao rascunho desta empresa.", 400);
      if (attachment.mime_type === "application/xml") {
        const metadata = attachment.metadata as Record<string, unknown> | undefined;
        if (!metadata || metadata.provider !== provider || metadata.officialNumber !== officialNumber || metadata.accessKey !== accessKey) throw new RequestError("O número e a chave devem corresponder ao XML anexado.", 400);
      }
      const updated = await db.prepare(`UPDATE fiscal_invoices SET status = 'registrada', official_number = ?, access_key = ?, provider = ?, provider_reference = ?, updated_at = ?
        WHERE id = ? AND organization_id = ? AND status = 'rascunho'
        AND NOT EXISTS (SELECT 1 FROM fiscal_invoices other WHERE other.organization_id = ? AND other.type = ? AND other.provider = ? AND other.access_key = ? AND other.status IN ('registrada', 'cancelada') AND other.id <> ?)`)
        .bind(officialNumber, accessKey, provider, JSON.stringify({ attachmentId, portalUrl, registeredBy: user.id, registeredAt: now }), now, id, organization.id, organization.id, invoice.type, provider, accessKey, id).run();
      if ((updated.meta?.changes ?? 0) !== 1) throw new RequestError("Esta nota já está registrada. Atualize a lista e abra o registro existente.", 409);
      return Response.json({ registered: true, status: "registrada", provider, officialNumber, accessKey });
    }

    if (action === "registerPortalCancellation") {
      if (body.productionConfirmed !== true) throw new RequestError("Confirme o cancelamento já efetivado no portal oficial.", 400);
      const updated = await db.prepare("UPDATE fiscal_invoices SET status = 'cancelada', updated_at = ?, provider_reference = json_set(CASE WHEN json_valid(provider_reference) THEN provider_reference ELSE '{}' END, '$.cancelledBy', ?, '$.cancelledAt', ?) WHERE id = ? AND organization_id = ? AND status = 'registrada' AND provider IN ('portal_nacional', 'portal_municipal', 'portal_estadual')")
        .bind(now, user.id, now, need(body.id, "Nota fiscal"), organization.id).run();
      if ((updated.meta?.changes ?? 0) !== 1) throw new RequestError("A nota registrada não foi encontrada nesta empresa ou já está cancelada.", 409);
      return Response.json({ status: "cancelada", recorded: true });
    }

    if (["issueFiscalInvoice", "refreshFiscalInvoice", "updateFiscalInvoice"].includes(action)) {
      const id = need(body.id, "Nota fiscal");
      const invoice = await db.prepare("SELECT id, type, status, customer_name AS customerName, customer_document AS customerDocument, customer_email AS customerEmail, service_description AS serviceDescription, city, amount_cents AS amountCents, issue_date AS issueDate, official_number AS officialNumber, access_key AS accessKey, xml_url AS xmlUrl, pdf_url AS pdfUrl, provider, provider_reference AS providerReference, notes FROM fiscal_invoices WHERE id = ? AND organization_id = ?")
        .bind(id, organization.id).first<Record<string, unknown>>();
      if (!invoice) throw new RequestError("Nota fiscal não encontrada nesta empresa.", 404);
      let issued: { status: string; provider: string; providerReference: string; officialNumber: string; accessKey: string; xmlUrl: string; pdfUrl: string };
      if (action === "issueFiscalInvoice") {
        if (invoice.status === "emitida") return Response.json({ issued: true, ...invoice });
        if (invoice.status !== "rascunho") throw new RequestError("Esta nota já foi enviada. Atualize o status antes de realizar outra operação.", 409);
        const lock = await db.prepare("UPDATE fiscal_invoices SET status = 'processando', updated_at = ? WHERE id = ? AND organization_id = ? AND status = 'rascunho'").bind(now, id, organization.id).run();
        if ((lock.meta?.changes ?? 0) !== 1) throw new RequestError("Esta nota já está em emissão.", 409);
        try { issued = await issueThroughFiscalProvider(organization.id, invoice); }
        catch (error) {
          if (error instanceof RequestError && error.status < 500) await db.prepare("UPDATE fiscal_invoices SET status = 'rascunho', updated_at = ? WHERE id = ? AND organization_id = ?").bind(now, id, organization.id).run();
          throw error;
        }
      } else if (action === "refreshFiscalInvoice") {
        const reference = optionalText(invoice.providerReference);
        if (invoice.provider !== "notaas" || !reference) throw new RequestError("Esta nota ainda não possui uma referência para consulta. Confira o envio no painel fiscal.", 409);
        const settings = await readCompanySettings(organization.id);
        const payload = await notaasRequest(settings, await decryptText(settings.fiscalApiToken), `/invoices/${encodeURIComponent(reference)}/status`);
        issued = fiscalProviderState(payload, reference);
      } else {
        if (body.status !== "cancelada") throw new RequestError("O status oficial é atualizado pelo provedor fiscal.", 400);
        if (invoice.status === "cancelada" || invoice.status === "cancelando") return Response.json({ ok: true });
        if (invoice.status === "rascunho") {
          await db.prepare("UPDATE fiscal_invoices SET status = 'cancelada', updated_at = ? WHERE id = ? AND organization_id = ? AND status = 'rascunho'").bind(now, id, organization.id).run();
          return Response.json({ ok: true });
        }
        if (invoice.status !== "emitida" || invoice.provider !== "notaas" || !invoice.providerReference) throw new RequestError("Atualize o status da emissão antes de solicitar o cancelamento.", 409);
        const settings = await readCompanySettings(organization.id);
        const payload = await notaasRequest(settings, await decryptText(settings.fiscalApiToken), "/cancelar", { method: "POST", body: JSON.stringify({ invoiceId: invoice.providerReference, motivo: optionalText(body.reason).slice(0, 255) || "Cancelamento solicitado pela empresa emitente." }) });
        issued = { ...fiscalProviderState(payload, String(invoice.providerReference)), status: payload.status === "cancelled" ? "cancelada" : "cancelando" };
      }
      await db.prepare("UPDATE fiscal_invoices SET status = ?, official_number = CASE WHEN ? <> '' THEN ? ELSE official_number END, access_key = CASE WHEN ? <> '' THEN ? ELSE access_key END, xml_url = CASE WHEN ? <> '' THEN ? ELSE xml_url END, pdf_url = CASE WHEN ? <> '' THEN ? ELSE pdf_url END, provider = ?, provider_reference = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
        .bind(issued.status, issued.officialNumber, issued.officialNumber, issued.accessKey, issued.accessKey, issued.xmlUrl, issued.xmlUrl, issued.pdfUrl, issued.pdfUrl, issued.provider, issued.providerReference, now, id, organization.id).run();
      return Response.json({ issued: issued.status === "emitida", ...issued });
    }

    if (action === "importStatement") {
      const accountId = need(body.accountId, "Conta bancária");
      const source = need(body.csv, "Arquivo CSV");
      let rows: ReturnType<typeof parseBankStatementCsv>;
      try { rows = parseBankStatementCsv(source); } catch (error) { throw new RequestError(error instanceof Error ? error.message : "Arquivo CSV inválido.", 400); }
      const account = usesSupabase()
        ? await selectOne<Record<string, unknown>>("bank_accounts", { id: accountId, organization_id: organization.id })
        : await db.prepare("SELECT id FROM bank_accounts WHERE id = ? AND organization_id = ?").bind(accountId, organization.id).first<Record<string, unknown>>();
      if (!account) throw new RequestError("A conta bancária selecionada não pertence a esta empresa.", 400);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${accountId}\n${source}`));
      const importId = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const existingImport = usesSupabase()
        ? await selectOne<Record<string, unknown>>("bank_movements", { organization_id: organization.id, account_id: accountId, import_id: importId })
        : await db.prepare("SELECT id FROM bank_movements WHERE organization_id = ? AND account_id = ? AND import_id = ? LIMIT 1").bind(organization.id, accountId, importId).first<Record<string, unknown>>();
      if (existingImport) throw new RequestError("Esse arquivo já foi importado para esta conta.", 409);
      const movements = rows.map((row) => ({ id: crypto.randomUUID(), organizationId: organization.id, accountId, ...row, status: "pendente", matchedTransactionId: "", createdAt: now }));
      if (usesSupabase()) {
        try {
          for (const movement of movements) await insertRow("bank_movements", { id: movement.id, organization_id: organization.id, account_id: accountId, posted_at: movement.postedAt, description: movement.description, amount_cents: movement.amountCents, status: "pendente", matched_transaction_id: "", import_id: importId, created_at: now, updated_at: now });
        } catch (error) {
          await deleteRows("bank_movements", { organization_id: organization.id, account_id: accountId, import_id: importId });
          throw error;
        }
      } else {
        await db.batch(movements.map((movement) => db.prepare("INSERT INTO bank_movements (id, organization_id, account_id, posted_at, description, amount_cents, status, matched_transaction_id, import_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pendente', '', ?, ?, ?)").bind(movement.id, organization.id, accountId, movement.postedAt, movement.description, movement.amountCents, importId, now, now)));
      }
      return Response.json({ imported: movements.length, movements }, { status: 201 });
    }
    throw new RequestError("Ação financeira inválida.", 400);
  } catch (error) { return tenantError(error, "Não foi possível salvar a operação financeira."); }
}

export async function PATCH(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    await assertRateLimit(request, "finance_update", user.id, 90, 60);
    if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
    const body = await request.json() as Record<string, unknown>;
    const action = optionalText(body.action);
    if (!["reconcile", "createAndReconcile"].includes(action)) throw new RequestError("Ação financeira inválida.", 400);
    const movementId = need(body.movementId, "Movimentação");
    const db = database();
    await ensureFinanceSchema();
    const rawMovement = usesSupabase()
      ? await selectOne<Record<string, unknown>>("bank_movements", { id: movementId, organization_id: organization.id })
      : await db.prepare("SELECT id, amount_cents AS amountCents, status FROM bank_movements WHERE id = ? AND organization_id = ?").bind(movementId, organization.id).first<Record<string, unknown>>();
    const movement = rawMovement && usesSupabase() ? camelizeRow<Record<string, unknown>>(rawMovement) : rawMovement;
    if (!movement) throw new RequestError("Movimentação não encontrada nesta empresa.", 404);
    if (movement.status !== "pendente") throw new RequestError("Esta movimentação já foi conciliada.", 409);
    const now = new Date().toISOString();
    let transactionId = "";
    let transaction: Record<string, unknown> | null = null;
    if (action === "createAndReconcile") {
      transactionId = crypto.randomUUID();
      const type = Number(movement.amountCents) > 0 ? "receita" : "despesa";
      const description = optionalText(movement.description).slice(0, 300) || "Movimentação bancária";
      const dueDate = optionalText(movement.postedAt).slice(0, 10);
      const record = { id: transactionId, organizationId: organization.id, description, type, category: "Extrato bancário", amountCents: Math.abs(Number(movement.amountCents)), dueDate, status: "pago", createdAt: now, updatedAt: now };
      if (usesSupabase()) {
        const secureRecord = await encryptRecordFields(record, encryptedFieldsByEntity.transactions);
        await insertRow("transactions", { id: record.id, organization_id: organization.id, description: secureRecord.description, type, category: secureRecord.category, amount_cents: record.amountCents, due_date: dueDate, status: "pago", created_at: now, updated_at: now });
      }
      transaction = { ...record };
    } else {
      transactionId = need(body.transactionId, "Lançamento");
      const rawTransaction = usesSupabase()
        ? await selectOne<Record<string, unknown>>("transactions", { id: transactionId, organization_id: organization.id })
        : await db.prepare("SELECT id, amount_cents AS amountCents, type, status FROM transactions WHERE id = ? AND organization_id = ?").bind(transactionId, organization.id).first<Record<string, unknown>>();
      transaction = rawTransaction && usesSupabase() ? camelizeRow<Record<string, unknown>>(rawTransaction) : rawTransaction;
      if (!transaction) throw new RequestError("Lançamento não encontrado nesta empresa.", 404);
      if (transaction.status === "pago") throw new RequestError("Esse lançamento já foi baixado.", 409);
      const signedAmount = Number(transaction.amountCents) * (transaction.type === "despesa" ? -1 : 1);
      if (signedAmount !== Number(movement.amountCents)) throw new RequestError("Os valores não correspondem. Confira os valores no extrato e no lançamento antes de conciliar.", 400);
    }
    if (usesSupabase()) {
      try {
        const updatedMovement = await updateRows("bank_movements", { status: "conciliado", matched_transaction_id: transactionId, updated_at: now }, { id: movementId, organization_id: organization.id, status: "pendente" });
        if (!updatedMovement.length) throw new RequestError("Esta movimentação já foi conciliada.", 409);
        await updateRows("transactions", { status: "pago", updated_at: now }, { id: transactionId, organization_id: organization.id });
      } catch (error) {
        if (action === "createAndReconcile") await deleteRows("transactions", { id: transactionId, organization_id: organization.id });
        throw error;
      }
    } else {
      const statements = [];
      if (action === "createAndReconcile") statements.push(db.prepare("INSERT INTO transactions (id, organization_id, description, type, category, amount_cents, due_date, status, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, 'pago', ?, ? FROM bank_movements WHERE id = ? AND organization_id = ? AND status = 'pendente'").bind(transactionId, organization.id, String(transaction.description), String(transaction.type), "Extrato bancário", Math.abs(Number(movement.amountCents)), String(transaction.dueDate), now, now, movementId, organization.id));
      statements.push(
        db.prepare("UPDATE bank_movements SET status = 'conciliado', matched_transaction_id = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND status = 'pendente'").bind(transactionId, now, movementId, organization.id),
      );
      if (action === "reconcile") statements.push(db.prepare("UPDATE transactions SET status = 'pago', updated_at = ? WHERE id = ? AND organization_id = ?").bind(now, transactionId, organization.id));
      const result = await db.batch(statements);
      const movementUpdate = result[action === "createAndReconcile" ? 1 : 0] as { meta?: { changes?: number } } | undefined;
      if (movementUpdate?.meta?.changes === 0) throw new RequestError("Esta movimentação já foi conciliada.", 409);
    }
    return Response.json({ reconciled: true, movementId, transactionId, transaction });
  } catch (error) { return tenantError(error, "Não foi possível conciliar a movimentação."); }
}
