import type { BootstrapData } from '@/app/data-model';
import { entityPermissions, hasFeaturePermission } from './permissions';
import type { AssistantSource } from './fama-ai-settings';
import type { AssistantData } from './fama-ai';

export function systemAssistantSources(role: string, permissions: unknown): AssistantSource[] {
  return ['overview', ...Object.values(entityPermissions).filter(permission => hasFeaturePermission(role, permissions, permission))] as AssistantSource[];
}

/** Omit denied collections so the assistant cannot disclose them or report false zero counts. */
export function systemAssistantData(data: BootstrapData, role: string, permissions: unknown): AssistantData {
  return Object.fromEntries(Object.entries(data).filter(([entity]) => {
    const permission = entityPermissions[entity];
    return permission && hasFeaturePermission(role, permissions, permission);
  })) as AssistantData;
}
