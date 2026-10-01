export const featurePermissions = [
  { id: "dashboard", label: "Visão geral", group: "Operação", description: "Resumo da operação, indicadores e atalhos do dia." },
  { id: "crm", label: "CRM", group: "Operação", description: "Leads, etapas comerciais e follow-up de vendas." },
  { id: "quotes", label: "Orçamentos", group: "Operação", description: "Projetos, propostas, PDFs e aprovação do cliente." },
  { id: "agenda", label: "Agenda", group: "Operação", description: "Visitas, rotas, reagendamento e agenda semanal." },
  { id: "mobile", label: "Modo técnico", group: "Operação", description: "Tela simplificada de campo para técnicos." },
  { id: "orders", label: "Ordens de serviço", group: "Operação", description: "Execução, checklist, conclusão e relatório técnico." },
  { id: "warranties", label: "Garantias", group: "Operação", description: "Pós-venda, vencimentos e atendimento de garantia." },
  { id: "customers", label: "Clientes e piscinas", group: "Gestão", description: "Cadastro, CPF/CNPJ, endereço, histórico e dados da piscina." },
  { id: "contracts", label: "Contratos", group: "Gestão", description: "Contratos recorrentes, vigência, mensalidade e PDF." },
  { id: "inventory", label: "Estoque", group: "Gestão", description: "Produtos, equipamentos, saldo, custo e estoque mínimo." },
  { id: "finance", label: "Financeiro", group: "Gestão", description: "Receitas, despesas, cobranças, Asaas, Pix e conciliação." },
  { id: "team", label: "Equipe", group: "Gestão", description: "Técnicos, capacidade, agenda da equipe e WhatsApp." },
] as const;

export type FeaturePermission = typeof featurePermissions[number]["id"];
export const featurePermissionIds = featurePermissions.map((item) => item.id) as FeaturePermission[];

export function normalizePermissions(value: unknown): FeaturePermission[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is FeaturePermission =>
      typeof item === "string" && featurePermissionIds.includes(item as FeaturePermission)))];
  }
  if (typeof value === "string") {
    try { return normalizePermissions(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

/**
 * A missing permissions value means the row predates granular access control.
 * An explicit empty array is intentional and denies every operational module.
 */
export function effectiveFeaturePermissions(value: unknown): FeaturePermission[] {
  if (value === undefined || value === null || value === "") return defaultFeaturePermissions();
  return normalizePermissions(value);
}

export function hasFeaturePermission(role: string, permissions: unknown, permission: FeaturePermission) {
  // Only the company owner is unconditional. Administrators can manage users,
  // but their operational modules are controlled by the same explicit list.
  if (role === "owner") return true;
  return effectiveFeaturePermissions(permissions).includes(permission);
}

export function defaultFeaturePermissions() {
  return [...featurePermissionIds];
}

export const entityPermissions: Record<string, FeaturePermission> = {
  leads: "crm",
  quotes: "quotes",
  appointments: "agenda",
  workOrders: "orders",
  customers: "customers",
  inventory: "inventory",
  transactions: "finance",
  employees: "team",
  warranties: "warranties",
  contracts: "contracts",
};
