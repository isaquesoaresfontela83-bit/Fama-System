import { OrderError } from './model.mjs';

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sales_orders (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, order_number TEXT NOT NULL, source_quote_id TEXT NOT NULL DEFAULT '', request_id TEXT NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, lock_token TEXT NOT NULL DEFAULT '', lock_until INTEGER NOT NULL DEFAULT 0, UNIQUE(organization_id,order_number), UNIQUE(organization_id,request_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_quote ON sales_orders(organization_id,source_quote_id) WHERE source_quote_id <> ''`,
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_org_updated ON sales_orders(organization_id,updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS sales_order_counters (organization_id TEXT PRIMARY KEY, next_value INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sales_order_quote_locks (organization_id TEXT NOT NULL,quote_id TEXT NOT NULL,token TEXT NOT NULL,lock_until INTEGER NOT NULL,PRIMARY KEY(organization_id,quote_id))`,
  `CREATE TABLE IF NOT EXISTS sales_order_policies (scope TEXT PRIMARY KEY, policy TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, actor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sales_order_attachments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, order_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_order_attachments_org_order ON sales_order_attachments(organization_id,order_id)`,
];
export async function ensureSchema(db) { await db.batch(SCHEMA.map(sql => db.prepare(sql))); }
const encoder = new TextEncoder();
export function encode(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
export function decode(value) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
async function key(env) {
  const material = String(env.FAMA_DATA_ENCRYPTION_KEY ?? '').trim();
  const bytes = /^[a-f0-9]{64}$/i.test(material) ? Uint8Array.from(material.match(/../g), x => parseInt(x, 16)) : decode(material);
  if (bytes.length !== 32) throw new OrderError('A proteção de dados dos pedidos precisa ser configurada no servidor.', 503);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), encoder.encode(typeof value === 'string' ? value : JSON.stringify(value)));
  return `fama:v1:${encode(iv)}.${encode(new Uint8Array(cipher))}`;
}
export async function unseal(value, env, json = true) {
  const [iv, data] = value.slice('fama:v1:'.length).split('.');
  const raw = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await key(env), decode(data)));
  return json ? JSON.parse(raw) : raw;
}
export async function uuidFor(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function legacyStore(env) {
  const remote = String(env.DATA_BACKEND ?? '').toLowerCase() === 'supabase';
  const allowed = { transactions: ['id','organization_id','description','type','category','amount_cents','due_date','status','created_at','updated_at'], appointments: ['id','organization_id','title','customer_id','client_name','start_at','address','technician','kind','status','notes','created_at','updated_at'] };
  async function api(table, method, filters, data, insert = false) {
    const query = new URLSearchParams({ select: '*' });
    for (const [k, v] of Object.entries(filters ?? {})) query.set(k, `eq.${v}`);
    if (insert) query.set('on_conflict', 'id');
    const url = new URL(`/rest/v1/${table}?${query}`, env.SUPABASE_URL);
    const secret = String(env.SUPABASE_SECRET_KEY ?? '');
    if (!secret) throw new OrderError('O serviço financeiro precisa ser configurado no servidor.', 503);
    const headers = { apikey: secret, 'Content-Type': 'application/json', Prefer: insert ? 'resolution=ignore-duplicates,return=representation' : 'return=representation' };
    if (secret.startsWith('eyJ')) headers.Authorization = `Bearer ${secret}`;
    const response = await fetch(url, { method, headers, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); throw new OrderError('Não foi possível sincronizar com o financeiro ou a agenda. Atualize e tente novamente.', 503); }
    return response.status === 204 ? [] : response.json();
  }
  return {
    async read(table, id, organizationId) {
      if (!allowed[table]) throw new Error('Invalid table');
      if (remote) return (await api(table, 'GET', { id, organization_id: organizationId }))[0] ?? null;
      return env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND organization_id=?`).bind(id, organizationId).first();
    },
    async insert(table, row) {
      if (!allowed[table] || Object.keys(row).some(k => !allowed[table].includes(k))) throw new Error('Invalid columns');
      if (remote) return api(table, 'POST', {}, row, true);
      const fields = Object.keys(row);
      return env.DB.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')}) ON CONFLICT(id) DO NOTHING`).bind(...Object.values(row)).run();
    },
    async patch(table, id, org, values, status) {
      if (!allowed[table] || Object.keys(values).some(k => !allowed[table].includes(k))) throw new Error('Invalid columns');
      const filters = { id, organization_id: org, ...(status ? { status } : {}) };
      if (remote) return api(table, 'PATCH', filters, values);
      const result = await env.DB.prepare(`UPDATE ${table} SET ${Object.keys(values).map(k => `${k}=?`).join(',')} WHERE id=? AND organization_id=?${status ? ' AND status=?' : ''}`).bind(...Object.values(values), id, org, ...(status ? [status] : [])).run();
      return result.meta.changes ? [values] : [];
    },
    async remove(table, id, org, status) {
      if (!allowed[table]) throw new Error('Invalid table');
      if (remote) return api(table, 'DELETE', { id, organization_id: org, ...(status ? {status} : {}) });
      return env.DB.prepare(`DELETE FROM ${table} WHERE id=? AND organization_id=?${status ? ' AND status=?' : ''}`).bind(id, org, ...(status ? [status] : [])).run();
    },
  };
}
