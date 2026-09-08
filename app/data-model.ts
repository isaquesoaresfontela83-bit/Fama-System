export type LeadStatus = "novo" | "contato" | "visita" | "proposta" | "ganho";
export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado";
export type AppointmentStatus = "agendado" | "em_rota" | "concluido";
export type WorkOrderStatus = "aberta" | "em_execucao" | "concluida";
export type TransactionStatus = "pendente" | "pago" | "atrasado";
export type WarrantyStatus = "ativa" | "agendada" | "concluida" | "expirada";
export type ContractStatus = "rascunho" | "ativo" | "suspenso" | "encerrado";
export type OrganizationRole = "owner" | "admin" | "member" | "technician";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

export type CurrentUser = {
  id: string;
  displayName: string;
  email: string;
  isPlatformAdmin: boolean;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  source: string;
  interest: string;
  status: LeadStatus;
  estimatedValueCents: number;
  nextAction: string;
  createdAt: string;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  clientName: string;
  service: string;
  materialsCents: number;
  laborCents: number;
  discountCents: number;
  totalCents: number;
  status: QuoteStatus;
  validUntil: string;
  notes: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  title: string;
  clientName: string;
  startAt: string;
  address: string;
  technician: string;
  kind: string;
  status: AppointmentStatus;
  notes: string;
};

export type WorkOrder = {
  id: string;
  osNumber: string;
  clientName: string;
  service: string;
  scheduledAt: string;
  appointmentId: string;
  technician: string;
  status: WorkOrderStatus;
  ph: number | null;
  chlorine: number | null;
  alkalinity: number | null;
  productsUsed: string;
  notes: string;
  amountCents: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  poolType: string;
  poolVolume: number | null;
  plan: string;
  status: string;
  notes: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  minimumQuantity: number;
  costCents: number;
};

export type Transaction = {
  id: string;
  description: string;
  type: "receita" | "despesa";
  category: string;
  amountCents: number;
  dueDate: string;
  status: TransactionStatus;
};

export type Employee = {
  id: string;
  name: string;
  role: string;
  phone: string;
  color: string;
  active: boolean;
  createdAt: string;
};

export type Warranty = {
  id: string;
  warrantyNumber: string;
  clientName: string;
  item: string;
  originReference: string;
  purchaseDate: string;
  expiresAt: string;
  scheduledAt: string;
  technician: string;
  status: WarrantyStatus;
  notes: string;
  createdAt: string;
};

export type Contract = {
  id: string;
  contractNumber: string;
  clientName: string;
  clientDocument: string;
  clientAddress: string;
  service: string;
  startDate: string;
  endDate: string;
  frequency: string;
  monthlyCents: number;
  paymentDay: number | null;
  status: ContractStatus;
  terms: string;
  createdAt: string;
};

export type BootstrapData = {
  leads: Lead[];
  quotes: Quote[];
  appointments: Appointment[];
  workOrders: WorkOrder[];
  customers: Customer[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  employees: Employee[];
  warranties: Warranty[];
  contracts: Contract[];
};

export const emptyData: BootstrapData = {
  leads: [],
  quotes: [],
  appointments: [],
  workOrders: [],
  customers: [],
  inventory: [],
  transactions: [],
  employees: [],
  warranties: [],
  contracts: [],
};
