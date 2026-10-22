import { database } from "./database";
export async function recordOperation(category, outcome, code) {
    try {
        const db = database();
        await db.prepare("CREATE TABLE IF NOT EXISTS fama_operation_events (id TEXT PRIMARY KEY, category TEXT NOT NULL, outcome TEXT NOT NULL, code TEXT NOT NULL, occurred_at TEXT NOT NULL)").run();
        await db.prepare("INSERT INTO fama_operation_events (id,category,outcome,code,occurred_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), category, outcome, code.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80), new Date().toISOString()).run();
    }
    catch { /* Monitoring cannot interrupt an operation. */ }
}
