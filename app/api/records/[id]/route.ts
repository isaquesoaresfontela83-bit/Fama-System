import { database, numberValue, optionalText } from "@/lib/database";
import { requireTenant, tenantError } from "@/lib/tenant";

type Config = {
  table: string;
  updateColumn: string;
  inputKey: string;
  allowed?: Set<string>;
  select: string;
};

const configs: Record<string, Config> = {
  leads: {
    table: "leads",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["novo", "contato", "visita", "proposta", "ganho"]),
    select: `SELECT id, name, phone, source, interest, status, estimated_value_cents AS estimatedValueCents, next_action AS nextAction, created_at AS createdAt FROM leads WHERE id = ? AND organization_id = ?`,
  },
  quotes: {
    table: "quotes",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["rascunho", "enviado", "aprovado", "recusado"]),
    select: `SELECT id, quote_number AS quoteNumber, client_name AS clientName, service, materials_cents AS materialsCents, labor_cents AS laborCents, discount_cents AS discountCents, total_cents AS totalCents, status, valid_until AS validUntil, notes, created_at AS createdAt FROM quotes WHERE id = ? AND organization_id = ?`,
  },
  appointments: {
    table: "appointments",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["agendado", "em_rota", "concluido"]),
    select: `SELECT id, title, client_name AS clientName, start_at AS startAt, address, technician, kind, status, notes FROM appointments WHERE id = ? AND organization_id = ?`,
  },
  workOrders: {
    table: "work_orders",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["aberta", "em_execucao", "concluida"]),
    select: `SELECT id, os_number AS osNumber, client_name AS clientName, service, scheduled_at AS scheduledAt, technician, status, ph, chlorine, alkalinity, products_used AS productsUsed, notes, amount_cents AS amountCents FROM work_orders WHERE id = ? AND organization_id = ?`,
  },
  transactions: {
    table: "transactions",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["pendente", "pago", "atrasado"]),
    select: `SELECT id, description, type, category, amount_cents AS amountCents, due_date AS dueDate, status FROM transactions WHERE id = ? AND organization_id = ?`,
  },
  inventory: {
    table: "inventory_items",
    updateColumn: "quantity",
    inputKey: "quantity",
    select: `SELECT id, name, sku, unit, quantity, minimum_quantity AS minimumQuantity, cost_cents AS costCents FROM inventory_items WHERE id = ? AND organization_id = ?`,
  },
  warranties: {
    table: "warranties",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["ativa", "agendada", "concluida", "expirada"]),
    select: `SELECT id, warranty_number AS warrantyNumber, client_name AS clientName, item, origin_reference AS originReference, purchase_date AS purchaseDate, expires_at AS expiresAt, scheduled_at AS scheduledAt, appointment_id AS appointmentId, technician, status, notes, created_at AS createdAt FROM warranties WHERE id = ? AND organization_id = ?`,
  },
  contracts: {
    table: "contracts",
    updateColumn: "status",
    inputKey: "status",
    allowed: new Set(["rascunho", "ativo", "suspenso", "encerrado"]),
    select: `SELECT id, contract_number AS contractNumber, client_name AS clientName, client_document AS clientDocument, client_address AS clientAddress, service, start_date AS startDate, end_date AS endDate, frequency, monthly_cents AS monthlyCents, payment_day AS paymentDay, status, terms, created_at AS createdAt FROM contracts WHERE id = ? AND organization_id = ?`,
  },
};

const deleteTables: Record<string, string> = {
  leads: "leads",
  quotes: "quotes",
  appointments: "appointments",
  workOrders: "work_orders",
  customers: "customers",
  inventory: "inventory_items",
  transactions: "transactions",
  employees: "employees",
  warranties: "warranties",
  contracts: "contracts",
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization } = await requireTenant(request);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const entity = optionalText(body.entity);
    const config = configs[entity];
    if (!config) return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });

    const raw = body[config.inputKey];
    const value = entity === "inventory" ? Math.max(0, numberValue(raw)) : optionalText(raw);
    if (config.allowed && !config.allowed.has(String(value))) {
      return Response.json({ error: "Status inválido." }, { status: 400 });
    }

    const db = database();
    const updatedAt = new Date().toISOString();
    const result = await db.batch([
      db.prepare(`UPDATE ${config.table} SET ${config.updateColumn} = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).bind(value, updatedAt, id, organization.id),
      db.prepare(config.select).bind(id, organization.id),
    ]);
    const record = result[1].results[0];
    if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    return Response.json({ record });
  } catch (error) {
    console.error("record_update_failed", error);
    return tenantError(error, "Não foi possível atualizar o registro.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { organization } = await requireTenant(request, ["owner", "admin"]);
    const url = new URL(request.url);
    const entity = optionalText(url.searchParams.get("entity"));
    const table = deleteTables[entity];
    if (!table) return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });

    const db = database();
    if (entity === "warranties") {
      const warranty = await db.prepare(`SELECT appointment_id AS appointmentId FROM warranties WHERE id = ? AND organization_id = ?`)
        .bind(id, organization.id)
        .first<{ appointmentId: string }>();
      if (!warranty) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
      const statements = [db.prepare(`DELETE FROM warranties WHERE id = ? AND organization_id = ?`).bind(id, organization.id)];
      if (warranty.appointmentId) {
        statements.unshift(db.prepare(`DELETE FROM appointments WHERE id = ? AND organization_id = ?`).bind(warranty.appointmentId, organization.id));
      }
      await db.batch(statements);
      return Response.json({ deleted: true, id, relatedAppointmentId: warranty.appointmentId || null });
    }

    const result = await db.prepare(`DELETE FROM ${table} WHERE id = ? AND organization_id = ?`).bind(id, organization.id).run();
    if (!result.meta.changes) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (error) {
    console.error("record_delete_failed", error);
    return tenantError(error, "Não foi possível excluir o registro.");
  }
}
