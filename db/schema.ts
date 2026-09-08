import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("active"),
  createdByUserId: text("created_by_user_id").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_organizations_slug").on(table.slug),
  index("idx_organizations_status").on(table.status),
]);

export const organizationMembers = sqliteTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull().default(""),
  userEmail: text("user_email").notNull(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("invited"),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_org_members_org_email").on(table.organizationId, table.userEmail),
  index("idx_org_members_user_id").on(table.userId),
  index("idx_org_members_organization").on(table.organizationId),
]);

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  source: text("source").notNull().default(""),
  interest: text("interest").notNull().default(""),
  status: text("status").notNull().default("novo"),
  estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
  nextAction: text("next_action").notNull().default(""),
  ...timestamps,
}, (table) => [
  index("idx_leads_created_at").on(table.createdAt),
  index("idx_leads_org_created_at").on(table.organizationId, table.createdAt),
]);

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  quoteNumber: text("quote_number").notNull(),
  clientName: text("client_name").notNull(),
  service: text("service").notNull(),
  materialsCents: integer("materials_cents").notNull().default(0),
  laborCents: integer("labor_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  status: text("status").notNull().default("rascunho"),
  validUntil: text("valid_until").notNull().default(""),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_quotes_number").on(table.quoteNumber),
  index("idx_quotes_created_at").on(table.createdAt),
  index("idx_quotes_org_created_at").on(table.organizationId, table.createdAt),
]);

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  startAt: text("start_at").notNull(),
  address: text("address").notNull().default(""),
  technician: text("technician").notNull().default(""),
  kind: text("kind").notNull().default("Manutenção"),
  status: text("status").notNull().default("agendado"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [
  index("idx_appointments_start_at").on(table.startAt),
  index("idx_appointments_org_start_at").on(table.organizationId, table.startAt),
]);

export const workOrders = sqliteTable("work_orders", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  osNumber: text("os_number").notNull(),
  clientName: text("client_name").notNull(),
  service: text("service").notNull(),
  scheduledAt: text("scheduled_at").notNull().default(""),
  technician: text("technician").notNull().default(""),
  status: text("status").notNull().default("aberta"),
  ph: real("ph"),
  chlorine: real("chlorine"),
  alkalinity: real("alkalinity"),
  productsUsed: text("products_used").notNull().default(""),
  notes: text("notes").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_work_orders_number").on(table.osNumber),
  index("idx_work_orders_scheduled_at").on(table.scheduledAt),
  index("idx_work_orders_org_scheduled_at").on(table.organizationId, table.scheduledAt),
]);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  poolType: text("pool_type").notNull().default(""),
  poolVolume: integer("pool_volume"),
  plan: text("plan").notNull().default(""),
  status: text("status").notNull().default("ativo"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [
  index("idx_customers_name").on(table.name),
  index("idx_customers_org_name").on(table.organizationId, table.name),
]);

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  name: text("name").notNull(),
  sku: text("sku").notNull().default(""),
  unit: text("unit").notNull().default("unidade"),
  quantity: real("quantity").notNull().default(0),
  minimumQuantity: real("minimum_quantity").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  ...timestamps,
}, (table) => [
  index("idx_inventory_name").on(table.name),
  index("idx_inventory_org_name").on(table.organizationId, table.name),
]);

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  description: text("description").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  dueDate: text("due_date").notNull().default(""),
  status: text("status").notNull().default("pendente"),
  ...timestamps,
}, (table) => [
  index("idx_transactions_due_date").on(table.dueDate),
  index("idx_transactions_org_due_date").on(table.organizationId, table.dueDate),
]);

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  phone: text("phone").notNull().default(""),
  color: text("color").notNull().default("aqua"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  index("idx_employees_name").on(table.name),
  index("idx_employees_org_name").on(table.organizationId, table.name),
]);

export const warranties = sqliteTable("warranties", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  warrantyNumber: text("warranty_number").notNull(),
  clientName: text("client_name").notNull(),
  item: text("item").notNull(),
  originReference: text("origin_reference").notNull().default(""),
  purchaseDate: text("purchase_date").notNull().default(""),
  expiresAt: text("expires_at").notNull().default(""),
  scheduledAt: text("scheduled_at").notNull().default(""),
  appointmentId: text("appointment_id").notNull().default(""),
  technician: text("technician").notNull().default(""),
  status: text("status").notNull().default("ativa"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_warranties_number").on(table.warrantyNumber),
  index("idx_warranties_expires_at").on(table.expiresAt),
  index("idx_warranties_org_expires_at").on(table.organizationId, table.expiresAt),
]);

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default(""),
  contractNumber: text("contract_number").notNull(),
  clientName: text("client_name").notNull(),
  clientDocument: text("client_document").notNull().default(""),
  clientAddress: text("client_address").notNull().default(""),
  service: text("service").notNull(),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  frequency: text("frequency").notNull().default("mensal"),
  monthlyCents: integer("monthly_cents").notNull().default(0),
  paymentDay: integer("payment_day"),
  status: text("status").notNull().default("rascunho"),
  terms: text("terms").notNull().default(""),
  ...timestamps,
}, (table) => [
  uniqueIndex("idx_contracts_number").on(table.contractNumber),
  index("idx_contracts_created_at").on(table.createdAt),
  index("idx_contracts_org_created_at").on(table.organizationId, table.createdAt),
]);
