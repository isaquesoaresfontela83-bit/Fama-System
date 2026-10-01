import { database } from "@/lib/database";
import { camelizeRow, insertRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const statuses = new Set(["aberto", "em_analise", "resolvido"]);

async function legacyTickets() {
  try {
    const rows = await database().prepare("SELECT * FROM support_tickets ORDER BY created_at DESC").all<Record<string, unknown>>();
    return rows.results ?? [];
  } catch (error) {
    if (!usesSupabase()) throw error;
    console.warn("support_legacy_read_unavailable", error);
    return [];
  }
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    const legacy = await legacyTickets();
    const primary = usesSupabase() ? await selectRows<Record<string, unknown>>("support_tickets", {}, { order: "created_at.desc" }) : [];
    const merged = new Map(legacy.map(row => [String(row.id), row]));
    for (const row of primary) merged.set(String(row.id), row);
    const tickets = Array.from(merged.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return Response.json({ tickets: tickets.map(row => camelizeRow<Record<string, unknown>>(row)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os chamados.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim();
    const adminNotes = String(body.adminNotes ?? "").trim().slice(0, 2000);
    if (!id || !statuses.has(status)) return Response.json({ error: "Informe um chamado e status válido." }, { status: 400 });
    const now = new Date().toISOString();
    const legacy = await database().prepare("SELECT * FROM support_tickets WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (usesSupabase()) {
      const existing = await selectOne("support_tickets", { id });
      if (!existing && !legacy) return Response.json({ error: "Chamado não encontrado." }, { status: 404 });
      const update = { status, admin_notes: adminNotes, updated_at: now };
      if (existing) await updateRows("support_tickets", update, { id });
      else await insertRow("support_tickets", { ...legacy, ...update });
    } else if (!legacy) {
      return Response.json({ error: "Chamado não encontrado." }, { status: 404 });
    }
    if (legacy) {
      const operation = database().prepare("UPDATE support_tickets SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?").bind(status, adminNotes, now, id).run();
      if (usesSupabase()) await operation.catch(error => console.warn("support_legacy_sync_failed", error));
      else await operation;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar o chamado.");
  }
}
