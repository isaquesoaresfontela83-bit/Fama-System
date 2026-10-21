import { Buffer } from 'node:buffer';
import { isIP } from 'node:net';
import { database } from './database';
import { encryptText, decryptText, isDataEncryptionConfigured } from './crypto';
import { RequestError } from './request-error';
import { readLimitedBody } from './request-body';
import { integrationFields, integrationRequirements, integrationActions } from './integration-settings';
import { integrationProviders, defaultFamaRepository, repositoryValid } from './integration-catalog';

export async function integrationStore() {
    const db = database();
    await db.prepare(`CREATE TABLE IF NOT EXISTS fama_platform_integrations (
        provider TEXT PRIMARY KEY, encrypted_config TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS fama_provider_activity (
        id TEXT PRIMARY KEY, provider TEXT NOT NULL, action TEXT NOT NULL, scope TEXT NOT NULL,
        payload_hash TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, result_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    )`).run();
    return db;
}
export async function readPlatformIntegration(provider) {
    if (typeof provider !== 'string' || !Object.hasOwn(integrationFields, provider)) throw new RequestError('Integração inválida.', 400);
    const db = await integrationStore();
    const row = await db.prepare('SELECT * FROM fama_platform_integrations WHERE provider=?').bind(provider).first();
    if (!row) return null;
    try { return { ...JSON.parse(await decryptText(row.encrypted_config)), revision: row.revision, updatedAt: row.updated_at }; }
    catch { throw new RequestError('Não foi possível abrir a configuração protegida. Confira a chave de proteção do servidor.', 503); }
}
function configured(provider, config) { return Boolean(config && integrationRequirements[provider].every(field => config.fields?.[field])); }
export function safeIntegrationConfig(provider, config) {
    const fields = {}, present = {};
    for (const field of integrationFields[provider]) {
        present[field.id] = Boolean(config?.fields?.[field.id]);
        if (!field.secret) fields[field.id] = String(config?.fields?.[field.id] || (provider === 'github' && field.id === 'repository' ? defaultFamaRepository : ''));
    }
    return { provider, managed: Boolean(config), enabled: config?.enabled !== false, configured: configured(provider, config), available: config?.enabled !== false && (configured(provider, config) || ['ipinfo', 'github'].includes(provider)), fields, present, revision: config?.revision ?? 0, updatedAt: config?.updatedAt ?? null };
}
export async function platformIntegrationSummary() {
    return Promise.all(integrationProviders.map(async ({ id }) => safeIntegrationConfig(id, await readPlatformIntegration(id))));
}
function validateFields(provider, fields) {
    for (const [name, value] of Object.entries(fields)) {
        if (!integrationFields[provider].some(field => field.id === name) || typeof value !== 'string' || value.length > 6000 || /[\r\n\0]/.test(value)) throw new RequestError('Confira os campos da integração.', 400);
    }
    if (provider === 'drive' && fields.folderId && !/^[A-Za-z0-9_-]{5,200}$/.test(fields.folderId)) throw new RequestError('Informe o identificador da pasta do Google Drive.', 400);
    if (provider === 'resend' && fields.from && !validEmail(fields.from)) throw new RequestError('Informe um único e-mail remetente verificado.', 400);
    if (provider === 'github' && fields.repository && !repositoryValid(fields.repository)) throw new RequestError('Informe proprietário/repositório.', 400);
    if (provider === 'sentry') {
        if (fields.dsn) sentryTarget(fields.dsn);
        if (fields.organization && !/^[A-Za-z0-9_-]{1,100}$/.test(fields.organization)) throw new RequestError('Organização Sentry inválida.', 400);
        if (fields.projectId && !/^\d{1,20}$/.test(fields.projectId)) throw new RequestError('Informe o número do projeto no Sentry.', 400);
    }
}
export async function savePlatformIntegration(input) {
    const { provider } = input;
    if (typeof provider !== 'string' || !Object.hasOwn(integrationFields, provider) || !Number.isSafeInteger(input.expectedRevision) || typeof input.enabled !== 'boolean' || !input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields) || Object.keys(input).some(key => !['provider', 'expectedRevision', 'enabled', 'fields', 'clearFields'].includes(key))) throw new RequestError('Configuração inválida.', 400);
    if (!isDataEncryptionConfigured()) throw new RequestError('A proteção das credenciais precisa estar configurada no servidor antes de salvar.', 503);
    const current = await readPlatformIntegration(provider);
    if (input.expectedRevision !== (current?.revision ?? 0)) throw new RequestError('Outra alteração foi salva. Confira novamente antes de editar.', 409);
    const fields = { ...(current?.fields ?? {}) };
    validateFields(provider, input.fields);
    for (const [key, value] of Object.entries(input.fields)) if (value.trim()) fields[key] = value.trim();
    if (input.clearFields !== undefined && (!Array.isArray(input.clearFields) || input.clearFields.some(key => !integrationFields[provider].some(field => field.id === key)))) throw new RequestError('Campos para remoção inválidos.', 400);
    for (const key of input.clearFields ?? []) delete fields[key];
    validateFields(provider, fields);
    const config = { enabled: input.enabled, fields }, revision = (current?.revision ?? 0) + 1, now = new Date().toISOString();
    const encrypted = await encryptText(JSON.stringify(config)), db = await integrationStore();
    const result = current
        ? await db.prepare('UPDATE fama_platform_integrations SET encrypted_config=?,revision=?,updated_at=? WHERE provider=? AND revision=?').bind(encrypted, revision, now, provider, current.revision).run()
        : await db.prepare('INSERT OR IGNORE INTO fama_platform_integrations(provider,encrypted_config,revision,updated_at) VALUES (?,?,?,?)').bind(provider, encrypted, revision, now).run();
    if (!result.meta?.changes) throw new RequestError('Outra alteração foi salva. Confira novamente antes de editar.', 409);
    return safeIntegrationConfig(provider, { ...config, revision, updatedAt: now });
}
export function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(value); }
async function digest(value) { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex'); }
async function upstream(url, init = {}) {
    let response;
    try { response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(25000) }); }
    catch { throw new RequestError('O provedor não confirmou a operação. Confira a atividade antes de repetir um envio.', 502); }
    if (!response.ok) {
        await response.body?.cancel();
        throw new RequestError(response.status === 429 ? 'O limite do provedor foi atingido. Aguarde e tente novamente.' : [401,403].includes(response.status) ? 'O provedor recusou a credencial ou a permissão desta operação.' : 'O provedor não confirmou a operação.', response.status === 429 ? 429 : [401,403].includes(response.status) ? 424 : 502);
    }
    try { return JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 2 * 1024 * 1024, 25000))); }
    catch { throw new RequestError('O provedor retornou uma resposta incompleta.', 502); }
}
function filePayload(input, maximum = 5 * 1024 * 1024) {
    const file = input?.file;
    if (!file || typeof file.base64 !== 'string' || file.base64.length > Math.ceil(maximum / 3) * 4 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) throw new RequestError('Selecione um arquivo válido dentro do limite de tamanho.', 413);
    const bytes = Buffer.from(file.base64, 'base64');
    if (!bytes.length || bytes.length > maximum) throw new RequestError('O arquivo excede o limite de tamanho.', 413);
    const signatures = { 'application/pdf': [37,80,68,70,45], 'image/png': [137,80,78,71,13,10,26,10], 'image/jpeg': [255,216,255] };
    if (!signatures[file.mime_type]?.every((value, index) => bytes[index] === value)) throw new RequestError('Envie um PDF, JPG ou PNG válido.', 400);
    const name = String(file.name || 'documento').replace(/[\r\n\0/\\]/g, '_').slice(0, 160);
    return { bytes, name, mime: file.mime_type, base64: bytes.toString('base64') };
}
async function driveToken(fields) {
    const token = await upstream('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: fields.clientId, client_secret: fields.clientSecret, refresh_token: fields.refreshToken, grant_type: 'refresh_token' }) });
    if (!token.access_token) throw new RequestError('Reconecte a conta do Google no Fama Control.', 424);
    return String(token.access_token);
}
function sentryTarget(value) {
    let url;
    try { url = new URL(value); } catch { throw new RequestError('Informe um DSN HTTPS válido do Sentry.', 400); }
    if (url.protocol !== 'https:' || !/^[A-Za-z0-9]+$/.test(url.username) || url.password || url.port || url.search || url.hash || !/^\/\d+$/.test(url.pathname) || !(url.hostname === 'sentry.io' || /\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(url.hostname))) throw new RequestError('Informe o DSN original de ingestão do Sentry.', 400);
    return { url: `https://${url.hostname}/api${url.pathname}/store/`, key: url.username };
}
async function sendMail(config, input, scope) {
    const file = filePayload(input);
    if (!validEmail(input.to) || typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 180 || /[\r\n]/.test(input.subject) || typeof input.text !== 'string' || input.text.length > 4000 || !/^[a-f0-9-]{36}$/i.test(input.request_id || '')) throw new RequestError('Confira o destinatário, assunto e mensagem.', 400);
    const db = await integrationStore(), id = await digest('resend:' + scope + ':' + input.request_id);
    const hash = await digest(JSON.stringify([input.to, input.subject, input.text, file.name, file.base64]));
    const old = await db.prepare('SELECT * FROM fama_provider_activity WHERE id=?').bind(id).first();
    if (old) {
        if (old.payload_hash !== hash) throw new RequestError('Este envio já possui outro conteúdo. Prepare um novo envio.', 409);
        if (old.status === 'accepted') return { id: old.result_id, alreadySent: true };
        throw new RequestError('O envio anterior está em confirmação. Confira a atividade antes de repetir.', 409);
    }
    const claim = await db.prepare("INSERT OR IGNORE INTO fama_provider_activity(id,provider,action,scope,payload_hash,status,created_at) VALUES (?,'resend','resend_send',?,?,'processing',?)").bind(id, scope, hash, new Date().toISOString()).run();
    if (!claim.meta?.changes) throw new RequestError('Este envio já está sendo processado.', 409);
    try {
        const data = await upstream('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + config.fields.apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: JSON.stringify({ from: config.fields.from, to: [input.to], subject: input.subject, text: input.text, attachments: [{ filename: file.name, content: file.base64, content_type: file.mime }] }) });
        if (typeof data.id !== 'string' || !data.id) throw new RequestError('O envio não foi confirmado.', 502);
        await db.prepare("UPDATE fama_provider_activity SET status='accepted',result_id=? WHERE id=?").bind(data.id.slice(0,100), id).run();
        return { id: data.id.slice(0,100) };
    } catch (error) {
        await db.prepare("UPDATE fama_provider_activity SET status='uncertain' WHERE id=?").bind(id).run();
        throw error;
    }
}
export async function runPlatformIntegration(action, input = {}, scope = 'platform') {
    const provider = Object.hasOwn(integrationActions, action) ? integrationActions[action] : null;
    if (!provider) throw new RequestError('Ação de integração inválida.', 400);
    const config = await readPlatformIntegration(provider);
    if (!config) return null; // Preserve existing connections until explicitly managed here.
    if (!config.enabled) throw new RequestError('Esta integração está pausada no Fama Control.', 424);
    if (!configured(provider, config)) return null; // Draft setup keeps the previous connection available.
    const fields = config.fields;
    let data, source;
    if (action === 'resend_send') return { data: await sendMail(config, input, scope) };
    if (action === 'drive_upload' || action === 'drive_list') {
        const authorization = { Authorization: 'Bearer ' + await driveToken(fields) };
        if (action === 'drive_list') {
            const query = new URLSearchParams({ q: `'${fields.folderId}' in parents and trashed = false`, fields: 'files(id,name,mimeType,modifiedTime,size)', pageSize: '20', orderBy: 'modifiedTime desc' });
            const result = await upstream('https://www.googleapis.com/drive/v3/files?' + query, { headers: authorization });
            data = { files: (result.files ?? []).slice(0,20).map(file => ({ id: String(file.id), name: String(file.name).slice(0,160), mimeType: String(file.mimeType), modifiedAt: file.modifiedTime ?? null })) };
        } else {
            const file = filePayload(input), boundary = 'fama_' + crypto.randomUUID().replace(/-/g, '');
            const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify({ name: file.name, parents: [fields.folderId] }), `\r\n--${boundary}\r\nContent-Type: ${file.mime}\r\n\r\n`, file.bytes, `\r\n--${boundary}--\r\n`]);
            const result = await upstream('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', { method: 'POST', headers: { ...authorization, 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
            data = { id: String(result.id || ''), name: String(result.name || file.name).slice(0,160) };
            if (!/^[A-Za-z0-9_-]{5,200}$/.test(data.id)) throw new RequestError('O Google não confirmou o arquivo enviado.', 502);
        }
    } else if (action === 'ocr_extract') {
        const file = filePayload(input, 1024 * 1024), body = new FormData();
        body.append('file', new Blob([file.bytes], { type: file.mime }), file.name); body.set('language', 'por'); body.set('isOverlayRequired', 'false');
        const result = await upstream('https://api.ocr.space/parse/image', { method: 'POST', headers: { apikey: fields.apiKey }, body });
        const parsed = Array.isArray(result.ParsedResults) ? result.ParsedResults : [];
        if (!parsed.length) throw new RequestError('A leitura não foi concluída. Confira o documento, a credencial e os limites do provedor.', 424);
        data = { text: parsed.map(item => String(item.ParsedText || '')).join('\n').slice(0,500000), partial: result.IsErroredOnProcessing === true };
    } else if (action === 'sentry_capture') {
        const target = sentryTarget(fields.dsn), id = crypto.randomUUID().replace(/-/g, '');
        const result = await upstream(target.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=fama-control/15.5,sentry_key=${target.key}` }, body: JSON.stringify({ event_id: id, platform: 'javascript', level: 'error', timestamp: Date.now()/1000, message: input.test === true ? 'Teste de conexão do Fama Control' : 'Falha técnica no navegador Fama System' }) });
        if (!result.id) throw new RequestError('O Sentry não confirmou o evento.', 502);
        data = { event_id: String(result.id).slice(0,100) };
    } else if (action === 'sentry_issues') {
        if (!fields.apiToken || !fields.organization || !fields.projectId) throw new RequestError('Preencha token de leitura, organização e número do projeto para consultar os erros aqui.', 424);
        const query = new URLSearchParams({ project: fields.projectId, query: 'is:unresolved', limit: '10', statsPeriod: '24h' });
        const result = await upstream(`https://sentry.io/api/0/organizations/${encodeURIComponent(fields.organization)}/issues/?${query}`, { headers: { Authorization: 'Bearer ' + fields.apiToken } });
        if (!Array.isArray(result)) throw new RequestError('O Sentry não confirmou a consulta.', 502);
        data = { issues: result.slice(0,10).map(item => ({ id: String(item.id), title: String(item.title || '').slice(0,250), count: String(item.count || '0'), lastSeen: item.lastSeen ?? null })) };
    } else if (action === 'github_rest_get') {
        if (!/^repos\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/(?:commits|releases)$/.test(input.path || '') || input.path.includes('..')) throw new RequestError('Consulta GitHub inválida.', 400);
        data = await upstream('https://api.github.com/' + input.path + '?per_page=5', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Fama-Control', 'X-GitHub-Api-Version': '2026-03-10', ...(fields.token ? { Authorization: 'Bearer ' + fields.token } : {}) } });
        if (!Array.isArray(data)) throw new RequestError('Resposta GitHub incompleta.', 502);
    } else if (action === 'ipinfo_lookup' || action === 'ipinfo_lite_lookup') {
        if (!isIP(input.ip || '')) throw new RequestError('Informe um endereço IPv4 ou IPv6 válido.', 400);
        if (action === 'ipinfo_lite_lookup' && !fields.token) throw new RequestError('Configure o token IPinfo Lite.', 424);
        const result = await upstream(fields.token ? 'https://api.ipinfo.io/lite/' + encodeURIComponent(input.ip) : 'https://ipinfo.io/' + encodeURIComponent(input.ip) + '/json', { headers: { Accept: 'application/json', ...(fields.token ? { Authorization: 'Bearer ' + fields.token } : {}) } });
        const network = String(result.org || '').match(/^(AS\d+)\s*(.*)$/);
        data = { ip: String(result.ip || input.ip), country: result.country_name ?? result.country ?? null, country_code: result.country_code ?? result.country ?? null, asn: result.asn ?? network?.[1] ?? null, as_name: result.as_name ?? network?.[2] ?? null };
        source = fields.token ? 'ipinfo_lite' : 'ipinfo_public';
    } else if (action === 'resend_status') {
        if (!/^[A-Za-z0-9-]{1,100}$/.test(input.id || '')) throw new RequestError('Envio inválido.', 400);
        const db = await integrationStore();
        const receipt = await db.prepare("SELECT id FROM fama_provider_activity WHERE provider='resend' AND result_id=? AND scope=? AND status='accepted'").bind(input.id, scope).first();
        if (!receipt) throw new RequestError('Envio não encontrado neste acesso.', 404);
        const result = await upstream('https://api.resend.com/emails/' + input.id, { headers: { Authorization: 'Bearer ' + fields.apiKey } });
        data = { id: String(result.id), status: String(result.last_event || 'sent').slice(0,50) };
    }
    return { data, ...(source ? { source } : {}) };
}
export async function testPlatformIntegration(provider) {
    const config = await readPlatformIntegration(provider);
    if (!config || !configured(provider, config) || !config.enabled) throw new RequestError('Salve e ative a configuração antes do teste.', 424);
    if (provider === 'ocrspace') return { verified: false, message: 'Para validar a chave e a leitura, selecione um PDF ou imagem em Documentos e clique em Extrair texto.' };
    if (provider === 'drive') {
        const folder = await upstream('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(config.fields.folderId) + '?fields=id,mimeType,capabilities', { headers: { Authorization: 'Bearer ' + await driveToken(config.fields) } });
        if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.capabilities?.canAddChildren !== true) throw new RequestError('A conta conectada não confirmou permissão de gravação nesta pasta.', 424);
    }
    if (provider === 'github') await runPlatformIntegration('github_rest_get', { path: `repos/${config.fields.repository || defaultFamaRepository}/commits` });
    if (provider === 'ipinfo') await runPlatformIntegration('ipinfo_lookup', { ip: '8.8.8.8' });
    if (provider === 'sentry') await runPlatformIntegration('sentry_capture', { test: true });
    if (provider === 'resend') {
        try { await upstream('https://api.resend.com/domains', { headers: { Authorization: 'Bearer ' + config.fields.apiKey } }); }
        catch (error) { if (error.status === 424) return { verified: false, message: 'Não foi possível validar por consulta. A chave pode ter permissão apenas de envio; valide enviando um documento para um destinatário revisado.' }; throw error; }
    }
    return { verified: true, message: provider === 'resend' ? 'Consulta ao Resend confirmada. O remetente será validado ao enviar um documento.' : 'Conexão confirmada pelo provedor.', checkedAt: new Date().toISOString() };
}
export async function recordIntegrationActivity(provider, action, status, resultId = '') {
    const db = await integrationStore();
    await db.prepare('INSERT INTO fama_provider_activity(id,provider,action,scope,status,result_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), provider, action, 'platform', status, String(resultId).slice(0,100), new Date().toISOString()).run();
}
export async function integrationActivity() {
    const db = await integrationStore();
    return (await db.prepare("SELECT provider,action,status,result_id AS resultId,created_at AS createdAt FROM fama_provider_activity WHERE scope='platform' ORDER BY created_at DESC LIMIT 30").all()).results;
}
export { upstream as integrationProviderRequest };

export async function downloadPlatformDriveFile(id) {
    if (!/^[A-Za-z0-9_-]{5,200}$/.test(id || '')) throw new RequestError('Documento inválido.', 400);
    const config = await readPlatformIntegration('drive');
    if (!configured('drive', config) || !config.enabled) throw new RequestError('A conexão com o Google Drive está indisponível.', 424);
    const headers = { Authorization: 'Bearer ' + await driveToken(config.fields) }, base = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id);
    const metadata = await upstream(base + '?fields=id,name,mimeType,parents,size', { headers });
    if (!metadata.parents?.includes(config.fields.folderId) || !['application/pdf','image/png','image/jpeg'].includes(metadata.mimeType)) throw new RequestError('Selecione um PDF ou imagem na pasta de documentos do Fama.', 403);
    if (Number(metadata.size) > 5 * 1024 * 1024) throw new RequestError('O download interno aceita documentos de até 5 MB.', 413);
    let response;
    try { response = await fetch(base + '?alt=media', { headers, redirect: 'manual', signal: AbortSignal.timeout(25000) }); }
    catch { throw new RequestError('Não foi possível carregar o documento do Drive.', 502); }
    if (!response.ok) { await response.body?.cancel(); throw new RequestError('O Drive não confirmou o download.', 502); }
    const bytes = await readLimitedBody(response, 5 * 1024 * 1024, 25000);
    return { bytes, name: String(metadata.name || 'documento').replace(/[\r\n\0/\\]/g,'_').slice(0,160), mime: metadata.mimeType };
}
