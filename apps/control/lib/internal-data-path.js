const tables = new Set([
    "organizations", "organization_members", "leads", "quotes", "appointments", "work_orders",
    "customers", "inventory_items", "transactions", "employees", "warranties", "contracts",
    "attachments", "legal_consents", "audit_logs", "recovery_snapshots", "privacy_requests",
    "request_rate_limits", "fama_quote_config", "suppliers", "purchases", "bank_accounts",
    "bank_movements", "bank_connections", "platform_settings", "support_tickets", "support_messages",
    "fama_whatsapp_connections", "fama_whatsapp_links", "fama_whatsapp_events",
    "fama_chat_conversations", "fama_chat_messages",
]);
const procedures = new Set(["fama_consume_rate_limit", "fama_create_customer_company", "schedule_warranty", "fama_whatsapp_member_access", "fama_whatsapp_claim_event", "fama_get_block_rules", "fama_recovery_payload", "fama_chat_record_message", "fama_chat_reserve_send", "fama_chat_message_page", "fama_chat_delivery", "fama_internal_chat"]);
const methods = new Set(["GET", "POST", "PATCH", "DELETE"]);
export function allowedDataPath(path, method = "GET") {
    if (!methods.has(method) || !path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path))
        return false;
    // Check the original segments before URL normalization can hide traversal.
    const rawPath = path.split(/[?#]/, 1)[0];
    for (const segment of rawPath.split("/")) {
        let decoded;
        try {
            decoded = decodeURIComponent(segment);
        }
        catch {
            return false;
        }
        if (decoded === "." || decoded === ".." || /[\/\\\u0000-\u001f\u007f]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded))
            return false;
    }
    const url = new URL(path, "https://backend.invalid");
    if (url.origin !== "https://backend.invalid" || url.hash)
        return false;
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname))
        return method === "GET" && !url.search;
    const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (table && ["fama_internal_threads", "fama_internal_participants"].includes(table))
        return method === "GET";
    if (table)
        return tables.has(table);
    const procedure = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
    if (procedure)
        return method === "POST" && procedures.has(procedure);
    return /^\/storage\/v1\/object\/(?:sign\/)?fama-documents(?:\/[a-zA-Z0-9_%.-]+)+$/.test(url.pathname)
        || url.pathname === "/storage/v1/object/fama-documents";
}
