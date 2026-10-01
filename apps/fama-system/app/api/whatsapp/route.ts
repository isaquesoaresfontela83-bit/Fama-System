import { env } from "cloudflare:workers";

import { database } from "@/lib/database";
import { decryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { camelizeRow, selectRows, usesSupabase } from "@/lib/supabase";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";

const graphVersion = () => String(env.META_GRAPH_VERSION ?? "v23.0");
const token = () => String(env.META_WHATSAPP_TOKEN ?? "").trim();
const phoneNumberId = () => String(env.META_WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
const verifyToken = () => String(env.META_WHATSAPP_VERIFY_TOKEN ?? "").trim();

function configuration() {
  return {
    configured: Boolean(token() && phoneNumberId()),
    webhookConfigured: Boolean(verifyToken()),
    phoneNumberId: phoneNumberId() ? `${phoneNumberId().slice(0, 5)}••••` : null,
  };
}

function cleanRecipient(value: unknown) {
  const recipient = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(recipient)) throw new RequestError("Informe um telefone com DDI e DDD.", 400);
  return recipient;
}

async function graphRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { error?: { message?: string } } & Record<string, unknown>;
  if (!response.ok) throw new RequestError(payload.error?.message ?? "A Meta recusou o envio da mensagem.", response.status >= 500 ? 502 : 400);
  return payload;
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function dateLabel(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function sameDay(value: unknown, day: string) {
  return String(value ?? "").slice(0, 10) === day;
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function appointmentKind(value: unknown) {
  const kind = String(value ?? "").toLocaleLowerCase("pt-BR");
  if (kind.includes("orça") || kind.includes("orc")) return "orcamentos";
  if (kind.includes("garantia")) return "garantias";
  return "servicos";
}

function plural(value: number, singular: string, pluralText: string) {
  return `${value} ${value === 1 ? singular : pluralText}`;
}

async function loadDailyAgenda(organizationId: string, day: string) {
  if (usesSupabase()) {
    const [employeesRaw, appointmentsRaw, warrantiesRaw, ordersRaw] = await Promise.all([
      selectRows<Record<string, unknown>>("employees", { organization_id: organizationId }, { order: "name.asc" }),
      selectRows<Record<string, unknown>>("appointments", { organization_id: organizationId }, { order: "start_at.asc" }),
      selectRows<Record<string, unknown>>("warranties", { organization_id: organizationId }, { order: "scheduled_at.asc" }),
      selectRows<Record<string, unknown>>("work_orders", { organization_id: organizationId }, { order: "scheduled_at.asc" }),
    ]);
    const employees = await Promise.all(employeesRaw.map((row) => decryptRecordFields(camelizeRow<Record<string, unknown>>(row), encryptedFieldsByEntity.employees ?? [])));
    const appointments = await Promise.all(appointmentsRaw.map((row) => decryptRecordFields(camelizeRow<Record<string, unknown>>(row), encryptedFieldsByEntity.appointments ?? [])));
    const warranties = await Promise.all(warrantiesRaw.map((row) => decryptRecordFields(camelizeRow<Record<string, unknown>>(row), encryptedFieldsByEntity.warranties ?? [])));
    const orders = await Promise.all(ordersRaw.map((row) => decryptRecordFields(camelizeRow<Record<string, unknown>>(row), encryptedFieldsByEntity.workOrders ?? [])));
    return {
      employees,
      appointments: appointments.filter((item) => sameDay(item.startAt, day)),
      warranties: warranties.filter((item) => sameDay(item.scheduledAt, day)),
      orders: orders.filter((item) => sameDay(item.scheduledAt, day)),
    };
  }

  const db = database();
  const [employees, appointments, warranties, orders] = await db.batch([
    db.prepare("SELECT id, name, role, phone, active FROM employees WHERE organization_id = ? ORDER BY name").bind(organizationId),
    db.prepare("SELECT id, title, client_name AS clientName, start_at AS startAt, address, technician, kind, status FROM appointments WHERE organization_id = ? ORDER BY start_at").bind(organizationId),
    db.prepare("SELECT id, warranty_number AS warrantyNumber, client_name AS clientName, item, scheduled_at AS scheduledAt, technician, status FROM warranties WHERE organization_id = ? ORDER BY scheduled_at").bind(organizationId),
    db.prepare("SELECT id, os_number AS osNumber, client_name AS clientName, service, scheduled_at AS scheduledAt, technician, status FROM work_orders WHERE organization_id = ? ORDER BY scheduled_at").bind(organizationId),
  ]);
  return {
    employees: await Promise.all(employees.results.map((row) => decryptRecordFields(row as Record<string, unknown>, encryptedFieldsByEntity.employees ?? []))),
    appointments: await Promise.all(appointments.results.filter((item) => sameDay((item as Record<string, unknown>).startAt, day)).map((row) => decryptRecordFields(row as Record<string, unknown>, encryptedFieldsByEntity.appointments ?? []))),
    warranties: await Promise.all(warranties.results.filter((item) => sameDay((item as Record<string, unknown>).scheduledAt, day)).map((row) => decryptRecordFields(row as Record<string, unknown>, encryptedFieldsByEntity.warranties ?? []))),
    orders: await Promise.all(orders.results.filter((item) => sameDay((item as Record<string, unknown>).scheduledAt, day)).map((row) => decryptRecordFields(row as Record<string, unknown>, encryptedFieldsByEntity.workOrders ?? []))),
  };
}

function buildTechnicianMessage(input: {
  employee: Record<string, unknown>;
  day: string;
  appointments: Record<string, unknown>[];
  warranties: Record<string, unknown>[];
  orders: Record<string, unknown>[];
}) {
  const name = String(input.employee.name ?? "Técnico").trim();
  const appointmentCounts = input.appointments.reduce<Record<"orcamentos" | "garantias" | "servicos", number>>((acc, item) => {
    const key = appointmentKind(item.kind);
    acc[key] += 1;
    return acc;
  }, { orcamentos: 0, garantias: 0, servicos: 0 });
  const warrantyCount = input.warranties.length + appointmentCounts.garantias;
  const serviceCount = input.orders.length + appointmentCounts.servicos;
  const quoteCount = appointmentCounts.orcamentos;
  const summary = [
    quoteCount ? plural(quoteCount, "orçamento", "orçamentos") : "",
    warrantyCount ? plural(warrantyCount, "garantia", "garantias") : "",
    serviceCount ? plural(serviceCount, "serviço", "serviços") : "",
  ].filter(Boolean).join(" e ") || "nenhum atendimento cadastrado";

  const appointmentLines = input.appointments.map((item) => `• ${dateLabel(String(item.startAt ?? ""))}\n${item.clientName ?? "Cliente"} — ${item.title ?? "Atendimento"}\n${item.address || "Endereço não informado"}\nStatus: ${item.status ?? "agendado"}`);
  const warrantyLines = input.warranties.map((item) => `• ${dateLabel(String(item.scheduledAt ?? ""))}\n${item.clientName ?? "Cliente"} — Garantia ${item.warrantyNumber ?? ""}\n${item.item ?? "Item coberto"}\nStatus: ${item.status ?? "agendada"}`);
  const orderLines = input.orders.map((item) => `• ${dateLabel(String(item.scheduledAt ?? ""))}\n${item.clientName ?? "Cliente"} — OS ${item.osNumber ?? ""}\n${item.service ?? "Serviço"}\nStatus: ${item.status ?? "aberta"}`);
  const details = [...appointmentLines, ...warrantyLines, ...orderLines];

  return `Olá, ${name}. Hoje você tem ${summary}.\n\n${details.length ? details.join("\n\n") : "Sem itens para hoje."}\n\nConfira os detalhes no Fama System e me avise se precisar ajustar a rota.`;
}

async function sendDailyAgenda(body: Record<string, unknown>, organizationId: string) {
  const day = String(body.date ?? todayInSaoPaulo()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RequestError("Informe uma data válida.", 400);
  const onlyTechnician = normalizeName(body.technician);
  const data = await loadDailyAgenda(organizationId, day);
  const sent: { technician: string; phone: string; messageId: string | null }[] = [];
  const skipped: { technician: string; reason: string }[] = [];

  for (const employee of data.employees) {
    const name = String(employee.name ?? "").trim();
    if (!name || employee.active === false || employee.active === 0) continue;
    if (onlyTechnician && normalizeName(name) !== onlyTechnician) continue;
    const technicianKey = normalizeName(name);
    const appointments = data.appointments.filter((item) => normalizeName(item.technician) === technicianKey);
    const warranties = data.warranties.filter((item) => normalizeName(item.technician) === technicianKey);
    const orders = data.orders.filter((item) => normalizeName(item.technician) === technicianKey);
    if (!appointments.length && !warranties.length && !orders.length && body.sendEmpty !== true) {
      skipped.push({ technician: name, reason: "Sem agenda para hoje." });
      continue;
    }
    let to = "";
    try {
      to = cleanRecipient(employee.phone);
    } catch {
      skipped.push({ technician: name, reason: "Telefone sem DDI/DDD cadastrado." });
      continue;
    }
    const text = buildTechnicianMessage({ employee, day, appointments, warranties, orders });
    const result = await graphRequest("/messages", { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } });
    sent.push({ technician: name, phone: `${to.slice(0, 4)}••••${to.slice(-2)}`, messageId: Array.isArray(result.messages) ? (result.messages[0] as { id?: string })?.id ?? null : null });
  }
  return { date: day, sent, skipped };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const incomingToken = url.searchParams.get("hub.verify_token");
  if (mode || challenge || incomingToken) {
    if (mode !== "subscribe" || !challenge || !verifyToken() || incomingToken !== verifyToken()) return new Response("Forbidden", { status: 403 });
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return Response.json({ provider: "meta_whatsapp_cloud", ...configuration() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.object === "whatsapp_business_account") {
      console.log("whatsapp_cloud_webhook_received", JSON.stringify({ entries: Array.isArray(body.entry) ? body.entry.length : 0 }));
      return Response.json({ received: true });
    }
    if (body.action === "status") return Response.json({ provider: "meta_whatsapp_cloud", ...configuration() });
    const { user, organization } = await requireTenant(request, ["owner", "admin"]);
    if (!hasFeaturePermission(organization.role, organization.permissions, "crm")) throw new RequestError("Seu perfil não possui acesso ao CRM.", 403);
    await assertRateLimit(request, "whatsapp_cloud_send", user.id, 30, 60);
    if (!configuration().configured) throw new RequestError("A API oficial do WhatsApp ainda não foi configurada pelo administrador.", 503);
    if (body.action === "dailyAgenda") {
      if (!hasFeaturePermission(organization.role, organization.permissions, "agenda")) throw new RequestError("Seu perfil não possui acesso à agenda.", 403);
      return Response.json(await sendDailyAgenda(body, organization.id));
    }

    const to = cleanRecipient(body.to);
    const type = String(body.type ?? "text");
    let message: Record<string, unknown>;
    if (type === "template") {
      const name = String(body.templateName ?? "").trim();
      const language = String(body.languageCode ?? "pt_BR").trim();
      if (!/^[a-z0-9_]+$/i.test(name)) throw new RequestError("Informe o nome aprovado do template Meta.", 400);
      message = { messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: language }, ...(Array.isArray(body.parameters) && body.parameters.length ? { components: [{ type: "body", parameters: body.parameters.map((value) => ({ type: "text", text: String(value).slice(0, 1024) })) }] } : {}) } };
    } else {
      const text = String(body.text ?? "").trim();
      if (!text || text.length > 4096) throw new RequestError("A mensagem deve ter entre 1 e 4096 caracteres.", 400);
      message = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } };
    }
    const result = await graphRequest("/messages", message);
    return Response.json({ sent: true, messageId: Array.isArray(result.messages) ? (result.messages[0] as { id?: string })?.id ?? null : null });
  } catch (error) {
    return tenantError(error, "Não foi possível enviar a mensagem pelo WhatsApp oficial.");
  }
}
