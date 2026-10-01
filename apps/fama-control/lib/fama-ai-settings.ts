export const assistantSources = {
  overview: 'Resumo da gestão', agenda: 'Agenda', crm: 'CRM', quotes: 'Orçamentos', orders: 'Ordens de serviço',
  customers: 'Clientes e piscinas', inventory: 'Estoque', finance: 'Financeiro', team: 'Equipe',
  warranties: 'Garantias', contracts: 'Contratos', companies: 'Empresas', users: 'Usuários', audit: 'Auditoria', backup: 'Backups', privacy: 'Privacidade',
} as const;
export type AssistantSource = keyof typeof assistantSources;
export type AssistantSettings = {
  enabled: boolean; name: string; welcome: string; maxItems: number;
  sources: Record<AssistantSource, boolean>;
  allowNavigation: boolean; allowCreate: boolean; detectConflicts: boolean;
  commands: { trigger: string; response: string; source: AssistantSource; enabled: boolean }[];
};
export const defaultAssistantSettings: AssistantSettings = {
  enabled: true, name: 'Fama IA interna', welcome: 'Consulte compromissos, pendências, estoque e os demais módulos disponíveis. Para buscar um nome, use “buscar: nome”.',
  maxItems: 20, sources: Object.fromEntries(Object.keys(assistantSources).map(key => [key, true])) as Record<AssistantSource, boolean>,
  allowNavigation: true, allowCreate: true, detectConflicts: true, commands: [],
};
export function normalizeCommand(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

/** Shared strict validator for the UI, server and Edge Function; no code execution. */
export function parseAssistantSettings(value: unknown): AssistantSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração inválida.');
  const input = value as Record<string, unknown>;
  const boolean = (item: unknown) => { if (typeof item !== 'boolean') throw new Error('As opções devem ser verdadeiras ou falsas.'); return item; };
  const text = (item: unknown, min: number, max: number) => {
    if (typeof item !== 'string' || item.trim().length < min || item.trim().length > max) throw new Error(`Texto inválido: informe entre ${min} e ${max} caracteres.`);
    return item.trim();
  };
  if (!Number.isInteger(input.maxItems) || Number(input.maxItems) < 5 || Number(input.maxItems) > 100) throw new Error('Limite de resultados: entre 5 e 100.');
  if (!input.sources || typeof input.sources !== 'object' || Array.isArray(input.sources)) throw new Error('Selecione as funções disponíveis.');
  const sources = Object.fromEntries(Object.keys(assistantSources).map(key => [key, boolean((input.sources as Record<string, unknown>)[key])])) as Record<AssistantSource, boolean>;
  if (!Array.isArray(input.commands) || input.commands.length > 30) throw new Error('Cadastre no máximo 30 respostas personalizadas.');
  const commands = input.commands.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta personalizada inválida.');
    const command = value as Record<string, unknown>;
    if (typeof command.source !== 'string' || !Object.hasOwn(assistantSources, command.source)) throw new Error('Módulo da resposta inválido.');
    return { trigger: text(command.trigger, 1, 120), response: text(command.response, 1, 1000), source: command.source as AssistantSource, enabled: boolean(command.enabled) };
  });
  if (new Set(commands.map(command => normalizeCommand(command.trigger))).size !== commands.length) throw new Error('Não repita a mesma pergunta nas respostas personalizadas.');
  return {
    enabled: boolean(input.enabled), name: text(input.name, 1, 60), welcome: text(input.welcome, 0, 300), maxItems: Number(input.maxItems), sources,
    allowNavigation: boolean(input.allowNavigation), allowCreate: boolean(input.allowCreate), detectConflicts: boolean(input.detectConflicts), commands,
  };
}

export type AssistantSettingsEnvelope = { settings: AssistantSettings; revision: number; updatedAt: string };

export function parseAssistantSettingsEnvelope(value: unknown): AssistantSettingsEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração indisponível.');
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1) throw new Error('Revisão da configuração inválida.');
  if (typeof input.updatedAt !== 'string' || Number.isNaN(Date.parse(input.updatedAt))) throw new Error('Data da configuração inválida.');
  return { settings: parseAssistantSettings(input.settings), revision: Number(input.revision), updatedAt: input.updatedAt };
}

/** Preferences can reduce access; they never grant a user access to a module. */
export function restrictAssistantSettings(settings: AssistantSettings, allowedSources: readonly AssistantSource[]): AssistantSettings {
  return { ...settings, sources: Object.fromEntries(Object.keys(assistantSources).map(key => [key, settings.sources[key as AssistantSource] && allowedSources.includes(key as AssistantSource)])) as Record<AssistantSource, boolean> };
}
