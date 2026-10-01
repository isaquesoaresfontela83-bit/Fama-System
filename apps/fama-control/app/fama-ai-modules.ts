import { CalendarDays, CircleDollarSign, FileCheck2, FileText, Package, Users, LayoutDashboard, BriefcaseBusiness, Wrench, ShieldCheck, Building2, UserRoundCog, History, DatabaseBackup, LockKeyhole, ContactRound, type LucideIcon } from 'lucide-react';
import type { AssistantSource, AssistantSuggestion } from '@/lib/fama-ai';

export const aiModules: Record<AssistantSource, { icon: LucideIcon; label: string; description: string; prompts: AssistantSuggestion[] }> = {
  overview: { icon: LayoutDashboard, label: 'Visão geral', description: 'As prioridades da sua operação em um só lugar.', prompts: [
    { label: 'Organizar meu dia', question: 'Plano de ação da empresa', source: 'overview' },
  ] },
  agenda: { icon: CalendarDays, label: 'Agenda', description: 'Compromissos, próximos atendimentos e distribuição da agenda.', prompts: [
    { label: 'O que tenho para hoje?', question: 'Agenda de hoje', source: 'agenda' },
    { label: 'Planejar a semana', question: 'Planejar agenda da semana', source: 'agenda' },
    { label: 'Revisar os conflitos', question: 'Conflitos na agenda', source: 'agenda' },
  ] },
  crm: { icon: BriefcaseBusiness, label: 'CRM e vendas', description: 'Negociações, clientes em potencial e próximos contatos.', prompts: [
    { label: 'Negociações em aberto', question: 'Leads pendentes', source: 'crm' },
    { label: 'Visão do funil', question: 'Diagnóstico do funil do CRM', source: 'crm' },
  ] },
  quotes: { icon: FileText, label: 'Orçamentos', description: 'Propostas, valores, aprovações e oportunidades de retorno.', prompts: [
    { label: 'Quem aguarda retorno?', question: 'Orçamentos enviados', source: 'quotes' },
    { label: 'Validades vencidas', question: 'Orçamentos vencidos', source: 'quotes' },
    { label: 'Preparar acompanhamento', question: 'Mensagem para orçamento', source: 'quotes' },
    { label: 'Preparar novo orçamento', question: 'Preparar orçamento', source: 'quotes' },
  ] },
  orders: { icon: Wrench, label: 'Ordens de serviço', description: 'Serviços em andamento e entregas da sua equipe.', prompts: [
    { label: 'Serviços em aberto', question: 'Ordens de serviço pendentes', source: 'orders' },
    { label: 'Serviços concluídos', question: 'Ordens de serviço concluídas', source: 'orders' },
  ] },
  customers: { icon: ContactRound, label: 'Clientes', description: 'Localize os clientes e consulte sua carteira.', prompts: [
    { label: 'Consultar histórico completo', question: 'Cliente 360', source: 'customers' },
    { label: 'Minha carteira de clientes', question: 'Clientes', source: 'customers' },
    { label: 'Clientes ativos', question: 'Clientes ativos', source: 'customers' },
  ] },
  inventory: { icon: Package, label: 'Estoque', description: 'Disponibilidade de produtos e necessidade de reposição.', prompts: [
    { label: 'O que preciso repor?', question: 'Estoque baixo', source: 'inventory' },
    { label: 'Produtos esgotados', question: 'Estoque zerado', source: 'inventory' },
  ] },
  finance: { icon: CircleDollarSign, label: 'Financeiro', description: 'Recebimentos, despesas, vencimentos e saldo realizado.', prompts: [
    { label: 'Projeção de entradas e saídas', question: 'Fluxo de caixa dos próximos 30 dias', source: 'finance' },
    { label: 'Comparar mês atual e anterior', question: 'Comparar financeiro', source: 'finance' },
    { label: 'O que está em atraso?', question: 'Lançamentos financeiros atrasados', source: 'finance' },
    { label: 'Vencimentos deste mês', question: 'Financeiro deste mês', source: 'finance' },
  ] },
  team: { icon: Users, label: 'Equipe', description: 'Profissionais ativos e distribuição dos atendimentos.', prompts: [
    { label: 'Equipe ativa', question: 'Equipe ativa', source: 'team' },
    { label: 'Distribuição do trabalho', question: 'Carga de trabalho da equipe hoje', source: 'team' },
  ] },
  warranties: { icon: ShieldCheck, label: 'Garantias', description: 'Validade, coberturas e registros de assistência.', prompts: [
    { label: 'Garantias vencidas', question: 'Garantias vencidas', source: 'warranties' },
    { label: 'Vencimento em 30 dias', question: 'Garantias a vencer em 30 dias', source: 'warranties' },
  ] },
  contracts: { icon: FileCheck2, label: 'Contratos', description: 'Contratos ativos, mensalidades e prazos de renovação.', prompts: [
    { label: 'Contratos em vigor', question: 'Contratos ativos', source: 'contracts' },
    { label: 'O que preciso renovar?', question: 'Contratos ativos a vencer em 30 dias', source: 'contracts' },
    { label: 'Preparar novo contrato', question: 'Preparar contrato', source: 'contracts' },
  ] },
  companies: { icon: Building2, label: 'Empresas', description: 'Consulte os cadastros e a situação das empresas.', prompts: [
    { label: 'Empresas da plataforma', question: 'Empresas', source: 'companies' },
    { label: 'Empresas suspensas', question: 'Empresas suspensas', source: 'companies' },
  ] },
  users: { icon: UserRoundCog, label: 'Usuários', description: 'Cadastros, funções e acessos à plataforma.', prompts: [
    { label: 'Consultar usuários', question: 'Usuários', source: 'users' },
  ] },
  audit: { icon: History, label: 'Auditoria', description: 'Eventos registrados e histórico de administração.', prompts: [
    { label: 'Histórico da plataforma', question: 'Auditoria', source: 'audit' },
  ] },
  backup: { icon: DatabaseBackup, label: 'Backups', description: 'Registros de backup disponíveis nesta área.', prompts: [
    { label: 'Consultar backups', question: 'Backups', source: 'backup' },
  ] },
  privacy: { icon: LockKeyhole, label: 'Privacidade', description: 'Solicitações e registros de privacidade.', prompts: [
    { label: 'Pedidos de privacidade', question: 'Solicitações de privacidade', source: 'privacy' },
  ] },
};

export const aiStarterSources: AssistantSource[] = ['agenda', 'finance', 'quotes', 'contracts', 'inventory', 'overview', 'companies', 'users', 'audit', 'privacy', 'crm', 'orders', 'customers', 'team', 'warranties', 'backup'];
