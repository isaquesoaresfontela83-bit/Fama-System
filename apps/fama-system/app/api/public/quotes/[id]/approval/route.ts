import { database } from "@/lib/database";
import { decryptRecordFields, encryptRecordFields } from "@/lib/crypto";
import { camelizeRow, selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { assertRateLimit, logAudit } from "@/lib/security";
import { isTrustedMutation } from "@/lib/request-security";

async function findQuote(id: string) {
  const db = database();
  const row = usesSupabase()
    ? await selectOne<Record<string, unknown>>("quotes", { id })
    : await db.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return usesSupabase() ? await decryptRecordFields(camelizeRow<Record<string, unknown>>(row), ["notes"]) : row;
}

function notesOf(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "")) as { text?: string; details?: Record<string, unknown> };
    return { text: String(parsed.text ?? ""), details: parsed.details ?? {} };
  } catch { return { text: String(value ?? ""), details: {} as Record<string, unknown> }; }
}

function matchesToken(stored: string, provided: string) {
  if (stored.length !== provided.length) return false;
  let difference = 0;
  for (let index = 0; index < stored.length; index += 1) difference |= stored.charCodeAt(index) ^ provided.charCodeAt(index);
  return difference === 0;
}

function publicQuote(quote: Record<string, unknown>, details: Record<string, unknown>) {
  const paymentMethod = String(details.paymentMethod ?? "");
  const installments = Math.max(1, Math.round(Number(details.installments ?? 1)));
  const cardRate = Number(details.cardRate ?? 0);
  const calculatedPayment = paymentMethod === "credit"
    ? `Cartão de crédito${installments > 1 ? ` em ${installments}x` : ""}${cardRate ? ` com juros de ${cardRate}%` : ""}`
    : paymentMethod === "boleto" ? "Boleto" : paymentMethod === "pix" ? "Pix / dinheiro" : "";
  return {
    id: String(quote.id),
    quoteNumber: String(quote.quoteNumber ?? quote.quote_number ?? ""),
    clientName: String(quote.clientName ?? quote.client_name ?? ""),
    service: String(quote.service ?? ""),
    totalCents: Number(quote.totalCents ?? quote.total_cents ?? 0),
    validUntil: String(quote.validUntil ?? quote.valid_until ?? ""),
    status: String(quote.status ?? ""),
    paymentTerms: String(details.paymentTerms || calculatedPayment),
    items: String(details.poolItems ?? details.products ?? ""),
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await assertRateLimit(request, "public_quote_preview", id, 30, 60);
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{64}$/i.test(token)) return Response.json({ error: "Link de aprovação inválido." }, { status: 404 });
    const quote = await findQuote(id);
    if (!quote) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
    const { details } = notesOf(quote.notes);
    if (typeof details.approvalToken !== "string" || !matchesToken(details.approvalToken, token)) return Response.json({ error: "Link de aprovação inválido ou expirado." }, { status: 404 });
    return Response.json({ quote: publicQuote(quote, details) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("public_quote_preview_failed", error);
    return Response.json({ error: "Não foi possível carregar esta proposta agora." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedMutation(request)) return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
    const { id } = await context.params;
    await assertRateLimit(request, "public_quote_response", id, 8, 60);
    const body = await request.json() as Record<string, unknown>;
    const token = String(body.token ?? "");
    const decision = String(body.decision ?? "");
    const customerName = String(body.customerName ?? "").trim().slice(0, 120);
    const reason = String(body.reason ?? "").trim().slice(0, 1000);
    if (!/^[a-f0-9]{64}$/i.test(token) || !["aprovado", "recusado"].includes(decision) || customerName.length < 2 || body.confirmed !== true) {
      return Response.json({ error: "Informe seu nome e confirme sua resposta antes de enviar." }, { status: 400 });
    }
    const quote = await findQuote(id);
    if (!quote) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
    const { text, details } = notesOf(quote.notes);
    if (typeof details.approvalToken !== "string" || !matchesToken(details.approvalToken, token)) return Response.json({ error: "Link de aprovação inválido ou expirado." }, { status: 404 });
    if (quote.status !== "enviado") {
      return Response.json({ status: quote.status, alreadyResponded: ["aprovado", "recusado"].includes(String(quote.status)) }, { status: 409 });
    }
    const validUntil = String(quote.validUntil ?? quote.valid_until ?? "");
    if (validUntil && validUntil < new Date().toISOString().slice(0, 10)) return Response.json({ error: "A validade desta proposta terminou." }, { status: 410 });
    const respondedAt = new Date().toISOString();
    const notes = JSON.stringify({ text, details: { ...details, approvalResponse: JSON.stringify({ decision, customerName, reason, respondedAt }) } });
    const db = database();
    if (usesSupabase()) {
      const protectedFields = await encryptRecordFields({ notes }, ["notes"]);
      const rows = await updateRows<Record<string, unknown>>("quotes", { status: decision, notes: protectedFields.notes, updated_at: respondedAt }, { id, status: "enviado" });
      if (!rows.length) return Response.json({ error: "A proposta já recebeu uma resposta." }, { status: 409 });
    } else {
      const result = await db.prepare("UPDATE quotes SET status = ?, notes = ?, updated_at = ? WHERE id = ? AND status = 'enviado'").bind(decision, notes, respondedAt, id).run();
      if (!result.meta.changes) return Response.json({ error: "A proposta já recebeu uma resposta." }, { status: 409 });
    }
    await logAudit({ organizationId: String(quote.organizationId ?? quote.organization_id ?? ""), actorUserId: null, eventType: "security", entityType: "quote_approval", recordId: id, metadata: { decision, customerName, respondedAt } });
    return Response.json({ status: decision, respondedAt });
  } catch (error) {
    console.error("public_quote_response_failed", error);
    return Response.json({ error: "Não foi possível registrar sua resposta agora." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
