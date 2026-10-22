// Form values are separate from stored values (cents, structured notes and UTC).
export function recordNotes(value) {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return { text: String(parsed.text ?? ""), details: parsed.details && typeof parsed.details === "object" && !Array.isArray(parsed.details) ? parsed.details : {} };
    } catch { /* Older records contain plain text. */ }
    return { text: String(value ?? ""), details: {} };
}
export function localRecordDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const part = key => parts.find(item => item.type === key)?.value;
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function recordEditFields(entity, record) {
    const notes = recordNotes(record.notes);
    const fields = { ...record, ...notes.details, notes: entity === "warranties" ? record.notes : notes.text };
    for (const [input, stored] of [["estimatedValue", "estimatedValueCents"], ["amount", "amountCents"], ["cost", "costCents"], ["monthly", "monthlyCents"], ["materials", "materialsCents"], ["labor", "laborCents"], ["discount", "discountCents"]]) {
        if (record[stored] !== undefined) fields[input] = (Number(record[stored]) / 100).toFixed(2);
    }
    for (const key of ["startAt", "scheduledAt"]) if (record[key]) fields[key] = localRecordDateTime(record[key]);
    if (entity === "quotes") {
        fields.urgency = String(notes.details.urgency || "normal").toLowerCase().startsWith("emerg") ? "emergencia" : String(notes.details.urgency || "normal").toLowerCase().startsWith("urgent") ? "urgente" : "normal";
    }
    return fields;
}
