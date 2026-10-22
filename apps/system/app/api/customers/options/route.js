import { database } from '@/lib/database';
import { camelizeRow,selectRows,usesSupabase } from '@/lib/supabase';
import { requireTenant,tenantError,RequestError } from '@/lib/tenant';
import { hasFeaturePermission } from '@/lib/permissions';
import { decryptRecordFields } from '@/lib/crypto';
export async function GET(request) {
    try {
        const {organization}=await requireTenant(request);
        if(!['quotes','agenda','orders','warranties','contracts'].some(feature=>hasFeaturePermission(organization.role,organization.permissions,feature,organization.moduleAccess)))throw new RequestError('Seu perfil não pode selecionar clientes para esta operação.',403);
        const rows=usesSupabase()?await selectRows('customers',{organization_id:organization.id},{select:'id,name,address,pool_type,pool_volume',order:'name.asc'}):(await database().prepare('SELECT id,name,address,pool_type,pool_volume FROM customers WHERE organization_id=? ORDER BY name').bind(organization.id).all()).results;
        const customers=await Promise.all(rows.map(async raw=>{const row=await decryptRecordFields(camelizeRow(raw),['address']);return {id:row.id,name:row.name,address:row.address||'',poolType:row.poolType||'',poolVolume:row.poolVolume??null};}));
        return Response.json({customers},{headers:{'Cache-Control':'private,no-store'}});
    }catch(error){return tenantError(error,'Não foi possível listar os clientes da empresa.');}
}
