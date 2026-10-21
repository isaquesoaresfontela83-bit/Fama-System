import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Store } from './store.mjs';

import { Sessions, authorized, companyValid } from './session-core.mjs';
export { Sessions, authorized, companyValid } from './session-core.mjs';
const fail = (message,status=400) => Object.assign(new Error(message),{status});

async function bodyJson(request) {
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw fail('Envie JSON.',415);
    let size=0,parts=[];
    for await (const chunk of request) { size+=chunk.length; if(size>24000)throw fail('Solicitação muito grande.',413); parts.push(chunk); }
    try { const value=JSON.parse(Buffer.concat(parts).toString()); if(!value || Array.isArray(value) || typeof value!=='object')throw new Error(); return value; } catch { throw fail('JSON inválido.'); }
}
export function service({secret,sessions,store}) {
    if (typeof secret!=='string' || secret.length<32) throw new Error('BAILEYS_API_TOKEN precisa ter ao menos 32 caracteres.');
    const limits=new Map();
    return createServer(async(request,response) => {
        const reply=(value,status=200) => { response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}); response.end(JSON.stringify(value)); };
        try {
            if (!authorized(request.headers.authorization,secret)) return reply({error:'Acesso não autorizado.'},401);
            const url=new URL(request.url,'http://localhost');
            if (url.pathname==='/health' && request.method==='GET') return reply({provider:'baileys',ok:true,version:'1.0.0'});
            const match=url.pathname.match(/^\/v1\/companies\/([^/]+)\/(session|conversations|messages)$/);
            if (!match || !companyValid(match[1])) return reply({error:'Operação inválida.'},404);
            const [,company,action]=match;
            if (request.method==='GET') {
                if(action==='session')return reply(sessions.view(company));
                if(action==='conversations')return reply({conversations:store.conversations(company)});
                const phone=url.searchParams.get('phone'); if(!phoneValid(phone))throw fail('Telefone inválido.');
                return reply({messages:store.messages(company,phone)});
            }
            if (limits.size>10000) limits.clear();
            const current=limits.get(company) || {since:Date.now(),count:0};
            if(Date.now()-current.since>60000){current.since=Date.now();current.count=0;}
            limits.set(company,current); if(++current.count>30)throw fail('Aguarde antes de tentar novamente.',429);
            if(action==='session' && request.method==='DELETE')return reply(await sessions.disconnect(company));
            if(action==='session' && request.method==='POST')return reply(await sessions.connect(company));
            if(action==='messages' && request.method==='POST')return reply(await sessions.send(company,await bodyJson(request)));
            reply({error:'Método não permitido.'},405);
        } catch(error) { reply({error:error.status ? error.message : 'O serviço não confirmou a operação. Confira a conexão e o celular.'},error.status || 502); }
    });
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
    const filename=resolve(process.env.BAILEYS_DATABASE || './data/baileys.sqlite');
    mkdirSync(dirname(filename),{recursive:true,mode:0o700});
    const baileys=await import('@whiskeysockets/baileys'), qrCode=(await import('qrcode')).default;
    const codec={stringify:value=>JSON.stringify(value,baileys.BufferJSON.replacer),parse:text=>JSON.parse(text,baileys.BufferJSON.reviver)};
    const store=new Store(filename,process.env.BAILEYS_ENCRYPTION_KEY,codec), sessions=new Sessions(store,baileys,qrCode,Number(process.env.BAILEYS_MAX_SESSIONS || 20));
    const server=service({secret:process.env.BAILEYS_API_TOKEN,sessions,store});
    server.requestTimeout=30000; server.headersTimeout=15000;
    server.listen(Number(process.env.PORT || 3010),process.env.HOST || '127.0.0.1',()=>console.log('Fama Baileys iniciado.'));
    for(const company of store.enabled()) { try { await sessions.connect(company); } catch {} }
    const close=()=>{ sessions.stop(); server.close(()=>{store.close();process.exit(0);}); setTimeout(()=>process.exit(1),5000).unref(); };
    process.once('SIGTERM',close); process.once('SIGINT',close);
}
