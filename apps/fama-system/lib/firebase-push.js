import { env } from 'cloudflare:workers';
import { database } from './database';
import { encryptText, decryptText, isDataEncryptionConfigured } from './crypto';
import { sha256 } from './security';
export const pushCategories = ['agenda', 'orders', 'inventory', 'finance', 'quotes', 'warranties'];
export function firebaseConfiguration() { try {
    const runtime = env;
    const raw = JSON.parse(runtime.FIREBASE_WEB_CONFIG || '{}'), service = JSON.parse(runtime.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'), vapidKey = runtime.FIREBASE_VAPID_KEY || '';
    const config = { apiKey: raw.apiKey, projectId: raw.projectId, appId: raw.appId, messagingSenderId: raw.messagingSenderId };
    if (!Object.values(config).every(v => typeof v === 'string' && v.length > 3) || !vapidKey || service.project_id !== config.projectId || typeof service.private_key !== 'string' || typeof service.client_email !== 'string' || !isDataEncryptionConfigured())
        return null;
    return { config, vapidKey, service };
}
catch {
    return null;
} }
export async function pushTables() { const db = database(); await db.prepare('CREATE TABLE IF NOT EXISTS fama_push_devices (token_hash TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, token TEXT NOT NULL, categories TEXT NOT NULL, updated_at TEXT NOT NULL)').run(); await db.prepare('CREATE TABLE IF NOT EXISTS fama_push_deliveries (organization_id TEXT NOT NULL,user_id TEXT NOT NULL,event_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(organization_id,user_id,event_hash))').run(); }
export async function registerPushDevice(organizationId, userId, token, categories) { await pushTables(); const hash = await sha256(token); await database().prepare('INSERT INTO fama_push_devices (token_hash,organization_id,user_id,token,categories,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET organization_id=excluded.organization_id,user_id=excluded.user_id,token=excluded.token,categories=excluded.categories,updated_at=excluded.updated_at').bind(hash, organizationId, userId, await encryptText(token), JSON.stringify(categories), new Date().toISOString()).run(); return hash; }
export function deviceCookie(request) { return /(?:^|;\s*)fama_push_device=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1] || ''; }
export async function removePushDevice(userId, hash) { await pushTables(); if (hash)
    await database().prepare('DELETE FROM fama_push_devices WHERE user_id=? AND token_hash=?').bind(userId, hash).run(); }
let access = null;
const base64 = (bytes) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function accessToken() {
    const settings = firebaseConfiguration();
    if (!settings)
        throw new Error('Firebase não configurado.');
    const service = settings.service, key = await sha256(service.private_key);
    if (access?.key === key && access.until > Date.now())
        return access.token;
    const encode = (v) => base64(new TextEncoder().encode(JSON.stringify(v))), now = Math.floor(Date.now() / 1000), header = encode({ alg: 'RS256', typ: 'JWT' }), claims = encode({ iss: service.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const pem = service.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), bytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(header + '.' + claims));
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + base64(new Uint8Array(signature)) }) });
    if (!response.ok)
        throw new Error('Não foi possível autenticar as notificações.');
    const data = await response.json();
    if (typeof data.access_token !== 'string')
        throw new Error('Resposta de autenticação inválida.');
    access = { key, token: data.access_token, until: Date.now() + Math.min(3300, Number(data.expires_in) || 3300) * 1000 };
    return access.token;
}
export async function deliverPush(organizationId, userId, eventId, category, title, body, testDeviceHash) {
    if (!firebaseConfiguration())
        return { sent: 0, configured: false };
    await pushTables();
    const devices = await database().prepare('SELECT token_hash,token,categories FROM fama_push_devices WHERE organization_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 10').bind(organizationId, userId).all();
    const targets = devices.results.filter(d => { if (testDeviceHash !== undefined)
        return d.token_hash === testDeviceHash; try {
        return JSON.parse(d.categories).includes(category);
    }
    catch {
        return false;
    } });
    if (!targets.length)
        return { sent: 0, configured: true };
    const eventHash = await sha256(eventId);
    const claim = await database().prepare('INSERT OR IGNORE INTO fama_push_deliveries (organization_id,user_id,event_hash,created_at) VALUES (?,?,?,?)').bind(organizationId, userId, eventHash, new Date().toISOString()).run();
    if (!claim.meta.changes)
        return { sent: 0, configured: true };
    let sent = 0;
    try {
        const settings = firebaseConfiguration(), authorization = await accessToken();
        await Promise.all(targets.map(async (device) => { const response = await fetch('https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(settings.config.projectId) + '/messages:send', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { token: await decryptText(device.token), data: { title, body, organizationId, eventId: eventHash, url: '/' }, webpush: { headers: { TTL: '3600', Urgency: 'normal' } } } }) }); if (response.ok)
            sent++;
        else if (response.status === 404) {
            const failure = await response.json().catch(() => ({}));
            if (failure.error?.details?.some((detail) => detail.errorCode === 'UNREGISTERED'))
                await removePushDevice(userId, device.token_hash);
        } }));
        if (!sent)
            throw new Error('Não foi possível entregar a notificação.');
        return { sent, configured: true };
    }
    catch {
        await database().prepare('DELETE FROM fama_push_deliveries WHERE organization_id=? AND user_id=? AND event_hash=?').bind(organizationId, userId, eventHash).run();
        throw new Error('O serviço de notificações não respondeu.');
    }
}
export async function enqueuePush(organizationId, userId, category) { if (!firebaseConfiguration())
    return ''; await database().prepare('CREATE TABLE IF NOT EXISTS fama_push_outbox (id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,user_id TEXT NOT NULL,category TEXT NOT NULL,created_at TEXT NOT NULL)').run(); const id = crypto.randomUUID(); await database().prepare('INSERT INTO fama_push_outbox (id,organization_id,user_id,category,created_at) VALUES (?,?,?,?,?)').bind(id, organizationId, userId, category, new Date().toISOString()).run(); return id; }
export async function dispatchQueuedPush(id) { const row = await database().prepare('SELECT organization_id,user_id,category FROM fama_push_outbox WHERE id=?').bind(id).first(); if (!row)
    return; await deliverPush(row.organization_id, row.user_id, id, row.category, 'Fama System', 'Um novo registro foi salvo na sua empresa. Abra o Fama para consultar.'); await database().prepare('DELETE FROM fama_push_outbox WHERE id=?').bind(id).run(); }
