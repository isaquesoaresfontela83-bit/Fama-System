import { GET as assistantStatus, POST as assistantQuery } from '../assistant/route';
import { isTrustedMutation } from '@/lib/request-security';

/** Compatibility for the old finance panel. All facts now come from server-scoped records. */
export async function GET(request: Request) { return assistantStatus(request); }
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return Response.json({ error: 'Origem da solicitação não autorizada.' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'Envie a consulta em JSON.' }, { status: 415 });
  if (Number(request.headers.get('content-length') || 0) > 20_000) return Response.json({ error: 'Consulta muito grande.' }, { status: 400 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 20_000) return Response.json({ error: 'Consulta muito grande.' }, { status: 400 });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(); }
  catch { return Response.json({ error: 'Consulta inválida.' }, { status: 400 }); }
  const headers = new Headers(request.headers); headers.delete('content-length');
  const forwarded = new Request(request.url, { method: 'POST', headers, body: JSON.stringify({ question: input.question, source: 'finance', timeZone: input.timeZone ?? 'America/Sao_Paulo' }) });
  const response = await assistantQuery(forwarded);
  if (!response.ok) return response;
  const payload = await response.json();
  return Response.json({ answer: payload.answer.text }, { headers: { 'Cache-Control': 'no-store' } });
}
