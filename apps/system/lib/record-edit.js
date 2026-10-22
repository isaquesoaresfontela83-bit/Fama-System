import { cents, dateTime } from "@/lib/database";
import { calendarDate } from "@/lib/calendar";
import { RequestError } from "@/lib/request-error";
import { quoteCardPayment, quoteUrgency } from "@/lib/quote-calculation";
import { poolQuoteQuantity } from "@/lib/pool-quote-catalog";
import { readQuoteConfig } from "@/lib/quote-config";
import { taxDocumentCode } from "@/lib/registration-lookup";
import { recordNotes } from "@/lib/record-edit-fields";
const fail = message => { throw new RequestError(message, 400); };
function text(value, max = 4000) {
    if (typeof value !== "string") fail("Informe um texto válido.");
    if (value.length > max) fail(`Use até ${max} caracteres.`);
    return value.trim();
}
function number(value, maximum = 1_000_000_000) {
    const raw = String(value).trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(raw)) fail("Informe um número positivo válido.");
    const result = Number(raw.replace(",", "."));
    if (!Number.isFinite(result) || result > maximum) fail("O número informado está fora do limite.");
    return result;
}
export async function editedRecord(entity, body, existing, { organizationId, canManageCosts }) {
    const patch = {};
    const notes = recordNotes(existing.notes);
    let noteChanged = false;
    const assign = (key, validate = value => text(value)) => { if (Object.hasOwn(body, key)) patch[key] = validate(body[key]); };
    const required = key => assign(key, value => { const result = text(value); if (!result) fail(`${key}: preencha o campo obrigatório.`); return result; });
    const monetary = (input, output) => { if (Object.hasOwn(body, input)) patch[output] = cents(body[input]); };
    const details = keys => {
        for (const key of keys) if (Object.hasOwn(body, key)) {
            notes.details[key] = text(body[key]); noteChanged = true;
        }
    };
    const structured = () => { if (Object.hasOwn(body, "notes")) { notes.text = text(body.notes); noteChanged = true; } };
    if (entity === "leads") {
        for (const key of ["name", "phone", "interest"]) required(key);
        for (const key of ["source", "nextAction"]) assign(key);
        monetary("estimatedValue", "estimatedValueCents");
        if (body.status !== undefined) { if (!["novo", "contato", "visita", "proposta", "negociacao", "ganho", "perdido"].includes(body.status)) fail("Etapa inválida."); assign("status"); }
    } else if (entity === "appointments") {
        required("title"); required("clientName");
        assign("startAt", value => { const result = dateTime(value); if (!result) fail("Informe a data e hora."); return result; });
        for (const key of ["address", "technician", "kind"]) assign(key);
        details(["frequency", "duration", "routeOrder"]); structured();
    } else if (entity === "workOrders") {
        if (existing.status === "concluida") throw new RequestError("O serviço já foi concluído. O relatório assinado deve ser preservado.", 409);
        required("clientName"); required("service"); assign("scheduledAt", dateTime); assign("technician"); assign("productsUsed");
        for (const [key, maximum] of [["ph", 14], ["chlorine", 100], ["alkalinity", 2000]]) assign(key, value => value === "" ? null : number(value, maximum));
        details(["calciumHardness", "stabilizer", "waterAppearance", "checklist"]); structured();
        for (const key of ["productCost", "laborCost", "travelCost"]) if (body[key] !== undefined) {
            const value = String(body[key]).trim() ? (cents(body[key]) / 100).toFixed(2) : "";
            const before = String(notes.details[key] ?? "");
            if (!canManageCosts && value !== before && !(value && before && cents(value) === cents(before))) throw new RequestError("Seu perfil não pode alterar custos financeiros.", 403);
            if (canManageCosts) { notes.details[key] = value; noteChanged = true; }
        }
        if (body.amount !== undefined) {
            const amount = cents(body.amount);
            if (!canManageCosts && amount !== existing.amountCents) throw new RequestError("Seu perfil não pode alterar o valor do serviço.", 403);
            if (canManageCosts) patch.amountCents = amount;
        }
    } else if (entity === "customers") {
        required("name"); required("phone");
        for (const key of ["email", "address", "poolType", "plan"]) assign(key);
        if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) fail("E-mail inválido.");
        if (body.clientDocument !== undefined) {
            const document = taxDocumentCode(text(body.clientDocument));
            if (document && !/^(?:[0-9]{11}|[A-Z0-9]{12}[0-9]{2})$/.test(document)) fail("CPF/CNPJ inválido.");
            notes.details.clientDocument = document; noteChanged = true;
        }
        assign("poolVolume", value => value === "" ? null : Math.round(number(value)));
        if (body.poolVolume === "" && [body.poolLength, body.poolWidth, body.poolDepth].every(value => String(value ?? "").trim())) {
            const factor = body.poolShape === "redonda" ? 0.785 : body.poolShape === "oval" ? 0.89 : 1;
            patch.poolVolume = Math.round(number(body.poolLength) * number(body.poolWidth) * number(body.poolDepth) * factor * 1000);
        }
        details(["poolShape", "poolLength", "poolWidth", "poolDepth", "filterType", "pump", "frequency", "problemHistory", "billingDay", "responsible"]); structured();
    } else if (entity === "inventory") {
        required("name"); assign("sku"); assign("unit");
        assign("quantity", number); assign("minimumQuantity", number); monetary("cost", "costCents");
    } else if (entity === "transactions") {
        required("description"); assign("category"); monetary("amount", "amountCents"); assign("dueDate", value => calendarDate(value, "Vencimento"));
        if (body.type !== undefined) { if (!["receita", "despesa"].includes(body.type)) fail("Tipo inválido."); assign("type"); }
        if (body.status !== undefined) { if (!["pendente", "pago", "atrasado"].includes(body.status)) fail("Status inválido."); assign("status"); }
    } else if (entity === "employees") {
        required("name"); required("role"); assign("phone");
        if (body.color !== undefined) { if (!["aqua", "blue", "violet", "orange"].includes(body.color)) fail("Cor inválida."); assign("color"); }
        if (body.active !== undefined) { if (![true, false, "true", "false"].includes(body.active)) fail("Situação inválida."); patch.active = body.active === true || body.active === "true"; }
    } else if (entity === "warranties") {
        required("clientName"); required("item"); assign("originReference"); assign("notes");
        assign("purchaseDate", value => calendarDate(value, "Compra/entrega")); assign("expiresAt", value => calendarDate(value, "Validade", true));
        if ((patch.purchaseDate ?? existing.purchaseDate) && (patch.expiresAt ?? existing.expiresAt) < (patch.purchaseDate ?? existing.purchaseDate)) fail("A validade deve ser posterior à compra.");
    } else if (entity === "contracts") {
        required("clientName"); required("service");
        for (const key of ["clientDocument", "clientAddress", "frequency", "terms"]) assign(key);
        assign("startDate", value => calendarDate(value, "Início", true)); assign("endDate", value => calendarDate(value, "Término", true));
        if ((patch.endDate ?? existing.endDate) < (patch.startDate ?? existing.startDate)) fail("O término deve ser posterior ao início.");
        monetary("monthly", "monthlyCents"); assign("paymentDay", value => { if (value === "") return null; const day = number(value, 31); if (!Number.isInteger(day) || day < 1) fail("Dia inválido."); return day; });
    } else if (entity === "quotes") {
        required("clientName"); assign("validUntil", value => calendarDate(value, "Validade")); structured();
        const config = await readQuoteConfig(organizationId);
        let lines;
        try { lines = JSON.parse(body.poolItems || "[]"); } catch { fail("Confira os itens do orçamento."); }
        const savedLines = (() => { try { return JSON.parse(notes.details.poolItems || "[]"); } catch { return []; } })();
        const legacy = !Array.isArray(savedLines) || !savedLines.length;
        if (!Array.isArray(lines) || lines.length > 50 || (!lines.length && !legacy)) fail("Adicione de 1 a 50 itens ao orçamento.");
        const calculated = lines.map(line => {
            const category = config.catalog.find(group => group.category === line?.category);
            const item = category?.items.find(item => item.name === line?.name);
            if (!item) fail("Um serviço não está mais no catálogo. Selecione outro item.");
            const dimensions = line.dimensions && typeof line.dimensions === "object" && !Array.isArray(line.dimensions) ? line.dimensions : {};
            const quantity = poolQuoteQuantity(item, dimensions);
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) fail("Informe medidas válidas.");
            return { category: category.category, name: item.name, unit: item.unit, quantity, unitPrice: item.price, markup: item.markup, totalCents: Math.round(quantity * item.price * (1 + item.markup / 100) * 100), dimensions };
        });
        patch.service = calculated.length ? calculated.map(line => line.name).join(", ") : text(body.service ?? existing.service);
        if (!patch.service) fail("Informe o serviço.");
        patch.materialsCents = calculated.length ? calculated.reduce((sum, line) => sum + line.totalCents, 0) : cents(body.materials ?? existing.materialsCents / 100);
        patch.laborCents = cents(body.labor); patch.discountCents = cents(body.discount);
        const travelCents = cents(body.travel), urgency = quoteUrgency(body.urgency);
        const rate = Math.max(0, Math.min(500, config.urgency[urgency.urgency]));
        const subtotal = patch.materialsCents + patch.laborCents + travelCents;
        const baseTotal = Math.max(0, subtotal + Math.round(subtotal * rate / 100) - patch.discountCents);
        const paymentMethod = ["pix", "credit", "boleto"].includes(body.paymentMethod) ? body.paymentMethod : "pix";
        const cardRate = body.cardRate === "" ? 0 : number(body.cardRate ?? "0", 50);
        const installments = Math.max(1, Math.min(24, Math.round(number(body.installments ?? "1", 24))));
        const card = quoteCardPayment(baseTotal, paymentMethod === "credit" ? cardRate : 0);
        patch.totalCents = card.totalCents;
        details(["paymentTerms"]);
        Object.assign(notes.details, { ...(calculated.length ? { poolItems: JSON.stringify(calculated), products: JSON.stringify(calculated) } : {}), travel: (travelCents / 100).toFixed(2), urgency: urgency.label, urgencyRate: String(rate), paymentMethod, installments: String(installments), cardRate: String(cardRate), cardFee: String(card.feeCents), baseTotal: String(baseTotal), installmentValue: String(Math.ceil(card.totalCents / installments)) });
        noteChanged = true;
    } else fail("Tipo de registro inválido.");
    if (noteChanged) patch.notes = JSON.stringify(notes);
    if (!Object.keys(patch).length) fail("Nenhum campo para atualizar.");
    return patch;
}
