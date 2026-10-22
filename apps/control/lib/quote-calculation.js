const rules = {
    normal: { label: "Normal", rate: 0 },
    urgente: { label: "Urgente (+10%)", rate: 0.1 },
    emergencia: { label: "Emergência (+20%)", rate: 0.2 },
};
export function quoteUrgency(value) {
    const normalized = String(value ?? "").trim().toLocaleLowerCase("pt-BR");
    const urgency = normalized.includes("emerg") ? "emergencia" : normalized.includes("urgent") ? "urgente" : "normal";
    return { urgency, ...rules[urgency] };
}
export function quoteUrgencySurcharge(baseCents, urgency) {
    return Math.round(Math.max(0, baseCents) * quoteUrgency(urgency).rate);
}
export function quoteTravelCents(value) {
    const raw = String(value ?? "").trim();
    if (!raw)
        return 0;
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    return Math.round(Number(normalized) * 100) || 0;
}
export function unpackQuoteNotes(value) {
    try {
        const parsed = JSON.parse(value);
        return { text: parsed.text ?? "", details: parsed.details ?? {} };
    }
    catch {
        return { text: value || "", details: {} };
    }
}
