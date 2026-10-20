'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, QrCode, RefreshCw, Send, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestJson } from '@/lib/client-request';
import './baileys-panel.css';

const states={not_configured:'Servidor pendente',disconnected:'Desconectado',connecting:'Conectando…',qr:'Aguardando leitura do QR code',connected:'Conectado',reconnecting:'Reconectando…',error:'Conexão interrompida'};
const stamp=value=>new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
export function BaileysPanel({organizationId,canManage=false}) {
    const [session,setSession]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[refresh,setRefresh]=useState(0);
    const [conversations,setConversations]=useState([]),[messages,setMessages]=useState([]),[selected,setSelected]=useState(''),[phone,setPhone]=useState(''),[text,setText]=useState(''),[notice,setNotice]=useState('');
    const mounted=useRef(false),version=useRef(0),sending=useRef(false),draft=useRef(null),mutation=useRef(false),polling=useRef(false);
    const headers={'x-organization-id':organizationId};
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;version.current++;};},[]);
    useEffect(()=>{
        const abort=new AbortController();let timer;
        async function load(){
            if(mutation.current || polling.current)return;
            polling.current=true;const seq=version.current;
            const valid=()=>!abort.signal.aborted && mounted.current && version.current===seq;
            try {
                const status=await requestJson('/api/whatsapp/baileys',{headers,signal:abort.signal,cache:'no-store'});
                if(!valid())return;setSession(status);setError('');
                if(status.status==='connected') {
                    const inbox=await requestJson('/api/whatsapp/baileys?action=conversations',{headers,signal:abort.signal,cache:'no-store'});
                    if(!valid())return;setConversations(inbox.conversations || []);
                    if(selected){const page=await requestJson('/api/whatsapp/baileys?action=messages&phone='+encodeURIComponent(selected),{headers,signal:abort.signal,cache:'no-store'});if(valid())setMessages(page.messages || []);}
                }else if(valid()){setMessages([]);setConversations([]);}
            }catch(cause){if(valid())setError(cause.message);}
            finally{polling.current=false;}
        }
        async function tick(){await load();if(!abort.signal.aborted)timer=setTimeout(tick,5000);}
        void tick();return()=>{abort.abort();clearTimeout(timer);};
    },[organizationId,selected,refresh]);
    async function act(action){
        if(mutation.current)return;mutation.current=true;const seq=++version.current;
        setBusy(action);setError('');setNotice('');
        try {
            const value=await requestJson('/api/whatsapp/baileys',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action})},30000);
            if(mounted.current && version.current===seq){setSession(value);if(action==='disconnect'){setMessages([]);setConversations([]);}setRefresh(value=>value+1);}
        }catch(cause){if(mounted.current && version.current===seq)setError(cause.message);}
        finally{mutation.current=false;if(mounted.current)setBusy('');}
    }
    async function send(event){
        event.preventDefault();if(sending.current || mutation.current)return;
        const target=selected || phone,body=text.trim();if(!target || !body)return;
        sending.current=true;mutation.current=true;const seq=++version.current;setBusy('send');setError('');setNotice('');
        const signature=JSON.stringify([target,body]);
        if(draft.current?.signature!==signature)draft.current={signature,id:crypto.randomUUID()};
        try{
            await requestJson('/api/whatsapp/baileys',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'send',phone:target,text:body,clientId:draft.current.id})},30000);
            if(mounted.current && version.current===seq){setText('');draft.current=null;setNotice('Mensagem enviada ao WhatsApp.');setRefresh(value=>value+1);}
        }catch(cause){if(mounted.current && version.current===seq)setError(cause.message);}
        finally{sending.current=false;mutation.current=false;if(mounted.current)setBusy('');}
    }
    const manage=canManage && session?.canManage!==false,connected=session?.status==='connected';
    const qr=session?.qr && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(session.qr) && session.qrExpiresAt>Date.now() ? session.qr : null;
    return <section className="surface settings-section baileys-panel" aria-label="WhatsApp Baileys">
        <div className="panel-heading"><div><small>WHATSAPP DA EMPRESA</small><h2><MessageCircle aria-hidden="true"/>WhatsApp · Baileys</h2></div><Button variant="outline" disabled={Boolean(busy)} onClick={()=>setRefresh(value=>value+1)}><RefreshCw/>Atualizar</Button></div>
        <p>Conecte o WhatsApp por QR code e atenda as conversas individuais da empresa aqui.</p>
        <p className={'baileys-status '+(connected?'connected':'')} role="status">{session ? states[session.status] || 'Conferindo conexão' : 'Conferindo conexão…'}{session?.phone ? ' · +'+session.phone : ''}</p>
        <small>Baileys é uma integração independente para WhatsApp Web.</small>
        {error && <p role="alert" className="baileys-error">{error}</p>}{notice && <p role="status">{notice}</p>}
        {session?.configured===false && <p>O servidor WhatsApp precisa ser configurado no Fama Control → Integrações → WhatsApp Baileys.</p>}
        {manage && session?.configured!==false && <div className="baileys-actions"><Button disabled={Boolean(busy) || !session || ['connected','connecting','reconnecting','qr'].includes(session?.status)} onClick={()=>void act('connect')}><QrCode/>{busy==='connect'?'Conectando…':'Conectar WhatsApp'}</Button>{session && !['disconnected','not_configured'].includes(session.status) && <Button variant="outline" disabled={Boolean(busy)} onClick={()=>void act('disconnect')}><Unplug/>{busy==='disconnect'?'Desconectando…':'Desconectar'}</Button>}</div>}
        {manage && qr && <div className="baileys-qr"><img src={qr} width="320" height="320" alt="QR code para conectar o WhatsApp desta empresa"/><div><strong>Escaneie com o WhatsApp do celular</strong><p>Abra Aparelhos conectados → Conectar aparelho. Aguarde o status Conectado.</p><small>O código é temporário e será atualizado automaticamente.</small></div></div>}
        {connected && <div className="baileys-inbox"><aside aria-label="Conversas do WhatsApp"><Button variant="outline" onClick={()=>{version.current++;setSelected('');setPhone('');setMessages([]);setText('');setNotice('');}}>Nova conversa</Button>{conversations.map(item=><button type="button" className={selected===item.phone?'selected':''} key={item.phone} onClick={()=>{version.current++;setSelected(item.phone);setMessages([]);setText('');setNotice('');}}><strong>{item.name || '+'+item.phone}</strong><span>{item.preview}</span></button>)}{!conversations.length && <p>As mensagens recebidas após a conexão aparecerão aqui.</p>}</aside><div className="baileys-conversation"><h3>{selected ? '+'+selected : 'Nova conversa'}</h3><div className="baileys-messages" aria-label="Mensagens do WhatsApp">{messages.map(item=><article className={item.direction==='out'?'outgoing':''} key={item.id}><p>{item.text}</p><small>{stamp(item.timestamp)}</small></article>)}</div><form onSubmit={send}>{!selected && <label>Telefone com DDD<Input required value={phone} maxLength={30} onChange={event=>setPhone(event.target.value)} placeholder="(61) 99999-9999" disabled={Boolean(busy)}/></label>}<label>Mensagem<textarea required rows="3" value={text} maxLength={4096} onChange={event=>setText(event.target.value)} disabled={Boolean(busy)}/></label><Button type="submit" disabled={Boolean(busy) || !text.trim() || (!selected && !phone.trim())}><Send/>{busy==='send'?'Enviando…':'Enviar mensagem'}</Button></form></div></div>}
    </section>;
}
