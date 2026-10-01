import { database, optionalText, requiredText } from "@/lib/database";
import { isInternalRequest } from "@/lib/internal-auth";
import { insertRow, selectOne, usesSupabase } from "@/lib/supabase";

const allowedTypes = new Set(["melhoria", "erro", "duvida", "financeiro"]);
const allowedPriorities = new Set(["baixa", "media", "alta", "critica"]);

export async function POST(request: Request) {
  if (!await isInternalRequest(request)) return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const ticket = {
      id: optionalText(body.id) || crypto.randomUUID(),
      organization_id: requiredText(body.organizationId, "Empresa"),
      organization_name: optionalText(body.organizationName),
      user_id: optionalText(body.userId),
      user_email: optionalText(body.userEmail),
      type: allowedTypes.has(optionalText(body.type)) ? optionalText(body.type) : "melhoria",
      priority: allowedPriorities.has(optionalText(body.priority)) ? optionalText(body.priority) : "media",
      title: requiredText(body.title, "Título").slice(0, 120),
      message: requiredText(body.message, "Detalhes").slice(0, 3000),
      status: "aberto",
      admin_notes: "",
      created_at: now,
      updated_at: now,
    };
    if (usesSupabase()) {
      const existing = await selectOne<Record<string, unknown>>("support_tickets", { id: ticket.id });
      if (existing && existing.organization_id !== ticket.organization_id) return Response.json({ error: "Chamado inválido." }, { status: 409 });
      if (!existing) await insertRow("support_tickets", ticket);
    } else {
      await database().prepare(`INSERT INTO support_tickets (id, organization_id, organization_name, user_id, user_email, type, priority, title, message, status, admin_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto', '', ?, ?) ON CONFLICT(id) DO NOTHING`)
        .bind(ticket.id, ticket.organization_id, ticket.organization_name, ticket.user_id, ticket.user_email, ticket.type, ticket.priority, ticket.title, ticket.message, now, now).run();
    }
    return Response.json({ ok: true, id: ticket.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json({ error: message.includes("obrigatório") ? message : "Não foi possível receber o chamado." }, { status: message.includes("obrigatório") ? 400 : 503 });
  }
}
