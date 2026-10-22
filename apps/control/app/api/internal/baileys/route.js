import { isInternalRequest } from '@/lib/internal-auth';
import { readJsonObject } from '@/lib/request-body';
import { RequestError } from '@/lib/request-error';
import { tenantError } from '@/lib/tenant';
import { readBaileysConfig, baileysRequest } from '@/lib/baileys-config';
const headers={'Cache-Control':'private,no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request) {
    try {
        if(!await isInternalRequest(request))throw new RequestError('Acesso não autorizado.',401);
        const input=await readJsonObject(request,24000);
        if(Object.keys(input).some(key=>!['organizationId','action','phone','text','clientId'].includes(key)))throw new RequestError('Operação inválida.',400);
        const config=await readBaileysConfig();
        if(input.action==='configured')return Response.json({configured:Boolean(config)},{headers});
        if(!uuid.test(input.organizationId || ''))throw new RequestError('Empresa inválida.',400);
        const base='/v1/companies/'+input.organizationId;
        const operations={status:['/session','GET'],connect:['/session','POST'],reconnect:['/session','POST'],disconnect:['/session','DELETE'],conversations:['/conversations','GET'],messages:['/messages?phone='+encodeURIComponent(input.phone || ''),'GET'],send:['/messages','POST']};
        const operation=operations[input.action];
        if(!operation)throw new RequestError('Operação inválida.',400);
        if(['messages','send'].includes(input.action) && !/^[1-9]\d{9,14}$/.test(input.phone || ''))throw new RequestError('Telefone inválido.',400);
        const value=await baileysRequest(config,base+operation[0],operation[1],input.action==='send'?{phone:input.phone,text:input.text,clientId:input.clientId}:input.action==='reconnect'?{reconnect:true}:input.action==='connect'?{}:undefined);
        // The secret and server address never cross this internal bridge.
        return Response.json(value,{headers});
    } catch(error) { return tenantError(error,'Não foi possível acessar o servidor Baileys.'); }
}
