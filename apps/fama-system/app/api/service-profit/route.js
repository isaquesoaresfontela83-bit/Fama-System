import { database } from "@/lib/database";
import { requireTenant, tenantError, RequestError } from "@/lib/tenant";
import { hasFeaturePermission } from "@/lib/permissions";
import { readJsonObject } from "@/lib/request-body";
import { selectOne, updateRows, usesSupabase, camelizeRow } from "@/lib/supabase";
import { decryptRecordFields, encryptRecordFields } from "@/lib/crypto";
import { costCents, costFields, serviceNotes } from "@/lib/service-profit";
import { assertRateLimit } from "@/lib/security";
export async function PATCH(request) {
    try {
        const { user, organization } = await requireTenant(request);
        if (!hasFeaturePermission(organization.role, organization.permissions, "finance", organization.moduleAccess) || !hasFeaturePermission(organization.role, organization.permissions, "orders", organization.moduleAccess))
            throw new RequestError("Seu perfil precisa de acesso ao financeiro e às ordens de serviço.", 403);
        await assertRateLimit(request, "service_costs", user.id, 60, 60);
        const body = await readJsonObject(request);
        const id = String(body.id ?? "");
        const amounts = Object.fromEntries(costFields.map(key => {
            const value = costCents(body[key]);
            if (value === null)
                throw new RequestError("Informe custos válidos; use zero quando não houver custo.", 400);
            return [key, value];
        }));
        const db = database();
        const existing = usesSupabase() ? await selectOne("work_orders", { id, organization_id: organization.id }) : await db.prepare("SELECT * FROM work_orders WHERE id = ? AND organization_id = ?").bind(id, organization.id).first();
        if (!existing)
            throw new RequestError("Ordem de serviço não encontrada.", 404);
        const clear = await decryptRecordFields(existing, ["notes"]);
        const notes = serviceNotes(clear.notes);
        for (const key of costFields)
            notes.details[key] = (amounts[key] / 100).toFixed(2);
        const protectedFields = await encryptRecordFields({ notes: JSON.stringify(notes) }, ["notes"]);
        const now = new Date().toISOString();
        if (usesSupabase()) {
            const rows = await updateRows("work_orders", { notes: protectedFields.notes, product_cost_cents: amounts.productCost, labor_cost_cents: amounts.laborCost, travel_cost_cents: amounts.travelCost, gross_profit_cents: Number(existing.amount_cents) - amounts.productCost - amounts.laborCost - amounts.travelCost, updated_at: now }, { id, organization_id: organization.id, updated_at: String(existing.updated_at) });
            if (!rows.length)
                throw new RequestError("A ordem foi alterada durante a edição. Atualize e tente novamente.", 409);
            return Response.json({ record: await decryptRecordFields(camelizeRow(rows[0]), ["notes", "productsUsed"]) });
        }
        const result = await db.prepare("UPDATE work_orders SET notes = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND updated_at = ?").bind(JSON.stringify(notes), now, id, organization.id, existing.updated_at).run();
        if (!result.meta.changes)
            throw new RequestError("A ordem foi alterada durante a edição. Atualize e tente novamente.", 409);
        return Response.json({ record: camelizeRow({ ...existing, notes: JSON.stringify(notes), updated_at: now }) });
    }
    catch (error) {
        return tenantError(error, "Não foi possível salvar os custos do serviço.");
    }
}
