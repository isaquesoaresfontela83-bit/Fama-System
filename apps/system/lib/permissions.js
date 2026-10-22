export const featurePermissions = [
    { id: "dashboard", label: "Visão geral", group: "Operação", description: "Central operacional, saldo, prioridades, painel personalizável, gráficos e gestão geral com indicadores." },
    { id: "crm", label: "CRM", group: "Operação", description: "Criar e editar leads, etapas comerciais e follow-up de vendas." },
    { id: "chat", label: "Chat", group: "Operação", description: "Conversas privadas e canais internos da equipe." },
    { id: "quotes", label: "Orçamentos", group: "Operação", description: "Criar e editar propostas, projetos, PDFs e aprovação do cliente." },
    { id: "agenda", label: "Agenda", group: "Operação", description: "Criar e editar agendamentos, execução de serviço, rotas, agenda semanal e envio automático da equipe." },
    { id: "mobile", label: "Modo técnico", group: "Operação", description: "Tela simplificada de campo para técnicos." },
    { id: "orders", label: "Ordens de serviço", group: "Operação", description: "Criar e editar serviços abertos, iniciar execução, checklist e concluir com relatório e confirmação do cliente." },
    { id: "warranties", label: "Garantias", group: "Operação", description: "Pós-venda, vencimentos e atendimento de garantia." },
    { id: "customers", label: "Clientes e piscinas", group: "Gestão", description: "Perfil dos clientes, seleção nos atendimentos, piscinas e consultas de CNPJ e CEP. Frete automático no Pro." },
    { id: "contracts", label: "Contratos", group: "Gestão", description: "Contratos recorrentes, vigência, mensalidade e PDF." },
    { id: "inventory", label: "Estoque", group: "Gestão", description: "Produtos, equipamentos, saldo, custo e estoque mínimo." },
    { id: "finance", label: "Financeiro", group: "Gestão", description: "Receitas, despesas, cobranças, Asaas, Pix e conciliação." },
    { id: "team", label: "Equipe", group: "Gestão", description: "Criar e editar técnicos, capacidade e agenda da equipe." },
];
export const featurePermissionIds = featurePermissions.map((item) => item.id);
export function normalizePermissions(value) {
    if (Array.isArray(value)) {
        return [...new Set(value.filter((item) => typeof item === "string" && featurePermissionIds.includes(item)))];
    }
    if (typeof value === "string") {
        try {
            return normalizePermissions(JSON.parse(value));
        }
        catch {
            return [];
        }
    }
    return [];
}
/**
 * A missing permissions value means the row predates granular access control.
 * An explicit empty array is intentional and denies every operational module.
 */
export function effectiveFeaturePermissions(value) {
    if (value === undefined || value === null || value === "")
        return defaultFeaturePermissions();
    return normalizePermissions(value);
}
export function hasFeaturePermission(role, permissions, permission, moduleAccess) {
    if (moduleAccess !== undefined)
        return Array.isArray(moduleAccess) && moduleAccess.includes(permission);
    // Only the company owner is unconditional. Administrators can manage users,
    // but their operational modules are controlled by the same explicit list.
    if (role === "owner")
        return true;
    return effectiveFeaturePermissions(permissions).includes(permission);
}
export function defaultFeaturePermissions() {
    return [...featurePermissionIds];
}
export const entityPermissions = {
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
