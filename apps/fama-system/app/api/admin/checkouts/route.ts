import { database } from "@/lib/database";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const statuses = new Set(["paid", "payment_rejected", "awaiting_review"]);

async function ensureCheckoutTable() {
  await database().prepare(`CREATE TABLE IF NOT EXISTS subscription_checkouts (
    id TEXT PRIMARY KEY,
    plan TEXT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    installments INTEGER NOT NULL DEFAULT 1,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_document TEXT NOT NULL DEFAULT '',
    buyer_phone TEXT NOT NULL DEFAULT '',
    payment_id TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'manual_pix',
    proof_text TEXT NOT NULL DEFAULT '',
    proof_submitted_at TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT NOT NULL DEFAULT '',
    admin_notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_payment',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  const info = await database().prepare("PRAGMA table_info(subscription_checkouts)").all<{ name: string }>();
  if (!info.results.some((entry) => entry.name === "billing_cycle")) {
    await database().prepare("ALTER TABLE subscription_checkouts ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly'").run();
  }
  if (!info.results.some((entry) => entry.name === "installments")) {
    await database().prepare("ALTER TABLE subscription_checkouts ADD COLUMN installments INTEGER NOT NULL DEFAULT 1").run();
  }
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureCheckoutTable();
    const rows = await database().prepare(`SELECT id, plan, billing_cycle AS billingCycle, installments, buyer_name AS buyerName, buyer_email AS buyerEmail,
      buyer_document AS buyerDocument, buyer_phone AS buyerPhone, payment_id AS paymentId, provider,
      proof_text AS proofText, proof_submitted_at AS proofSubmittedAt, reviewed_at AS reviewedAt,
      reviewed_by AS reviewedBy, admin_notes AS adminNotes, status, created_at AS createdAt, updated_at AS updatedAt
      FROM subscription_checkouts ORDER BY created_at DESC LIMIT 80`).all<Record<string, unknown>>();
    return Response.json({ checkouts: rows.results });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os pagamentos.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePlatformAdmin();
    await ensureCheckoutTable();
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim();
    const adminNotes = String(body.adminNotes ?? "").trim().slice(0, 2000);
    if (!id || !statuses.has(status)) return Response.json({ error: "Informe pagamento e status válido." }, { status: 400 });
    const now = new Date().toISOString();
    await database().prepare("UPDATE subscription_checkouts SET status = ?, admin_notes = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?")
      .bind(status, adminNotes, now, user.email.toLocaleLowerCase("pt-BR"), now, id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar o pagamento.");
  }
}
