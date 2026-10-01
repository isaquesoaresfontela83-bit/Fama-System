import { encryptRecordFields, encryptedFieldsByEntity, isDataEncryptionConfigured } from "@/lib/crypto";
import { camelizeRow, selectRows, snakeRow, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const tables = Object.entries({
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
} as const);

export async function POST() {
  try {
    await requirePlatformAdmin();
    if (!usesSupabase()) return Response.json({ error: "A recriptografia automática exige o backend Supabase." }, { status: 503 });
    if (!isDataEncryptionConfigured()) return Response.json({ error: "Configure FAMA_DATA_ENCRYPTION_KEY antes de recriptografar." }, { status: 503 });
    let processed = 0;
    let encrypted = 0;
    for (const [entity, table] of tables) {
      const fields = encryptedFieldsByEntity[entity] ?? [];
      if (!fields.length) continue;
      const rows = await selectRows<Record<string, unknown>>(table, {}, { select: "*" });
      for (const row of rows) {
        const clear = camelizeRow<Record<string, unknown>>(row);
        const protectedRecord = await encryptRecordFields(clear, fields);
        const changes = Object.fromEntries(fields
          .filter((field) => protectedRecord[field] !== clear[field])
          .map((field) => [field, protectedRecord[field]]));
        if (Object.keys(changes).length) {
          await updateRows(table, snakeRow(changes), { id: String(row.id) });
          encrypted += 1;
        }
        processed += 1;
      }
    }
    return Response.json({ processed, encrypted, completedAt: new Date().toISOString() });
  } catch (error) {
    return tenantError(error, "Não foi possível recriptografar os dados.");
  }
}
