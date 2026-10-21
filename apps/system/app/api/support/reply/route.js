import { requireTenant, tenantError, RequestError } from "@/lib/tenant";
import { readJsonObject } from "@/lib/request-body";
import { database } from "@/lib/database";
import { selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { addSupportMessage } from "@/lib/support-conversation";
import { assertRateLimit } from "@/lib/security";
export async function POST(request) {
    try {
        const { user, organization } = await requireTenant(request);
        await assertRateLimit(request, "support_reply", user.id, 30, 60);
        const body = await readJsonObject(request);
        const id = String(body.id ?? ""), message = String(body.message ?? "").trim();
        if (message.length < 2 || message.length > 3000)
            throw new RequestError("Escreva uma resposta entre 2 e 3.000 caracteres.", 400);
        const ticket = usesSupabase() ? await selectOne("support_tickets", { id, organization_id: organization.id }) : await database().prepare("SELECT * FROM support_tickets WHERE id = ? AND organization_id = ?").bind(id, organization.id).first();
        if (!ticket)
            throw new RequestError("Chamado não encontrado.", 404);
        const reply = await addSupportMessage({ ticketId: id, organizationId: organization.id, authorKind: "customer", authorName: user.displayName || organization.name, body: message });
        const patch = { status: ticket.status === "resolvido" ? "aberto" : ticket.status, updated_at: new Date().toISOString() };
        if (usesSupabase())
            await updateRows("support_tickets", patch, { id, organization_id: organization.id });
        else
            await database().prepare("UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(patch.status, patch.updated_at, id, organization.id).run();
        return Response.json({ message: reply, status: patch.status }, { status: 201 });
    }
    catch (error) {
        return tenantError(error, "Não foi possível enviar a resposta.");
    }
}
