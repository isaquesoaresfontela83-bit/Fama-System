import { systemAddPage } from './account-access-system-page.mjs';
import { controlPage } from './account-access-control-page.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const html = body => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const normalizeEmail = value => String(value ?? '').trim().toLowerCase();
const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function owner(app, request, env, ctx) {
  const url = new URL('/api/auth/session', request.url);
  const session = await app.fetch(new Request(url, { headers: { cookie: request.headers.get('cookie') ?? '' } }), env, ctx);
  if (!session.ok) return false;
  const data = await session.json().catch(() => ({}));
  if (!data.authenticated || normalizeEmail(data.email) !== normalizeEmail(env.PLATFORM_OWNER_EMAIL)) return false;
  const probe = await app.fetch(new Request(new URL('/api/admin/organizations', request.url), { headers: { cookie: request.headers.get('cookie') ?? '' } }), env, ctx);
  await probe.body?.cancel();
  return probe.ok;
}

async function authAdmin(env, path, method, body) {
  const base = String(env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(env.SUPABASE_SECRET_KEY ?? '').trim();
  if (!base.startsWith('https://') || !key) throw Error('Serviço de contas indisponível.');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(base + '/auth/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(response.status === 422 ? 'Este e-mail já possui uma conta. Peça para a pessoa entrar com a conta existente.' : 'O serviço de autenticação não confirmou a operação.');
  return data.user && typeof data.user === 'object' ? data.user : data;
}

async function existingAuthUser(env, email) {
  for (let page = 1; page <= 50; page++) {
    const result = await authAdmin(env, `admin/users?page=${page}&per_page=200`, 'GET');
    const users = Array.isArray(result.users) ? result.users : [];
    const found = users.find(user => normalizeEmail(user.email) === email);
    if (found) return found;
    if (users.length < 200) return null;
  }
  throw Error('Diretório de contas grande demais para confirmar o e-mail.');
}

async function controlApi(app, request, env, ctx) {
  if (!await owner(app, request, env, ctx)) return json({ error: 'Somente a conta proprietária pode gerenciar colaboradores.' }, 403);
  if (!env.DB) return json({ error: 'Banco de solicitações indisponível.' }, 503);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS control_collaborator_requests (email TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('pending','active','revoked')), user_id TEXT NOT NULL DEFAULT '', requested_at TEXT NOT NULL, approved_at TEXT NOT NULL DEFAULT '')`).run();
  if (request.method === 'GET') {
    const result = await env.DB.prepare('SELECT email,status,requested_at AS requestedAt,approved_at AS approvedAt FROM control_collaborator_requests ORDER BY requested_at DESC').all();
    return json({ requests: result.results });
  }
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Origem da solicitação inválida.' }, 403);
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (email === normalizeEmail(env.PLATFORM_OWNER_EMAIL)) return json({ error: 'Esta já é a conta proprietária.' }, 409);
  const action = body?.action;
  const row = await env.DB.prepare('SELECT email,status,user_id FROM control_collaborator_requests WHERE email = ?').bind(email).first();
  if (action === 'request') {
    if (row) return json({ error: 'Este e-mail já possui uma solicitação.' }, 409);
    await env.DB.prepare('INSERT INTO control_collaborator_requests (email,status,requested_at) VALUES (?, ?, ?)').bind(email, 'pending', new Date().toISOString()).run();
    return json({ pending: true }, 201);
  }
  if (action === 'approve') {
    if (!row || row.status !== 'pending') return json({ error: 'Solicitação pendente não encontrada.' }, 409);
    // No user or privilege is created until this explicit approval action.
    const user = await existingAuthUser(env, email) ?? await authAdmin(env, 'invite', 'POST', { email });
    if (!user.id || normalizeEmail(user.email) !== email) return json({ error: 'O convite não foi confirmado.' }, 502);
    const metadata = { ...(user.app_metadata ?? {}), fama_control_admin: true };
    const updated = await authAdmin(env, 'admin/users/' + encodeURIComponent(user.id), 'PUT', { app_metadata: metadata });
    if (updated.id !== user.id || updated.app_metadata?.fama_control_admin !== true) return json({ error: 'A permissão não foi confirmada.' }, 502);
    await env.DB.prepare("UPDATE control_collaborator_requests SET status = 'active', user_id = ?, approved_at = ? WHERE email = ? AND status = 'pending'").bind(user.id, new Date().toISOString(), email).run();
    return json({ active: true });
  }
  if (action === 'revoke') {
    if (!row || row.status !== 'active' || !row.user_id) return json({ error: 'Acesso ativo não encontrado.' }, 409);
    const user = await authAdmin(env, 'admin/users/' + encodeURIComponent(row.user_id), 'GET');
    const metadata = { ...(user.app_metadata ?? {}) };
    delete metadata.fama_control_admin;
    await authAdmin(env, 'admin/users/' + encodeURIComponent(row.user_id), 'PUT', { app_metadata: metadata });
    await env.DB.prepare("UPDATE control_collaborator_requests SET status = 'revoked' WHERE email = ? AND status = 'active'").bind(email).run();
    return json({ revoked: true });
  }
  return json({ error: 'Ação inválida.' }, 400);
}

export function withAccountAccess(app, kind) {
  return { ...app, async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (kind === 'system' && request.method === 'GET' && url.pathname === '/entrar' && url.searchParams.get('add_account') === '1') return html(systemAddPage(url));
    if (kind === 'control' && url.pathname === '/api/control-collaborators') {
      try { return await controlApi(app, request, env, ctx); }
      catch (error) { console.error('control_collaborator_failed', error); return json({ error: 'Não foi possível gerenciar o colaborador agora.' }, 503); }
    }
    if (kind === 'control' && request.method === 'GET' && url.pathname === '/colaboradores-control') {
      if (!await owner(app, request, env, ctx)) return Response.redirect(new URL('/', request.url), 302);
      return html(controlPage);
    }
    return app.fetch(request, env, ctx);
  } };
}
