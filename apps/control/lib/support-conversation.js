import { database } from "./database";
import { camelizeRow, insertRow, selectRows, usesSupabase } from "./supabase";
export async function ensureSupportConversation() {
    if (usesSupabase())
        return;
    const db = database();
    await db.prepare("CREATE TABLE IF NOT EXISTS support_tickets (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, organization_name TEXT NOT NULL DEFAULT '', user_id TEXT NOT NULL DEFAULT '', user_email TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'melhoria', priority TEXT NOT NULL DEFAULT 'media', title TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'aberto', admin_notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS support_messages (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, organization_id TEXT NOT NULL, author_kind TEXT NOT NULL, author_name TEXT NOT NULL, body TEXT NOT NULL, internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages (ticket_id, created_at)").run();
    const columns = await db.prepare("PRAGMA table_info(support_tickets)").all();
    if (!columns.results.some(column => column.name === "assigned_to"))
        await db.prepare("ALTER TABLE support_tickets ADD COLUMN assigned_to TEXT NOT NULL DEFAULT ''").run();
}
export async function supportMessages(organizationId, includeInternal = false) {
    await ensureSupportConversation();
    const rows = usesSupabase() ? await selectRows("support_messages", { ...(organizationId ? { organization_id: organizationId } : {}), ...(!includeInternal ? { internal: false } : {}) }, { order: "created_at.desc", limit: 2000 }) : (await database().prepare("SELECT * FROM support_messages WHERE (? = '' OR organization_id = ?) AND (? = 1 OR internal = 0) ORDER BY created_at DESC LIMIT 2000").bind(organizationId ?? "", organizationId ?? "", includeInternal ? 1 : 0).all()).results;
    return rows.reverse().map(row => ({ ...camelizeRow(row), internal: row.internal === true || row.internal === 1 }));
}
export async function addSupportMessage(input) {
    await ensureSupportConversation();
    const row = { id: crypto.randomUUID(), ticket_id: input.ticketId, organization_id: input.organizationId, author_kind: input.authorKind, author_name: input.authorName.slice(0, 160), body: input.body, internal: input.internal === true, created_at: new Date().toISOString() };
    if (usesSupabase())
        await insertRow("support_messages", row);
    else
        await database().prepare("INSERT INTO support_messages (id,ticket_id,organization_id,author_kind,author_name,body,internal,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(row.id, row.ticket_id, row.organization_id, row.author_kind, row.author_name, row.body, row.internal ? 1 : 0, row.created_at).run();
    return camelizeRow(row);
}
