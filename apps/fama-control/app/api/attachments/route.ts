import { optionalText } from "@/lib/database";
import {
  camelizeRow,
  createSignedObjectUrl,
  insertRow,
  removeObjects,
  selectOne,
  selectRows,
  uploadObject,
  usesSupabase,
} from "@/lib/supabase";
import { requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";

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
};

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
    const permission = entityPermissions[entityType];
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
  try {
    const { organization, user } = await requireTenant(request);
    if (!usesSupabase()) return Response.json({ error: "Conecte o Supabase para enviar arquivos." }, { status: 503 });

    const form = await request.formData();
    const entityType = optionalText(form.get("entity"));
    const entityId = optionalText(form.get("entityId"));
    const permission = entityPermissions[entityType];
    if (!permission || !hasFeaturePermission(organization.role, organization.permissions, permission)) {
      return Response.json({ error: "Seu perfil não possui acesso a este módulo." }, { status: 403 });
    }
    const file = form.get("file");
    const table = entityTables[entityType];
    if (!table || !entityId) return Response.json({ error: "Registro inválido." }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo." }, { status: 400 });
    if (!acceptedTypes.has(file.type)) return Response.json({ error: "Envie PDF, JPG, PNG ou WEBP." }, { status: 400 });
    if (file.size <= 0 || file.size > maximumBytes) return Response.json({ error: "O arquivo deve ter no máximo 10 MB." }, { status: 400 });

    const record = await selectOne<Record<string, unknown>>(table, { id: entityId, organization_id: organization.id }, { select: "id" });
    if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    uploadedPath = `${organization.id}/${entityType}/${entityId}/${id}-${safeFileName(file.name)}`;
    await uploadObject(uploadedPath, file, file.type);
    const stored = await insertRow<Record<string, unknown>>("attachments", {
      id,
      organization_id: organization.id,
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name.slice(0, 180),
      object_path: uploadedPath,
      mime_type: file.type,
      size_bytes: file.size,
      created_by_user_id: user.id,
      created_at: createdAt,
    });
    return Response.json({
      attachment: {
        ...camelizeRow<Record<string, unknown>>(stored),
        downloadUrl: await createSignedObjectUrl(uploadedPath),
      },
    }, { status: 201 });
  } catch (error) {
    if (uploadedPath) await removeObjects([uploadedPath]).catch(() => undefined);
    return tenantError(error, "Não foi possível enviar o arquivo.");
  }
}
