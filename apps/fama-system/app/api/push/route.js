import { requireTenant, tenantError, RequestError } from '@/lib/tenant';
import { assertRateLimit } from '@/lib/security';
import { readJsonObject } from '@/lib/request-body';
import { database } from '@/lib/database';
import { firebaseConfiguration, pushTables, registerPushDevice, removePushDevice, deviceCookie, deliverPush, pushCategories } from '@/lib/firebase-push';
import { GET as bootstrap } from '../bootstrap/route';
import { workspaceAlerts } from '@/lib/workspace-insights';
import { hasFeaturePermission } from '@/lib/permissions';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request) { try {
    const { user, organization } = await requireTenant(request);
    const settings = firebaseConfiguration();
    await pushTables();
    const device = await database().prepare('SELECT categories FROM fama_push_devices WHERE token_hash=? AND organization_id=? AND user_id=?').bind(deviceCookie(request), organization.id, user.id).first();
    return Response.json({ configured: !!settings, ...(settings ? { config: settings.config, vapidKey: settings.vapidKey } : {}), subscribed: !!device, categories: device ? JSON.parse(device.categories) : pushCategories }, { headers });
}
catch (error) {
    return tenantError(error, 'Não foi possível consultar as notificações.');
} }
export async function POST(request) {
    try {
        const { user, organization } = await requireTenant(request);
        await assertRateLimit(request, 'push', user.id, 20, 60);
        const input = await readJsonObject(request, 8192);
        if (input.action === 'disable') {
            await removePushDevice(user.id, deviceCookie(request));
            return Response.json({ ok: true }, { headers: { ...headers, 'Set-Cookie': 'fama_push_device=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0' } });
        }
        if (!firebaseConfiguration())
            throw new RequestError('As notificações no celular ainda estão em preparação no Fama. Os alertas internos continuam disponíveis.', 503);
        if (input.action === 'subscribe') {
            if (typeof input.token !== 'string' || input.token.length < 20 || input.token.length > 4096 || !Array.isArray(input.categories) || input.categories.some(c => !pushCategories.includes(c)))
                throw new RequestError('Preferências de notificações inválidas.', 400);
            const hash = await registerPushDevice(organization.id, user.id, input.token, input.categories);
            return Response.json({ ok: true }, { headers: { ...headers, 'Set-Cookie': `fama_push_device=${hash}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000` } });
        }
        if (input.action === 'test') {
            const hash = deviceCookie(request);
            if (!hash)
                throw new RequestError('Ative as notificações neste navegador antes de testar.', 400);
            return Response.json(await deliverPush(organization.id, user.id, crypto.randomUUID(), 'agenda', 'Fama System', 'Teste recebido! As notificações deste aparelho estão funcionando.', hash), { headers });
        }
        if (input.action === 'sync') {
            const snapshot = await bootstrap(request);
            if (!snapshot.ok)
                return snapshot;
            const data = await snapshot.json();
            const allowed = pushCategories.filter(feature => hasFeaturePermission(organization.role, organization.permissions, feature, organization.moduleAccess));
            const alerts = workspaceAlerts(data, allowed, 0).slice(0, 10);
            let sent = 0;
            for (const alert of alerts) {
                const result = await deliverPush(organization.id, user.id, new Date().toISOString().slice(0, 10) + ':' + alert.id, alert.item.section, 'Fama System · ' + alert.title, 'Há uma pendência na sua empresa. Abra o Fama para consultar os detalhes.');
                sent += result.sent;
            }
            return Response.json({ sent }, { headers });
        }
        throw new RequestError('Ação de notificação inválida.', 400);
    }
    catch (error) {
        return tenantError(error, 'Não foi possível atualizar as notificações.');
    }
}
