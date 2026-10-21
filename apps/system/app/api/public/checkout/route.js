import { requestPublicUrl } from "@/lib/request-security";
import { recordOperation } from "@/lib/operation-events";
import { database, optionalText, requiredText } from "@/lib/database";
import { AsaasError } from "@/lib/asaas";
import { createAsaasPixCheckout, getPlatformBillingConfig } from "@/lib/billing";
import { MANUAL_PIX } from "@/lib/manual-pix";
import { isBillingCycle, getPlanSnapshot, isPlanCode } from "@/lib/plans";
import { assertRateLimit } from "@/lib/security";
import { ensureSubscriptionCheckoutTable, refreshSubscriptionCheckout } from "@/lib/subscription-checkout";
import { RequestError } from "@/lib/tenant";
function signupUrl(request, plan, checkoutId) {
    const url = requestPublicUrl(request);
    return `${url.origin}/entrar?signup=1&plan=${encodeURIComponent(plan)}&checkout=${encodeURIComponent(checkoutId)}`;
}
function manualCheckout(id) {
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
export async function POST(request) {
    try {
        await ensureSubscriptionCheckoutTable();
        const body = await request.json();
        const plan = optionalText(body.plan);
        if (!isPlanCode(plan))
            return Response.json({ error: "Escolha um plano válido." }, { status: 400 });
        const billingCycle = isBillingCycle(body.billingCycle) ? body.billingCycle : "monthly";
        const installments = Math.min(12, Math.max(1, Math.round(Number(body.installments ?? 1))));
        if (!Number.isInteger(Number(body.installments ?? 1)) || Number(body.installments ?? 1) < 1 || Number(body.installments ?? 1) > 12)
            return Response.json({ error: "Informe de 1 a 12 parcelas." }, { status: 400 });
        const requiresAsaasLink = installments > 1;
        const buyerName = requiredText(body.buyerName, "Nome");
        if (buyerName.length < 2 || buyerName.length > 100)
            return Response.json({ error: "Informe seu nome ou empresa, com 2 a 100 caracteres." }, { status: 400 });
        const buyerEmail = requiredText(body.buyerEmail, "E-mail").toLocaleLowerCase("pt-BR");
        if (!/^\S+@\S+\.\S+$/.test(buyerEmail))
            return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
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
    }
    catch (error) {
        if (error instanceof AsaasError || !(error instanceof RequestError))
            await recordOperation("payments", "error", "provider_unavailable");
        if (error instanceof AsaasError || error instanceof RequestError)
            return Response.json({ error: error.message }, { status: error.status });
        const message = error instanceof Error ? error.message : "Não foi possível gerar a cobrança.";
        return Response.json({ error: message }, { status: message.includes("obrigatório") ? 400 : 503 });
    }
}
export async function GET(request) {
    try {
        await ensureSubscriptionCheckoutTable();
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!id)
            return Response.json({ error: "Informe a cobrança." }, { status: 400 });
        await assertRateLimit(request, "public_checkout_status", id, 60, 60);
        const row = await database().prepare("SELECT * FROM subscription_checkouts WHERE id = ?").bind(id).first();
        if (!row)
            return Response.json({ error: "Cobrança não encontrada." }, { status: 404 });
        const current = await refreshSubscriptionCheckout(row);
        const status = String(current.status ?? "pending_payment");
        const provider = String(row.provider ?? "");
        return Response.json({ checkout: { id, plan: row.plan, billingCycle: row.billing_cycle, installments: Number(row.installments ?? 1), provider, status, signupUrl: status === "paid" ? signupUrl(request, String(row.plan), id) : "" } }, { headers: { "Cache-Control": "no-store" } });
    }
    catch (error) {
        if (error instanceof AsaasError || !(error instanceof RequestError))
            await recordOperation("payments", "error", "provider_unavailable");
        if (error instanceof AsaasError || error instanceof RequestError)
            return Response.json({ error: error.message }, { status: error.status });
        return Response.json({ error: "Não foi possível conferir o pagamento." }, { status: 503 });
    }
}
export async function PATCH(request) {
    try {
        await ensureSubscriptionCheckoutTable();
        const body = await request.json();
        const id = requiredText(body.id, "Cobrança");
        const proofText = requiredText(body.proofText, "Comprovante").slice(0, 2000);
        const row = await database().prepare("SELECT * FROM subscription_checkouts WHERE id = ?").bind(id).first();
        if (!row)
            return Response.json({ error: "Cobrança não encontrada." }, { status: 404 });
        if (row.provider !== "manual_pix")
            return Response.json({ error: "O pagamento pela Asaas é confirmado automaticamente. Use Conferir pagamento." }, { status: 400 });
        await assertRateLimit(request, "public_checkout_proof", id, 5, 15 * 60);
        if (String(row.status) === "paid")
            return Response.json({ checkout: { id, status: "paid", signupUrl: signupUrl(request, String(row.plan), id) } });
        const now = new Date().toISOString();
        await database().prepare("UPDATE subscription_checkouts SET proof_text = ?, proof_submitted_at = ?, status = 'awaiting_review', updated_at = ? WHERE id = ? AND status <> 'paid'")
            .bind(proofText, now, now, id).run();
        return Response.json({ checkout: { id, status: "awaiting_review", signupUrl: "" } });
    }
    catch (error) {
        if (error instanceof AsaasError || !(error instanceof RequestError))
            await recordOperation("payments", "error", "provider_unavailable");
        if (error instanceof RequestError)
            return Response.json({ error: error.message }, { status: error.status });
        const message = error instanceof Error ? error.message : "Não foi possível enviar o comprovante.";
        return Response.json({ error: message }, { status: message.includes("obrigatório") ? 400 : 503 });
    }
}
