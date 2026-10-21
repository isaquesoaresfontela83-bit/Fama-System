import { database } from "@/lib/database";
import { camelizeRow, selectOne, usesSupabase } from "@/lib/supabase";
import { decryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { hasFeaturePermission } from "@/lib/permissions";
import { requireTenant, tenantError } from "@/lib/tenant";
import { generateQuotePdf } from "@/lib/quote-pdf";
import { generateContractPdf } from "@/lib/contract-pdf";
import { generateWorkOrderPdf } from "@/lib/work-order-pdf";
const documents = {
    quotes: { table: "quotes", permission: "quotes", reference: "quoteNumber" },
    contracts: { table: "contracts", permission: "contracts", reference: "contractNumber" },
    workOrders: { table: "work_orders", permission: "orders", reference: "osNumber" },
};
export async function GET(request, context) {
    try {
        const { organization } = await requireTenant(request);
        const entity = new URL(request.url).searchParams.get("entity") ?? "";
        if (!Object.hasOwn(documents, entity))
            return Response.json({ error: "Documento inválido." }, { status: 400 });
        const type = entity;
        const config = documents[type];
        if (!hasFeaturePermission(organization.role, organization.permissions, config.permission, organization.moduleAccess)) {
            return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
        }
        const { id } = await context.params;
        const row = usesSupabase()
            ? await selectOne(config.table, { id, organization_id: organization.id })
            : await database().prepare(`SELECT * FROM ${config.table} WHERE id = ? AND organization_id = ?`).bind(id, organization.id).first();
        if (!row)
            return Response.json({ error: "Documento não encontrado." }, { status: 404 });
        const record = await decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity[type] ?? []);
        const bytes = type === "quotes" ? await generateQuotePdf(record, organization.name, false)
            : type === "contracts" ? await generateContractPdf(record, organization.name, false)
                : await generateWorkOrderPdf(record, organization.name, false);
        const filename = String(record[config.reference] || type).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80).toLowerCase();
        return new Response(bytes, { headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}.pdf"`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            } });
    }
    catch (error) {
        return tenantError(error, "Não foi possível gerar o documento.");
    }
}
