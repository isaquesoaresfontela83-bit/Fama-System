import { database } from "@/lib/database";
import { requireTenant, tenantError, type ModulePermission } from "@/lib/tenant";

const queries = [
  `SELECT id, name, phone, source, interest, status,
     estimated_value_cents AS estimatedValueCents, next_action AS nextAction,
     created_at AS createdAt
   FROM leads WHERE organization_id = ? ORDER BY created_at DESC`,
  `SELECT id, quote_number AS quoteNumber, client_name AS clientName, service,
     materials_cents AS materialsCents, labor_cents AS laborCents,
     discount_cents AS discountCents, total_cents AS totalCents, status,
     valid_until AS validUntil, notes, created_at AS createdAt
   FROM quotes WHERE organization_id = ? ORDER BY created_at DESC`,
  `SELECT id, title, client_name AS clientName, start_at AS startAt, address,
     technician, kind, status, notes
   FROM appointments WHERE organization_id = ? ORDER BY start_at ASC`,
  `SELECT id, os_number AS osNumber, client_name AS clientName, service,
     scheduled_at AS scheduledAt, technician, status, ph, chlorine, alkalinity,
     products_used AS productsUsed, notes, amount_cents AS amountCents
   FROM work_orders WHERE organization_id = ? ORDER BY scheduled_at DESC`,
  `SELECT id, name, phone, email, address, pool_type AS poolType,
     pool_volume AS poolVolume, plan, status, notes
   FROM customers WHERE organization_id = ? ORDER BY name ASC`,
  `SELECT id, name, sku, unit, quantity, minimum_quantity AS minimumQuantity,
     cost_cents AS costCents
   FROM inventory_items WHERE organization_id = ? ORDER BY name ASC`,
  `SELECT id, description, type, category, amount_cents AS amountCents,
     due_date AS dueDate, status
   FROM transactions WHERE organization_id = ? ORDER BY due_date DESC`,
  `SELECT id, name, role, phone, color, active, created_at AS createdAt
   FROM employees WHERE organization_id = ? ORDER BY name ASC`,
  `SELECT id, warranty_number AS warrantyNumber, client_name AS clientName, item,
     origin_reference AS originReference, purchase_date AS purchaseDate,
     expires_at AS expiresAt, scheduled_at AS scheduledAt, appointment_id AS appointmentId, technician, status,
     notes, created_at AS createdAt
   FROM warranties WHERE organization_id = ? ORDER BY expires_at ASC`,
  `SELECT id, contract_number AS contractNumber, client_name AS clientName,
     client_document AS clientDocument, client_address AS clientAddress, service,
     start_date AS startDate, end_date AS endDate, frequency,
     monthly_cents AS monthlyCents, payment_day AS paymentDay, status, terms,
     created_at AS createdAt
   FROM contracts WHERE organization_id = ? ORDER BY created_at DESC`,
] as const;

export async function GET(request: Request) {
  try {
    const { organization, permissions } = await requireTenant(request);
    const db = database();
    const result = await db.batch(queries.map((query) => db.prepare(query).bind(organization.id)));
    const can = (module: ModulePermission) => permissions.includes(module);

    return Response.json({
      permissions,
      leads: can("crm") ? result[0].results : [],
      quotes: can("quotes") ? result[1].results : [],
      appointments: can("agenda") ? result[2].results : [],
      workOrders: can("orders") ? result[3].results : [],
      customers: can("customers") ? result[4].results : [],
      inventory: can("inventory") ? result[5].results : [],
      transactions: can("finance") ? result[6].results : [],
      employees: can("team") ? result[7].results.map((employee) => ({ ...employee, active: Boolean(employee.active) })) : [],
      warranties: can("warranties") ? result[8].results : [],
      contracts: can("contracts") ? result[9].results : [],
    });
  } catch (error) {
    console.error("bootstrap_failed", error);
    return tenantError(error, "Não foi possível carregar os dados.");
  }
}
