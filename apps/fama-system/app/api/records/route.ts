import { cents, database, dateTime, numberValue, optionalText, reference, requiredText } from "@/lib/database";
import { insertRow, selectRows, snakeRow, usesSupabase } from "@/lib/supabase";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { encryptRecordFields, encryptedFieldsByEntity } from "@/lib/crypto";
import { assertRateLimit } from "@/lib/security";
import { quoteCardPayment, quoteUrgency } from "@/lib/quote-calculation";
import { poolQuoteQuantity } from "@/lib/pool-quote-catalog";
import { readQuoteConfig } from "@/lib/quote-config";
import { getPlanSnapshot, isPlanCode } from "@/lib/plans";

const leadStatuses = new Set(["novo", "contato", "visita", "proposta", "negociacao", "ganho", "perdido"]);
const transactionStatuses = new Set(["pendente", "pago", "atrasado"]);

function structuredNotes(body: Record<string, unknown>, fields: string[]) {
  const details = Object.fromEntries(fields.map((field) => [field, field === "clientDocument" ? optionalText(body[field]).replace(/\D/g, "") : optionalText(body[field])]).filter(([, value]) => value));
  return JSON.stringify({ text: optionalText(body.notes), details });
}

async function saveSupabaseRecord(table: string, organizationId: string, record: Record<string, unknown>, createdAt: string) {
  const entity = Object.entries({ leads: "leads", quotes: "quotes", appointments: "appointments", workOrders: "work_orders", customers: "customers", inventory: "inventory_items", transactions: "transactions", employees: "employees", warranties: "warranties", contracts: "contracts" }).find(([, value]) => value === table)?.[0] ?? table;
  const protectedRecord = await encryptRecordFields(record, encryptedFieldsByEntity[entity] ?? []);
  await insertRow(table, { ...snakeRow(protectedRecord), organization_id: organizationId, updated_at: createdAt });
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    await assertRateLimit(request, "record_create", user.id, 60, 60);
    const body = await request.json() as Record<string, unknown>;
    const entity = optionalText(body.entity);
    if (!entityPermissions[entity] || !hasFeaturePermission(organization.role, organization.permissions, entityPermissions[entity])) {
      throw new RequestError("Seu perfil não possui acesso a este módulo.", 403);
    }
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
      if (usesSupabase()) {
        await saveSupabaseRecord("leads", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
      await db.prepare(`INSERT INTO leads (id, organization_id, name, phone, source, interest, status, estimated_value_cents, next_action, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, organization.id, record.name, record.phone, record.source, record.interest, record.status, record.estimatedValueCents, record.nextAction, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "quotes") {
      const effectiveQuoteConfig = await readQuoteConfig(organization.id);
      let calculatedItems: Record<string, unknown>[] = [];
      if (typeof body.poolItems === "string" && body.poolItems) {
        let submitted: unknown;
        try { submitted = JSON.parse(body.poolItems); } catch { throw new RequestError("Os itens do orçamento estão inválidos.", 400); }
        if (!Array.isArray(submitted) || submitted.length < 1 || submitted.length > 50) throw new RequestError("Adicione de 1 a 50 itens ao orçamento.", 400);
        calculatedItems = submitted.map((value) => {
          if (!value || typeof value !== "object") throw new RequestError("Um item do orçamento está inválido.", 400);
          const entry = value as { category?: unknown; name?: unknown; dimensions?: unknown };
          const category = effectiveQuoteConfig.catalog.find((item) => item.category === entry.category);
          const item = category?.items.find((candidate) => candidate.name === entry.name);
          if (!category || !item) throw new RequestError("Um serviço escolhido não existe mais no catálogo.", 400);
          const dimensions = entry.dimensions && typeof entry.dimensions === "object" && !Array.isArray(entry.dimensions) ? entry.dimensions as Record<string, unknown> : {};
          const quantity = poolQuoteQuantity(item, dimensions);
          if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new RequestError(`Informe medidas válidas para ${item.name}.`, 400);
          const totalCents = Math.round(quantity * item.price * (1 + item.markup / 100) * 100);
          return { category: category.category, name: item.name, unit: item.unit, quantity, unitPrice: item.price, markup: item.markup, totalCents, dimensions };
        });
      }
      const materialsCents = calculatedItems.length ? calculatedItems.reduce((sum, item) => sum + Number(item.totalCents), 0) : cents(body.materials);
      const laborCents = cents(body.labor);
      const travelCents = cents(body.travel);
      const discountCents = cents(body.discount);
      const urgency = quoteUrgency(body.urgency);
      const subtotalCents = materialsCents + laborCents + travelCents;
      const surchargePercent = effectiveQuoteConfig.urgency[urgency.urgency];
      const urgencySurchargeCents = Math.round(subtotalCents * Math.max(0, Math.min(500, surchargePercent)) / 100);
      const baseTotalCents = Math.max(0, subtotalCents + urgencySurchargeCents - discountCents);
      const paymentMethod = ["pix", "credit", "boleto"].includes(String(body.paymentMethod ?? "")) ? String(body.paymentMethod) : "pix";
      const installments = Math.max(1, Math.min(24, Math.round(numberValue(body.installments) || 1)));
      const cardRate = Math.max(0, Math.min(50, numberValue(body.cardRate)));
      const cardPayment = quoteCardPayment(baseTotalCents, paymentMethod === "credit" ? cardRate : 0);
      const cardFeeCents = cardPayment.feeCents;
      const totalCents = cardPayment.totalCents;
      const installmentCents = Math.ceil(totalCents / installments);
      const record = {
        id,
        quoteNumber: reference("ORC"),
        clientName: requiredText(body.clientName, "Cliente"),
        service: calculatedItems.length ? calculatedItems.map((item) => String(item.name)).join(", ") : requiredText(body.service, "Serviço"),
        materialsCents,
        laborCents,
        discountCents,
        totalCents,
        status: "rascunho",
        validUntil: optionalText(body.validUntil),
        notes: structuredNotes({ ...body, products: calculatedItems.length ? JSON.stringify(calculatedItems) : body.products, poolItems: calculatedItems.length ? JSON.stringify(calculatedItems) : body.poolItems, urgency: urgency.label, urgencyRate: String(surchargePercent), paymentMethod, installments: String(installments), cardRate: String(cardRate), cardFee: String(cardFeeCents), baseTotal: String(baseTotalCents), installmentValue: String(installmentCents) }, ["products", "poolItems", "travel", "urgency", "urgencyRate", "paymentTerms", "paymentMethod", "installments", "cardRate", "cardFee", "baseTotal", "installmentValue", "poolDimensions"]),
        createdAt,
      };
      if (usesSupabase()) {
        await saveSupabaseRecord("quotes", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
        notes: structuredNotes(body, ["frequency", "duration", "routeOrder"]),
      };
      if (usesSupabase()) {
        await saveSupabaseRecord("appointments", organization.id, record, createdAt);
        const frequency = optionalText(body.frequency);
        const intervalDays = frequency === "semanal" ? 7 : frequency === "quinzenal" ? 14 : frequency === "mensal" ? 30 : 0;
        const repeatCount = frequency === "semanal" ? 11 : frequency === "quinzenal" ? 5 : frequency === "mensal" ? 2 : 0;
        for (let index = 1; index <= repeatCount; index += 1) {
          const recurringDate = new Date(record.startAt);
          recurringDate.setUTCDate(recurringDate.getUTCDate() + intervalDays * index);
          await saveSupabaseRecord("appointments", organization.id, { ...record, id: crypto.randomUUID(), startAt: recurringDate.toISOString(), status: "agendado" }, createdAt);
        }
        return Response.json({ record, recurringCreated: repeatCount }, { status: 201 });
      }
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
        ph: optionalText(body.ph) ? numberValue(body.ph) : null,
        chlorine: optionalText(body.chlorine) ? numberValue(body.chlorine) : null,
        alkalinity: optionalText(body.alkalinity) ? numberValue(body.alkalinity) : null,
        productsUsed: optionalText(body.productsUsed),
        notes: structuredNotes(body, ["calciumHardness", "stabilizer", "waterAppearance", "productCost", "laborCost", "travelCost", "checklist"]),
        amountCents: cents(body.amount),
      };
      if (usesSupabase()) {
        await saveSupabaseRecord("work_orders", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
      await db.prepare(`INSERT INTO work_orders (id, organization_id, os_number, client_name, service, scheduled_at, technician, status, ph, chlorine, alkalinity, products_used, notes, amount_cents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, '', ?, ?, ?, ?)`).bind(record.id, organization.id, record.osNumber, record.clientName, record.service, record.scheduledAt, record.technician, record.status, record.notes, record.amountCents, createdAt, createdAt).run();
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "customers") {
      const plan = await getPlanSnapshot(isPlanCode(organization.plan) ? organization.plan : "inicial");
      const count = usesSupabase()
        ? (await selectRows("customers", { organization_id: organization.id }, { select: "id", limit: plan.limits.customers })).length
        : (await db.prepare("SELECT COUNT(*) AS count FROM customers WHERE organization_id = ?").bind(organization.id).first<{ count: number }>())?.count ?? 0;
      if (count >= plan.limits.customers) throw new RequestError(`O plano ${plan.name} permite até ${plan.limits.customers} clientes. Atualize o plano para adicionar mais.`, 409);
      const clientDocument = optionalText(body.clientDocument).replace(/\D/g, "");
      if (clientDocument && clientDocument.length !== 11 && clientDocument.length !== 14) {
        throw new RequestError("Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.", 400);
      }
      const length = numberValue(body.poolLength);
      const width = numberValue(body.poolWidth);
      const depth = numberValue(body.poolDepth);
      const shapeFactor = optionalText(body.poolShape) === "redonda" ? 0.785 : optionalText(body.poolShape) === "oval" ? 0.89 : 1;
      const calculatedVolume = length > 0 && width > 0 && depth > 0 ? Math.round(length * width * depth * shapeFactor * 1000) : null;
      const volume = optionalText(body.poolVolume) ? Math.round(numberValue(body.poolVolume)) : calculatedVolume;
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
        notes: structuredNotes(body, ["clientDocument", "poolShape", "filterType", "pump", "frequency", "problemHistory", "billingDay", "responsible"]),
      };
      if (usesSupabase()) {
        await saveSupabaseRecord("customers", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
      if (usesSupabase()) {
        await saveSupabaseRecord("inventory_items", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
      if (usesSupabase()) {
        await saveSupabaseRecord("transactions", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
      if (usesSupabase()) {
        await saveSupabaseRecord("employees", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
      if (usesSupabase()) {
        await saveSupabaseRecord("warranties", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
      if (usesSupabase()) {
        await saveSupabaseRecord("contracts", organization.id, record, createdAt);
        return Response.json({ record }, { status: 201 });
      }
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
