import { OrderError } from './model.mjs';

export const RATE_LIMIT_SCHEMA = `CREATE TABLE IF NOT EXISTS sales_order_rate_limits (key_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL)`;

/** One durable row per verified actor and action; arbitrary client IDs never create rows. */
export async function consumeRateLimit(db, organizationId, userId, action, limit = 60, now = Date.now()) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([organizationId,userId,action])));
  const hash = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('');
  const window = Math.floor(now / 60_000);
  const result = await db.prepare(`INSERT INTO sales_order_rate_limits(key_hash,window_start,request_count) VALUES (?,?,1)
    ON CONFLICT(key_hash) DO UPDATE SET window_start=excluded.window_start,
    request_count=CASE WHEN sales_order_rate_limits.window_start<>excluded.window_start THEN 1 ELSE sales_order_rate_limits.request_count+1 END
    WHERE sales_order_rate_limits.window_start<>excluded.window_start OR sales_order_rate_limits.request_count<? RETURNING request_count`)
    .bind(hash,window,limit).first();
  if (!result) throw new OrderError('Muitas ações em pouco tempo. Aguarde um minuto e tente novamente.',429);
}
