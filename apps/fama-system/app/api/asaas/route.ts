import { cents, database } from "@/lib/database";
import { decryptText, encryptText, isDataEncryptionConfigured } from "@/lib/crypto";
import { ensureFinanceSchema } from "@/lib/finance-schema";
import { AsaasError, asaasMovement, asaasRequest, parseAsaasEnvironment, sha256, validateAsaasKey, type AsaasEnvironment } from "@/lib/asaas";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { camelizeRow, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { type OrganizationRole, RequestError, requireTenant, tenantError } from "@/lib/tenant";

const PROVIDER = "asaas";
const MAX_PAGES = 8;
type Connection = { id: string; organizationId: string; itemHash: string; encryptedItemId: string; institution: string; status: string; lastSyncedAt: string };
type AsaasSummary = {
  status: string;
  balanceCents: number;
  customers: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  transfers: Array<Record<string, unknown>>;
};

function checkPermission(organization: { role: OrganizationRole; permissions: string[] }) {
  if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao financeiro.", 403);
}

function requireEncryption() {
  if (!isDataEncryptionConfigured()) throw new RequestError("Configure a chave de criptografia do servidor antes de conectar uma conta Asaas.", 503);
}

function environmentFromInstitution(institution: string): AsaasEnvironment {
  return institution.includes("Sandbox") ? "sandbox" : "production";
}

async function getConnection(organizationId: string, id: string) {
  if (usesSupabase()) {
    const row = await selectOne<Record<string, unknown>>("bank_connections", { organization_id: organizationId, id, provider: PROVIDER });
    return row ? camelizeRow<Connection>(row) : null;
  }
  return await database().prepare("SELECT id, organization_id AS organizationId, item_hash AS itemHash, encrypted_item_id AS encryptedItemId, institution, status, last_synced_at AS lastSyncedAt FROM bank_connections WHERE organization_id = ? AND id = ? AND provider = ? LIMIT 1").bind(organizationId, id, PROVIDER).first<Connection>();
}

async function getFirstConnection(organizationId: string) {
  if (usesSupabase()) {
    const rows = await selectRows<Record<string, unknown>>("bank_connections", { organization_id: organizationId, provider: PROVIDER }, { order: "updated_at.desc", limit: 1 });
    return rows[0] ? camelizeRow<Connection>(rows[0]) : null;
  }
  return await database().prepare("SELECT id, organization_id AS organizationId, item_hash AS itemHash, encrypted_item_id AS encryptedItemId, institution, status, last_synced_at AS lastSyncedAt FROM bank_connections WHERE organization_id = ? AND provider = ? ORDER BY updated_at DESC LIMIT 1").bind(organizationId, PROVIDER).first<Connection>();
}

async function saveConnection(organizationId: string, apiKey: string, environment: AsaasEnvironment, status: string, now: string) {
  const itemHash = await sha256(apiKey);
  const encryptedItemId = await encryptText(apiKey);
  const institution = environment === "production" ? "Asaas" : "Asaas Sandbox";
  if (usesSupabase()) {
    const existing = await selectOne<Record<string, unknown>>("bank_connections", { organization_id: organizationId, provider: PROVIDER, item_hash: itemHash });
    if (existing) {
      await updateRows("bank_connections", { encrypted_item_id: encryptedItemId, institution, status, last_synced_at: now, updated_at: now }, { organization_id: organizationId, id: String(existing.id), provider: PROVIDER });
      return String(existing.id);
    }
    const id = crypto.randomUUID();
    await insertRow("bank_connections", { id, organization_id: organizationId, provider: PROVIDER, item_hash: itemHash, encrypted_item_id: encryptedItemId, institution, status, last_synced_at: now, created_at: now, updated_at: now });
    return id;
  }
  const db = database();
  const existing = await db.prepare("SELECT id FROM bank_connections WHERE organization_id = ? AND provider = ? AND item_hash = ? LIMIT 1").bind(organizationId, PROVIDER, itemHash).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE bank_connections SET encrypted_item_id = ?, institution = ?, status = ?, last_synced_at = ?, updated_at = ? WHERE organization_id = ? AND id = ?").bind(encryptedItemId, institution, status, now, now, organizationId, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO bank_connections (id, organization_id, provider, item_hash, encrypted_item_id, institution, status, last_synced_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, organizationId, PROVIDER, itemHash, encryptedItemId, institution, status, now, now, now).run();
  return id;
}

async function upsertAccount(organizationId: string, connectionId: string, institution: string, balance: number, now: string) {
  const providerAccountId = connectionId;
  if (usesSupabase()) {
    const existing = await selectOne<Record<string, unknown>>("bank_accounts", { organization_id: organizationId, provider: PROVIDER, provider_connection_id: connectionId, provider_account_id: providerAccountId });
    if (existing) {
      await updateRows("bank_accounts", { name: "Conta Asaas", institution, current_balance_cents: balance, active: true, updated_at: now }, { organization_id: organizationId, id: String(existing.id) });
      return String(existing.id);
    }
    const id = crypto.randomUUID();
    await insertRow("bank_accounts", { id, organization_id: organizationId, name: "Conta Asaas", institution, account_type: "pagamentos", opening_balance_cents: 0, provider: PROVIDER, provider_connection_id: connectionId, provider_account_id: providerAccountId, current_balance_cents: balance, active: true, created_at: now, updated_at: now });
    return id;
  }
  const db = database();
  const existing = await db.prepare("SELECT id FROM bank_accounts WHERE organization_id = ? AND provider = ? AND provider_connection_id = ? LIMIT 1").bind(organizationId, PROVIDER, connectionId).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE bank_accounts SET name = 'Conta Asaas', institution = ?, current_balance_cents = ?, active = 1, updated_at = ? WHERE organization_id = ? AND id = ?").bind(institution, balance, now, organizationId, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO bank_accounts (id, organization_id, name, institution, account_type, opening_balance_cents, active, provider, provider_connection_id, provider_account_id, current_balance_cents, created_at, updated_at) VALUES (?, ?, 'Conta Asaas', ?, 'pagamentos', 0, 1, ?, ?, ?, ?, ?, ?)").bind(id, organizationId, institution, PROVIDER, connectionId, providerAccountId, balance, now, now).run();
  return id;
}

async function upsertMovement(organizationId: string, accountId: string, movement: NonNullable<ReturnType<typeof asaasMovement>>, now: string) {
  const description = await encryptText(movement.description);
  if (usesSupabase()) {
    const existing = await selectOne<Record<string, unknown>>("bank_movements", { organization_id: organizationId, account_id: accountId, provider: PROVIDER, provider_transaction_id: movement.providerTransactionId });
    if (existing) {
      await updateRows("bank_movements", { posted_at: movement.postedAt, description, amount_cents: movement.amountCents, updated_at: now }, { organization_id: organizationId, id: String(existing.id) });
      return false;
    }
    await insertRow("bank_movements", { id: crypto.randomUUID(), organization_id: organizationId, account_id: accountId, posted_at: movement.postedAt, description, amount_cents: movement.amountCents, status: "pendente", matched_transaction_id: "", import_id: "", provider: PROVIDER, provider_transaction_id: movement.providerTransactionId, created_at: now, updated_at: now });
    return true;
  }
  const db = database();
  const existing = await db.prepare("SELECT id FROM bank_movements WHERE organization_id = ? AND account_id = ? AND provider = ? AND provider_transaction_id = ? LIMIT 1").bind(organizationId, accountId, PROVIDER, movement.providerTransactionId).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE bank_movements SET posted_at = ?, description = ?, amount_cents = ?, updated_at = ? WHERE organization_id = ? AND id = ?").bind(movement.postedAt, description, movement.amountCents, now, organizationId, existing.id).run();
    return false;
  }
  await db.prepare("INSERT INTO bank_movements (id, organization_id, account_id, posted_at, description, amount_cents, status, matched_transaction_id, import_id, provider, provider_transaction_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pendente', '', '', ?, ?, ?, ?)").bind(crypto.randomUUID(), organizationId, accountId, movement.postedAt, description, movement.amountCents, PROVIDER, movement.providerTransactionId, now, now).run();
  return true;
}

async function syncConnection(organizationId: string, connection: Connection, apiKey: string, environment: AsaasEnvironment, now: string) {
  const balancePayload = await asaasRequest(apiKey, environment, "/finance/balance");
  const balance = cents(balancePayload.balance);
  const accountId = await upsertAccount(organizationId, connection.id, connection.institution, balance, now);
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const finishDate = new Date().toISOString().slice(0, 10);
  let imported = 0; let updated = 0; let offset = 0; let truncated = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const statement = await asaasRequest(apiKey, environment, `/financialTransactions?offset=${offset}&limit=100&startDate=${startDate}&finishDate=${finishDate}&order=asc`);
    const rows = Array.isArray(statement.data) ? statement.data as Record<string, unknown>[] : [];
    for (const row of rows) {
      const movement = asaasMovement(row);
      if (!movement) continue;
      if (await upsertMovement(organizationId, accountId, movement, now)) imported += 1; else updated += 1;
    }
    if (!Boolean(statement.hasMore) || rows.length === 0) break;
    offset += rows.length;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return { imported, updated, truncated, balanceCents: balance };
}

function asaasCents(value: unknown) {
  const amount = cents(value);
  if (amount <= 0 || amount > 1_000_000_000) throw new RequestError("Informe um valor válido.", 400);
  return amount;
}

function asaasMoney(centsValue: number) {
  return Math.round(centsValue) / 100;
}

function publicPayment(payment: Record<string, unknown>) {
  return {
    id: String(payment.id ?? ""),
    customer: String(payment.customer ?? ""),
    description: String(payment.description ?? payment.externalReference ?? "Cobrança Asaas"),
    status: String(payment.status ?? ""),
    billingType: String(payment.billingType ?? ""),
    valueCents: cents(payment.value),
    dueDate: String(payment.dueDate ?? ""),
    invoiceUrl: String(payment.invoiceUrl ?? payment.bankSlipUrl ?? ""),
  };
}

function publicCustomer(customer: Record<string, unknown>) {
  return {
    id: String(customer.id ?? ""),
    name: String(customer.name ?? "Cliente"),
    email: String(customer.email ?? ""),
    mobilePhone: String(customer.mobilePhone ?? customer.phone ?? ""),
    cpfCnpj: String(customer.cpfCnpj ?? ""),
  };
}

function publicTransfer(transfer: Record<string, unknown>) {
  return {
    id: String(transfer.id ?? ""),
    status: String(transfer.status ?? ""),
    valueCents: cents(transfer.value),
    dateCreated: String(transfer.dateCreated ?? transfer.effectiveDate ?? ""),
    description: String(transfer.description ?? "Pix enviado"),
  };
}

async function asaasSummary(apiKey: string, environment: AsaasEnvironment): Promise<AsaasSummary> {
  const [status, balance, customers, payments, transfers] = await Promise.all([
    asaasRequest(apiKey, environment, "/myAccount/status"),
    asaasRequest(apiKey, environment, "/finance/balance"),
    asaasRequest(apiKey, environment, "/customers?limit=10&offset=0"),
    asaasRequest(apiKey, environment, "/payments?limit=10&offset=0&order=desc"),
    asaasRequest(apiKey, environment, "/transfers?limit=10&offset=0").catch(() => ({ data: [] })),
  ]);
  return {
    status: String(status.general ?? "PENDING"),
    balanceCents: cents(balance.balance),
    customers: Array.isArray(customers.data) ? customers.data as Record<string, unknown>[] : [],
    payments: Array.isArray(payments.data) ? payments.data as Record<string, unknown>[] : [],
    transfers: Array.isArray(transfers.data) ? transfers.data as Record<string, unknown>[] : [],
  };
}

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    checkPermission(organization); await ensureFinanceSchema();
    const rows = usesSupabase()
      ? await selectRows<Record<string, unknown>>("bank_connections", { organization_id: organization.id, provider: PROVIDER }, { order: "updated_at.desc" })
      : (await database().prepare("SELECT id, institution, status, last_synced_at AS lastSyncedAt FROM bank_connections WHERE organization_id = ? AND provider = ? ORDER BY updated_at DESC").bind(organization.id, PROVIDER).all<Record<string, unknown>>()).results;
    const connections = rows.map((row) => {
      const item = usesSupabase() ? camelizeRow<Record<string, unknown>>(row) : row;
      return { id: String(item.id ?? ""), institution: String(item.institution ?? "Asaas"), status: String(item.status ?? "PENDING"), lastSyncedAt: String(item.lastSyncedAt ?? ""), environment: String(item.institution ?? "").includes("Sandbox") ? "sandbox" : "production" };
    });
    return Response.json({ encryptionConfigured: isDataEncryptionConfigured(), connections });
  } catch (error) { return tenantError(error, "Não foi possível carregar as conexões Asaas."); }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    checkPermission(organization); requireEncryption(); await ensureFinanceSchema();
    await assertRateLimit(request, "asaas", user.id, 10, 60);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();
    let connection: Connection | null = null;
    let apiKey = "";
    let environment: AsaasEnvironment;

    if (["dashboard", "createCustomer", "createPixCharge", "sendPix"].includes(action)) {
      const connectionId = String(body.connectionId ?? "").trim();
      connection = connectionId ? await getConnection(organization.id, connectionId) : await getFirstConnection(organization.id);
      if (!connection) throw new RequestError("Conecte uma conta Asaas antes de usar o controle completo.", 400);
      apiKey = await decryptText(connection.encryptedItemId);
      environment = environmentFromInstitution(connection.institution);

      if (action === "dashboard") {
        const summary = await asaasSummary(apiKey, environment);
        return Response.json({
          connection: { id: connection.id, institution: connection.institution, status: summary.status, lastSyncedAt: connection.lastSyncedAt, environment },
          balanceCents: summary.balanceCents,
          customers: summary.customers.map(publicCustomer),
          payments: summary.payments.map(publicPayment),
          transfers: summary.transfers.map(publicTransfer),
        });
      }

      if (action === "createCustomer") {
        const payload: Record<string, unknown> = {
          name: String(body.name ?? "").trim().slice(0, 120),
          email: String(body.email ?? "").trim().slice(0, 254),
          mobilePhone: String(body.mobilePhone ?? "").replace(/\D/g, "").slice(0, 20),
          cpfCnpj: String(body.cpfCnpj ?? "").replace(/\D/g, "").slice(0, 14),
          notificationDisabled: false,
        };
        if (!payload.name) throw new RequestError("Informe o nome do cliente.", 400);
        if (!payload.email) delete payload.email;
        if (!payload.mobilePhone) delete payload.mobilePhone;
        if (!payload.cpfCnpj) delete payload.cpfCnpj;
        const customer = await asaasRequest(apiKey, environment, "/customers", { method: "POST", body: JSON.stringify(payload) });
        return Response.json({ customer: publicCustomer(customer) }, { status: 201 });
      }

      if (action === "createPixCharge") {
        const customer = String(body.customer ?? "").trim();
        if (!/^cus_/.test(customer)) throw new RequestError("Selecione um cliente Asaas válido.", 400);
        const amountCents = asaasCents(body.value);
        const dueDate = String(body.dueDate ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new RequestError("Informe um vencimento válido.", 400);
        const billingType = String(body.billingType ?? "PIX").trim().toUpperCase();
        if (!["PIX", "BOLETO", "UNDEFINED"].includes(billingType)) throw new RequestError("Forma de cobrança inválida.", 400);
        const payment = await asaasRequest(apiKey, environment, "/payments", {
          method: "POST",
          body: JSON.stringify({
            customer,
            billingType,
            value: asaasMoney(amountCents),
            dueDate,
            description: String(body.description ?? "Cobrança Fama System").trim().slice(0, 180),
          }),
        });
        const paymentId = String(payment.id ?? "");
        const pix = billingType === "PIX" && paymentId ? await asaasRequest(apiKey, environment, `/payments/${encodeURIComponent(paymentId)}/pixQrCode`) : {};
        return Response.json({
          payment: publicPayment(payment),
          pixQrCode: String(pix.encodedImage ?? ""),
          pixCopyPaste: String(pix.payload ?? ""),
        }, { status: 201 });
      }

      if (action === "sendPix") {
        if (String(body.confirmation ?? "").trim() !== "ENVIAR PIX") throw new RequestError("Digite ENVIAR PIX para confirmar o envio.", 400);
        const amountCents = asaasCents(body.value);
        const pixAddressKey = String(body.pixAddressKey ?? "").trim().slice(0, 180);
        const pixAddressKeyType = String(body.pixAddressKeyType ?? "EVP").trim();
        if (!pixAddressKey) throw new RequestError("Informe a chave Pix de destino.", 400);
        if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(pixAddressKeyType)) throw new RequestError("Tipo de chave Pix inválido.", 400);
        const transfer = await asaasRequest(apiKey, environment, "/transfers", {
          method: "POST",
          body: JSON.stringify({
            value: asaasMoney(amountCents),
            operationType: "PIX",
            pixAddressKey,
            pixAddressKeyType,
            description: String(body.description ?? "Pix enviado pelo Fama System").trim().slice(0, 180),
          }),
        });
        return Response.json({ transfer: publicTransfer(transfer) }, { status: 201 });
      }
    }

    if (action === "connect") {
      apiKey = String(body.apiKey ?? "").trim();
      environment = parseAsaasEnvironment(body.environment);
      validateAsaasKey(apiKey, environment);
      const [status, commercial] = await Promise.all([
        asaasRequest(apiKey, environment, "/myAccount/status"),
        asaasRequest(apiKey, environment, "/myAccount/commercialInfo"),
      ]);
      const connectionId = await saveConnection(organization.id, apiKey, environment, String(status.general ?? "PENDING"), now);
      connection = await getConnection(organization.id, connectionId);
      if (!connection) throw new RequestError("Não foi possível registrar a conexão Asaas.", 503);
      const sync = await syncConnection(organization.id, connection, apiKey, environment, now);
      return Response.json({ connection: { id: connection.id, institution: connection.institution, status: String(status.general ?? "PENDING"), lastSyncedAt: now, environment }, accountName: String(commercial.companyName ?? commercial.tradingName ?? "Conta Asaas"), ...sync });
    }

    if (action !== "sync") throw new RequestError("Ação da Asaas inválida.", 400);
    const connectionId = String(body.connectionId ?? "").trim();
    if (!/^[\w-]{16,80}$/.test(connectionId)) throw new RequestError("Conexão Asaas inválida.", 400);
    connection = await getConnection(organization.id, connectionId);
    if (!connection) throw new RequestError("Essa conexão não pertence à empresa selecionada.", 404);
    apiKey = await decryptText(connection.encryptedItemId);
    environment = environmentFromInstitution(connection.institution);
    const status = await asaasRequest(apiKey, environment, "/myAccount/status");
    const sync = await syncConnection(organization.id, connection, apiKey, environment, now);
    if (usesSupabase()) await updateRows("bank_connections", { status: String(status.general ?? "PENDING"), last_synced_at: now, updated_at: now }, { organization_id: organization.id, id: connection.id, provider: PROVIDER });
    else await database().prepare("UPDATE bank_connections SET status = ?, last_synced_at = ?, updated_at = ? WHERE organization_id = ? AND id = ? AND provider = ?").bind(String(status.general ?? "PENDING"), now, now, organization.id, connection.id, PROVIDER).run();
    return Response.json({ connection: { id: connection.id, institution: connection.institution, status: String(status.general ?? "PENDING"), lastSyncedAt: now, environment }, ...sync });
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    return tenantError(error, "Não foi possível conectar ou sincronizar a conta Asaas.");
  }
}
