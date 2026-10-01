import { env } from 'cloudflare:workers';
import { GET as readBootstrap } from '../bootstrap/route';
import { GET as readSettings } from '../ai-settings/route';
import type { BootstrapData } from '@/app/data-model';
import { systemAssistantData, systemAssistantSources } from '@/lib/fama-ai-access';
import { parseAssistantSettingsEnvelope, restrictAssistantSettings } from '@/lib/fama-ai-settings';
import { assistantCalendar, parseAssistantRequest } from '@/lib/fama-ai-request';
import { answerGenerative, assistantProviderConfigured, AssistantProviderError, type AssistantProviderRuntime } from '@/lib/fama-ai-provider';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit } from '@/lib/security';
import { requireTenant, RequestError, tenantError } from '@/lib/tenant';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: Request) {
  try {
    await requireTenant(request);
    return Response.json({ configured: assistantProviderConfigured(env as AssistantProviderRuntime) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (!isTrustedMutation(request)) throw new RequestError('Origem da solicitação não autorizada.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new RequestError('Envie a consulta em JSON.', 415);
    if (Number(request.headers.get('content-length') || 0) > 20_000) throw new RequestError('Consulta muito grande.', 400);
    const { user, organization } = await requireTenant(request);
    let input;
    try { input = parseAssistantRequest(await request.text()); } catch (error) { throw new RequestError(error instanceof Error ? error.message : 'Consulta inválida.', 400); }
    const runtime = env as AssistantProviderRuntime;
    if (!assistantProviderConfigured(runtime)) throw new RequestError('A conversa livre ainda não está conectada. Use as consultas internas.', 503);
    await assertRateLimit(request, 'assistant_query', user.id, 12, 60);
    const settingsResponse = await readSettings();
    if (!settingsResponse.ok) throw new RequestError('Não foi possível verificar a configuração da assistente.', 503);
    const envelope = parseAssistantSettingsEnvelope(await settingsResponse.json());
    const settings = restrictAssistantSettings(envelope.settings, systemAssistantSources(organization.role, organization.permissions));
    if (!settings.enabled || !settings.sources[input.source]) throw new RequestError('Seu usuário não possui acesso a esta função da assistente.', 403);
    const bootstrap = await readBootstrap(request);
    if (!bootstrap.ok) return bootstrap;
    const data = systemAssistantData(await bootstrap.json() as BootstrapData, organization.role, organization.permissions);
    const calendar = assistantCalendar(data, input.timeZone);
    const answer = await answerGenerative(input, calendar.data, settings, runtime, calendar.now);
    return Response.json({ answer }, { headers });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const response = tenantError(error instanceof AssistantProviderError ? new RequestError(error.message, error.status) : error, 'Não foi possível consultar a assistente.');
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
