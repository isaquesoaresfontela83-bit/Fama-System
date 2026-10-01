import { database } from "@/lib/database";
import { usesSupabase } from "@/lib/supabase";

export async function ensureFinanceSchema() {
  if (usesSupabase()) return;
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, document TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_suppliers_org_name ON suppliers(organization_id, name)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, supplier_id TEXT NOT NULL DEFAULT '', supplier_name TEXT NOT NULL, invoice_number TEXT NOT NULL DEFAULT '', purchase_date TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '', amount_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pendente', payable_id TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_purchases_org_date ON purchases(organization_id, purchase_date)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS bank_accounts (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, institution TEXT NOT NULL DEFAULT '', account_type TEXT NOT NULL DEFAULT 'corrente', opening_balance_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, provider TEXT NOT NULL DEFAULT '', provider_connection_id TEXT NOT NULL DEFAULT '', provider_account_id TEXT NOT NULL DEFAULT '', current_balance_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bank_accounts_org_name ON bank_accounts(organization_id, name)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS bank_movements (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, account_id TEXT NOT NULL, posted_at TEXT NOT NULL DEFAULT '', description TEXT NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', matched_transaction_id TEXT NOT NULL DEFAULT '', import_id TEXT NOT NULL DEFAULT '', provider TEXT NOT NULL DEFAULT '', provider_transaction_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bank_movements_org_date ON bank_movements(organization_id, posted_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS bank_connections (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, provider TEXT NOT NULL, item_hash TEXT NOT NULL, encrypted_item_id TEXT NOT NULL, institution TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'ATIVA', last_synced_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bank_connections_org ON bank_connections(organization_id, provider)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS fiscal_invoices (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'nfse', status TEXT NOT NULL DEFAULT 'rascunho', customer_name TEXT NOT NULL, customer_document TEXT NOT NULL DEFAULT '', customer_email TEXT NOT NULL DEFAULT '', service_description TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', amount_cents INTEGER NOT NULL DEFAULT 0, issue_date TEXT NOT NULL DEFAULT '', official_number TEXT NOT NULL DEFAULT '', access_key TEXT NOT NULL DEFAULT '', xml_url TEXT NOT NULL DEFAULT '', pdf_url TEXT NOT NULL DEFAULT '', provider TEXT NOT NULL DEFAULT '', provider_reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_org_date ON fiscal_invoices(organization_id, issue_date)"),
  ]);

  const additions = [
    ["bank_accounts", "provider", "TEXT NOT NULL DEFAULT ''"],
    ["bank_accounts", "provider_connection_id", "TEXT NOT NULL DEFAULT ''"],
    ["bank_accounts", "provider_account_id", "TEXT NOT NULL DEFAULT ''"],
    ["bank_accounts", "current_balance_cents", "INTEGER NOT NULL DEFAULT 0"],
    ["bank_movements", "provider", "TEXT NOT NULL DEFAULT ''"],
    ["bank_movements", "provider_transaction_id", "TEXT NOT NULL DEFAULT ''"],
    ["fiscal_invoices", "xml_url", "TEXT NOT NULL DEFAULT ''"],
    ["fiscal_invoices", "pdf_url", "TEXT NOT NULL DEFAULT ''"],
    ["fiscal_invoices", "provider", "TEXT NOT NULL DEFAULT ''"],
    ["fiscal_invoices", "provider_reference", "TEXT NOT NULL DEFAULT ''"],
  ] as const;
  for (const [table, column, definition] of additions) {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    if (!info.results.some((entry) => entry.name === column)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  }
  await db.batch([
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_org_item ON bank_connections(organization_id, provider, item_hash)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_provider_account ON bank_accounts(organization_id, provider, provider_connection_id, provider_account_id) WHERE provider_account_id <> ''"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_movements_provider_transaction ON bank_movements(organization_id, account_id, provider, provider_transaction_id) WHERE provider_transaction_id <> ''"),
  ]);
}
