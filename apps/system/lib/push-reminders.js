import { database } from './database';
import { selectOne, selectRows, usesSupabase } from './supabase';
import { memberBlockAccess } from './fama-blocks-server';
import { planBlockAccess } from './fama-blocks';
import { hasFeaturePermission } from './permissions';
import { isPlanAccessBlocked } from './billing-access';
import { deliverPush, firebaseConfiguration, pushTables, pushCategories } from './firebase-push';
export function dueReminders(collections, now = new Date()) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now), hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(now));
    const result = [];
    for (const r of collections.agenda || []) {
        const starts = Date.parse(r.start_at ?? r.startAt), minutes = (starts - now.getTime()) / 60000;
        if (minutes >= 0 && minutes <= 90 && !['concluido', 'cancelado'].includes(r.status))
            result.push({ id: 'visit:' + r.id + ':' + (r.start_at ?? r.startAt), category: 'agenda', title: 'Você tem um atendimento nos próximos 90 minutos.' });
    }
    if (hour >= 8 && hour < 20) {
        for (const r of collections.orders || [])
            if (String(r.scheduled_at ?? r.scheduledAt).slice(0, 10) <= today && !['concluida', 'cancelada'].includes(r.status))
                result.push({ id: today + ':order:' + r.id, category: 'orders', title: 'Há uma ordem de serviço pendente para hoje ou dias anteriores.' });
        for (const r of collections.inventory || [])
            if (r.quantity <= (r.minimum_quantity ?? r.minimumQuantity ?? 0))
                result.push({ id: today + ':stock:' + r.id, category: 'inventory', title: 'Há um produto com estoque baixo.' });
        for (const r of collections.finance || [])
            if (r.due_date < today && r.status !== 'pago')
                result.push({ id: today + ':finance:' + r.id, category: 'finance', title: 'Há uma cobrança vencida para conferir.' });
        for (const r of collections.quotes || [])
            if (['rascunho', 'enviado'].includes(r.status) && r.valid_until && r.valid_until <= new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10))
                result.push({ id: today + ':quote:' + r.id, category: 'quotes', title: 'Há um orçamento vencido ou próximo do vencimento.' });
        for (const r of collections.warranties || [])
            if (r.expires_at && r.status !== 'concluida' && r.expires_at <= new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10))
                result.push({ id: today + ':warranty:' + r.id, category: 'warranties', title: 'Há uma garantia que precisa de atenção.' });
    }
    return result;
}
const sources = { agenda: ['appointments', 'id,start_at,status'], orders: ['work_orders', 'id,scheduled_at,status'], inventory: ['inventory_items', 'id,quantity,minimum_quantity'], finance: ['transactions', 'id,due_date,status'], quotes: ['quotes', 'id,status,valid_until'], warranties: ['warranties', 'id,status,expires_at'] };
async function rows(table, organizationId, select) { return usesSupabase() ? selectRows(table, { organization_id: organizationId }, { select, limit: 1000 }) : (await database().prepare(`SELECT ${select} FROM ${table} WHERE organization_id=? LIMIT 1000`).bind(organizationId).all()).results; }
export async function reminderPermissions(organizationId, userId) {
    const member = usesSupabase() ? await selectOne('organization_members', { organization_id: organizationId, user_id: userId, status: 'active' }) : await database().prepare("SELECT * FROM organization_members WHERE organization_id=? AND user_id=? AND status='active'").bind(organizationId, userId).first();
    const organization = member ? (usesSupabase() ? await selectOne('organizations', { id: organizationId, status: 'active' }) : await database().prepare("SELECT * FROM organizations WHERE id=? AND status='active'").bind(organizationId).first()) : null;
    if (!member || !organization || isPlanAccessBlocked(String(organization.plan_status ?? 'trial'), String(organization.plan_expires_at ?? ''), organization.billing_enabled !== false && organization.billing_enabled !== 0, organization.block_on_expiry !== false && organization.block_on_expiry !== 0))
        return [];
    const access = usesSupabase() ? await memberBlockAccess(member, organization.plan) : planBlockAccess(String(member.role), member.permissions, organization.plan ?? 'inicial');
    return pushCategories.filter(category => hasFeaturePermission(String(member.role), member.permissions, category, access));
}
export async function runPushReminderBatch(cursor = '') {
    if (!firebaseConfiguration())
        return { configured: false, processed: 0, sent: 0, more: false, nextCursor: '', reason: 'Firebase central não configurado.' };
    await pushTables();
    const pairs = (await database().prepare("SELECT organization_id,user_id,MAX(categories) AS categories FROM fama_push_devices WHERE updated_at>? AND organization_id||':'||user_id>? GROUP BY organization_id,user_id ORDER BY organization_id,user_id LIMIT 3").bind(new Date(Date.now() - 30 * 86400000).toISOString(), cursor).all()).results;
    let sent = 0, failed = 0;
    for (const pair of pairs.slice(0, 2)) {
        try {
            const allowed = await reminderPermissions(pair.organization_id, pair.user_id);
            if (!allowed.length)
                continue;
            const data = {};
            for (const category of allowed) {
                const [table, fields] = sources[category];
                data[category] = await rows(table, pair.organization_id, fields);
            }
            for (const reminder of dueReminders(data)) {
                const result = await deliverPush(pair.organization_id, pair.user_id, 'scheduled:' + reminder.id, reminder.category, 'Fama System', reminder.title + ' Abra o Fama para ver os detalhes.');
                sent += result.sent;
                if (result.sent)
                    break;
            }
        }
        catch {
            failed++;
        }
    }
    const last = pairs.slice(0, 2).at(-1);
    return { configured: true, processed: Math.min(2, pairs.length), sent, failed, more: pairs.length > 2, nextCursor: last ? last.organization_id + ':' + last.user_id : '' };
}
