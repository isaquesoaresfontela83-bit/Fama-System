import { createHash, timingSafeEqual } from 'node:crypto';
export const companyValid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const phoneValid = value => typeof value === 'string' && /^[1-9]\d{9,14}$/.test(value);
export function authorized(value, secret) {
    if (!secret || typeof value !== 'string' || !value.startsWith('Bearer ')) return false;
    const digest = text => createHash('sha256').update(text).digest();
    return timingSafeEqual(digest(value.slice(7)),digest(secret));
}
const logger = { level:'silent', child(){ return this; }, trace(){},debug(){},info(){},warn(){},error(){},fatal(){} };
const fail = (message,status=400) => Object.assign(new Error(message),{status});

export class Sessions {
    constructor(store, baileys, qrCode, maximum = 20) { this.store=store; this.baileys=baileys; this.qrCode=qrCode; this.maximum=maximum; this.items=new Map(); }
    view(company) {
        const item=this.items.get(company);
        return { provider:'baileys', status:item?.status || 'disconnected', phone:item?.phone || '',
            qr:item?.expiresAt > Date.now() ? item.qr : null, qrExpiresAt:item?.expiresAt > Date.now() ? item.expiresAt : null };
    }
    async connect(company,{reconnect=false}={}) {
        let item=this.items.get(company);
        if (item?.opening) { await item.opening; return this.view(company); }
        if (item && (reconnect || (item.status==='qr'&&item.expiresAt<=Date.now()) || (['connecting','reconnecting'].includes(item.status)&&Date.now()-(item.startedAt||Date.now())>60000))) {
            clearTimeout(item.timer);item.timer=null;item.generation=(item.generation||0)+1;
            const previous=item.socket;item.socket=null;item.qr=null;item.expiresAt=0;item.attempts=0;
            try { previous?.end(undefined); } catch {}
        }
        if (item?.socket || item?.timer) return this.view(company);
        if (!item && this.items.size>=this.maximum) throw fail('Limite de conexões do servidor atingido.',409);
        if (!item) { item={ status:'connecting', attempts:0 }; this.items.set(company,item); }
        item.stopped=false; item.status='connecting'; item.startedAt=Date.now(); this.store.enable(company,true);
        item.opening=this.open(company,item).catch(() => { item.status='error'; throw fail('Não foi possível abrir a conexão com o WhatsApp.',502); }).finally(() => { item.opening=null; });
        await item.opening; return this.view(company);
    }
    async open(company,item) {
        const generation=(item.generation||0)+1;item.generation=generation;
        const current=()=>item.generation===generation&&!item.stopped;
        const { initAuthCreds, proto, makeWASocket, default:defaultSocket }=this.baileys;
        const creds=this.store.getAuth(company,'creds') || initAuthCreds();
        const keys={
            get:async(type,ids) => Object.fromEntries(ids.map(id => {
                let value=this.store.getAuth(company,'key:'+type+':'+id);
                if (type==='app-state-sync-key' && value) value=proto.Message.AppStateSyncKeyData.fromObject(value);
                return [id,value];
            }).filter(([,value]) => value!==null)),
            set:async data => { if(!current())return; for (const [type,values] of Object.entries(data)) for (const [id,value] of Object.entries(values)) this.store.setAuth(company,'key:'+type+':'+id,value); },
        };
        const sock=(makeWASocket || defaultSocket)({ auth:{creds,keys}, logger, browser:['Fama System','Chrome','1.0.0'], markOnlineOnConnect:false, syncFullHistory:false,
            shouldSyncHistoryMessage:message=>{const types=proto.HistorySync?.HistorySyncType;return Boolean(types && [types.INITIAL_BOOTSTRAP,types.PUSH_NAME].includes(message.syncType));},
            getMessage:async()=>undefined, connectTimeoutMs:20000, defaultQueryTimeoutMs:20000 });
        item.socket=sock;
        const guarded=fn => (...args) => { void Promise.resolve().then(()=>fn(...args)).catch(() => { if (item.socket===sock) item.status='error'; }); };
        sock.ev.on('creds.update',guarded(update => { if (item.socket!==sock || item.stopped) return; Object.assign(creds,update); this.store.setAuth(company,'creds',creds); }));
        sock.ev.on('connection.update',guarded(async update => {
            if (item.socket!==sock || item.stopped) return;
            if (update.qr) {
                const qr=await this.qrCode.toDataURL(update.qr,{width:320,margin:2,errorCorrectionLevel:'M'});
                if (item.socket!==sock || item.stopped) return;
                item.qr=qr; item.expiresAt=Date.now()+55000; item.status='qr';
            }
            if (update.connection==='open') { item.status='connected'; item.qr=null; item.expiresAt=0; item.attempts=0; item.phone=String(sock.user?.id || '').split(':')[0].split('@')[0]; }
            if (update.connection==='close') {
                item.socket=null; item.qr=null; item.expiresAt=0;
                const code=update.lastDisconnect?.error?.output?.statusCode;
                if (code===this.baileys.DisconnectReason.loggedOut || code===this.baileys.DisconnectReason.badSession) {
                    item.status='disconnected'; item.stopped=true; item.phone=''; this.store.clearAuth(company); this.items.delete(company); return;
                }
                if (++item.attempts>8) { item.status='error'; return; }
                item.status='reconnecting';
                item.timer=setTimeout(() => { item.timer=null; if (!item.stopped) void this.connect(company).catch(()=>{}); },Math.min(30000,1000*2**Math.min(item.attempts,5)));
                item.timer.unref?.();
            }
        }));
        sock.ev.on('messages.upsert',guarded(event => {
            if (item.socket!==sock || item.stopped || event.type!=='notify') return;
            for (const message of event.messages || []) {
                // Ignore groups, broadcasts, status updates, and messages without an identified phone.
                const jid=String(message.key?.remoteJid || '');
                if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue;
                const phoneJid=jid.endsWith('@lid') ? String(message.key.remoteJidAlt || '') : jid;
                const phone=phoneJid.endsWith('@s.whatsapp.net') ? phoneJid.split('@')[0] : '';
                if (!phoneValid(phone) || !message.key?.id || !message.message) continue;
                const data=message.message.ephemeralMessage?.message || message.message;
                const text=data.conversation || data.extendedTextMessage?.text || (data.imageMessage ? '[Imagem recebida]' : data.audioMessage ? '[Áudio recebido]' : data.documentMessage ? '[Documento recebido]' : data.videoMessage ? '[Vídeo recebido]' : '');
                if (!text) continue;
                this.store.record(company,{id:message.key.id,phone,name:message.key.fromMe ? '' : String(message.pushName || '').slice(0,150),text:String(text).slice(0,4096),direction:message.key.fromMe ? 'out' : 'in',timestamp:Number(message.messageTimestamp)*1000 || Date.now()});
            }
        }));
    }
    async disconnect(company) {
        const item=this.items.get(company);
        if (item) {
            item.stopped=true; item.generation=(item.generation||0)+1; clearTimeout(item.timer);
            const sock=item.socket; item.socket=null; item.qr=null;
            try { if (sock) await Promise.race([sock.logout(),new Promise(resolve=>{ const timer=setTimeout(resolve,3000); timer.unref?.(); })]); } catch {}
            try { sock?.end(undefined); } catch {}
        }
        this.store.clearAuth(company); this.items.delete(company);
        return this.view(company);
    }
    async send(company,body) {
        if (!phoneValid(body.phone) || typeof body.text!=='string' || !body.text.trim() || body.text.length>4096 || !companyValid(body.clientId)) throw fail('Informe telefone, mensagem e identificador válidos.');
        const item=this.items.get(company);
        if (item?.status!=='connected' || !item.socket) throw fail('Conecte o WhatsApp antes de enviar.',409);
        const text=body.text.trim(), fingerprint=createHash('sha256').update(JSON.stringify([body.phone,text])).digest('hex');
        const reservation=this.store.reserve(company,body.clientId,fingerprint);
        if (!reservation.created) {
            if (reservation.fingerprint!==fingerprint) throw fail('O identificador já foi usado em outra mensagem.',409);
            if (reservation.status!=='sent') throw fail('Envio sem confirmação. Confira a conversa no celular antes de enviar novamente.',409);
            return { id:reservation.id,status:'sent',duplicate:true };
        }
        const sent=await item.socket.sendMessage(body.phone+'@s.whatsapp.net',{text});
        if (!sent?.key?.id) throw fail('O WhatsApp não confirmou o envio. Confira no celular.',502);
        const result={id:sent.key.id,status:'sent'};
        this.store.record(company,{...result,phone:body.phone,text,direction:'out',timestamp:Date.now()});
        this.store.finish(company,body.clientId,result); return result;
    }
    stop() { for (const item of this.items.values()) { item.stopped=true; item.generation=(item.generation||0)+1; clearTimeout(item.timer); try { item.socket?.end(undefined); } catch {} } }
}

