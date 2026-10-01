import { env } from 'cloudflare:workers';
import { GET as readSettings } from '../ai-settings/route';
import { GET as readOrganizations } from '../admin/organizations/route';
import { GET as readMembers } from '../admin/members/route';
import { GET as readAudit } from '../admin/audit/route';
import { GET as readPrivacy } from '../admin/privacy/route';
import type { AssistantData } from '@/lib/fama-ai';
import { parseAssistantSettingsEnvelope, restrictAssistantSettings, type AssistantSettings } from '@/lib/fama-ai-settings';
import { assistantCalendar, parseAssistantRequest } from '@/lib/fama-ai-request';
import { answerGenerative, assistantProviderConfigured, AssistantProviderError, type AssistantProviderRuntime } from '@/lib/fama-ai-provider';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit } from '@/lib/security';
import { requirePlatformAdmin, RequestError, tenantError } from '@/lib/tenant';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET() {
  try {
    await requirePlatformAdmin();
    return Response.json({ configured: assistantProviderConfigured(env as AssistantProviderRuntime) }, { headers });
  } catch (error) { return failure(error); }
}
async function administrativeData(settings: AssistantSettings): Promise<AssistantData> {
  const queries = [
    ['companies', 'organizations', 'organizations', readOrganizations],
    ['users', 'members', 'members', readMembers],
    ['audit', 'audit', 'audit', readAudit],
    ['privacy', 'requests', 'privacy', readPrivacy],
  ] as const;
  const data: AssistantData = {};
  await Promise.all(queries.map(async ([source, payloadKey, key, read]) => {
    if (!settings.sources[source]) return;
    const response = await read();
    if (!response.ok) throw new RequestError('Não foi possível consultar os registros autorizados da plataforma.', 503);
    const payload = await response.json() as Record<string, Record<string, unknown>[]>;
    // Never forward account emails, audit metadata, privacy contacts or request details.
    data[key] = (payload[payloadKey] ?? []).map(row => ({ id: String(row.id), name: row.name ? String(row.name) : undefined, display_name: row.displayName ? String(row.displayName) : undefined, role: row.role ? String(row.role) : undefined, status: row.status ? String(row.status) : undefined, plan_status: row.planStatus ? String(row.planStatus) : undefined, event_type: row.eventType ? String(row.eventType) : undefined, occurred_at: row.occurredAt ? String(row.occurredAt) : undefined, request_type: row.requestType ? String(row.requestType) : undefined }));
  }));
  return data;
}
export async function POST(request: Request) {
  try {
    if (!isTrustedMutation(request)) throw new RequestError('Origem da solicitação não autorizada.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new RequestError('Envie a consulta em JSON.', 415);
    if (Number(request.headers.get('content-length') || 0) > 20_000) throw new RequestError('Consulta muito grande.', 400);
    const user = await requirePlatformAdmin();
    let input;
    try { input = parseAssistantRequest(await request.text()); } catch (error) { throw new RequestError(error instanceof Error ? error.message : 'Consulta inválida.', 400); }
    const runtime = env as AssistantProviderRuntime;
    if (!assistantProviderConfigured(runtime)) throw new RequestError('A conversa livre ainda não está conectada. Use as consultas internas.', 503);
    await assertRateLimit(request, 'assistant_query', user.id, 12, 60);
    const settingsResponse = await readSettings();
    if (!settingsResponse.ok) throw new RequestError('Não foi possível verificar a configuração da assistente.', 503);
    const envelope = parseAssistantSettingsEnvelope(await settingsResponse.json());
    const settings = restrictAssistantSettings(envelope.settings, ['overview', 'companies', 'users', 'audit', 'privacy']);
    if (!settings.enabled || !settings.sources[input.source]) throw new RequestError('Esta função está disponível apenas dentro da empresa no Fama System.', 403);
    const calendar = assistantCalendar(await administrativeData(settings), input.timeZone);
    const answer = await answerGenerative(input, calendar.data, settings, runtime, calendar.now, true);
    return Response.json({ answer }, { headers });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const response = tenantError(error instanceof AssistantProviderError ? new RequestError(error.message, error.status) : error, 'Não foi possível consultar a assistente.');
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
