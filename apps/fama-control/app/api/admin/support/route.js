import { supportMessages, addSupportMessage, ensureSupportConversation } from "@/lib/support-conversation";
import { isTrustedMutation } from "@/lib/request-security";
import { RequestError } from "@/lib/request-error";
import { readJsonObject } from "@/lib/request-body";
import { assertRateLimit } from "@/lib/security";
import { database } from "@/lib/database";
import { camelizeRow, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";
const statuses = new Set(["aberto", "em_analise", "resolvido"]);
async function legacyTickets() {
    try {
        const rows = await database().prepare("SELECT * FROM support_tickets ORDER BY created_at DESC").all();
        return rows.results ?? [];
    }
    catch (error) {
        if (!usesSupabase())
            throw error;
        console.warn("support_legacy_read_unavailable", error);
        return [];
    }
}
export async function GET() {
    try {
        await requirePlatformAdmin();
        await ensureSupportConversation();
        const legacy = await legacyTickets();
        const primary = usesSupabase() ? await selectRows("support_tickets", {}, { order: "created_at.desc" }) : [];
        const merged = new Map(legacy.map(row => [String(row.id), row]));
        for (const row of primary)
            merged.set(String(row.id), row);
        const tickets = Array.from(merged.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        const messages = await supportMessages(undefined, true);
        return Response.json({ tickets: tickets.map(row => ({ ...camelizeRow(row), messages: messages.filter(message => message.ticketId === row.id) })) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar os chamados.");
    }
}
export async function PATCH(request) {
    try {
        const admin = await requirePlatformAdmin();
        if (!isTrustedMutation(request))
            throw new RequestError("Origem da solicitação inválida.", 403);
        await assertRateLimit(request, "admin_support", admin.id, 60, 60);
        await ensureSupportConversation();
        const body = await readJsonObject(request);
        const id = String(body.id ?? "").trim();
        const status = String(body.status ?? "").trim();
        const adminNotes = String(body.adminNotes ?? "").trim().slice(0, 2000);
        if (!id || !statuses.has(status))
            return Response.json({ error: "Informe um chamado e status válido." }, { status: 400 });
        const now = new Date().toISOString();
        const legacy = (await legacyTickets()).find(ticket => ticket.id === id) ?? null;
        const current = usesSupabase() ? await selectOne("support_tickets", { id }) : legacy;
        if (!current && !legacy)
            throw new RequestError("Chamado não encontrado.", 404);
        const previous = current ?? legacy;
        const priority = body.priority === undefined ? String(previous.priority ?? "media") : String(body.priority);
        if (!["baixa", "media", "alta", "critica"].includes(priority))
            throw new RequestError("Prioridade inválida.", 400);
        const assignedTo = body.assignedTo === undefined ? String(previous.assigned_to ?? "") : String(body.assignedTo).trim().slice(0, 120);
        const reply = String(body.reply ?? "").trim();
        if (body.reply !== undefined && (reply.length < 2 || reply.length > 3000))
            throw new RequestError("Escreva uma resposta entre 2 e 3.000 caracteres.", 400);
        const savedNotes = body.adminNotes === undefined ? String(previous.admin_notes ?? "") : adminNotes;
        if (usesSupabase()) {
            const existing = await selectOne("support_tickets", { id });
            if (!existing && !legacy)
                return Response.json({ error: "Chamado não encontrado." }, { status: 404 });
            const update = { status, priority, assigned_to: assignedTo, admin_notes: savedNotes, updated_at: now };
            if (existing)
                await updateRows("support_tickets", update, { id });
            else
                await insertRow("support_tickets", { ...legacy, ...update });
        }
        else if (!legacy) {
            return Response.json({ error: "Chamado não encontrado." }, { status: 404 });
        }
        if (legacy) {
            const operation = database().prepare("UPDATE support_tickets SET status = ?, priority = ?, assigned_to = ?, admin_notes = ?, updated_at = ? WHERE id = ?").bind(status, priority, assignedTo, savedNotes, now, id).run();
            if (usesSupabase())
                await operation.catch(error => console.warn("support_legacy_sync_failed", error));
            else
                await operation;
        }
        if (reply)
            await addSupportMessage({ ticketId: id, organizationId: String(previous.organization_id), authorKind: "admin", authorName: admin.displayName || "Equipe Fama", body: reply, internal: body.internal === true });
        if (String(previous.status) !== status)
            await addSupportMessage({ ticketId: id, organizationId: String(previous.organization_id), authorKind: "admin", authorName: "Equipe Fama", body: "Situação atualizada: " + ({ aberto: "Aberto", em_analise: "Em análise", resolvido: "Resolvido" }[status] ?? status) });
        return Response.json({ ok: true });
    }
    catch (error) {
        return tenantError(error, "Não foi possível atualizar o chamado.");
    }
}
