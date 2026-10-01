import { database, optionalText, requiredText } from "@/lib/database";
import { camelizeRow, insertRow, selectRows, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";

const allowedTypes = new Set(["melhoria", "erro", "duvida", "financeiro"]);
const allowedPriorities = new Set(["baixa", "media", "alta", "critica"]);
const controlSupportUrl = "https://control.famasystem.online/api/public/support";

async function ensureSupportTable() {
  if (usesSupabase()) return;
  await database().prepare(`CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    organization_name TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    user_email TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'melhoria',
    priority TEXT NOT NULL DEFAULT 'media',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    admin_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

function mapTicket(row: Record<string, unknown>) {
  return camelizeRow<Record<string, unknown>>(row);
}

async function forwardTicketToControl(ticket: Record<string, unknown>) {
  try {
    const response = await fetch(controlSupportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${String((env as unknown as { FAMA_DATA_BRIDGE_SECRET?: string }).FAMA_DATA_BRIDGE_SECRET ?? "")}` },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        id: ticket.id,
        organizationId: ticket.organization_id,
        organizationName: ticket.organization_name,
        userId: ticket.user_id,
        userEmail: ticket.user_email,
        type: ticket.type,
        priority: ticket.priority,
        title: ticket.title,
        message: ticket.message,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      console.warn("support_ticket_control_forward_failed", payload.error ?? response.statusText);
    }
  } catch (error) {
    console.warn("support_ticket_control_forward_failed", error);
  }
}

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    await ensureSupportTable();
    if (usesSupabase()) {
      const rows = await selectRows<Record<string, unknown>>("support_tickets", { organization_id: organization.id }, { order: "created_at.desc" });
      return Response.json({ tickets: rows.map(mapTicket) });
    }
    const rows = await database().prepare(`SELECT id, type, priority, title, message, status, admin_notes AS adminNotes,
      organization_id AS organization_id, organization_name AS organization_name, user_id AS user_id, user_email AS user_email,
      created_at AS createdAt, updated_at AS updatedAt FROM support_tickets WHERE organization_id = ? ORDER BY created_at DESC`)
      .bind(organization.id).all<Record<string, unknown>>();
    const tickets = rows.results ?? [];
    return Response.json({ tickets });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar o suporte.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    await ensureSupportTable();
    const body = await request.json() as Record<string, unknown>;
    const type = allowedTypes.has(optionalText(body.type)) ? optionalText(body.type) : "melhoria";
    const priority = allowedPriorities.has(optionalText(body.priority)) ? optionalText(body.priority) : "media";
    const title = requiredText(body.title, "Título").slice(0, 120);
    const message = requiredText(body.message, "Detalhes").slice(0, 3000);
    if (title.length < 4) return Response.json({ error: "Informe um título mais claro." }, { status: 400 });
    if (message.length < 10) return Response.json({ error: "Descreva melhor o chamado." }, { status: 400 });
    const now = new Date().toISOString();
    const ticket = {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      organization_name: organization.name,
      user_id: user.id,
      user_email: user.email,
      type,
      priority,
      title,
      message,
      status: "aberto",
      admin_notes: "",
      created_at: now,
      updated_at: now,
    };
    if (usesSupabase()) {
      const row = await insertRow<Record<string, unknown>>("support_tickets", ticket);
      return Response.json({ ticket: mapTicket(row) }, { status: 201 });
    }
    await database().prepare(`INSERT INTO support_tickets (id, organization_id, organization_name, user_id, user_email, type, priority, title, message, status, admin_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto', '', ?, ?)`)
      .bind(ticket.id, ticket.organization_id, ticket.organization_name, ticket.user_id, ticket.user_email, ticket.type, ticket.priority, ticket.title, ticket.message, now, now).run();
    await forwardTicketToControl(ticket);
    return Response.json({ ticket: mapTicket(ticket) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("obrigatório")) return Response.json({ error: message }, { status: 400 });
    return tenantError(error, "Não foi possível enviar o chamado.");
  }
}
import { env } from "cloudflare:workers";
