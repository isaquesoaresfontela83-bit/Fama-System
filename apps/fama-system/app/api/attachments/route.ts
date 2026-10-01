import { database, optionalText } from "@/lib/database";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { readFiscalXml } from "@/lib/fiscal-document";
import {
  camelizeRow,
  createSignedObjectUrl,
  deleteRows,
  insertRow,
  removeObjects,
  selectOne,
  selectRows,
  uploadObject,
  usesSupabase,
} from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";

const entityTables: Record<string, string> = {
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
  suppliers: "suppliers",
  purchases: "purchases",
  fiscalInvoices: "fiscal_invoices",
};

function permissionForAttachment(entityType: string) {
  return entityPermissions[entityType] ?? (["suppliers", "purchases", "fiscalInvoices"].includes(entityType) ? "finance" : undefined);
}

const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maximumBytes = 10 * 1024 * 1024;

function safeFileName(value: string) {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(-100) || "arquivo";
}

export async function GET(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    if (!usesSupabase()) return Response.json({ available: false, attachments: [] });

    const url = new URL(request.url);
    const entityType = optionalText(url.searchParams.get("entity"));
    const entityId = optionalText(url.searchParams.get("entityId"));
    const permission = permissionForAttachment(entityType);
    if (!permission || !hasFeaturePermission(organization.role, organization.permissions, permission)) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    if (!entityTables[entityType] || !entityId) {
      return Response.json({ error: "Registro inválido." }, { status: 400 });
    }

    const rows = await selectRows<Record<string, unknown>>("attachments", {
      organization_id: organization.id,
      entity_type: entityType,
      entity_id: entityId,
    }, { order: "created_at.desc" });

    const attachments = await Promise.all(rows.map(async (row) => ({
      ...camelizeRow<Record<string, unknown>>(row),
      downloadUrl: await createSignedObjectUrl(String(row.object_path)),
    })));
    return Response.json({ available: true, attachments });
  } catch (error) {
    return tenantError(error, "Não foi possível carregar os arquivos.");
  }
}

export async function POST(request: Request) {
  let uploadedPath = "";
  let uploadedAttachmentId = "";
  let uploadedOrganizationId = "";
  try {
    const { organization, user } = await requireTenant(request);
    await assertRateLimit(request, "attachment_upload", user.id, 20, 60);
    if (!usesSupabase()) return Response.json({ error: "Conecte o Supabase para enviar arquivos." }, { status: 503 });

    const form = await request.formData();
    const entityType = optionalText(form.get("entity"));
    const entityId = optionalText(form.get("entityId"));
    const permission = permissionForAttachment(entityType);
    if (!permission || !hasFeaturePermission(organization.role, organization.permissions, permission)) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    const file = form.get("file");
    const table = entityTables[entityType];
    if (!table || !entityId) return Response.json({ error: "Registro inválido." }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo." }, { status: 400 });
    const fiscal = entityType === "fiscalInvoices";
    const isXml = fiscal && /\.xml$/i.test(file.name) && ["application/xml", "text/xml", "text/plain", ""].includes(file.type);
    const isPdf = file.type === "application/pdf" || (fiscal && /\.pdf$/i.test(file.name) && ["", "application/octet-stream"].includes(file.type));
    if (fiscal ? !isPdf && !isXml : !acceptedTypes.has(file.type)) return Response.json({ error: fiscal ? "Anexe o PDF ou XML baixado do portal oficial." : "Envie PDF, JPG, PNG ou WEBP." }, { status: 400 });
    if (file.size <= 0 || file.size > maximumBytes) return Response.json({ error: "O arquivo deve ter no máximo 10 MB." }, { status: 400 });

    const record = fiscal
      ? await database().prepare("SELECT id, type, status, amount_cents AS amountCents, customer_document AS customerDocument FROM fiscal_invoices WHERE id = ? AND organization_id = ?").bind(entityId, organization.id).first<Record<string, unknown>>()
      : await selectOne<Record<string, unknown>>(table, { id: entityId, organization_id: organization.id }, { select: "id" });
    if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    if (fiscal && !["rascunho", "registrada", "cancelada"].includes(String(record.status))) return Response.json({ error: "Aguarde a conclusão da emissão antes de anexar documentos." }, { status: 409 });

    let fiscalMetadata: ReturnType<typeof readFiscalXml> | undefined;
    if (isXml) {
      if (file.size > 1024 * 1024) return Response.json({ error: "O XML deve ter no máximo 1 MB." }, { status: 400 });
      const settingsRow = await database().prepare("SELECT settings_json FROM organization_settings WHERE organization_id = ?").bind(organization.id).first<{ settings_json: string }>();
      const company = normalizeCompanySettings(settingsRow ? JSON.parse(settingsRow.settings_json) : {});
      try { fiscalMetadata = readFiscalXml(await file.text(), { type: String(record.type), amountCents: Number(record.amountCents), customerDocument: String(record.customerDocument || "") }, company.document); }
      catch (error) { return Response.json({ error: error instanceof Error ? error.message : "XML inválido." }, { status: 400 }); }
    } else if (fiscal && new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") {
      return Response.json({ error: "O arquivo selecionado não é um PDF válido." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    uploadedPath = `${organization.id}/${entityType}/${entityId}/${id}-${safeFileName(file.name)}`;
    // XML is downloaded as bytes; the browser must not render untrusted XML markup.
    await uploadObject(uploadedPath, file, isXml ? "application/octet-stream" : isPdf ? "application/pdf" : file.type);
    const stored = await insertRow<Record<string, unknown>>("attachments", {
      id,
      organization_id: organization.id,
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name.slice(0, 180),
      object_path: uploadedPath,
      mime_type: isXml ? "application/xml" : isPdf ? "application/pdf" : file.type,
      ...(fiscal ? { metadata: fiscalMetadata || {} } : {}),
      size_bytes: file.size,
      created_by_user_id: user.id,
      created_at: createdAt,
    });
    uploadedAttachmentId = id;
    uploadedOrganizationId = organization.id;
    return Response.json({
      fiscalMetadata,
      attachment: {
        ...camelizeRow<Record<string, unknown>>(stored),
        downloadUrl: await createSignedObjectUrl(uploadedPath),
      },
    }, { status: 201 });
  } catch (error) {
    if (uploadedAttachmentId) await deleteRows("attachments", { id: uploadedAttachmentId, organization_id: uploadedOrganizationId }).catch(() => undefined);
    if (uploadedPath) await removeObjects([uploadedPath]).catch(() => undefined);
    return tenantError(error, "Não foi possível enviar o arquivo.");
  }
}
