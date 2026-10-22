import { useEffect, useState } from 'react';
export function ServiceNotice() {
 const [state,setState]=useState('ready');
 useEffect(()=>{const update=event=>setState(event.detail);window.addEventListener('fama-service-state',update);return()=>window.removeEventListener('fama-service-state',update);},[]);
 if(state==='ready')return null;
 return <aside role="status" style={{position:'fixed',bottom:16,left:16,right:16,zIndex:10000,padding:16,borderRadius:12,background:'#12253c',color:'#fff',boxShadow:'0 4px 24px #0005'}}>{state==='waiting'?'Sua solicitação está aguardando o servidor. Após um período sem uso, ele pode levar cerca de um minuto para iniciar.':'A conexão com o servidor falhou. Confira sua internet e tente novamente.'}</aside>;
}
export function Loading({error,onRetry}) {return <section className="surface" role={error?'alert':'status'} style={{padding:24,margin:24}}><h2>{error?'Não foi possível conectar':'Verificando seu acesso…'}</h2><p>{error || 'As informações da sua conta serão carregadas pelo serviço seguro.'}</p>{error&&<button className="button" onClick={onRetry}>Tentar novamente</button>}</section>;}
