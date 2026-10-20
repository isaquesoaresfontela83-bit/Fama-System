const basicModules = [
    "CRM, clientes e piscinas",
    "Agenda, mapa operacional e ordens de serviço",
    "Orçamentos em PDF",
    "Consulta de CNPJ e CEP",
    "Painel personalizável e gestão geral",
    "Manual e chamados de suporte",
].join("\n");
const plusModules = ["Tudo do Basic", "Financeiro, contas a pagar e receber, Asaas e Pix", "Contratos e garantias", "Estoque e controle de produtos", "Gestão da equipe e modo técnico", "Chat interno"].join("\n");
const proModules = ["Tudo do Plus", "Fama IA para consultar e planejar a operação", "Frete automático: distância entre CEPs × tarifa por km", "Preparação e arquivo de notas fiscais; emissão de NFS-e pela Asaas com configuração fiscal"].join("\n");
export const PLAN_PRICE_NOTICE = "Os valores, limites e recursos dos planos estão sujeitos a alterações, sempre com aviso prévio.";
export const defaultPlanCatalog = [
    { id: "inicial", name: "Basic", price: 9900, description: "Para profissionais autônomos e pequenas equipes organizarem clientes, agenda, orçamentos e serviços em um só lugar.", users: "Até 3 usuários", clients: "Até 200 clientes", modules: basicModules },
    { id: "intermediario", name: "Plus", price: 19900, description: "Para empresas em crescimento controlarem o financeiro e coordenarem equipe, estoque, contratos e garantias, com comunicação interna.", users: "Até 6 usuários", clients: "Até 1.000 clientes", modules: plusModules },
    { id: "profissional", name: "Pro", price: 35000, description: "A operação completa, com Fama IA, frete automático entre CEPs e notas fiscais para empresas com maior volume de serviços.", users: "Até 10 usuários", clients: "Até 5.000 clientes", modules: proModules },
];
