import { Buffer } from 'node:buffer';
import { encryptText, decryptText } from './crypto';
import { RequestError } from './request-error';
import { integrationStore, readPlatformIntegration, savePlatformIntegration, integrationProviderRequest } from './platform-integrations';
const encode = bytes => Buffer.from(bytes).toString('base64url');
const hash = async value => encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
async function store() {
    const db = await integrationStore();
    await db.prepare('CREATE TABLE IF NOT EXISTS fama_integration_oauth (id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,encrypted_state TEXT NOT NULL,expires_at TEXT NOT NULL)').run();
    return db;
}
export async function beginDriveAuthorization(actorId, origin) {
    const config = await readPlatformIntegration('drive');
    if (!config?.fields?.clientId || !config.fields.clientSecret || !config.enabled) throw new RequestError('Salve o identificador e o segredo do aplicativo Google e ative a integração antes de conectar.', 424);
    const redirectUri = origin + '/api/admin/integrations/google/callback';
    const state = encode(crypto.getRandomValues(new Uint8Array(32))), verifier = encode(crypto.getRandomValues(new Uint8Array(48)));
    const db = await store(), now = new Date().toISOString();
    await db.prepare('DELETE FROM fama_integration_oauth WHERE expires_at<?').bind(now).run();
    await db.prepare('INSERT INTO fama_integration_oauth(id,actor_id,encrypted_state,expires_at) VALUES (?,?,?,?)')
        .bind(await hash(state), actorId, await encryptText(JSON.stringify({ verifier, redirectUri, revision: config.revision })), new Date(Date.now()+10*60000).toISOString()).run();
    const query = new URLSearchParams({ client_id: config.fields.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', state, code_challenge: await hash(verifier), code_challenge_method: 'S256' });
    return { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?' + query, redirectUri };
}
export async function completeDriveAuthorization(actorId, url) {
    const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
    if (state.length < 20 || state.length > 150 || !code || code.length > 4096) throw new RequestError('A autorização expirou ou não foi concluída. Conecte novamente pelo Fama Control.', 400);
    const db = await store(), id = await hash(state), now = new Date().toISOString();
    const row = await db.prepare('SELECT * FROM fama_integration_oauth WHERE id=? AND actor_id=? AND expires_at>?').bind(id, actorId, now).first();
    if (!row) throw new RequestError('A autorização expirou ou já foi utilizada.', 400);
    const details = JSON.parse(await decryptText(row.encrypted_state));
    if (details.redirectUri !== url.origin + url.pathname) throw new RequestError('Retorno de autorização inválido.', 400);
    const config = await readPlatformIntegration('drive');
    if (!config || !config.enabled || config.revision !== details.revision) throw new RequestError('A configuração foi alterada. Inicie uma nova conexão.', 409);
    const claim = await db.prepare('DELETE FROM fama_integration_oauth WHERE id=? AND actor_id=? AND expires_at>?').bind(id, actorId, now).run();
    if (!claim.meta?.changes) throw new RequestError('Esta autorização já foi utilizada.', 409);
    const token = await integrationProviderRequest('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: details.redirectUri, client_id: config.fields.clientId, client_secret: config.fields.clientSecret, code_verifier: details.verifier }) });
    if (!token.refresh_token || !token.access_token) throw new RequestError('O Google não liberou uma autorização permanente. Conecte novamente e confirme o consentimento.', 424);
    let folderId = config.fields.folderId;
    if (!folderId) {
        const folder = await integrationProviderRequest('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Documentos Fama', mimeType: 'application/vnd.google-apps.folder' }) });
        folderId = String(folder.id || '');
        if (!/^[A-Za-z0-9_-]{5,200}$/.test(folderId)) throw new RequestError('A pasta do Fama não foi confirmada pelo Google.', 502);
    }
    return savePlatformIntegration({ provider: 'drive', enabled: true, expectedRevision: config.revision, fields: { refreshToken: String(token.refresh_token), folderId } });
}
