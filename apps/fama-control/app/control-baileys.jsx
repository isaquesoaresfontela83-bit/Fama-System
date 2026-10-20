'use client';
import {useEffect,useRef,useState} from 'react';
import {MessageCircle,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {requestJson} from '@/lib/client-request';
export function ControlBaileys(){
    const [data,setData]=useState(null),[url,setUrl]=useState(''),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
    const lock=useRef(false),mounted=useRef(false);
    useEffect(()=>{const abort=new AbortController();mounted.current=true;requestJson('/api/admin/baileys',{signal:abort.signal,cache:'no-store'}).then(value=>{if(!abort.signal.aborted){setData(value);setUrl(value.url);}}).catch(cause=>{if(!abort.signal.aborted)setError(cause.message);});return()=>{mounted.current=false;abort.abort();};},[]);
    async function save(action){
        if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');
        try{
            const value=await requestJson('/api/admin/baileys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(action==='save'?{url,token}:{})})},55000);
            if(mounted.current){setData(value);setMessage(action==='save'?'Servidor validado e configuração salva. O QR pode ser aberto no Fama System.':'Servidor Baileys respondeu corretamente.');}
        }catch(cause){if(mounted.current)setError(cause.message);}
        finally{lock.current=false;if(mounted.current){setBusy(false);setToken('');}}
    }
    return <section className="control-integration-card" aria-label="Configuração do WhatsApp Baileys"><div className="control-panel-heading"><h3><MessageCircle/>WhatsApp Baileys</h3><Button variant="outline" disabled={busy || !data?.configured} onClick={()=>void save('check')}><RefreshCw/>Testar servidor</Button></div><p>Configure o servidor que mantém as sessões WhatsApp das empresas. Cada empresa conecta seu número pelo QR no Fama System.</p><p role="status">{data ? data.configured?'Servidor cadastrado':'Servidor ainda não configurado':'Conferindo configuração…'}</p>{error && <p className="control-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}<details><summary>{data?.configured?'Alterar servidor':'Configurar servidor WhatsApp'}</summary><form onSubmit={event=>{event.preventDefault();void save('save');}} className="control-baileys-form"><label>URL HTTPS do servidor<Input required type="url" value={url} maxLength={253} placeholder="https://whatsapp.suaempresa.com.br" disabled={busy} onChange={event=>setUrl(event.target.value)}/></label><label>Token do servidor{data?.configured?' — vazio para manter no mesmo endereço':''}<Input type="password" autoComplete="new-password" value={token} maxLength={512} required={!data?.configured || url!==data?.url} disabled={busy} onChange={event=>setToken(event.target.value)}/></label><Button type="submit" disabled={busy || !url || (!token && (!data?.configured || url!==data?.url))}>{busy?'Validando…':'Validar e salvar'}</Button></form></details><p className="control-muted">O serviço precisa de Node.js e armazenamento persistente. O token fica criptografado no backend. A integração Baileys é independente da API oficial da Meta.</p></section>;
}
