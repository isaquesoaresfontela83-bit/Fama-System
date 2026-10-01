import { assistantSources, type AssistantSource } from './fama-ai-settings';
import type { AssistantData } from './fama-ai';

export type AssistantRequest = { question: string; source: AssistantSource; history: string[]; customerName?: string; timeZone: string };
export function parseAssistantRequest(raw: string): AssistantRequest {
  if (new TextEncoder().encode(raw).byteLength > 20_000) throw new Error('A consulta ultrapassou o tamanho permitido.');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new Error('Envie uma consulta válida.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Envie uma consulta válida.');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !['question', 'source', 'history', 'customerName', 'timeZone'].includes(key))) throw new Error('A consulta contém campos não permitidos.');
  if (typeof input.question !== 'string' || input.question.trim().length < 3 || input.question.length > 2000) throw new Error('Escreva uma pergunta entre 3 e 2.000 caracteres.');
  const source = input.source ?? 'overview';
  if (typeof source !== 'string' || !Object.hasOwn(assistantSources, source)) throw new Error('Escolha um módulo válido.');
  const history = input.history ?? [];
  if (!Array.isArray(history) || history.length > 4 || history.some(item => typeof item !== 'string' || item.length > 2000)) throw new Error('O histórico da consulta é inválido.');
  if (input.customerName !== undefined && (typeof input.customerName !== 'string' || input.customerName.length > 200)) throw new Error('Informe um nome de cliente válido.');
  const timeZone = input.timeZone ?? 'America/Sao_Paulo';
  if (typeof timeZone !== 'string' || timeZone.length > 80) throw new Error('O fuso horário é inválido.');
  try { new Intl.DateTimeFormat('pt-BR', { timeZone }); } catch { throw new Error('O fuso horário é inválido.'); }
  return { question: input.question.trim(), source: source as AssistantSource, history, customerName: input.customerName as string | undefined, timeZone };
}

function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}
/** Both the trusted server clock and absolute record dates use the same calendar. */
export function assistantCalendar(data: AssistantData, timeZone: string, instant = new Date()) {
  const dateFields = new Set(['startAt', 'scheduledAt', 'createdAt', 'occurred_at']);
  const records = Object.fromEntries(Object.entries(data).map(([entity, rows]) => [entity, rows?.map(row => Object.fromEntries(Object.entries(row).map(([field, value]) => {
    if (dateFields.has(field) && typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return [field, wallClock(date, timeZone)];
    }
    return [field, value];
  })))])) as AssistantData;
  return { data: records, now: new Date(wallClock(instant, timeZone)) };
}
