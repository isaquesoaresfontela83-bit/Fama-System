import { requirePlatformAdmin, tenantError, RequestError } from '@/lib/tenant';
import { isTrustedMutation } from '@/lib/request-security';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { readBaileysConfig, saveBaileysConfig, baileysRequest } from '@/lib/baileys-config';
const headers={'Cache-Control':'private,no-store'};
export async function GET() {
    try {
        await requirePlatformAdmin(); const config=await readBaileysConfig();
        return Response.json({configured:Boolean(config),url:config?.url || '',provider:'baileys'},{headers});
    } catch(error) { return tenantError(error,'Não foi possível conferir o Baileys.'); }
}
export async function POST(request) {
    try {
        const admin=await requirePlatformAdmin();
        if(!isTrustedMutation(request))throw new RequestError('Origem inválida.',403);
        await assertRateLimit(request,'admin_baileys',admin.id,10,60);
        const input=await readJsonObject(request,4096);
        if(!['save','check'].includes(input.action) || Object.keys(input).some(key=>!['action','url','token'].includes(key)))throw new RequestError('Operação inválida.',400);
        const previous=await readBaileysConfig();
        if(input.action==='save' && !input.token && input.url!==previous?.url)throw new RequestError('Informe o token ao cadastrar outro endereço de servidor.',400);
        const config=input.action==='save' ? await saveBaileysConfig(input.url,input.token || previous?.token) : previous;
        const health=await baileysRequest(config,'/health');
        if(health.provider!=='baileys' || health.ok!==true)throw new RequestError('Servidor Baileys incompatível.',502);
        return Response.json({configured:true,url:config.url,available:true,checkedAt:new Date().toISOString(),provider:'baileys'},{headers});
    } catch(error) { return tenantError(error,'Não foi possível configurar o Baileys.'); }
}
