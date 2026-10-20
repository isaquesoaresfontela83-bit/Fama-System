import { env } from 'cloudflare:workers';
import { requireTenant, tenantError, RequestError } from './tenant';
import { hasFeaturePermission } from './permissions';
import { isTrustedMutation } from './request-security';
import { readJsonObject, readLimitedBody } from './request-body';
import { assertRateLimit } from './security';
import { whatsappPhoneInput } from './fama-whatsapp';

const headers={'Cache-Control':'private,no-store'};
export async function baileysBridge(organizationId,action,input={}) {
    if(!env.FAMA_DATA_BRIDGE_SECRET)throw new RequestError('A conexão segura com o Fama Control está indisponível.',503);
    const send=env.FAMA_CONTROL?.fetch ? env.FAMA_CONTROL.fetch.bind(env.FAMA_CONTROL) : fetch;
    let response;
    try { response=await send('https://control.famasystem.online/api/internal/baileys',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(28000),headers:{Authorization:'Bearer '+env.FAMA_DATA_BRIDGE_SECRET,'Content-Type':'application/json'},body:JSON.stringify({...input,organizationId,action})}); }
    catch { throw new RequestError('O Fama Control não respondeu. Tente novamente.',502); }
    let result;
    try { result=JSON.parse(new TextDecoder().decode(await readLimitedBody(response,1024*1024,28000))); }catch{throw new RequestError('A conexão com o Baileys não retornou uma resposta válida.',502);}
    if(!response.ok)throw new RequestError(typeof result.error==='string'?result.error.slice(0,300):'O Baileys não confirmou a operação.',[400,401,403,409,429,503].includes(response.status)?response.status:502);
    return result;
}
async function access(request) {
    const value=await requireTenant(request);
    if(!hasFeaturePermission(value.organization.role,value.organization.permissions,'chat',value.organization.moduleAccess))throw new RequestError('Seu perfil não tem acesso ao WhatsApp.',403);
    return value;
}
export async function baileysGET(request) {
    try {
        const {organization}=await access(request), url=new URL(request.url),action=url.searchParams.get('action') || 'status';
        if(!['status','conversations','messages'].includes(action))throw new RequestError('Consulta inválida.',400);
        if(action==='status') {
            const config=await baileysBridge(organization.id,'configured');
            if(!config.configured)return Response.json({provider:'baileys',configured:false,status:'not_configured',canManage:['owner','admin'].includes(organization.role)},{headers});
        }
        const input=action==='messages'?{phone:whatsappPhoneInput(url.searchParams.get('phone'))}:{};
        const result=await baileysBridge(organization.id,action,input);
        if(action==='status'){
            const canManage=['owner','admin'].includes(organization.role);
            return Response.json({...result,...(!canManage?{qr:null,qrExpiresAt:null}:{}),configured:true,canManage},{headers});
        }
        return Response.json(result,{headers});
    } catch(error){return tenantError(error,'Não foi possível consultar o WhatsApp.');}
}
export async function baileysPOST(request) {
    try {
        if(!isTrustedMutation(request))throw new RequestError('Origem inválida.',403);
        const {organization,user}=await access(request), input=await readJsonObject(request,24000);
        if(!['connect','disconnect','send'].includes(input.action) || Object.keys(input).some(key=>!['action','phone','text','clientId'].includes(key)))throw new RequestError('Operação inválida.',400);
        if(input.action!=='send' && !['owner','admin'].includes(organization.role))throw new RequestError('Somente administradores podem conectar ou desconectar o WhatsApp.',403);
        await assertRateLimit(request,'baileys_'+input.action,organization.id+':'+user.id,input.action==='send'?20:8,60);
        const body={};
        if(input.action==='send') {
            try { body.phone=whatsappPhoneInput(input.phone); }catch{throw new RequestError('Informe o telefone com DDD.',400);}
            if(typeof input.text!=='string' || !input.text.trim() || input.text.length>4096 || !/^[0-9a-f-]{36}$/i.test(input.clientId || ''))throw new RequestError('Mensagem ou identificador inválido.',400);
            body.text=input.text.trim();body.clientId=input.clientId;
        }
        return Response.json(await baileysBridge(organization.id,input.action,body),{headers});
    }catch(error){return tenantError(error,'Não foi possível concluir a operação no WhatsApp.');}
}
