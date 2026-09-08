import { cents, database, dateTime, numberValue, optionalText, reference, requiredText } from "@/lib/database";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";

const leadStatuses = new Set(["novo", "contato", "visita", "proposta", "ganho"]);
const transactionStatuses = new Set(["pendente", "pago", "atrasado"]);

export async function POST(request: Request) {
  try {
    const { organization } = await requireTenant(request);
    const body = await request.json() as Record<string, unknown>;
    const entity = optionalText(body.entity);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const db = database();

    if (entity === "leads") {
      const record = {
        id,
        name: requiredText(body.name, "Nome"),
        phone: requiredText(body.phone, "Telefone"),
        source: optionalText(body.source),
        interest: requiredText(body.interest, "Interesse"),
        status: leadStatuses.has(optionalText(body.status)) ? optionalText(body.status) : "novo",
        estimatedValueCents: cents(body.estimatedValue),
        nextAction: optionalText(body.nextAction),
        createdAt,
      };
      await db.prepare(`INSERT INTO leads (id, organization_id, name, phone, source, interest, status, estimated_value_cents, next_action, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.name, record.phone, record.source, record.interest, record.status, record.estimatedValueCents, record.nextAction, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "quotes") {
      const materialsCents = cents(body.materials);
      const laborCents = cents(body.labor);
      const discountCents = cents(body.discount);
      const record = {
        id,
        quoteNumber: reference("ORC"),
        clientName: requiredText(body.clientName, "Cliente"),
        service: requiredText(body.service, "Serviço"),
        materialsCents,
        laborCents,
        discountCents,
        totalCents: Math.max(0, materialsCents + laborCents - discountCents),
        status: "rascunho",
        validUntil: optionalText(body.validUntil),
        notes: optionalText(body.notes),
        createdAt,
      };
      await db.prepare(`INSERT INTO quotes (id, organization_id, quote_number, client_name, service, materials_cents, labor_cents, discount_cents, total_cents, status, valid_until, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.quoteNumber, record.clientName, record.service, record.materialsCents, record.laborCents, record.discountCents, record.totalCents, record.status, record.validUntil, record.notes, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "appointments") {
      const record = {
        id,
        title: requiredText(body.title, "Compromisso"),
        clientName: requiredText(body.clientName, "Cliente"),
        startAt: dateTime(requiredText(body.startAt, "Data e hora")),
        address: optionalText(body.address),
        technician: optionalText(body.technician),
        kind: optionalText(body.kind) || "Manutenção",
        status: "agendado",
        notes: optionalText(body.notes),
      };
      await db.prepare(`INSERT INTO appointments (id, organization_id, title, client_name, start_at, address, technician, kind, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.title, record.clientName, record.startAt, record.address, record.technician, record.kind, record.status, record.notes, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "workOrders") {
      const record = {
        id,
        osNumber: reference("OS"),
        clientName: requiredText(body.clientName, "Cliente"),
        service: requiredText(body.service, "Serviço"),
        scheduledAt: dateTime(body.scheduledAt),
        technician: optionalText(body.technician),
        status: "aberta",
        ph: null,
        chlorine: null,
        alkalinity: null,
        productsUsed: "",
        notes: optionalText(body.notes),
        amountCents: cents(body.amount),
      };
      await db.prepare(`INSERT INTO work_orders (id, organization_id, os_number, client_name, service, scheduled_at, technician, status, ph, chlorine, alkalinity, products_used, notes, amount_cents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, '', ?, ?, ?, ?)`).bind(record.id, organization.id, record.osNumber, record.clientName, record.service, record.scheduledAt, record.technician, record.status, record.notes, record.amountCents, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "customers") {
      const volume = optionalText(body.poolVolume) ? Math.round(numberValue(body.poolVolume)) : null;
      const record = {
        id,
        name: requiredText(body.name, "Nome"),
        phone: requiredText(body.phone, "Telefone"),
        email: optionalText(body.email),
        address: optionalText(body.address),
        poolType: optionalText(body.poolType),
        poolVolume: volume,
        plan: optionalText(body.plan),
        status: "ativo",
        notes: optionalText(body.notes),
      };
      await db.prepare(`INSERT INTO customers (id, organization_id, name, phone, email, address, pool_type, pool_volume, plan, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.name, record.phone, record.email, record.address, record.poolType, record.poolVolume, record.plan, record.status, record.notes, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "inventory") {
      const record = {
        id,
        name: requiredText(body.name, "Produto"),
        sku: optionalText(body.sku),
        unit: optionalText(body.unit) || "unidade",
        quantity: Math.max(0, numberValue(body.quantity)),
        minimumQuantity: Math.max(0, numberValue(body.minimumQuantity)),
        costCents: cents(body.cost),
      };
      await db.prepare(`INSERT INTO inventory_items (id, organization_id, name, sku, unit, quantity, minimum_quantity, cost_cents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.name, record.sku, record.unit, record.quantity, record.minimumQuantity, record.costCents, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "transactions") {
      const status = transactionStatuses.has(optionalText(body.status)) ? optionalText(body.status) : "pendente";
      const type = optionalText(body.type) === "despesa" ? "despesa" : "receita";
      const record = {
        id,
        description: requiredText(body.description, "Descrição"),
        type,
        category: optionalText(body.category),
        amountCents: cents(body.amount),
        dueDate: optionalText(body.dueDate),
        status,
      };
      await db.prepare(`INSERT INTO transactions (id, organization_id, description, type, category, amount_cents, due_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.description, record.type, record.category, record.amountCents, record.dueDate, record.status, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "employees") {
      const colors = new Set(["aqua", "blue", "violet", "orange"]);
      const selectedColor = optionalText(body.color);
      const record = {
        id,
        name: requiredText(body.name, "Nome"),
        role: requiredText(body.role, "Função"),
        phone: optionalText(body.phone),
        color: colors.has(selectedColor) ? selectedColor : "aqua",
        active: true,
        createdAt,
      };
      await db.prepare(`INSERT INTO employees (id, organization_id, name, role, phone, color, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`).bind(record.id, organization.id, record.name, record.role, record.phone, record.color, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "warranties") {
      const purchaseDate = optionalText(body.purchaseDate);
      const expiresAt = requiredText(body.expiresAt, "Validade");
      if (purchaseDate && expiresAt < purchaseDate) throw new Error("A validade deve ser posterior à data de compra ou entrega.");
      const record = {
        id,
        warrantyNumber: reference("GAR"),
        clientName: requiredText(body.clientName, "Cliente"),
        item: requiredText(body.item, "Item ou serviço coberto"),
        originReference: optionalText(body.originReference),
        purchaseDate,
        expiresAt,
        scheduledAt: "",
        appointmentId: "",
        technician: "",
        status: "ativa",
        notes: optionalText(body.notes),
        createdAt,
      };
      await db.prepare(`INSERT INTO warranties (id, organization_id, warranty_number, client_name, item, origin_reference, purchase_date, expires_at, scheduled_at, appointment_id, technician, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?, ?)`).bind(record.id, organization.id, record.warrantyNumber, record.clientName, record.item, record.originReference, record.purchaseDate, record.expiresAt, record.status, record.notes, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "contracts") {
      const dayInput = optionalText(body.paymentDay);
      const paymentDay = dayInput ? Math.min(31, Math.max(1, Math.round(numberValue(dayInput)))) : null;
      const startDate = requiredText(body.startDate, "Início");
      const endDate = requiredText(body.endDate, "Término");
      if (endDate < startDate) throw new Error("O término deve ser posterior ao início do contrato.");
      const record = {
        id,
        contractNumber: reference("CTR"),
        clientName: requiredText(body.clientName, "Cliente"),
        clientDocument: optionalText(body.clientDocument),
        clientAddress: optionalText(body.clientAddress),
        service: requiredText(body.service, "Objeto do contrato"),
        startDate,
        endDate,
        frequency: optionalText(body.frequency) || "mensal",
        monthlyCents: cents(body.monthly),
        paymentDay,
        status: "rascunho",
        terms: optionalText(body.terms),
        createdAt,
      };
      await db.prepare(`INSERT INTO contracts (id, organization_id, contract_number, client_name, client_document, client_address, service, start_date, end_date, frequency, monthly_cents, payment_day, status, terms, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.contractNumber, record.clientName, record.clientDocument, record.clientAddress, record.service, record.startDate, record.endDate, record.frequency, record.monthlyCents, record.paymentDay, record.status, record.terms, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
  } catch (error) {
    if (error instanceof RequestError) return tenantError(error, "Não foi possível salvar.");
    const message = error instanceof Error ? error.message : "Não foi possível salvar.";
    console.error("record_create_failed", error);
    const validationError = message.includes("obrigatório") || message.includes("posterior");
    return Response.json({ error: message }, { status: validationError ? 400 : 503 });
  }
}
