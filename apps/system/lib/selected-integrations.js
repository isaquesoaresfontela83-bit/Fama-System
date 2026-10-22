import { integrationProviders } from '@/lib/integration-catalog';
export const selectedIntegrations = integrationProviders.filter(item => item.scope === 'system');
