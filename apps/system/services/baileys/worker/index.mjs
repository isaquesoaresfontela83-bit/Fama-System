import { DurableObject } from 'cloudflare:workers';
import * as baileys from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { EncryptedStore } from '../encrypted-store.mjs';
import { Sessions, authorized, companyValid } from '../session-core.mjs';
import { DurableSqlite } from './sqlite.mjs';
import { companyRequestBody } from './body.mjs';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});


export class WhatsAppCompany extends DurableObject {
    constructor(ctx,env){
        super(ctx,env);
        const codec={stringify:value=>JSON.stringify(value,baileys.BufferJSON.replacer),parse:value=>JSON.parse(value,baileys.BufferJSON.reviver)};
        this.store=new EncryptedStore(new DurableSqlite(ctx.storage.sql),env.BAILEYS_ENCRYPTION_KEY,codec);
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS service_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
        this.sessions=new Sessions(this.store,baileys,QRCode,1);this.company=this.meta('company');
        this.limit={since:Date.now(),count:0};
    }
    meta(key,value){
        if(value!==undefined){this.ctx.storage.sql.exec('INSERT INTO service_meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,String(value));return value;}
        return this.ctx.storage.sql.exec('SELECT value FROM service_meta WHERE key=?',key).toArray()[0]?.value || '';
    }
    async handle(company,action,method,body={},phone=''){
        try{return {ok:true,data:await this.execute(company,action,method,body,phone)};}
        catch(error){
            if(!error.status)console.error(JSON.stringify({event:'baileys_company_failure',message:String(error.message).slice(0,500)}));
            return {ok:false,error:error.status?error.message:'O serviço WhatsApp não confirmou a operação. Atualize a conexão.',status:error.status || 502};
        }
    }
    async execute(company,action,method,body,phone){
        if(!companyValid(company) || (this.company && this.company!==company))throw fail('Empresa inválida.');
        if(!this.company){this.meta('company',company);this.company=company;}
        const enabled=this.store.enabled().includes(company);
        if(enabled && this.store.getAuth(company,'creds')?.registered && !this.sessions.items.get(company))await this.sessions.connect(company);
        if(method==='GET'){
            if(action==='session')return this.sessions.view(company);
            if(action==='conversations')return {conversations:this.store.conversations(company)};
            if(action==='messages' && /^[1-9]\d{9,14}$/.test(phone))return {messages:this.store.messages(company,phone)};
            throw fail('Consulta inválida.');
        }
        if(Date.now()-this.limit.since>60000)this.limit={since:Date.now(),count:0};
        if(++this.limit.count>30)throw fail('Aguarde antes de tentar novamente.',429);
        if(action==='session' && method==='POST'){
            this.meta('requestedAt',Date.now());
            if(Object.keys(body||{}).some(key=>key!=='reconnect')||(body?.reconnect!==undefined&&typeof body.reconnect!=='boolean'))throw Object.assign(new Error('Operação inválida.'),{status:400});
            const result=await this.sessions.connect(company,{reconnect:body?.reconnect===true});await this.ctx.storage.setAlarm(Date.now()+60000);return result;
        }
        if(action==='session' && method==='DELETE'){
            const result=await this.sessions.disconnect(company);await this.ctx.storage.deleteAlarm();return result;
        }
        if(action==='messages' && method==='POST')return this.sessions.send(company,body);
        throw fail('Método não permitido.',405);
    }
    async alarm(){
        const company=this.company;if(!company || !this.store.enabled().includes(company))return;
        if(!this.store.getAuth(company,'creds')?.registered && Date.now()-Number(this.meta('requestedAt'))>8*60000){await this.sessions.disconnect(company);return;}
        await this.sessions.connect(company).catch(()=>{});
        await this.ctx.storage.setAlarm(Date.now()+60000);
    }
}

export default {
    async fetch(request,env){
        try{
            if(!authorized(request.headers.get('Authorization'),env.BAILEYS_API_TOKEN))return json({error:'Acesso não autorizado.'},401);
            const url=new URL(request.url);
            if(url.pathname==='/health' && request.method==='GET')return json({provider:'baileys',ok:true,version:'1.1.0',runtime:'cloudflare-durable-objects'});
            const match=url.pathname.match(/^\/v1\/companies\/([^/]+)\/(session|conversations|messages)$/);
            if(!match || !companyValid(match[1]))return json({error:'Operação inválida.'},404);
            const body=await companyRequestBody(request,match[2]);
            const stub=env.WHATSAPP.getByName(match[1]);
            const result=await stub.handle(match[1],match[2],request.method,body,url.searchParams.get('phone') || '');
            return result.ok?json(result.data):json({error:result.error},result.status);
        }catch(error){
            if(!error.status)console.error(JSON.stringify({event:'baileys_request_failure',message:String(error.message).slice(0,500)}));
            return json({error:error.status?error.message:'O serviço WhatsApp não confirmou a operação. Atualize a conexão.'},error.status || 502);
        }
    },
};
