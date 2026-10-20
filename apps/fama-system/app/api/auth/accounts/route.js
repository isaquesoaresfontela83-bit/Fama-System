import { AuthRequestError, listFamaAccounts, switchFamaAccount, removeFamaAccount } from '@/app/system-auth';
import { AccountSessionError } from '@/lib/account-sessions';
import { isTrustedMutation } from '@/lib/request-security';
import { assertRateLimit, logAudit } from '@/lib/security';
const noStore = { 'Cache-Control': 'no-store, private' };

function failure(error) {
    const known = error instanceof AuthRequestError || error instanceof AccountSessionError;
    if (!known) console.error('account_session_failed', error);
    return Response.json({ error: known ? error.message : 'Não foi possível gerenciar as contas agora.', code: known ? error.code : 'ACCOUNT_UNAVAILABLE' }, { status: known ? error.status : 503, headers: noStore });
}
export async function GET() {
    try { return Response.json(await listFamaAccounts(), { headers: noStore }); }
    catch (error) { return failure(error); }
}
export async function POST(request) {
    try {
        if (!isTrustedMutation(request)) return Response.json({ error: 'Origem da solicitação inválida.' }, { status: 403, headers: noStore });
        const body = await request.json();
        const action = String(body.action ?? '');
        const id = String(body.accountId ?? '');
        if (!['switch', 'remove', 'logout_all'].includes(action) || (action !== 'logout_all' && !/^[a-zA-Z0-9_-]{1,128}$/.test(id)))
            return Response.json({ error: 'Selecione uma conta conectada.' }, { status: 400, headers: noStore });
        await assertRateLimit(request, 'auth_account_switch', id || 'all', 20, 5 * 60);
        const result = action === 'switch' ? await switchFamaAccount(id) : await removeFamaAccount(id, action === 'logout_all');
        if (!result.requiresMfa) await logAudit({ actorUserId: action === 'logout_all' ? undefined : id, eventType: action === 'switch' ? 'account_switch' : 'logout', entityType: 'auth', metadata: { action, browser_only: true } }).catch(() => undefined);
        return Response.json(result, { headers: noStore });
    } catch (error) { return failure(error); }
}
