import { isInternalRequest } from '@/lib/internal-auth';
import { systemApiStatus, probeSystemApi } from '@/lib/system-api-status';
import { apiCatalog } from '@/lib/api-catalog';
import { observation } from '@/lib/api-status-model';
import { readJsonObject } from '@/lib/request-body';
import { FAMA_VERSION, FAMA_RELEASE_ID } from '@/lib/fama-release';
const headers = { 'Cache-Control': 'private,no-store' };
export async function GET(request) {
    if (!await isInternalRequest(request)) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401, headers });
    return Response.json({ scope: 'system', version: FAMA_VERSION, releaseId: FAMA_RELEASE_ID, observations: await systemApiStatus() }, { headers });
}
export async function POST(request) {
    if (!await isInternalRequest(request)) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401, headers });
    let input;
    try { input = await readJsonObject(request, 1024); } catch { return Response.json({ error: 'Solicitação inválida.' }, { status: 400, headers }); }
    if (!apiCatalog.some(item => item.id === input.id && item.scopes.includes('system') && item.probe) || Object.keys(input).some(key => key !== 'id')) return Response.json({ error: 'Diagnóstico inválido.' }, { status: 400, headers });
    let value;
    try { value = await probeSystemApi(input.id); }
    catch { value = observation('unavailable', 'A consulta de diagnóstico não foi confirmada. Confira a configuração, a conexão e os limites do serviço.', new Date().toISOString()); }
    return Response.json({ id: input.id, scope: 'system', observation: value }, { headers });
}
