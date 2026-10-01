import { database } from "@/lib/database";
import { camelizeRow, selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { RequestError } from "@/lib/tenant";

export async function adjustInventoryStock(id: string, organizationId: string, delta: unknown) {
  if (delta !== 1 && delta !== -1) throw new RequestError("Cada leitura deve adicionar ou remover uma unidade.", 400);
  if (!usesSupabase()) {
    const row = await database().prepare(`UPDATE inventory_items SET quantity = quantity + ?, updated_at = ?
      WHERE id = ? AND organization_id = ? AND quantity + ? >= 0 RETURNING *`)
      .bind(delta, new Date().toISOString(), id, organizationId, delta).first<Record<string, unknown>>();
    if (row) return camelizeRow<Record<string, unknown>>(row);
    const existing = await database().prepare("SELECT id FROM inventory_items WHERE id = ? AND organization_id = ?").bind(id, organizationId).first();
    throw new RequestError(existing ? "O produto não possui saldo para esta saída." : "Produto não encontrado nesta empresa.", existing ? 409 : 404);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await selectOne<Record<string, unknown>>("inventory_items", { id, organization_id: organizationId });
    if (!current) throw new RequestError("Produto não encontrado nesta empresa.", 404);
    const quantity = Number(current.quantity);
    if (!Number.isFinite(quantity) || quantity + delta < 0) throw new RequestError("O produto não possui saldo para esta saída.", 409);
    const rows = await updateRows<Record<string, unknown>>("inventory_items", { quantity: quantity + delta, updated_at: new Date().toISOString() }, { id, organization_id: organizationId, quantity });
    if (rows.length) return camelizeRow<Record<string, unknown>>(rows[0]);
  }
  throw new RequestError("Outra movimentação está sendo registrada. Tente novamente.", 409);
}
