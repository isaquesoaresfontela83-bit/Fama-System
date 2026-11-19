// A produção recebe o catálogo atual do Control no HTML.
// A prévia local usa o retrato conferido em 19/11/2026.
const catalogNode = typeof document === 'undefined' ? null : document.getElementById('fama-public-catalog');
const liveCatalog = catalogNode ? JSON.parse(catalogNode.textContent) : null;
export const cycles = {
 monthly: { name: 'Mensal', months: 1, discount: 0 },
 quarterly: { name: 'Trimestral', months: 3, discount: 5 },
 semiannual: { name: 'Semestral', months: 6, discount: 10 },
 annual: { name: 'Anual', months: 12, discount: 15 },
};

export const plans = liveCatalog?.plans ?? [
 {
  code: 'inicial',
  name: 'Basic',
  priceCents: 10900,
  users: 3,
  customers: 100000,
  icon: 'grid',
  label: 'ORGANIZAÇÃO',
  description: 'Sua rotina de atendimentos bem organizada.',
  featureTitle: 'O essencial para sua operação',
  features: ['CRM, clientes e piscinas', 'Orçamentos em PDF', 'Agenda e planejamento de visitas', 'Ordens de serviço com checklist', 'Financeiro básico'],
 },
 {
  code: 'intermediario',
  name: 'Plus',
  priceCents: 19900,
  users: 6,
  customers: 100000,
  icon: 'layers',
  label: 'EQUIPE E GESTÃO',
  description: 'A equipe e o financeiro na mesma operação.',
  featureTitle: 'Tudo do Basic, mais',
  features: ['Financeiro com Asaas e Pix', 'Compras e conciliação de extrato', 'Estoque e código de barras', 'Gestão da equipe e modo técnico', 'Gestão de filiais e chat interno'],
 },
 {
  code: 'profissional',
  name: 'Pro',
  priceCents: 39900,
  users: 50,
  customers: 100000,
  icon: 'sparkles',
  label: 'INTELIGÊNCIA E ESCALA',
  description: 'Mais recursos para ampliar sua gestão.',
  featureTitle: 'Tudo do Plus, mais',
  features: ['Fama IA com voz', 'Planejamento semanal com IA', 'Cálculo automático de frete', 'Preparação e arquivo de notas', 'NFS-e via Asaas, com configuração'],
 },
];

// Os níveis de inclusão refletem a comparação publicada do catálogo atual.
export const featureGroups = liveCatalog?.featureGroups ?? [
 {
  title: 'Organização e atendimento',
  minimum: 0,
  features: [
   'Painel personalizável e gestão geral',
   'CRM e acompanhamento de negociações',
   'Orçamentos em PDF e conversão em ordem de serviço',
   'Agenda recorrente, mapa, clima e planejamento de visitas',
   'Ordens de serviço com checklist',
   'Financeiro básico com entradas, saídas e saldo mensal',
   'Clientes e piscinas, com consulta de CNPJ e CEP',
   'Contratos e documentos',
   'Manual e chamados de suporte',
  ],
 },
 {
  title: 'Equipe e gestão completa',
  minimum: 1,
  features: [
   'Financeiro, contas a pagar e receber, Asaas e Pix',
   'Compras, fornecedores, contas bancárias e conciliação',
   'Contratos e garantias',
   'Estoque com leitura de código de barras',
   'Gestão da equipe e modo técnico',
   'Chat interno',
   'Filiais com gestão e usuários por loja',
  ],
 },
 {
  title: 'Inteligência e recursos avançados',
  minimum: 2,
  features: [
   'Fama IA com voz para consultar e planejar a operação',
   'Apoio da IA ao planejamento semanal, quando habilitado',
   'Frete por distância entre CEPs e tarifa por km',
   'Preparação e arquivo de notas, NFS-e via Asaas configurada',
  ],
 },
];

export function cycleTotal(priceCents, cycleCode) {
 const cycle = cycles[cycleCode];
 return Math.round(priceCents * cycle.months * (100 - cycle.discount) / 100);
}
