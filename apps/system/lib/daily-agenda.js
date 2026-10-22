import { database } from './database';
import { decryptRecordFields,encryptedFieldsByEntity } from './crypto';
import { camelizeRow,selectRows,usesSupabase } from './supabase';
export function todayInSaoPaulo() {
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
export function normalizeName(value) {
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
export async function loadDailyAgenda(organizationId, day, include) {
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
            warranties: warranties.filter((item) => sameDay(item.scheduledAt, day) && !appointments.some(visit=>visit.id===item.appointmentId && sameDay(visit.startAt,day))),
            orders: orders.filter((item) => sameDay(item.scheduledAt, day)),
        };
    }
    const db = database();
    const [employees, appointments, warranties, orders] = await db.batch([
        db.prepare("SELECT id, name, role, phone, active FROM employees WHERE organization_id = ? ORDER BY name").bind(organizationId),
        db.prepare("SELECT id, title, client_name AS clientName, start_at AS startAt, address, technician, kind, status FROM appointments WHERE organization_id = ? ORDER BY start_at").bind(organizationId),
        db.prepare("SELECT id, warranty_number AS warrantyNumber, appointment_id AS appointmentId, client_name AS clientName, item, scheduled_at AS scheduledAt, technician, status FROM warranties WHERE organization_id = ? ORDER BY scheduled_at").bind(organizationId),
        db.prepare("SELECT id, os_number AS osNumber, client_name AS clientName, service, scheduled_at AS scheduledAt, technician, status FROM work_orders WHERE organization_id = ? ORDER BY scheduled_at").bind(organizationId),
    ]);
    return {
        employees: await Promise.all(employees.results.map((row) => decryptRecordFields(row, encryptedFieldsByEntity.employees ?? []))),
        appointments: await Promise.all(appointments.results.filter((item) => sameDay(item.startAt, day)).map((row) => decryptRecordFields(row, encryptedFieldsByEntity.appointments ?? []))),
        warranties: await Promise.all((include.warranties?warranties.results:[]).filter((item)=>sameDay(item.scheduledAt,day) && !appointments.results.some(visit=>visit.id===item.appointmentId && sameDay(visit.startAt,day))).map((row) => decryptRecordFields(row, encryptedFieldsByEntity.warranties ?? []))),
        orders: await Promise.all((include.orders?orders.results:[]).filter((item) => sameDay(item.scheduledAt, day)).map((row) => decryptRecordFields(row, encryptedFieldsByEntity.workOrders ?? []))),
    };
}
export function buildTechnicianMessage(input) {
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
