import { POST as control } from '../fama-control/route';
import { parseAssistantSettings } from '@/lib/fama-ai-settings';

export const dynamic = 'force-dynamic';
const DB_URL = 'https://mupnsdqahoybhmkpufmx.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_';
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

// Public preferences contain only UI options and messages displayed to users.
// No session, business record or question is sent here.
export async function GET() {
  try {
    const response = await fetch(`${DB_URL}/rest/v1/fama_ai_settings?id=eq.global&select=config,revision,updated_at&limit=1`, { headers: { apikey: PUBLISHABLE_KEY }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return json(503, { message: 'Não foi possível carregar a configuração da IA. Verifique se a instalação das configurações foi concluída.' });
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) return json(503, { message: 'Configuração da IA ainda não instalada.' });
    return json(200, { settings: parseAssistantSettings(rows[0].config), revision: rows[0].revision, updatedAt: rows[0].updated_at });
  } catch { return json(503, { message: 'Não foi possível carregar a configuração da IA.' }); }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { message: 'Origem não autorizada.' });
  try {
    const raw = await request.text();
    if (raw.length > 50_000) return json(413, { message: 'Configuração muito grande.' });
    const body = JSON.parse(raw);
    const settings = parseAssistantSettings(body.settings);
    if (!Number.isInteger(body.revision) || body.revision < 1) return json(400, { message: 'Recarregue a configuração antes de salvar.' });
    return await control(new Request(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_settings_save', settings, revision: body.revision }) }));
  } catch { return json(400, { message: 'Configuração inválida. Confira os campos e tente novamente.' }); }
}
