import { readPublicAssistantSettings } from '@/lib/fama-ai-settings-reader';
/** Read-only public preferences; business records stay in the authenticated tenant bootstrap. */
export async function GET() {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    try {
        return Response.json(await readPublicAssistantSettings(), { headers });
    }
    catch {
        return Response.json({ error: 'Não foi possível carregar a configuração da assistente. Tente novamente.' }, { status: 503, headers });
    }
}
