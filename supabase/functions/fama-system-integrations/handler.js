// Backend-only integrations. No provider credential is accepted from the caller.
const ORIGINS = new Set([
  "https://famasystem.online", "https://www.famasystem.online",
  "https://control.famasystem.online",
  "https://fama-system.isaquesoaresfontela8.chatgpt.site",
  "https://fama-system-4p9c0y.v2.appdeploy.ai"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["integration_status", "drive_upload", "resend_send", "ocr_extract", "sentry_capture"]);
class IntegrationError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function createHandler(runtime = {}) {
  const env = runtime.env ?? ((name) => Deno.env.get(name));
  const send = runtime.fetch ?? globalThis.fetch;
  const now = runtime.now ?? Date.now;
  const value = (name) => String(env(name) ?? "").trim();
  let driveCache = null;
  const fail = (status, code, message) => { throw new IntegrationError(status, code, message); };
  function reply(req, status, body) {
    const origin = req.headers.get("origin") ?? "";
    const headers = {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-organization-id"
    };
    if (ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
  }
  async function readText(stream, maximum, status = 413) {
    if (!stream) return "";
    const reader = stream.getReader(), chunks = [];
    let size = 0; const deadline = now() + 10000;
    try {
      while (true) {
        let timer;
        let item;
        try {
          item = await Promise.race([
            reader.read(),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new IntegrationError(408, "BODY_TIMEOUT", "Tempo de leitura excedido.")), Math.max(1, deadline - now())); })
          ]);
        } finally { clearTimeout(timer); }
        if (item.done) break;
        size += item.value.byteLength;
        if (size > maximum) fail(status, "BODY_TOO_LARGE", "Arquivo ou resposta excedeu o limite permitido.");
        chunks.push(item.value);
      }
    } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
    const all = new Uint8Array(size); let offset = 0;
    for (const part of chunks) { all.set(part, offset); offset += part.byteLength; }
    return new TextDecoder().decode(all);
  }
  async function upstream(url, options = {}, maximum = 1048576) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await send(url, { ...options, redirect: "error", signal: controller.signal });
      const text = await readText(response.body, maximum, 502);
      if (!response.ok) {
        if (response.status === 429) fail(429, "PROVIDER_RATE_LIMIT", "Limite do provedor atingido. Tente mais tarde.");
        if (response.status === 401 || response.status === 403) fail(424, "PROVIDER_CREDENTIAL_REJECTED", "O provedor recusou a credencial configurada no servidor.");
        fail(502, "PROVIDER_ERROR", "O serviço externo não concluiu a solicitação.");
      }
      try { return text ? JSON.parse(text) : {}; }
      catch { fail(502, "PROVIDER_INVALID_JSON", "O serviço externo retornou uma resposta inválida."); }
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      fail(502, "PROVIDER_UNAVAILABLE", "Não foi possível acessar o serviço externo.");
    } finally { clearTimeout(timer); }
  }
  function required(names) {
    if (names.some(name => !value(name))) fail(424, "PROVIDER_NOT_CONFIGURED", "Esta integração aguarda configuração segura no backend.");
  }
  async function database(path, token, method = "GET", body) {
    const base = value("SUPABASE_URL"), key = value("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !key) fail(503, "BACKEND_NOT_CONFIGURED", "Configuração do servidor indisponível.");
    return upstream(base + path, { method, headers: {
      apikey: key, Authorization: "Bearer " + token, "Content-Type": "application/json"
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function user(req) {
    const authorization = req.headers.get("authorization") ?? "";
    if (!/^Bearer \S{16,8192}$/i.test(authorization)) fail(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.");
    let account;
    try { account = await database("/auth/v1/user", authorization.slice(7)); }
    catch (error) {
      if (error.code === "PROVIDER_CREDENTIAL_REJECTED") fail(401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");
      throw error;
    }
    if (!UUID.test(String(account?.id ?? ""))) fail(401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");
    return account;
  }
  async function tenant(req, body, account) {
    const header = req.headers.get("x-organization-id") ?? "";
    const id = String(header || body.organization_id || "").trim();
    if (!UUID.test(id)) fail(400, "ORGANIZATION_REQUIRED", "Selecione uma empresa válida.");
    if (header && body.organization_id && header !== body.organization_id) fail(403, "ORGANIZATION_MISMATCH", "A empresa informada não corresponde à sessão.");
    const query = new URLSearchParams({ select: "role,status", organization_id: "eq." + id, user_id: "eq." + account.id, limit: "1" });
    const service = value("SUPABASE_SERVICE_ROLE_KEY");
    const members = await database("/rest/v1/organization_members?" + query, service);
    const member = Array.isArray(members) ? members[0] : null;
    if (!member || member.status !== "active" || !["owner", "admin"].includes(member.role)) fail(403, "FORBIDDEN", "Esta integração exige acesso administrativo à empresa.");
    const organizations = await database("/rest/v1/organizations?" + new URLSearchParams({
      select: "id,status,plan_status,plan_expires_at,billing_enabled,block_on_expiry", id: "eq." + id, limit: "1"
    }), service);
    const organization = Array.isArray(organizations) ? organizations[0] : null;
    if (!organization || organization.status !== "active") fail(403, "ORGANIZATION_BLOCKED", "Esta empresa não está ativa.");
    if (organization.billing_enabled !== false && organization.block_on_expiry !== false) {
      const expires = Date.parse(String(organization.plan_expires_at ?? ""));
      if (["expired", "blocked", "suspended", "canceled", "cancelled", "past_due", "unpaid"].includes(organization.plan_status) ||
          Number.isFinite(expires) && expires <= now()) fail(402, "PLAN_BLOCKED", "Regularize o plano desta empresa para continuar.");
    }
    return id;
  }
  async function limit(identity, action, maximum, seconds) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity + ":" + action));
    const key = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
    const allowed = await database("/rest/v1/rpc/fama_consume_rate_limit", value("SUPABASE_SERVICE_ROLE_KEY"), "POST", {
      p_key_hash: key, p_action: "integrations_" + action, p_limit: maximum, p_window_seconds: seconds
    });
    if (allowed !== true) fail(429, "RATE_LIMIT", "Limite de operações atingido. Aguarde e tente novamente.");
  }
  function file(input, maximum, ocr = false) {
    if (!input || typeof input !== "object" || Array.isArray(input)) fail(400, "FILE_REQUIRED", "Informe o arquivo.");
    const mime = String(input.mime_type ?? "").trim().toLowerCase();
    const types = ocr ? ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"] :
      ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff", "text/plain", "application/json"];
    if (!types.includes(mime)) fail(400, "FILE_TYPE", "Tipo de arquivo não permitido.");
    const name = String(input.name ?? "").trim();
    if (!name || name.length > 160 || /[\r\n\x00/\\]/.test(name)) fail(400, "FILE_NAME", "Nome de arquivo inválido.");
    const base64 = String(input.base64 ?? "");
    if (!base64 || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) fail(400, "FILE_BASE64", "Conteúdo de arquivo inválido.");
    const length = base64.length / 4 * 3 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (length < 1 || length > maximum) fail(413, "FILE_SIZE", "O arquivo excede o limite desta integração.");
    return { mime, name, base64, length };
  }
  async function driveToken() {
    required(["FAMA_GOOGLE_DRIVE_CLIENT_ID", "FAMA_GOOGLE_DRIVE_CLIENT_SECRET", "FAMA_GOOGLE_DRIVE_REFRESH_TOKEN"]);
    if (driveCache?.expires > now()) return driveCache.token;
    const data = await upstream("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
      client_id: value("FAMA_GOOGLE_DRIVE_CLIENT_ID"), client_secret: value("FAMA_GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: value("FAMA_GOOGLE_DRIVE_REFRESH_TOKEN"), grant_type: "refresh_token"
    }) });
    if (typeof data.access_token !== "string" || !data.access_token) fail(424, "DRIVE_OAUTH", "O Google Drive não retornou uma autorização válida.");
    driveCache = { token: data.access_token, expires: now() + Math.max(0, Math.min(Number(data.expires_in) || 3600, 3600) - 60) * 1000 };
    return driveCache.token;
  }
  function status() {
    return {
      google_drive: { configured: ["FAMA_GOOGLE_DRIVE_CLIENT_ID", "FAMA_GOOGLE_DRIVE_CLIENT_SECRET", "FAMA_GOOGLE_DRIVE_REFRESH_TOKEN", "FAMA_GOOGLE_DRIVE_FOLDER_ID"].every(name => !!value(name)) },
      resend: { configured: !!value("FAMA_RESEND_API_KEY") && !!value("FAMA_RESEND_FROM") },
      ocr_space: { configured: !!value("FAMA_OCRSPACE_API_KEY") },
      sentry: { configured: !!value("FAMA_SENTRY_DSN") }
    };
  }
  return async function handler(req) {
    const origin = req.headers.get("origin") ?? "";
    if (origin && !ORIGINS.has(origin)) return reply(req, 403, { ok: false, code: "ORIGIN_REJECTED", message: "Origem não autorizada." });
    if (req.method === "OPTIONS") return reply(req, 204, null);
    if (req.method !== "POST") return reply(req, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Método não permitido." });
    try {
      const account = await user(req);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) fail(415, "JSON_REQUIRED", "Envie uma requisição JSON.");
      if (Number(req.headers.get("content-length") || 0) > 7 * 1024 * 1024 + 8192) fail(413, "BODY_TOO_LARGE", "Requisição muito grande.");
      let body;
      try { body = JSON.parse(await readText(req.body, 7 * 1024 * 1024 + 8192)); }
      catch (error) { if (error instanceof IntegrationError) throw error; fail(400, "INVALID_JSON", "Requisição JSON inválida."); }
      if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "INVALID_BODY", "Requisição inválida.");
      const action = String(body.action ?? "");
      if (!ACTIONS.has(action)) fail(400, "ACTION_NOT_ALLOWED", "Ação não permitida.");
      const organization = await tenant(req, body, account);
      await limit(account.id + ":" + organization, action, action === "resend_send" ? 3 : 10, 60);
      if (action === "integration_status") return reply(req, 200, { ok: true, data: status() });
      if (action === "drive_upload") {
        required(["FAMA_GOOGLE_DRIVE_FOLDER_ID"]);
        const folder = value("FAMA_GOOGLE_DRIVE_FOLDER_ID");
        if (!/^[A-Za-z0-9_-]{10,200}$/.test(folder)) fail(424, "DRIVE_FOLDER", "Configure a pasta de destino do Google Drive no servidor.");
        const media = file(body.file, 5 * 1024 * 1024);
        await limit(organization, "drive_daily", 50, 86400);
        const access = await driveToken(), boundary = "fama_" + crypto.randomUUID().replaceAll("-", "");
        const metadata = { name: organization + "_" + media.name, parents: [folder], appProperties: { fama_organization_id: organization } };
        const prefix = new TextEncoder().encode("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + media.mime + "\r\n\r\n");
        const binary = Uint8Array.from(atob(media.base64), char => char.charCodeAt(0));
        const suffix = new TextEncoder().encode("\r\n--" + boundary + "--\r\n");
        const multipart = new Uint8Array(prefix.length + binary.length + suffix.length);
        multipart.set(prefix); multipart.set(binary, prefix.length); multipart.set(suffix, prefix.length + binary.length);
        const data = await upstream("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", headers: { Authorization: "Bearer " + access, "Content-Type": "multipart/related; boundary=" + boundary }, body: multipart });
        if (!data.id) fail(502, "DRIVE_RESPONSE", "O Google Drive não confirmou o arquivo.");
        return reply(req, 200, { ok: true, data: { id: data.id, name: data.name, web_view_link: data.webViewLink ?? null } });
      }
      if (action === "resend_send") {
        required(["FAMA_RESEND_API_KEY", "FAMA_RESEND_FROM"]);
        const to = String(body.to ?? "").trim(), subject = String(body.subject ?? "").trim(), text = String(body.text ?? "").trim();
        const requestId = String(body.request_id ?? "");
        if (!/^\S+@\S+\.\S+$/.test(to) || to.length > 254 || /[\r\n]/.test(to)) fail(400, "EMAIL_RECIPIENT", "Informe um destinatário válido.");
        if (!subject || subject.length > 200 || /[\r\n]/.test(subject) || !text || text.length > 50000) fail(400, "EMAIL_CONTENT", "Informe assunto e mensagem válidos.");
        if (!UUID.test(requestId)) fail(400, "IDEMPOTENCY_REQUIRED", "Informe request_id para impedir envios duplicados.");
        const payload = { from: value("FAMA_RESEND_FROM"), to: [to], subject, text };
        if (body.file) { const media = file(body.file, 5 * 1024 * 1024); payload.attachments = [{ filename: media.name, content: media.base64 }]; }
        await limit(organization, "resend_daily", 50, 86400);
        const data = await upstream("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + value("FAMA_RESEND_API_KEY"), "Content-Type": "application/json", "Idempotency-Key": "fama-" + organization + "-" + requestId }, body: JSON.stringify(payload) });
        if (!data.id) fail(502, "EMAIL_RESPONSE", "O provedor não confirmou o envio.");
        return reply(req, 200, { ok: true, data: { id: data.id } });
      }
      if (action === "ocr_extract") {
        required(["FAMA_OCRSPACE_API_KEY"]);
        const media = file(body.file, 1024 * 1024, true);
        const language = String(body.language ?? "auto");
        if (!["auto", "por", "eng", "spa"].includes(language)) fail(400, "OCR_LANGUAGE", "Idioma não permitido.");
        await limit(organization, "ocr_daily", 100, 86400);
        const form = new FormData();
        form.set("base64Image", "data:" + media.mime + ";base64," + media.base64);
        form.set("language", language); form.set("OCREngine", "2"); form.set("isOverlayRequired", "false");
        const data = await upstream("https://api.ocr.space/parse/image", { method: "POST", headers: { apikey: value("FAMA_OCRSPACE_API_KEY") }, body: form });
        if (data.IsErroredOnProcessing || !Array.isArray(data.ParsedResults) || !data.ParsedResults.length) fail(422, "OCR_PROCESSING", "O provedor não conseguiu reconhecer este documento.");
        const text = data.ParsedResults.slice(0,20).map(page => String(page.ParsedText ?? "")).join("\n\n");
        return reply(req, 200, { ok: true, data: { text: text.slice(0,500000), partial: Number(data.OCRExitCode) === 2 } });
      }
      required(["FAMA_SENTRY_DSN"]);
      let dsn;
      try { dsn = new URL(value("FAMA_SENTRY_DSN")); } catch { fail(424, "SENTRY_DSN", "Configure um DSN válido do Sentry no servidor."); }
      if (dsn.protocol !== "https:" || dsn.port || dsn.password || !/^(?:[a-z0-9-]+\.)+ingest(?:\.[a-z0-9-]+)?\.sentry\.io$/i.test(dsn.hostname) || !/^[a-f0-9]{32}$/i.test(dsn.username) || !/^\/[0-9]+$/.test(dsn.pathname) || dsn.search || dsn.hash) fail(424, "SENTRY_DSN", "O DSN do Sentry não é permitido.");
      await limit(organization, "sentry_daily", 100, 86400);
      const eventId = crypto.randomUUID().replaceAll("-", "");
      const event = { event_id: eventId, timestamp: now() / 1000, platform: "javascript", level: "info", environment: "production", logger: "fama-system-integrations", message: String(body.message ?? "Verificação da integração Fama System").slice(0,2000), tags: { source: "fama-system-backend" } };
      const envelope = JSON.stringify({ event_id: eventId, sent_at: new Date(now()).toISOString() }) + "\n" + JSON.stringify({ type: "event" }) + "\n" + JSON.stringify(event) + "\n";
      await upstream("https://" + dsn.hostname + "/api" + dsn.pathname + "/envelope/", { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": "Sentry sentry_version=7,sentry_client=fama-system/1.0,sentry_key=" + dsn.username }, body: envelope });
      return reply(req, 200, { ok: true, data: { event_id: eventId } });
    } catch (error) {
      if (error instanceof IntegrationError) return reply(req, error.status, { ok: false, code: error.code, message: error.message });
      console.error("fama_integrations_unexpected_error");
      return reply(req, 500, { ok: false, code: "INTERNAL_ERROR", message: "Falha interna na integração." });
    }
  };
}
