import { env } from "cloudflare:workers";
import { RequestError } from "@/lib/request-error";
import { validCalendarValue } from "@/lib/calendar";
export function database() {
    if (!env.DB)
        throw new Error("Banco de dados indisponível.");
    return env.DB;
}
export function requiredText(value, label) {
    if (typeof value !== "string")
        throw new RequestError(`${label}: informe um texto válido.`, 400);
    const text = String(value ?? "").trim();
    if (!text)
        throw new Error(`${label} é obrigatório.`);
    return text;
}
export function optionalText(value) {
    return String(value ?? "").trim();
}
export function numberValue(value, fallback = 0) {
    const normalized = String(value ?? "").trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}
export function cents(value) {
    if (value === undefined || value === null || value === "")
        return 0;
    if (typeof value !== "string" && typeof value !== "number")
        throw new RequestError("Informe um valor monetário válido.", 400);
    let normalized = String(value).trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
    if (!normalized)
        return 0;
    if (typeof value === "string") {
        if (normalized.includes(",")) {
            if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(normalized))
                throw new RequestError("Informe um valor monetário válido.", 400);
            normalized = normalized.replace(/\./g, "").replace(",", ".");
        }
        else if ((normalized.match(/\./g) ?? []).length > 1) {
            if (!/^\d{1,3}(?:\.\d{3})+$/.test(normalized))
                throw new RequestError("Informe um valor monetário válido.", 400);
            normalized = normalized.replace(/\./g, "");
        }
        else if (!/^\d+(?:\.\d+)?$/.test(normalized))
            throw new RequestError("Informe um valor monetário válido.", 400);
    }
    const parsed = Number(normalized);
    const amount = Math.round(parsed * 100);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(amount))
        throw new RequestError("Informe um valor monetário válido.", 400);
    return amount;
}
export function dateTime(value) {
    if (value !== undefined && value !== null && typeof value !== "string")
        throw new RequestError("Informe uma data e hora válidas.", 400);
    const raw = optionalText(value);
    if (!raw)
        return "";
    if (!validCalendarValue(raw))
        throw new RequestError("Informe uma data e hora válidas.", 400);
    const withZone = raw.includes("T") && !/(Z|[+-]\d{2}:\d{2})$/.test(raw) ? `${raw}-03:00` : raw;
    const parsed = new Date(withZone);
    if (!Number.isFinite(parsed.getTime()))
        throw new RequestError("Informe uma data e hora válidas.", 400);
    return parsed.toISOString();
}
export function reference(prefix) {
    const year = new Date().getUTCFullYear().toString().slice(-2);
    return `${prefix}-${year}${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
}
