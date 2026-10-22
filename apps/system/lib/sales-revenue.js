export function financeDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
}
export function saleRevenueForWorkOrder(order) {
    const amountCents = Math.round(Number(order.amountCents) || 0);
    if (amountCents <= 0) return null;
    let details = {};
    try {
        const notes = JSON.parse(String(order.notes ?? ""));
        if (notes && typeof notes === "object" && !Array.isArray(notes) && notes.details && typeof notes.details === "object") details = notes.details;
    } catch { /* legacy plain text note */ }
    const sourceQuoteId = typeof details.sourceQuoteId === "string" ? details.sourceQuoteId : "";
    const sourceType = sourceQuoteId ? "quote" : "workOrder";
    const sourceId = sourceQuoteId || String(order.id ?? "");
    if (!sourceId) return null;
    const createdAt = String(order.createdAt ?? new Date().toISOString());
    const dueDate = financeDate(createdAt);
    const description = [`Venda OS ${String(order.osNumber ?? "").trim()}`, String(order.service ?? "").trim(), String(order.clientName ?? "").trim()]
        .filter(Boolean).join(" · ").slice(0, 240);
    return { id: `auto-sale:${sourceType}:${sourceId}`, description, type: "receita", category: "Vendas", amountCents, dueDate, status: "pendente", createdAt };
}
