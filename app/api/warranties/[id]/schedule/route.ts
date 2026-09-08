import { database, dateTime, optionalText, requiredText } from "@/lib/database";
import { requireTenant, tenantError } from "@/lib/tenant";

type WarrantyRow = {
  id: string;
  warrantyNumber: string;
  clientName: string;
  item: string;
  originReference: string;
  purchaseDate: string;
  expiresAt: string;
  scheduledAt: string;
  appointmentId: string;
  technician: string;
  status: string;
  notes: string;
  createdAt: string;
};

const warrantySelect = `SELECT id, warranty_number AS warrantyNumber, client_name AS clientName, item,
  origin_reference AS originReference, purchase_date AS purchaseDate, expires_at AS expiresAt,
  scheduled_at AS scheduledAt, appointment_id AS appointmentId, technician, status, notes,
  created_at AS createdAt FROM warranties WHERE id = ? AND organization_id = ?`;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization } = await requireTenant(request);
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const scheduledAt = dateTime(requiredText(body.scheduledAt, "Data e hora"));
    const technician = optionalText(body.technician);
    const db = database();
    const warranty = await db.prepare(warrantySelect).bind(id, organization.id).first<WarrantyRow>();
    if (!warranty) return Response.json({ error: "Garantia não encontrada." }, { status: 404 });

    const now = new Date().toISOString();
    const appointmentId = warranty.appointmentId || crypto.randomUUID();
    const appointment = {
      id: appointmentId,
      title: `Atendimento de garantia ${warranty.warrantyNumber}`,
      clientName: warranty.clientName,
      startAt: scheduledAt,
      address: "",
      technician,
      kind: "Garantia",
      status: "agendado",
      notes: `Cobertura: ${warranty.item}`,
    };

    const appointmentStatement = warranty.appointmentId
      ? db.prepare(`UPDATE appointments SET title = ?, client_name = ?, start_at = ?, technician = ?, kind = ?, status = ?, notes = ?, updated_at = ? WHERE id = ? AND organization_id = ?`)
        .bind(appointment.title, appointment.clientName, appointment.startAt, appointment.technician, appointment.kind, appointment.status, appointment.notes, now, appointmentId, organization.id)
      : db.prepare(`INSERT INTO appointments (id, organization_id, title, client_name, start_at, address, technician, kind, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(appointment.id, organization.id, appointment.title, appointment.clientName, appointment.startAt, appointment.address, appointment.technician, appointment.kind, appointment.status, appointment.notes, now, now);

    const result = await db.batch([
      appointmentStatement,
      db.prepare(`UPDATE warranties SET scheduled_at = ?, appointment_id = ?, technician = ?, status = 'agendada', updated_at = ? WHERE id = ? AND organization_id = ?`)
        .bind(scheduledAt, appointmentId, technician, now, id, organization.id),
      db.prepare(warrantySelect).bind(id, organization.id),
    ]);
    const updatedWarranty = result[2].results[0];
    return Response.json({ warranty: updatedWarranty, appointment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível agendar a garantia.";
    console.error("warranty_schedule_failed", error);
    if (message.includes("obrigatório")) return Response.json({ error: message }, { status: 400 });
    return tenantError(error, "Não foi possível agendar a garantia.");
  }
}
