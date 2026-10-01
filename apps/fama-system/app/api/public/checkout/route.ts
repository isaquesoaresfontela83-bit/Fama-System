import { database, optionalText, requiredText } from "@/lib/database";
import { AsaasError } from "@/lib/asaas";
import { createAsaasPixCheckout, getAsaasPayment, getPlatformBillingConfig, isPaidAsaasStatus } from "@/lib/billing";
import { MANUAL_PIX } from "@/lib/manual-pix";
import { isBillingCycle, getPlanSnapshot, isPlanCode } from "@/lib/plans";
import { assertRateLimit } from "@/lib/security";

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
  const columns = new Set(info.results.map((entry) => entry.name));
  for (const [column, definition] of [
    ["provider", "TEXT NOT NULL DEFAULT 'manual_pix'"],
    ["billing_cycle", "TEXT NOT NULL DEFAULT 'monthly'"],
    ["installments", "INTEGER NOT NULL DEFAULT 1"],
    ["proof_text", "TEXT NOT NULL DEFAULT ''"],
    ["proof_submitted_at", "TEXT NOT NULL DEFAULT ''"],
    ["reviewed_at", "TEXT NOT NULL DEFAULT ''"],
    ["reviewed_by", "TEXT NOT NULL DEFAULT ''"],
    ["admin_notes", "TEXT NOT NULL DEFAULT ''"],
  ] as const) {
    if (!columns.has(column)) await database().prepare(`ALTER TABLE subscription_checkouts ADD COLUMN ${column} ${definition}`).run();
  }
}

function signupUrl(request: Request, plan: string, checkoutId: string) {
  const url = new URL(request.url);
  return `${url.origin}/entrar?signup=1&plan=${encodeURIComponent(plan)}&checkout=${encodeURIComponent(checkoutId)}`;
}

function manualCheckout(id: string) {
  return {
    paymentId: `manual:${id}`,
    customerId: "",
    invoiceUrl: "",
    pixQrCode: "",
    pixCopyPaste: MANUAL_PIX.copyPaste,
    dueDate: new Date().toISOString().slice(0, 10),
    provider: "manual_pix",
    installments: 1,
  };
}


export async function POST(request: Request) {
  try {
    await ensureCheckoutTable();
    const body = await request.json() as Record<string, unknown>;
    const plan = optionalText(body.plan);
    if (!isPlanCode(plan)) return Response.json({ error: "Escolha um plano válido." }, { status: 400 });
    const billingCycle = isBillingCycle(body.billingCycle) ? body.billingCycle : "monthly";
    const installments = Math.min(12, Math.max(1, Math.round(Number(body.installments ?? 1))));
    if (!Number.isInteger(Number(body.installments ?? 1)) || Number(body.installments ?? 1) < 1 || Number(body.installments ?? 1) > 12) return Response.json({ error: "Informe de 1 a 12 parcelas." }, { status: 400 });
    const requiresAsaasLink = installments > 1;

    const buyerName = requiredText(body.buyerName, "Nome");
    const buyerEmail = requiredText(body.buyerEmail, "E-mail").toLocaleLowerCase("pt-BR");
    if (!/^\S+@\S+\.\S+$/.test(buyerEmail)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    await assertRateLimit(request, "public_checkout", buyerEmail, 8, 15 * 60);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const billingConfig = await getPlatformBillingConfig();
    if (!billingConfig && requiresAsaasLink) {
      return Response.json({ error: "Parcelamento por link exige a Asaas configurada na plataforma." }, { status: 503 });
    }
    const checkout = billingConfig
      ? await createAsaasPixCheckout({
        organizationId: `checkout:${id}`,
        organizationName: buyerName,
        plan,
        buyerName,
        buyerEmail,
        buyerDocument: optionalText(body.buyerDocument),
        buyerPhone: optionalText(body.buyerPhone),
        billingCycle,
        installments,
        billingConfig,
      })
      : manualCheckout(id);
    const provider = "provider" in checkout && checkout.provider === "manual_pix" ? "manual_pix" : "asaas";
    const row = {
      id,
      plan,
      billing_cycle: billingCycle,
      installments,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_document: optionalText(body.buyerDocument),
      buyer_phone: optionalText(body.buyerPhone),
      payment_id: checkout.paymentId,
      customer_id: checkout.customerId,
      provider,
      proof_text: "",
      proof_submitted_at: "",
      reviewed_at: "",
      reviewed_by: "",
      admin_notes: "",
      status: "pending_payment",
      created_at: now,
      updated_at: now,
    };
    await database().prepare(`INSERT INTO subscription_checkouts (id, plan, billing_cycle, installments, buyer_name, buyer_email, buyer_document, buyer_phone, payment_id, customer_id, provider, proof_text, proof_submitted_at, reviewed_at, reviewed_by, admin_notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', '', 'pending_payment', ?, ?)`)
      .bind(id, plan, billingCycle, installments, row.buyer_name, row.buyer_email, row.buyer_document, row.buyer_phone, checkout.paymentId, checkout.customerId, provider, now, now).run();
    return Response.json({
      checkout: {
        ...checkout,
        id,
        provider,
        encodedImage: checkout.pixQrCode,
        payload: checkout.pixCopyPaste,
        qrImagePath: provider === "manual_pix" ? MANUAL_PIX.qrImagePath : "",
        signupUrl: "",
      },
      plan: await getPlanSnapshot(plan),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Não foi possível gerar a cobrança.";
    return Response.json({ error: message }, { status: message.includes("obrigatório") ? 400 : 503 });
  }
}

export async function GET(request: Request) {
  try {
    await ensureCheckoutTable();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return Response.json({ error: "Informe a cobrança." }, { status: 400 });
    const row = await database().prepare("SELECT * FROM subscription_checkouts WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Cobrança não encontrada." }, { status: 404 });
    let status = String(row.status ?? "pending_payment");
    const paymentId = String(row.payment_id ?? "");
    const provider = String(row.provider ?? "");
    const billingConfig = provider === "asaas" ? await getPlatformBillingConfig() : null;
    if (status !== "paid" && provider === "asaas" && paymentId && billingConfig) {
      const payment = await getAsaasPayment(paymentId, billingConfig);
      if (isPaidAsaasStatus(payment.status)) {
        status = "paid";
        const now = new Date().toISOString();
        await database().prepare("UPDATE subscription_checkouts SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
      }
    }
    return Response.json({ checkout: { id, plan: row.plan, billingCycle: row.billing_cycle, installments: Number(row.installments ?? 1), provider, status, signupUrl: status === "paid" ? signupUrl(request, String(row.plan), id) : "" } });
  } catch (error) {
    if (error instanceof AsaasError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Não foi possível conferir o pagamento." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureCheckoutTable();
    const body = await request.json() as Record<string, unknown>;
    const id = requiredText(body.id, "Cobrança");
    const proofText = requiredText(body.proofText, "Comprovante").slice(0, 2000);
    const row = await database().prepare("SELECT * FROM subscription_checkouts WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Cobrança não encontrada." }, { status: 404 });
    if (String(row.status) === "paid") return Response.json({ checkout: { id, status: "paid", signupUrl: signupUrl(request, String(row.plan), id) } });
    const now = new Date().toISOString();
    await database().prepare("UPDATE subscription_checkouts SET proof_text = ?, proof_submitted_at = ?, status = 'awaiting_review', updated_at = ? WHERE id = ?")
      .bind(proofText, now, now, id).run();
    return Response.json({ checkout: { id, status: "awaiting_review", signupUrl: "" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar o comprovante.";
    return Response.json({ error: message }, { status: message.includes("obrigatório") ? 400 : 503 });
  }
}
