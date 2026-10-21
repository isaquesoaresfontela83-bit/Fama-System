import { RequestError } from "@/lib/request-error";
export function validCalendarValue(raw) {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/);
    if (!match)
        return false;
    const [, y, m, d, h, min, sec] = match;
    const year = Number(y), month = Number(m), day = Number(d);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())
        return false;
    return h === undefined || (Number(h) < 24 && Number(min) < 60 && Number(sec ?? 0) < 60);
}
export function calendarDate(value, label, required = false) {
    if (value === undefined || value === null || value === "") {
        if (required)
            throw new RequestError(`${label} é obrigatório.`, 400);
        return "";
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !validCalendarValue(value)) {
        throw new RequestError(`${label}: informe uma data válida.`, 400);
    }
    return value;
}
