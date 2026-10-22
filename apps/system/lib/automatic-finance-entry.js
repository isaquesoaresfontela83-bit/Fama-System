import { database } from "@/lib/database";
import { encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { insertRow, selectOne, snakeRow, updateRows, usesSupabase } from "@/lib/supabase";
import { saleRevenueForWorkOrder } from "@/lib/sales-revenue";
export { saleRevenueForWorkOrder } from "@/lib/sales-revenue";
export function saleRevenueStatement(db, organizationId, entry) {
    return db.prepare(`INSERT INTO transactions (id, organization_id, description, type, category, amount_cents, due_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET description = excluded.description, category = excluded.category,
      amount_cents = excluded.amount_cents, due_date = excluded.due_date, updated_at = excluded.updated_at`)
        .bind(entry.id, organizationId, entry.description, entry.type, entry.category, entry.amountCents, entry.dueDate, entry.status, entry.createdAt, entry.createdAt);
}
export async function syncWorkOrderRevenue(organizationId, order) {
    const entry = saleRevenueForWorkOrder(order);
    if (!entry) return null;
    if (!usesSupabase()) {
        await saleRevenueStatement(database(), organizationId, entry).run();
        return entry;
    }
    const protectedEntry = await encryptRecordFields(entry, encryptedFieldsByEntity.transactions ?? []);
    const values = { ...snakeRow(protectedEntry), organization_id: organizationId, updated_at: new Date().toISOString() };
    const patch = { description: values.description, type: values.type, category: values.category, amount_cents: values.amount_cents, due_date: values.due_date, updated_at: values.updated_at };
    const filters = { id: entry.id, organization_id: organizationId };
    const existing = await selectOne("transactions", filters);
    if (existing) {
        const rows = await updateRows("transactions", patch, filters);
        if (!rows.length) throw new Error("Não foi possível atualizar a receita automática.");
        return entry;
    }
    try {
        await insertRow("transactions", values);
    } catch (error) {
        if (error?.code !== "23505") throw error;
        const rows = await updateRows("transactions", patch, filters);
        if (!rows.length) throw error;
    }
    return entry;
}
