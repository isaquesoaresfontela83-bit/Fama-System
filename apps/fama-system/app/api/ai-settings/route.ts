import { env } from 'cloudflare:workers';
import { parseAssistantSettingsEnvelope } from '@/lib/fama-ai-settings';

/** Read-only public preferences; business records stay in the authenticated tenant bootstrap. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const runtime = env as unknown as { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };
    const url = String(runtime.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
    const key = String(runtime.SUPABASE_PUBLISHABLE_KEY ?? '').trim();
    if (!url || !key || new URL(url).protocol !== 'https:') throw new Error('Preferences backend not configured');
    const response = await fetch(`${url}/rest/v1/fama_ai_settings?id=eq.global&select=config,revision,updated_at&limit=1`, { cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json', apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) } });
    if (!response.ok) throw new Error('Assistant preferences unavailable');
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > 50_000) throw new Error('Invalid preferences size');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Preferences not available');
    const row = rows[0];
    return Response.json(parseAssistantSettingsEnvelope({ settings: row.config, revision: row.revision, updatedAt: row.updated_at }), { headers });
  } catch {
    return Response.json({ error: 'Não foi possível carregar a configuração da assistente. Tente novamente.' }, { status: 503, headers });
  }
}
