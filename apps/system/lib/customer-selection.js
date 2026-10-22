import { database } from './database';
import { camelizeRow, selectOne, usesSupabase } from './supabase';
import { decryptRecordFields, encryptedFieldsByEntity } from './crypto';
import { RequestError } from './request-error';
export const customerEntities = new Set(['quotes','appointments','workOrders','warranties','contracts']);
export async function resolveCustomerSelection(entity, body, organizationId, existing = null) {
    if (!customerEntities.has(entity)) return null;
    if (!Object.hasOwn(body,'customerId') && existing?.customerId) body.customerId=existing.customerId;
    if (!Object.hasOwn(body,'customerId')) return null;
    if (!body.customerId) {
        if (existing && !existing.customerId && body.clientName===existing.clientName) return null;
        throw new RequestError('Selecione um cliente cadastrado.',400);
    }
    if (typeof body.customerId!=='string' || body.customerId.length>100) throw new RequestError('Cliente inválido.',400);
    const raw=usesSupabase() ? await selectOne('customers',{id:body.customerId,organization_id:organizationId}) : await database().prepare('SELECT * FROM customers WHERE id=? AND organization_id=?').bind(body.customerId,organizationId).first();
    if (!raw) throw new RequestError('Cliente não encontrado nesta empresa.',404);
    const customer=await decryptRecordFields(camelizeRow(raw),encryptedFieldsByEntity.customers ?? []);
    body.clientName=customer.name;
    if (entity==='appointments' && !String(body.address ?? '').trim()) body.address=customer.address || '';
    if (entity==='contracts') {
        let details={};try { details=JSON.parse(customer.notes).details || {}; } catch {}
        if (!String(body.clientAddress ?? '').trim()) body.clientAddress=customer.address || '';
        if (!String(body.clientDocument ?? '').trim()) body.clientDocument=details.clientDocument || '';
    }
    return customer.id;
}
let schemaPromise;
export async function ensureCustomerColumns() {
    if (usesSupabase()) return;
    if (!schemaPromise) schemaPromise=(async()=>{
        const db=database();
        for (const table of ['quotes','appointments','work_orders','warranties','contracts']) {
            const info=await db.prepare(`PRAGMA table_info(${table})`).all();
            if (!info.results.some(column=>column.name==='customer_id')) {
                try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN customer_id TEXT`).run(); }
                catch(error) {const check=await db.prepare(`PRAGMA table_info(${table})`).all();if(!check.results.some(column=>column.name==='customer_id'))throw error;}
            }
        }
    })().catch(error=>{schemaPromise=null;throw error;});
    return schemaPromise;
}
