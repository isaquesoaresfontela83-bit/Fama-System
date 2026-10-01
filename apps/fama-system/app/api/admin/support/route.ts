import { database } from "@/lib/database";
import { camelizeRow, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const statuses = new Set(["aberto", "em_analise", "resolvido"]);

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

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureSupportTable();
    if (usesSupabase()) {
      const rows = await selectRows<Record<string, unknown>>("support_tickets", {}, { order: "created_at.desc" });
      return Response.json({ tickets: rows.map((row) => camelizeRow<Record<string, unknown>>(row)) });
    }
    const rows = await database().prepare(`SELECT id, organization_id AS organizationId, organization_name AS organizationName,
      user_email AS userEmail, type, priority, title, message, status, admin_notes AS adminNotes,
      created_at AS createdAt, updated_at AS updatedAt FROM support_tickets ORDER BY created_at DESC`).all<Record<string, unknown>>();
    return Response.json({ tickets: rows.results });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os chamados.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    await ensureSupportTable();
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim();
    const adminNotes = String(body.adminNotes ?? "").trim().slice(0, 2000);
    if (!id || !statuses.has(status)) return Response.json({ error: "Informe um chamado e status válido." }, { status: 400 });
    const now = new Date().toISOString();
    if (usesSupabase()) {
      await updateRows("support_tickets", { status, admin_notes: adminNotes, updated_at: now }, { id });
    } else {
      await database().prepare("UPDATE support_tickets SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?")
        .bind(status, adminNotes, now, id).run();
    }
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar o chamado.");
  }
}
