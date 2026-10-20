import { env } from "cloudflare:workers";
import { database } from "@/lib/database";
import { isBackupRequest } from "@/lib/backup-auth";
import { isBillingConfigured } from "@/lib/billing";
export async function GET(request) {
    if (!await isBackupRequest(request))
        return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
    try {
        const db = database();
        const tableNames = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
        const tables = new Set(tableNames.results.map(row => row.name));
        const grouped = async (table, date) => tables.has(table) ? (await db.prepare("SELECT status,COUNT(*) AS count,MAX(" + date + ") AS lastAt FROM " + table + " GROUP BY status").all()).results : [];
        const [checkouts, invoices, events, webhook] = await Promise.all([
            grouped("subscription_checkouts", "updated_at"),
            grouped("fiscal_invoices", "updated_at"),
            tables.has("fama_operation_events") ? db.prepare("SELECT category,outcome,code,occurred_at AS occurredAt FROM fama_operation_events ORDER BY occurred_at DESC LIMIT 100").all() : Promise.resolve({ results: [] }),
            tables.has("billing_webhook_events") ? db.prepare("SELECT COUNT(*) AS count,MAX(processed_at) AS lastAt FROM billing_webhook_events").first() : Promise.resolve(null),
        ]);
        const values = env;
        return Response.json({ checkedAt: new Date().toISOString(), database: true, payments: { configured: isBillingConfigured(), environment: String(values.FAMA_ASAAS_ENVIRONMENT ?? "sandbox"), checkouts, webhook }, fiscal: { invoices }, email: { deliveryVerified: false }, events: events.results }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch {
        return Response.json({ error: "Não foi possível consultar a operação." }, { status: 503 });
    }
}
