import { database } from "@/lib/database";
import { decryptRecordFields, decryptText, encryptedFieldsByEntity } from "@/lib/crypto";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { camelizeRow, selectOne, selectRows, usesSupabase } from "@/lib/supabase";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";
import { limitedWhatsappBody } from '@/lib/fama-whatsapp';
import { whatsappGraph } from '@/lib/fama-whatsapp-transport';
import { whatsappWebhookGET, whatsappWebhookPOST } from '@/lib/fama-whatsapp-server';
import { isTrustedMutation } from '@/lib/request-security';
async function configuration(organizationId) {
    const connection = usesSupabase() ? await selectOne('fama_whatsapp_connections', { organization_id: organizationId }) : null;
    return {
        configured: Boolean(connection?.verified_at),
        webhookConfigured: Boolean(connection?.webhook_verified_at),
        phoneNumberId: connection ? `${String(connection.phone_number_id).slice(0, 5)}••••` : null,
    };
}
function cleanRecipient(value) {
    const recipient = String(value ?? "").replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(recipient))
        throw new RequestError("Informe um telefone com DDI e DDD.", 400);
    return recipient;
}
async function graphRequest(path, body, organizationId) {
    const connection = usesSupabase() ? await selectOne('fama_whatsapp_connections', { organization_id: organizationId }) : null;
    if (!connection?.verified_at || path !== '/messages')
        throw new RequestError('Configure o WhatsApp oficial nas configurações da empresa.', 503);
    return whatsappGraph(String(connection.phone_number_id), await decryptText(String(connection.token_ciphertext)), body);
}
function todayInSaoPaulo() {
    return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "America/Sao_Paulo",
    }).format(new Date());
}
function dateLabel(value) {
    if (!value)
        return "";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
function sameDay(value, day) {
    const text = String(value ?? '');
    if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
        const date = new Date(text);
        if (!Number.isFinite(date.getTime()))
            return false;
        return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(date) === day;
    }
    return text.slice(0, 10) === day;
}
function normalizeName(value) {
    return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}
function appointmentKind(value) {
    const kind = String(value ?? "").toLocaleLowerCase("pt-BR");
    if (kind.includes("orça") || kind.includes("orc"))
        return "orcamentos";
    if (kind.includes("garantia"))
        return "garantias";
    return "servicos";
}
function plural(value, singular, pluralText) {
    return `${value} ${value === 1 ? singular : pluralText}`;
}
async function loadDailyAgenda(organizationId, day, include) {
    if (usesSupabase()) {
        const [employeesRaw, appointmentsRaw, warrantiesRaw, ordersRaw] = await Promise.all([
            selectRows("employees", { organization_id: organizationId }, { order: "name.asc" }),
            selectRows("appointments", { organization_id: organizationId }, { order: "start_at.asc" }),
            include.warranties ? selectRows("warranties", { organization_id: organizationId }, { order: "scheduled_at.asc" }) : Promise.resolve([]),
            include.orders ? selectRows("work_orders", { organization_id: organizationId }, { order: "scheduled_at.asc" }) : Promise.resolve([]),
        ]);
        const employees = await Promise.all(employeesRaw.map((row) => decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity.employees ?? [])));
        const appointments = await Promise.all(appointmentsRaw.map((row) => decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity.appointments ?? [])));
        const warranties = await Promise.all(warrantiesRaw.map((row) => decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity.warranties ?? [])));
        const orders = await Promise.all(ordersRaw.map((row) => decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity.workOrders ?? [])));
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
        employees: await Promise.all(employees.results.map((row) => decryptRecordFields(row, encryptedFieldsByEntity.employees ?? []))),
        appointments: await Promise.all(appointments.results.filter((item) => sameDay(item.startAt, day)).map((row) => decryptRecordFields(row, encryptedFieldsByEntity.appointments ?? []))),
        warranties: await Promise.all(warranties.results.filter((item) => sameDay(item.scheduledAt, day)).map((row) => decryptRecordFields(row, encryptedFieldsByEntity.warranties ?? []))),
        orders: await Promise.all(orders.results.filter((item) => sameDay(item.scheduledAt, day)).map((row) => decryptRecordFields(row, encryptedFieldsByEntity.workOrders ?? []))),
    };
}
function buildTechnicianMessage(input) {
    const name = String(input.employee.name ?? "Técnico").trim();
    const appointmentCounts = input.appointments.reduce((acc, item) => {
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
async function sendDailyAgenda(body, organization) {
    const day = String(body.date ?? todayInSaoPaulo()).slice(0, 10);
    const parsedDay = new Date(`${day}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day)
        throw new RequestError("Informe uma data válida.", 400);
    const onlyTechnician = normalizeName(body.technician);
    const data = await loadDailyAgenda(organization.id, day, { warranties: hasFeaturePermission(organization.role, organization.permissions, 'warranties', organization.moduleAccess), orders: hasFeaturePermission(organization.role, organization.permissions, 'orders', organization.moduleAccess) });
    const sent = [];
    const drafts = [];
    const manualShare = !(await configuration(organization.id)).configured;
    const skipped = [];
    for (const employee of data.employees) {
        const name = String(employee.name ?? "").trim();
        if (!name || employee.active === false || employee.active === 0)
            continue;
        if (onlyTechnician && normalizeName(name) !== onlyTechnician)
            continue;
        const technicianKey = normalizeName(name);
        const appointments = data.appointments.filter((item) => normalizeName(item.technician) === technicianKey);
        const warranties = data.warranties.filter((item) => normalizeName(item.technician) === technicianKey);
        const orders = data.orders.filter((item) => normalizeName(item.technician) === technicianKey);
        if (!appointments.length && !warranties.length && !orders.length && body.sendEmpty !== true) {
            skipped.push({ technician: name, reason: "Sem agenda para hoje." });
            continue;
        }
        const text = buildTechnicianMessage({ employee, day, appointments, warranties, orders });
        if (manualShare) {
            drafts.push({ technician: name, text });
            continue;
        }
        let to = "";
        try {
            to = cleanRecipient(employee.phone);
        }
        catch {
            skipped.push({ technician: name, reason: "Telefone sem DDI/DDD cadastrado." });
            continue;
        }
        const result = await graphRequest("/messages", { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } }, organization.id);
        sent.push({ technician: name, phone: `${to.slice(0, 4)}••••${to.slice(-2)}`, messageId: Array.isArray(result.messages) ? result.messages[0]?.id ?? null : null });
    }
    return { date: day, sent, skipped, manualShare, drafts };
}
export async function GET(request) {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const incomingToken = url.searchParams.get("hub.verify_token");
    if (mode || challenge || incomingToken) {
        return whatsappWebhookGET(request);
    }
    try {
        const { organization } = await requireTenant(request);
        return Response.json({ provider: "meta_whatsapp_cloud", ...await configuration(organization.id) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível conferir a conexão WhatsApp.');
    }
}
export async function POST(request) {
    if (request.headers.has('x-hub-signature-256'))
        return whatsappWebhookPOST(request);
    try {
        if (!isTrustedMutation(request))
            throw new RequestError('Origem da solicitação não autorizada.', 403);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            throw new RequestError('Envie a solicitação em JSON.', 415);
        const body = JSON.parse(await limitedWhatsappBody(request, 20_000));
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw new RequestError('Solicitação inválida.', 400);
        if (body.object === "whatsapp_business_account") {
            throw new RequestError('Assinatura não autorizada.', 401);
        }
        const { user, organization } = await requireTenant(request, ["owner", "admin"]);
        if (body.action === "status")
            return Response.json({ provider: "meta_whatsapp_cloud", ...await configuration(organization.id) }, { headers: { 'Cache-Control': 'no-store' } });
        if (!hasFeaturePermission(organization.role, organization.permissions, "crm", organization.moduleAccess))
            throw new RequestError("Seu perfil não possui acesso ao CRM.", 403);
        await assertRateLimit(request, "whatsapp_cloud_send", user.id, 30, 60);
        if (body.action === "dailyAgenda") {
            if (!hasFeaturePermission(organization.role, organization.permissions, "agenda", organization.moduleAccess))
                throw new RequestError("Seu perfil não possui acesso à agenda.", 403);
            if (!hasFeaturePermission(organization.role, organization.permissions, "team", organization.moduleAccess))
                throw new RequestError("Seu perfil não possui acesso à equipe.", 403);
            return Response.json(await sendDailyAgenda(body, organization));
        }
        const to = cleanRecipient(body.to);
        const type = String(body.type ?? "text");
        let message;
        if (type === "template") {
            const name = String(body.templateName ?? "").trim();
            const language = String(body.languageCode ?? "pt_BR").trim();
            if (!/^[a-z0-9_]+$/i.test(name))
                throw new RequestError("Informe o nome aprovado do template Meta.", 400);
            message = { messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: language }, ...(Array.isArray(body.parameters) && body.parameters.length ? { components: [{ type: "body", parameters: body.parameters.map((value) => ({ type: "text", text: String(value).slice(0, 1024) })) }] } : {}) } };
        }
        else {
            const text = String(body.text ?? "").trim();
            if (!text || text.length > 4096)
                throw new RequestError("A mensagem deve ter entre 1 e 4096 caracteres.", 400);
            message = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } };
        }
        const result = await graphRequest("/messages", message, organization.id);
        return Response.json({ sent: true, messageId: Array.isArray(result.messages) ? result.messages[0]?.id ?? null : null });
    }
    catch (error) {
        if (error instanceof SyntaxError)
            return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
        if (error instanceof Error && error.message.startsWith('body_'))
            return Response.json({ error: 'Solicitação muito grande ou interrompida.' }, { status: 413 });
        return tenantError(error, "Não foi possível enviar a mensagem pelo WhatsApp oficial.");
    }
}
