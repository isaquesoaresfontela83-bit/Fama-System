import { PLAN_FEATURES } from "./plan-features";
const basicModules = [
    "CRM, clientes e piscinas",
    "Agenda semanal e recorrente, mapa operacional e ordens de serviço com checklist",
    "Planejamento de visitas com clima, CEP e estimativa de deslocamento",
    "Orçamentos em PDF e conversão em ordem de serviço",
    "Consulta de CNPJ e CEP",
    "Painel personalizável e gestão geral",
    "Manual e chamados de suporte",
].join("\n");
const plusModules = ["Tudo do Basic", "Financeiro, contas a pagar e receber, Asaas e Pix", "Compras, fornecedores, contas bancárias e conciliação de extrato", "Contratos e garantias", "Estoque e controle de produtos com leitura de código de barras", "Gestão da equipe e modo técnico", "Chat interno"].join("\n");
const proModules = ["Tudo do Plus", "Fama IA com voz para consultar e planejar a operação", "Apoio da IA ao planejamento semanal, quando habilitado", "Frete automático: distância entre CEPs × tarifa por km", "Preparação e arquivo de notas fiscais; emissão de NFS-e pela Asaas com configuração fiscal"].join("\n");
export const PLAN_PRICE_NOTICE = "Os valores, limites e recursos dos planos estão sujeitos a alterações, sempre com aviso prévio.";
export const defaultPlanCatalog = [
    { id: "inicial", name: "Basic", price: 9900, description: "Organize clientes, propostas e serviços, com agenda recorrente, mapa e planejamento de visitas com previsão do tempo.", users: "Até 3 usuários", clients: "Até 200 clientes", modules: basicModules },
    { id: "intermediario", name: "Plus", price: 19900, description: "Conecte a operação ao financeiro, com compras, conciliação, estoque com código de barras, equipe, contratos e garantias.", users: "Até 6 usuários", clients: "Até 1.000 clientes", modules: plusModules },
    { id: "profissional", name: "Pro", price: 35000, description: "Amplie a operação com Fama IA e voz, apoio ao planejamento semanal, frete automático e recursos fiscais integrados.", users: "Até 10 usuários", clients: "Até 5.000 clientes", modules: proModules },
];

// Descriptions for restricted catalogs never advertise a disabled module.
const featureDetails = {
    dashboard: "Painel personalizável e gestão geral",
    crm: "CRM e acompanhamento de negociações",
    quotes: "Orçamentos em PDF e conversão em ordem de serviço",
    agenda: "Agenda semanal e recorrente, mapa, clima e planejamento de visitas",
    orders: "Ordens de serviço com checklist",
    customers: "Clientes e piscinas; consulta de CNPJ e CEP",
    finance: "Financeiro, contas a pagar e receber, Asaas e Pix; compras e conciliação",
    contracts: "Contratos e documentos",
    warranties: "Garantias e acompanhamento de atendimentos",
    inventory: "Estoque e controle de produtos com leitura de código de barras",
    team: "Gestão da equipe",
    mobile: "Modo técnico para execução em campo",
    chat: "Chat interno",
    assistant: "Fama IA com voz para consultar e planejar a operação",
    freight: "Frete automático: distância entre CEPs × tarifa por km",
    invoices: "Preparação e arquivo de notas fiscais; emissão de NFS-e pela Asaas com configuração fiscal",
};
export function refreshCatalogPresentation(plan) {
    const current = defaultPlanCatalog.find(item => item.id === plan?.id);
    if (!current) return plan;
    // Explicit feature selections remain authoritative, including inherited modules.
    const complete = PLAN_FEATURES[plan.id];
    if (Array.isArray(plan.featureIds) && (!complete || plan.featureIds.length !== complete.length || complete.some(id => !plan.featureIds.includes(id)))) {
        return { ...plan, description: "Recursos selecionados pela administração para a operação da sua empresa.", modules: [...plan.featureIds.map(id => featureDetails[id]).filter(Boolean), "Manual e chamados de suporte"].join("\n") };
    }
    return { ...plan, description: current.description, modules: current.modules };
}
