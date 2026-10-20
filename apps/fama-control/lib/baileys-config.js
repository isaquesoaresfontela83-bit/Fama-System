import { env } from 'cloudflare:workers';
import { isIP } from 'node:net';
import { database } from './database';
import { encryptText, decryptText } from './crypto';
import { RequestError } from './request-error';
import { readLimitedBody } from './request-body';

const settingKey='whatsapp_baileys_v1';
export function serviceOrigin(value) {
    let url;
    try { url=new URL(value); } catch { throw new RequestError('Informe a URL HTTPS do servidor Baileys.',400); }
    const host=url.hostname.toLowerCase();
    if (url.protocol!=='https:' || url.username || url.password || url.port || url.pathname!=='/' || url.search || url.hash || isIP(host) || host.startsWith('[') || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host) || host.endsWith('.localhost') || host.endsWith('.local'))
        throw new RequestError('Use um domínio HTTPS público, sem porta, caminho ou credenciais.',400);
    return url.origin;
}
export async function readBaileysConfig() {
    const row=await database().prepare('SELECT value FROM platform_settings WHERE key=?').bind(settingKey).first();
    if (row) {
        try {
            const value=JSON.parse(await decryptText(String(row.value)));
            return {url:serviceOrigin(value.url),token:String(value.token || '')};
        } catch { throw new RequestError('Confira a configuração segura do Baileys no Fama Control.',503); }
    }
    if (env.BAILEYS_SERVICE_URL && env.BAILEYS_API_TOKEN) return {url:serviceOrigin(String(env.BAILEYS_SERVICE_URL)),token:String(env.BAILEYS_API_TOKEN)};
    return null;
}
export async function baileysRequest(config,path,method='GET',body) {
    if (!config || config.token.length<32) throw new RequestError('O servidor Baileys ainda não foi configurado no Fama Control.',503);
    let response;
    try {
        response=await fetch(config.url+path,{method,redirect:'manual',signal:AbortSignal.timeout(25000),headers:{Authorization:'Bearer '+config.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    } catch { throw new RequestError('O servidor Baileys está indisponível. Confira a conexão no Fama Control.',502); }
    if (response.status>=300 && response.status<400) { await response.body?.cancel(); throw new RequestError('O servidor Baileys retornou um redirecionamento inesperado.',502); }
    let result;
    try { result=JSON.parse(new TextDecoder().decode(await readLimitedBody(response,1024*1024,25000))); }
    catch { throw new RequestError('O servidor Baileys retornou uma resposta inválida.',502); }
    if (!response.ok) throw new RequestError(typeof result.error==='string' ? result.error.slice(0,300) : 'O Baileys não confirmou a operação.',[400,409,413,429].includes(response.status)?response.status:502);
    return result;
}
export async function saveBaileysConfig(url,token) {
    const config={url:serviceOrigin(url),token};
    if(typeof token!=='string' || token.length<32 || token.length>512 || /\s/.test(token)) throw new RequestError('Informe o token do servidor Baileys com ao menos 32 caracteres.',400);
    const health=await baileysRequest(config,'/health');
    if(health.provider!=='baileys' || health.ok!==true)throw new RequestError('O endereço não confirmou um servidor Baileys compatível.',502);
    const encrypted=await encryptText(JSON.stringify(config));
    await database().prepare('INSERT INTO platform_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(settingKey,encrypted,new Date().toISOString()).run();
    return config;
}
