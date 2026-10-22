import { ensureCustomerColumns } from '@/lib/customer-selection';
import { database } from "@/lib/database";
import { camelizeRow, selectRows, usesSupabase } from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { decryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
const supabaseCollections = [
    ["leads", "created_at.desc"],
    ["quotes", "created_at.desc"],
    ["appointments", "start_at.asc"],
    ["work_orders", "scheduled_at.desc"],
    ["customers", "name.asc"],
    ["inventory_items", "name.asc"],
    ["transactions", "due_date.desc"],
    ["employees", "name.asc"],
    ["warranties", "expires_at.asc"],
    ["contracts", "created_at.desc"],
];
const queries = [
    `SELECT id, name, phone, source, interest, status,
     estimated_value_cents AS estimatedValueCents, next_action AS nextAction,
     created_at AS createdAt
   FROM leads WHERE organization_id = ? ORDER BY created_at DESC`,
    `SELECT id, quote_number AS quoteNumber, customer_id AS customerId, client_name AS clientName, service,
     materials_cents AS materialsCents, labor_cents AS laborCents,
     discount_cents AS discountCents, total_cents AS totalCents, status,
     valid_until AS validUntil, notes, created_at AS createdAt
   FROM quotes WHERE organization_id = ? ORDER BY created_at DESC`,
    `SELECT id, title, customer_id AS customerId, client_name AS clientName, start_at AS startAt, address,
     technician, kind, status, notes
   FROM appointments WHERE organization_id = ? ORDER BY start_at ASC`,
    `SELECT id, os_number AS osNumber, customer_id AS customerId, client_name AS clientName, service,
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
     due_date AS dueDate, status, created_at AS createdAt
   FROM transactions WHERE organization_id = ? ORDER BY due_date DESC`,
    `SELECT id, name, role, phone, color, active, created_at AS createdAt
   FROM employees WHERE organization_id = ? ORDER BY name ASC`,
    `SELECT id, warranty_number AS warrantyNumber, customer_id AS customerId, client_name AS clientName, item,
     origin_reference AS originReference, purchase_date AS purchaseDate,
     expires_at AS expiresAt, scheduled_at AS scheduledAt, appointment_id AS appointmentId, technician, status,
     notes, created_at AS createdAt
   FROM warranties WHERE organization_id = ? ORDER BY expires_at ASC`,
    `SELECT id, contract_number AS contractNumber, customer_id AS customerId, client_name AS clientName,
     client_document AS clientDocument, client_address AS clientAddress, service,
     start_date AS startDate, end_date AS endDate, frequency,
     monthly_cents AS monthlyCents, payment_day AS paymentDay, status, terms,
     created_at AS createdAt
   FROM contracts WHERE organization_id = ? ORDER BY created_at DESC`,
];
export async function GET(request) {
    try {
        const { organization } = await requireTenant(request);
        await ensureCustomerColumns();
        const allowed = (entity) => {
            const permission = entityPermissions[entity];
            return Boolean(permission && hasFeaturePermission(organization.role, organization.permissions, permission, organization.moduleAccess));
        };
        if (usesSupabase()) {
            const result = await Promise.all(supabaseCollections.map(([table, order], index) => allowed(Object.keys(entityPermissions)[index])
                ? selectRows(table, { organization_id: organization.id }, { order })
                : Promise.resolve([])));
            const mapped = await Promise.all(result.map((rows, index) => {
                const entity = Object.keys(entityPermissions)[index];
                return Promise.all(rows.map((row) => decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity[entity] ?? [])));
            }));
            return Response.json({
                leads: mapped[0],
                quotes: mapped[1],
                appointments: mapped[2],
                workOrders: mapped[3],
                customers: mapped[4],
                inventory: mapped[5],
                transactions: mapped[6],
                employees: mapped[7].map((employee) => ({ ...employee, active: Boolean(employee.active) })),
                warranties: mapped[8].map((warranty) => ({ ...warranty, appointmentId: warranty.appointmentId ?? "" })),
                contracts: mapped[9],
                storageEnabled: true,
            });
        }
        const db = database();
        const allowedIndexes = queries.map((_, index) => allowed(Object.keys(entityPermissions)[index]) ? index : -1).filter((index) => index >= 0);
        const queried = await db.batch(allowedIndexes.map((index) => db.prepare(queries[index]).bind(organization.id)));
        const result = queries.map((_, index) => {
            const resultIndex = allowedIndexes.indexOf(index);
            return resultIndex >= 0 ? queried[resultIndex] : { results: [] };
        });
        const mapped = await Promise.all(result.map((collection, index) => {
            const entity = Object.keys(entityPermissions)[index];
            return Promise.all(collection.results.map((row) => decryptRecordFields(row, encryptedFieldsByEntity[entity] ?? [])));
        }));
        return Response.json({
            leads: mapped[0],
            quotes: mapped[1],
            appointments: mapped[2],
            workOrders: mapped[3],
            customers: mapped[4],
            inventory: mapped[5],
            transactions: mapped[6],
            employees: mapped[7].map((employee) => ({ ...employee, active: Boolean(employee.active) })),
            warranties: mapped[8],
            contracts: mapped[9],
            storageEnabled: false,
        });
    }
    catch (error) {
        console.error("bootstrap_failed", error);
        return tenantError(error, "Não foi possível carregar os dados.");
    }
}
