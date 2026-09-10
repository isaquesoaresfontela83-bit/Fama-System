'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Org = { id:string; name:string; slug?:string; status:string; deleted_at?:string|null };
type Member = { id:string; organization_id:string; user_id?:string; user_email:string; display_name?:string; role:string; status:string; permissions?:string[] };
type Bootstrap = { organizations:Org[]; members:Member[]; modules:string[]; health?:Record<string,any>; auth_users?:any[] };

type Props = {
  currentUser: { id:string; email:string; displayName:string };
  signOutPath: string;
};

const SUPA='https://mupnsdqahoybhmkpufmx.supabase.co';
const KEY='sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_';
const API=SUPA+'/functions/v1/fama-control';
const labels:Record<string,string>={dashboard:'Visão geral',crm:'CRM',quotes:'Orçamentos',agenda:'Agenda',orders:'Ordens de serviço',warranties:'Garantias',customers:'Clientes e piscinas',contracts:'Contratos',inventory:'Estoque',finance:'Financeiro',team:'Equipe'};
const tabs=[['overview','Visão geral'],['companies','Empresas'],['users','Usuários'],['audit','Auditoria'],['backup','Backup & Lixeira'],['security','Segurança'],['privacy','Privacidade']] as const;

function Card({children,className=''}:{children:React.ReactNode;className?:string}){
  return <div className={'rounded-2xl border border-[#2a507c] bg-[#0d284c] shadow-xl '+className}>{children}</div>;
}
function Button({children,onClick,kind='default',disabled=false}:{children:React.ReactNode;onClick?:()=>void|Promise<void>;kind?:'default'|'primary'|'danger'|'warn';disabled?:boolean}){
  const k=kind==='primary'?'border-transparent bg-gradient-to-r from-[#29a5ef] to-[#1685d6] text-white':kind==='danger'?'border-[#7d3a49] bg-[#3d1824] text-[#ffdce0]':kind==='warn'?'border-[#7e622b] bg-[#3b2c12] text-[#ffe3a8]':'border-[#2a507c] bg-[#0e3159] text-[#edf7ff]';
  return <button disabled={disabled} onClick={()=>void onClick?.()} className={'rounded-xl border px-3 py-2 text-sm font-extrabold disabled:opacity-50 '+k}>{children}</button>;
}

export function FamaControlApp({currentUser,signOutPath}:Props){
  const tokenRef=useRef('');
  const [active,setActive]=useState<(typeof tabs)[number][0]>('overview');
  const [data,setData]=useState<Bootstrap>({organizations:[],members:[],modules:Object.keys(labels),health:{},auth_users:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const [audit,setAudit]=useState<any[]>([]);
  const [backups,setBackups]=useState<any[]>([]);
  const [trash,setTrash]=useState<{organizations:any[];snapshots:any[]}>({organizations:[],snapshots:[]});
  const [limits,setLimits]=useState<any[]>([]);
  const [privacy,setPrivacy]=useState<any[]>([]);

  const getSession=useCallback(async()=>{
    const r=await fetch('/api/fama-control/chatgpt-session',{method:'POST',credentials:'same-origin',cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(r.status===401){window.location.assign('/signin-with-chatgpt?return_to=%2F');throw new Error('Entrando com ChatGPT...')}
    if(!r.ok||!j.access_token)throw new Error(j.message||'Não foi possível iniciar a sessão administrativa.');
    tokenRef.current=j.access_token;
    return j.access_token as string;
  },[]);

  const call=useCallback(async(action:string,payload:Record<string,unknown>={},retry=true):Promise<any>=>{
    let token=tokenRef.current;
    if(!token)token=await getSession();
    let r=await fetch(API,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+token,'x-access-token':token},body:JSON.stringify({action,...payload,access_token:token})});
    let j=await r.json().catch(()=>({}));
    if(r.status===401&&retry){token=await getSession();r=await fetch(API,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+token,'x-access-token':token},body:JSON.stringify({action,...payload,access_token:token})});j=await r.json().catch(()=>({}));}
    if(!r.ok||!(j.ok||j.success||j.authorized))throw new Error(j.message||`Falha no Fama Control (${r.status}).`);
    return j.data??j;
  },[getSession]);

  const bootstrap=useCallback(async()=>{
    const d=await call('bootstrap');
    setData({organizations:d.organizations||[],members:d.members||[],modules:d.modules||Object.keys(labels),health:d.health||{},auth_users:d.auth_users||[]});
  },[call]);

  useEffect(()=>{(async()=>{try{setLoading(true);await getSession();await bootstrap()}catch(e:any){setError(e?.message||'Falha ao abrir o Fama Control.')}finally{setLoading(false)}})()},[getSession,bootstrap]);

  async function run(key:string,fn:()=>Promise<void>){try{setBusy(key);setError('');await fn()}catch(e:any){setError(e?.message||'Falha na operação.')}finally{setBusy('')}}
  const orgName=(id:string)=>data.organizations.find(o=>o.id===id)?.name||'—';

  async function openTab(tab:(typeof tabs)[number][0]){
    setActive(tab);
    if(tab==='audit'&&!audit.length)await run('audit',async()=>setAudit(await call('audit_list',{limit:250})));
    if(tab==='backup')await run('backup',async()=>{const [b,t]=await Promise.all([call('backup_list'),call('trash_list')]);setBackups(b||[]);setTrash(t||{organizations:[],snapshots:[]})});
    if(tab==='security')await run('security',async()=>{const [h,l]=await Promise.all([call('health'),call('limits_list')]);setData(v=>({...v,health:h.health||v.health,auth_users:h.auth_users||v.auth_users}));setLimits(l||[])});
    if(tab==='privacy')await run('privacy',async()=>setPrivacy(await call('privacy_list')));
  }

  async function createCompany(){
    const name=window.prompt('Nome da nova empresa:')?.trim(); if(!name)return;
    await run('createCompany',async()=>{await call('create_org',{name});await bootstrap()});
  }
  async function createUser(){
    const activeOrgs=data.organizations.filter(o=>o.status==='active'&&!o.deleted_at);if(!activeOrgs.length)return;
    const display_name=window.prompt('Nome do usuário:')?.trim();if(!display_name)return;
    const email=window.prompt('E-mail do usuário:')?.trim();if(!email)return;
    const password=window.prompt('Senha temporária (mínimo 8 caracteres):')||'';if(password.length<8)return;
    const organization_id=activeOrgs.length===1?activeOrgs[0].id:(window.prompt('ID da empresa:\n'+activeOrgs.map(o=>`${o.name}: ${o.id}`).join('\n'))||'');if(!organization_id)return;
    const role=(window.prompt('Perfil: admin, member ou technician','member')||'member').trim();
    await run('createUser',async()=>{await call('create_user',{display_name,email,password,organization_id,role,permissions:data.modules});await bootstrap()});
  }
  async function updateOrg(org:Org,status:string){await run('org:'+org.id,async()=>{await call('update_org',{id:org.id,status});await bootstrap()})}
  async function trashOrg(org:Org){if(!confirm(`Enviar ${org.name} para a lixeira?`))return;await run('org:'+org.id,async()=>{await call('trash_org',{id:org.id});await bootstrap()})}
  async function restoreOrg(id:string){await run('restore:'+id,async()=>{await call('restore_org',{id});await bootstrap();setTrash(await call('trash_list'))})}
  function patchMember(id:string,patch:Partial<Member>){setData(v=>({...v,members:v.members.map(m=>m.id===id?{...m,...patch}:m)}))}
  async function saveMember(m:Member){await run('member:'+m.id,async()=>{await call('update_member',{id:m.id,display_name:m.display_name,role:m.role,status:m.status,permissions:m.permissions||[]});await bootstrap()})}
  async function deleteMember(m:Member){if(!confirm(`Remover ${m.display_name||m.user_email} da empresa?`))return;await run('member:'+m.id,async()=>{await call('delete_member',{id:m.id});await bootstrap()})}
  async function setPassword(m:Member){const p=window.prompt(`Nova senha para ${m.user_email} (mínimo 8 caracteres):`)||'';if(p.length<8)return;await run('pw:'+m.id,async()=>{const au=data.auth_users?.find((u:any)=>u.id===m.user_id)||data.auth_users?.find((u:any)=>String(u.email).toLowerCase()===m.user_email.toLowerCase());if(!au?.id)throw new Error('Conta Auth não localizada.');await call('set_user_password',{user_id:au.id,password:p})})}
  async function makeBackup(scope:'global'|'organization',organization_id?:string){await run('makeBackup',async()=>{await call('backup_create',{scope,organization_id,label:scope==='global'?'Backup global':'Backup '+orgName(organization_id||'')});setBackups(await call('backup_list'))})}
  async function exportLive(){await run('export',async()=>{const d=await call('export_live');const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fama-control-export.json';a.click();URL.revokeObjectURL(a.href)})}

  if(loading)return <main className="min-h-screen bg-[#061426] text-white"><div className="mx-auto max-w-6xl p-8">Carregando Fama Control…</div></main>;
  if(error&&data.organizations.length===0)return <main className="min-h-screen bg-[#061426] text-white"><div className="mx-auto max-w-3xl p-8"><Card className="p-8"><h1 className="text-3xl font-bold">Fama Control</h1><p className="mt-4 text-[#ff9aa4]">{error}</p><div className="mt-6"><Button kind="primary" onClick={()=>location.reload()}>Tentar novamente</Button></div></Card></div></main>;

  const activeOrgs=data.organizations.filter(o=>o.status==='active'&&!o.deleted_at);
  const suspended=data.organizations.filter(o=>o.status==='suspended').length;
  const deleted=data.organizations.filter(o=>o.status==='deleted'||o.deleted_at).length;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0,#06405d_0,transparent_27%),linear-gradient(180deg,#071a2d,#041020)] text-[#edf7ff]">
    <div className="mx-auto max-w-[1220px] px-3 py-5 sm:px-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="h-14 w-14 overflow-hidden rounded-2xl bg-white p-1 shadow-xl"><img src="/fama-piscinas-mark.png" alt="Fama" className="h-full w-full object-contain"/></div><div><div className="text-xs font-black tracking-[.14em] text-[#74def5]">FAMA SYSTEM</div><div className="text-2xl font-bold">Fama Control</div><div className="text-xs text-[#b8cadb]">{currentUser.email}</div></div></div>
        <a href={signOutPath} target="_top" className="rounded-xl border border-[#2a507c] bg-[#0e3159] px-4 py-2 text-sm font-extrabold">Sair</a>
      </header>

      <nav className="sticky top-0 z-20 mb-4 flex gap-2 overflow-x-auto bg-[#071b31]/95 py-2 backdrop-blur">
        {tabs.map(([id,name])=><button key={id} onClick={()=>void openTab(id)} className={'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-extrabold '+(active===id?'border-transparent bg-gradient-to-r from-[#2199e8] to-[#177fc8] text-white':'border-[#2a507c] bg-[#0c2b50] text-[#b8cadb]')}>{name}</button>)}
      </nav>

      {error&&<div className="mb-4 rounded-xl border border-[#81414d] bg-[#3d1824] px-4 py-3 text-sm text-[#ffc4ca]">{error}<button className="ml-3 underline" onClick={()=>setError('')}>fechar</button></div>}

      {active==='overview'&&<section>
        <div className="mb-4"><h1 className="text-3xl font-bold">Visão geral</h1><p className="text-sm text-[#b8cadb]">Saúde administrativa de todo o Fama System.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['EMPRESAS ATIVAS',activeOrgs.length,`${suspended} suspensa(s) · ${deleted} na lixeira`],['USUÁRIOS',data.members.length,'vínculos cadastrados'],['BACKEND','ONLINE','Supabase + Fama Control'],['ACESSO','CHATGPT','login nativo do Site']].map((x,i)=><Card key={i} className="p-4"><span className="text-xs font-black tracking-wider text-[#b8cadb]">{x[0]}</span><strong className="mt-1 block text-3xl">{x[1]}</strong><em className="mt-1 block text-xs not-italic text-[#b8cadb]">{x[2]}</em></Card>)}
        </div>
        <Card className="mt-4 p-5"><h2 className="text-xl font-bold">Ações rápidas</h2><div className="mt-4 flex flex-wrap gap-2"><Button kind="primary" onClick={createCompany}>+ Nova empresa</Button><Button onClick={createUser}>+ Novo usuário</Button><Button onClick={()=>makeBackup('global')}>Criar backup global</Button><Button onClick={()=>openTab('audit')}>Abrir auditoria</Button></div></Card>
      </section>}

      {active==='companies'&&<section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Empresas</h1><p className="text-sm text-[#b8cadb]">Suspender, reativar e recuperar empresas.</p></div><Button kind="primary" onClick={createCompany}>+ Nova empresa</Button></div>
        <div className="space-y-3">{data.organizations.filter(o=>o.status!=='deleted'&&!o.deleted_at).map(o=><Card key={o.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{o.name}</h3><div className="text-xs text-[#b8cadb]">{o.slug}</div></div><span className="rounded-full border border-[#2a507c] px-3 py-1 text-xs font-black">{o.status.toUpperCase()}</span></div><div className="mt-4 flex flex-wrap gap-2">{o.status==='active'?<Button kind="warn" onClick={()=>updateOrg(o,'suspended')}>Suspender</Button>:<Button kind="primary" onClick={()=>updateOrg(o,'active')}>Reativar</Button>}<Button kind="danger" onClick={()=>trashOrg(o)}>Enviar para lixeira</Button></div></Card>)}</div>
      </section>}

      {active==='users'&&<section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Usuários globais</h1><p className="text-sm text-[#b8cadb]">Perfil, status e permissões individuais por módulo.</p></div><Button kind="primary" onClick={createUser}>+ Novo usuário</Button></div>
        <div className="space-y-3">{data.members.map(m=>{const owner=m.role==='owner';const perms=Array.isArray(m.permissions)?m.permissions:[];return <Card key={m.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{m.display_name||m.user_email}</h3><div className="text-xs text-[#b8cadb]">{m.user_email} · {orgName(m.organization_id)}</div></div><div className="flex gap-2"><select disabled={owner} value={m.role} onChange={e=>patchMember(m.id,{role:e.target.value})} className="rounded-xl border border-[#355f8b] bg-[#12335d] px-2 py-2 text-sm"><option value="admin">Administrador</option><option value="member">Usuário</option><option value="technician">Técnico</option><option value="owner">Proprietário</option></select><select disabled={owner} value={m.status} onChange={e=>patchMember(m.id,{status:e.target.value})} className="rounded-xl border border-[#355f8b] bg-[#12335d] px-2 py-2 text-sm"><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="invited">Convidado</option></select></div></div>
          <div className="mt-4 flex flex-wrap gap-2">{data.modules.map(k=>{const checked=owner||perms.includes(k);return <label key={k} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#315b86] bg-[#0e2d53] px-3 py-2 text-xs"><input type="checkbox" disabled={owner} checked={checked} onChange={e=>{const next=e.target.checked?[...new Set([...perms,k])]:perms.filter(p=>p!==k);patchMember(m.id,{permissions:next})}}/>{labels[k]||k}</label>})}</div>
          <div className="mt-4 flex flex-wrap gap-2">{owner?<span className="rounded-full border border-[#2d7756] px-3 py-2 text-xs font-black text-[#b7f5d5]">Proprietário: acesso total</span>:<><Button kind="primary" disabled={busy==='member:'+m.id} onClick={()=>saveMember(m)}>Salvar acessos</Button><Button onClick={()=>setPassword(m)}>Alterar senha</Button><Button kind="danger" onClick={()=>deleteMember(m)}>Remover vínculo</Button></>}</div>
        </Card>})}</div>
      </section>}

      {active==='audit'&&<section><div className="mb-4 flex items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Auditoria</h1><p className="text-sm text-[#b8cadb]">Eventos recentes do sistema.</p></div><Button onClick={()=>run('audit',async()=>setAudit(await call('audit_list',{limit:250})))}>↻ Atualizar</Button></div><Card className="overflow-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-[#0c284b] text-[#74def5]"><tr><th className="p-3">Data</th><th className="p-3">Evento</th><th className="p-3">Entidade</th><th className="p-3">Empresa</th><th className="p-3">Usuário</th></tr></thead><tbody>{audit.map(a=><tr key={a.id} className="border-t border-[#2a507c]"><td className="p-3">{a.occurred_at?new Date(a.occurred_at).toLocaleString('pt-BR'):'—'}</td><td className="p-3">{a.event_type}</td><td className="p-3">{a.entity_type}</td><td className="p-3">{orgName(a.organization_id)}</td><td className="p-3 break-all">{a.actor_user_id||'—'}</td></tr>)}</tbody></table></Card></section>}

      {active==='backup'&&<section><div className="mb-4"><h1 className="text-3xl font-bold">Backup & Lixeira</h1><p className="text-sm text-[#b8cadb]">Backups administrativos e recuperação.</p></div><div className="mb-4 flex flex-wrap gap-2"><Button kind="primary" onClick={()=>makeBackup('global')}>Criar backup global</Button>{activeOrgs[0]&&<Button onClick={()=>makeBackup('organization',activeOrgs[0].id)}>Backup de {activeOrgs[0].name}</Button>}<Button onClick={exportLive}>Exportar JSON atual</Button></div><div className="grid gap-4 lg:grid-cols-2"><Card className="p-5"><h2 className="text-xl font-bold">Backups</h2><div className="mt-3 space-y-2">{backups.length?backups.map(b=><div key={b.id} className="rounded-xl border border-[#2a507c] bg-[#0a2142] p-3"><b>{b.label||b.id}</b><div className="text-xs text-[#b8cadb]">{b.scope} · {b.created_at?new Date(b.created_at).toLocaleString('pt-BR'):''}</div></div>):<p className="text-sm text-[#b8cadb]">Nenhum backup armazenado.</p>}</div></Card><Card className="p-5"><h2 className="text-xl font-bold">Lixeira</h2><div className="mt-3 space-y-2">{trash.organizations?.map(o=><div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#2a507c] bg-[#0a2142] p-3"><div><b>{o.name}</b><div className="text-xs text-[#b8cadb]">Empresa excluída</div></div><Button kind="primary" onClick={()=>restoreOrg(o.id)}>Restaurar</Button></div>)}{trash.snapshots?.map(s=><div key={s.id} className="rounded-xl border border-[#2a507c] bg-[#0a2142] p-3"><b>{s.entity_type}</b><div className="text-xs text-[#b8cadb]">Registro {s.record_id}</div><div className="mt-2"><Button onClick={()=>run('snap:'+s.id,async()=>{await call('restore_snapshot',{id:s.id});setTrash(await call('trash_list'))})}>Restaurar registro</Button></div></div>)}</div></Card></div></section>}

      {active==='security'&&<section><div className="mb-4"><h1 className="text-3xl font-bold">Segurança & Sistema</h1><p className="text-sm text-[#b8cadb]">Saúde do backend, Auth e limites de uso.</p></div><div className="grid gap-4 lg:grid-cols-2"><Card className="p-5"><h2 className="text-xl font-bold">Saúde técnica</h2><pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-[#b8cadb]">{JSON.stringify(data.health||{},null,2)}</pre></Card><Card className="p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Limites</h2><Button kind="warn" onClick={()=>run('limits',async()=>{await call('clear_limits');setLimits(await call('limits_list'))})}>Limpar limites</Button></div><div className="mt-3 space-y-2">{limits.map((l,i)=><div key={i} className="rounded-xl border border-[#2a507c] bg-[#0a2142] p-3 text-xs"><b>{l.action}</b> · {l.request_count} requisições</div>)}</div></Card></div></section>}

      {active==='privacy'&&<section><div className="mb-4 flex items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Privacidade / LGPD</h1><p className="text-sm text-[#b8cadb]">Solicitações administrativas.</p></div><Button onClick={()=>run('privacy',async()=>setPrivacy(await call('privacy_list')))}>↻ Atualizar</Button></div><div className="space-y-3">{privacy.length?privacy.map(p=><Card key={p.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{p.request_type}</h3><div className="text-xs text-[#b8cadb]">{p.created_at?new Date(p.created_at).toLocaleString('pt-BR'):''}</div></div><span className="text-xs font-black">{p.status}</span></div><p className="mt-3 text-sm text-[#b8cadb]">{p.details||'Sem detalhes.'}</p></Card>):<Card className="p-5 text-sm text-[#b8cadb]">Nenhuma solicitação LGPD.</Card>}</div></section>}
    </div>
  </main>;
}
