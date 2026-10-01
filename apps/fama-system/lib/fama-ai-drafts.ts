import type { BootstrapData } from '@/app/data-model';
import type { AssistantSource } from './fama-ai-settings';

export type AssistantDraftEntity = 'appointments' | 'transactions' | 'contracts' | 'quotes' | 'workOrders' | 'customers' | 'leads';
export type AssistantDraft = { entity: AssistantDraftEntity; fields: Record<string, string> };
export type DraftField = { name: string; label: string; required?: boolean; type?: 'date' | 'datetime-local' | 'email' | 'number' | 'textarea'; options?: [string, string][]; placeholder?: string };
export const assistantDraftDefinitions: Record<AssistantDraftEntity, { title: string; source: AssistantSource; fields: DraftField[] }> = {
  appointments: { title: 'Preparar agendamento', source: 'agenda', fields: [
    { name: 'title', label: 'Compromisso', required: true }, { name: 'clientName', label: 'Cliente', required: true }, { name: 'startAt', label: 'Data e hora', type: 'datetime-local', required: true },
    { name: 'technician', label: 'Técnico' }, { name: 'kind', label: 'Tipo de visita', options: [['Manutenção', 'Manutenção'], ['Visita técnica', 'Visita técnica'], ['Instalação', 'Instalação'], ['Diagnóstico', 'Diagnóstico'], ['Garantia', 'Garantia']] },
    { name: 'duration', label: 'Duração estimada', placeholder: 'Ex.: 1h30' }, { name: 'address', label: 'Endereço' }, { name: 'notes', label: 'Observações', type: 'textarea' },
  ] },
  transactions: { title: 'Preparar lançamento', source: 'finance', fields: [
    { name: 'description', label: 'Descrição', required: true }, { name: 'type', label: 'Tipo', options: [['receita', 'Receita'], ['despesa', 'Despesa']] }, { name: 'amount', label: 'Valor em R$', required: true, placeholder: 'Ex.: 450,00' },
    { name: 'dueDate', label: 'Vencimento', type: 'date' }, { name: 'category', label: 'Categoria' },
  ] },
  contracts: { title: 'Preparar contrato', source: 'contracts', fields: [
    { name: 'clientName', label: 'Cliente', required: true }, { name: 'service', label: 'Objeto do contrato', type: 'textarea', required: true },
    { name: 'startDate', label: 'Início', type: 'date', required: true }, { name: 'endDate', label: 'Término', type: 'date', required: true },
    { name: 'monthly', label: 'Mensalidade em R$' }, { name: 'frequency', label: 'Frequência', options: [['semanal', 'Semanal'], ['quinzenal', 'Quinzenal'], ['mensal', 'Mensal'], ['sob demanda', 'Sob demanda']] },
    { name: 'paymentDay', label: 'Dia do pagamento', type: 'number' }, { name: 'terms', label: 'Condições informadas por você', type: 'textarea' },
  ] },
  quotes: { title: 'Preparar orçamento', source: 'quotes', fields: [
    { name: 'clientName', label: 'Cliente', required: true }, { name: 'labor', label: 'Mão de obra em R$' }, { name: 'travel', label: 'Deslocamento em R$' }, { name: 'discount', label: 'Desconto em R$' },
    { name: 'urgency', label: 'Urgência', options: [['normal', 'Normal'], ['urgente', 'Urgente'], ['emergencia', 'Emergência']] }, { name: 'validUntil', label: 'Validade', type: 'date' },
    { name: 'paymentTerms', label: 'Condição de pagamento' }, { name: 'notes', label: 'Escopo e observações', type: 'textarea' },
  ] },
  workOrders: { title: 'Preparar ordem de serviço', source: 'orders', fields: [
    { name: 'clientName', label: 'Cliente', required: true }, { name: 'service', label: 'Serviço', required: true }, { name: 'scheduledAt', label: 'Data e hora', type: 'datetime-local' },
    { name: 'technician', label: 'Técnico' }, { name: 'amount', label: 'Valor em R$' }, { name: 'notes', label: 'Observações', type: 'textarea' },
  ] },
  customers: { title: 'Preparar cliente', source: 'customers', fields: [
    { name: 'name', label: 'Nome', required: true }, { name: 'phone', label: 'Telefone', required: true }, { name: 'email', label: 'E-mail', type: 'email' },
    { name: 'address', label: 'Endereço' }, { name: 'poolType', label: 'Tipo de piscina' }, { name: 'notes', label: 'Observações', type: 'textarea' },
  ] },
  leads: { title: 'Preparar contato comercial', source: 'crm', fields: [
    { name: 'name', label: 'Nome', required: true }, { name: 'phone', label: 'Telefone', required: true }, { name: 'interest', label: 'Interesse', required: true },
    { name: 'source', label: 'Origem' }, { name: 'estimatedValue', label: 'Valor estimado em R$' }, { name: 'nextAction', label: 'Próxima ação' },
  ] },
};

const moneyFields = new Set(['amount', 'monthly', 'labor', 'travel', 'discount', 'estimatedValue']);
function validCalendarDate(text: string) {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2200 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function sanitizeAssistantDraft(value: unknown): AssistantDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.entity !== 'string' || !Object.hasOwn(assistantDraftDefinitions, input.entity)) return null;
  if (!input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) return null;
  const entity = input.entity as AssistantDraftEntity;
  const fields: Record<string, string> = {};
  for (const field of assistantDraftDefinitions[entity].fields) {
    const raw = (input.fields as Record<string, unknown>)[field.name];
    if (typeof raw !== 'string') continue;
    const text = raw.trim().slice(0, field.type === 'textarea' ? 1500 : 200);
    if (!text) continue;
    if (field.options && !field.options.some(([id]) => id === text)) continue;
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) continue;
    if (field.type === 'datetime-local' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) continue;
    if ((field.type === 'date' || field.type === 'datetime-local') && !validCalendarDate(text)) continue;
    if (field.type === 'datetime-local' && (Number(text.slice(11, 13)) > 23 || Number(text.slice(14, 16)) > 59)) continue;
    if (moneyFields.has(field.name) && !/^\d+(?:[.,]\d{1,2})?$/.test(text.replace(/\s/g, ''))) continue;
    if (field.name === 'paymentDay' && (!/^\d{1,2}$/.test(text) || Number(text) < 1 || Number(text) > 31)) continue;
    fields[field.name] = moneyFields.has(field.name) ? text.replace(/\s/g, '').replace(',', '.') : text;
  }
  if (entity === 'contracts' && fields.startDate && fields.endDate && fields.endDate < fields.startDate) delete fields.endDate;
  return { entity, fields };
}
export function draftMissingFields(draft: AssistantDraft) { return assistantDraftDefinitions[draft.entity].fields.filter(field => field.required && !draft.fields[field.name]).map(field => field.label); }
export function draftEntityForSource(source: AssistantSource): AssistantDraftEntity | undefined {
  return (Object.keys(assistantDraftDefinitions) as AssistantDraftEntity[]).find(entity => assistantDraftDefinitions[entity].source === source);
}
export function draftSource(entity: keyof BootstrapData): AssistantSource | undefined { return assistantDraftDefinitions[entity as AssistantDraftEntity]?.source; }
