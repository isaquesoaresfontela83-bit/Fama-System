import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getIntegrationStatus } from "./integration-status.js";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const ALLOWED=new Set(["https://control.famasystem.online","https://fama-control-ztzau5.v2.appdeploy.ai","https://fama-control.isaquesoaresfontela8.chatgpt.site"]);
function cors(req:Request){const o=req.headers.get("origin")??"";return{"Access-Control-Allow-Origin":ALLOWED.has(o)?o:"https://control.famasystem.online","Vary":"Origin","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400"}}
const RECORD_TABLES=["leads","quotes","appointments","work_orders","customers","inventory_items","transactions","employees","warranties","contracts","attachments"];
const BACKUP_TABLES=["organizations","organization_members","leads","quotes","appointments","work_orders","customers","inventory_items","transactions","employees","warranties","contracts","attachments","legal_consents","privacy_requests","recovery_snapshots","protected_records"];
function out(req:Request,s:number,b:unknown){return new Response(JSON.stringify(b),{status:s,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}})}
async function sf(path:string,init:RequestInit={}){const h=new Headers(init.headers??{});h.set("apikey",SERVICE);h.set("Authorization","Bearer "+SERVICE);if(init.body&&!h.has("Content-Type"))h.set("Content-Type","application/json");return fetch(SUPABASE_URL+path,{...init,headers:h})}
async function sj(path:string,init:RequestInit={}){const r=await sf(path,init);let j:any=null;try{j=await r.json()}catch{}if(!r.ok)throw new Error(j?.message||j?.msg||j?.error||`HTTP_${r.status}`);return j}
async function select(table:string,q="select=*"){return sj(`/rest/v1/${table}?${q}`)}async function rpc(name:string,body:any={}){return sj(`/rest/v1/rpc/${name}`,{method:"POST",body:JSON.stringify(body)})}
async function authorize(req:Request){const origin=req.headers.get("origin")??"";if(origin&&!ALLOWED.has(origin))return null;const a=req.headers.get("authorization")??"";if(!a.toLowerCase().startsWith("bearer "))return null;const ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{Authorization:a,apikey:SERVICE}});if(!ur.ok)return null;const u=await ur.json();if(!u?.id||!u?.email)return null;const rows=await select("fama_control_admins",`select=user_id,email,enabled&user_id=eq.${encodeURIComponent(String(u.id))}&enabled=eq.true&limit=1`);const ad=Array.isArray(rows)?rows[0]:null;if(!ad||String(ad.email).toLowerCase()!==String(u.email).toLowerCase())return null;return{id:String(u.id),email:String(u.email)}}
async function audit(a:any,event_type:string,entity_type:string,record_id:string,metadata:any={},organization_id:string|null=null){try{await sf("/rest/v1/audit_logs",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({organization_id,actor_user_id:a.id,event_type,entity_type,record_id,metadata})})}catch{}}
async function sha(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}async function rate(a:any,action:string,max=30,seconds=60){const key=await sha(a.id+":"+action);const ok=await rpc("fama_consume_rate_limit",{p_key_hash:key,p_action:"control_"+action,p_limit:max,p_window_seconds:seconds});if(ok!==true)throw new Error("Muitas ações em pouco tempo. Aguarde e tente novamente.")}
async function checksum(payload:any){return rpc("fama_jsonb_sha256",{p_payload:payload})}async function authDirectory(){return rpc("fama_control_auth_directory")}async function health(){return rpc("fama_control_health")}
async function collectBackup(scope:string,orgId:string|null){const data:any={};for(const t of BACKUP_TABLES){let q="select=*";if(scope==="organization"&&orgId){if(t==="organizations")q+=`&id=eq.${encodeURIComponent(orgId)}`;else if(t==="legal_consents"){data[t]=[];continue}else q+=`&organization_id=eq.${encodeURIComponent(orgId)}`}data[t]=await select(t,q)}return{format:"fama-control-backup",version:"15.0",created_at:new Date().toISOString(),scope,organization_id:orgId,data}}

const IPINFO_CACHE=new Map<string,{expires_at:number,data:any}>();
function isIpAddress(ip:string){
if(!ip||ip.length>45)return false;
if(ip.includes(":")){
if(!/^[0-9a-fA-F:.]+$/.test(ip))return false;
try{return new URL("https://["+ip+"]/").hostname.startsWith("[")}catch{return false}
}
const parts=ip.split(".");
return parts.length===4&&parts.every(p=>/^(0|[1-9][0-9]{0,2})$/.test(p)&&Number(p)<=255);
}
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS"){const o=req.headers.get("origin")??"";if(o&&!ALLOWED.has(o))return new Response(null,{status:403,headers:cors(req)});return new Response(null,{status:204,headers:cors(req)})}if(req.method!=="POST")return out(req,405,{ok:false,message:"Método não permitido."});if(!SUPABASE_URL||!SERVICE)return out(req,500,{ok:false,message:"Configuração do servidor indisponível."});const admin=await authorize(req);if(!admin)return out(req,401,{ok:false,message:"Sessão inválida, origem não autorizada ou conta sem acesso ao Fama Control."});let body:any={};try{body=await req.json()}catch{return out(req,400,{ok:false,message:"Requisição inválida."})}const action=String(body.action??"");try{
if(action==="health")return out(req,200,{ok:true,data:{health:await health(),auth_users:await authDirectory()}});

if(action==="integration_status"){
return out(req,200,{ok:true,data:getIntegrationStatus((name:string)=>Deno.env.get(name))});
}
if(action==="ipinfo_lookup"||action==="ipinfo_lite_lookup"){
const token=String(Deno.env.get("IPINFO_LITE_TOKEN")||"").trim();
if(action==="ipinfo_lite_lookup"&&!token)return out(req,424,{ok:false,message:"O IPinfo Lite exige IPINFO_LITE_TOKEN. A consulta sem cadastro está disponível na ação ipinfo_lookup."});
const ip=String(body.ip??"").trim();
if(!isIpAddress(ip))return out(req,400,{ok:false,message:"Informe um endereço IPv4 ou IPv6 válido."});
const userAllowed=await rpc("fama_consume_rate_limit",{p_key_hash:await sha(admin.id+":ipinfo_lookup"),p_action:"control_ipinfo_lookup",p_limit:20,p_window_seconds:60});
if(userAllowed!==true)return out(req,429,{ok:false,message:"Limite de consultas por minuto atingido. Aguarde e tente novamente."});
const source=token?"ipinfo_lite":"ipinfo_public";
const meta={source,attribution:{name:"IPinfo",url:"https://ipinfo.io"},...(!token?{rate_limit:{requests_per_day:1000,shared_by_egress_ip:true}}:{})};
const cacheKey=source+":"+ip.toLowerCase(),cached=IPINFO_CACHE.get(cacheKey);
if(cached&&cached.expires_at>Date.now())return out(req,200,{ok:true,data:cached.data,...meta,cached:true});
if(cached)IPINFO_CACHE.delete(cacheKey);
if(!token){
const publicAllowed=await rpc("fama_consume_rate_limit",{p_key_hash:await sha("fama-control:ipinfo-public:global"),p_action:"control_ipinfo_public_daily",p_limit:900,p_window_seconds:86400});
if(publicAllowed!==true)return out(req,429,{ok:false,message:"Orçamento diário da consulta pública IPinfo atingido. Tente mais tarde ou configure IPINFO_LITE_TOKEN."});
}
const target=new URL(token?"https://api.ipinfo.io/lite/"+ip:"https://ipinfo.io/"+ip+"/json");
if(token)target.searchParams.set("token",token);
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
let upstream:Response,raw:string;
try{
upstream=await fetch(target,{headers:{Accept:"application/json","User-Agent":"Fama-Control"},redirect:"error",signal:controller.signal});
raw=await upstream.text();
}catch{return out(req,502,{ok:false,message:"Não foi possível consultar o IPinfo."})}finally{clearTimeout(timer)}
if(raw.length>64000)return out(req,502,{ok:false,message:"Resposta IPinfo excedeu o limite de segurança."});
if(!upstream.ok)return out(req,upstream.status===429?429:502,{ok:false,message:upstream.status===429?"Limite compartilhado do IPinfo atingido. Tente mais tarde.":token&&(upstream.status===401||upstream.status===403)?"O IPinfo Lite rejeitou o segredo configurado.":"Falha na consulta IPinfo ("+upstream.status+")."});
let result:any=null;
try{result=JSON.parse(raw)}catch{return out(req,502,{ok:false,message:"O IPinfo retornou uma resposta inválida."})}
if(!result||typeof result!=="object"||Array.isArray(result)||result.error)return out(req,502,{ok:false,message:"O IPinfo retornou uma resposta inválida."});
let data=result;
if(!token){
const org=typeof result.org==="string"?result.org:"",asn=org.match(/^(AS[0-9]+)\s*(.*)$/i);
const countryCode=typeof result.country==="string"&&/^[A-Z]{2}$/i.test(result.country)?result.country.toUpperCase():null;
data={ip:typeof result.ip==="string"?result.ip:ip,country_code:countryCode,country:countryCode?new Intl.DisplayNames(["en"],{type:"region"}).of(countryCode):null,continent_code:null,continent:null,asn:asn?asn[1].toUpperCase():null,as_name:asn?asn[2]||null:org||null,as_domain:null,...(result.bogon===true?{bogon:true}:{})};
}
if(IPINFO_CACHE.size>=200){const oldest=IPINFO_CACHE.keys().next().value;if(oldest!==undefined)IPINFO_CACHE.delete(oldest)}
IPINFO_CACHE.set(cacheKey,{expires_at:Date.now()+900000,data});
return out(req,200,{ok:true,data,...meta,cached:false});
}
if(action==="github_rest_get"){
await rate(admin,action,30,3600);
let path=String(body.path??"").trim();
while(path.startsWith("/"))path=path.slice(1);
const parts=path.split("/");
const segment=/^[A-Za-z0-9_.-]{1,120}$/;
const repoResource=["issues","pulls","commits","releases","contributors","contents","branches","tags"];
const routeAllowed=path==="rate_limit"||path==="search/repositories"||(parts.length===2&&parts[0]==="users"&&/^[A-Za-z0-9-]{1,39}$/.test(parts[1]))||(parts.length>=4&&parts.length<=5&&parts[0]==="repos"&&segment.test(parts[1])&&segment.test(parts[2])&&repoResource.includes(parts[3])&&(parts.length===4||segment.test(parts[4])));
if(!routeAllowed||path.includes(".."))return out(req,400,{ok:false,message:"Endpoint GitHub não permitido."});
const params=body.params??{};
if(!params||typeof params!=="object"||Array.isArray(params))return out(req,400,{ok:false,message:"Parâmetros GitHub inválidos."});
const allowedParams=new Set(["q","per_page","page","sort","direction","state","labels","order","type","affiliation"]);
const target=new URL("https://api.github.com/"+path);
for(const [name,value] of Object.entries(params)){
if(!allowedParams.has(name)||!["string","number","boolean"].includes(typeof value))return out(req,400,{ok:false,message:"Parâmetro GitHub não permitido."});
const textValue=String(value);
if(textValue.length>500)return out(req,400,{ok:false,message:"Parâmetro GitHub muito longo."});
if(name==="per_page"&&(!Number.isInteger(Number(textValue))||Number(textValue)<1||Number(textValue)>100))return out(req,400,{ok:false,message:"per_page deve ficar entre 1 e 100."});
target.searchParams.set(name,textValue);
}
if(!target.searchParams.has("per_page")&&path!=="rate_limit"&&!path.startsWith("users/"))target.searchParams.set("per_page","20");
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
let upstream:Response;
try{upstream=await fetch(target,{headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10","User-Agent":"Fama-Control"},signal:controller.signal})}catch{return out(req,502,{ok:false,message:"Não foi possível consultar a GitHub REST API."})}finally{clearTimeout(timer)}
const raw=await upstream.text();
if(raw.length>500000)return out(req,502,{ok:false,message:"Resposta GitHub excedeu o limite de segurança."});
let result:any=null;try{result=raw?JSON.parse(raw):null}catch{return out(req,502,{ok:false,message:"A GitHub REST API retornou uma resposta inválida."})}
if(!upstream.ok)return out(req,upstream.status===403||upstream.status===429?429:upstream.status,{ok:false,message:upstream.status===403||upstream.status===429?"Limite da GitHub REST API atingido ou acesso negado.":"A GitHub REST API respondeu com erro ("+upstream.status+")."});
return out(req,200,{ok:true,data:result,rate_limit:{remaining:upstream.headers.get("x-ratelimit-remaining"),reset:upstream.headers.get("x-ratelimit-reset")}});
}

if(action==="audit_list"){let q=`select=id,organization_id,actor_user_id,event_type,entity_type,record_id,metadata,occurred_at&order=occurred_at.desc&limit=${Math.min(Math.max(Number(body.limit)||200,1),1000)}`;if(body.organization_id)q+=`&organization_id=eq.${encodeURIComponent(String(body.organization_id))}`;if(body.event_type)q+=`&event_type=eq.${encodeURIComponent(String(body.event_type))}`;if(body.entity_type)q+=`&entity_type=eq.${encodeURIComponent(String(body.entity_type))}`;return out(req,200,{ok:true,data:await select("audit_logs",q)})}
if(action==="privacy_list")return out(req,200,{ok:true,data:await select("privacy_requests","select=*&order=created_at.desc&limit=500")});
if(action==="privacy_update"){await rate(admin,action,20,60);const id=String(body.id??""),status=["open","in_progress","completed","rejected"].includes(String(body.status))?String(body.status):"in_progress";const patch:any={status,resolution:String(body.resolution??"").slice(0,4000),completed_at:status==="completed"?new Date().toISOString():null};const d=await sj(`/rest/v1/privacy_requests?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});await audit(admin,"update","privacy_requests",id,{status});return out(req,200,{ok:true,data:d})}
if(action==="limits_list")return out(req,200,{ok:true,data:await select("request_rate_limits","select=key_hash,action,window_started_at,request_count,updated_at&order=updated_at.desc&limit=300")});
if(action==="clear_limits"){await rate(admin,action,6,60);const target=String(body.target_action??"");const path=target?`/rest/v1/request_rate_limits?action=eq.${encodeURIComponent(target)}`:"/rest/v1/request_rate_limits?request_count=gt.0";const r=await sf(path,{method:"DELETE",headers:{Prefer:"return=minimal"}});if(!r.ok)throw new Error("Não foi possível limpar os limites.");await audit(admin,"security","request_rate_limits","",{action:"clear",target_action:target||"all"});return out(req,200,{ok:true,data:true})}
if(action==="trash_org"){await rate(admin,action,10,60);const id=String(body.id??"");const d=await sj(`/rest/v1/organizations?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"deleted",deleted_at:new Date().toISOString()})});await audit(admin,"delete","organizations",id,{soft_delete:true,retention_days:30},id);return out(req,200,{ok:true,data:d})}
if(action==="restore_org"){await rate(admin,action,10,60);const id=String(body.id??"");const d=await sj(`/rest/v1/organizations?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"active",deleted_at:null})});await audit(admin,"restore","organizations",id,{source:"fama_control"},id);return out(req,200,{ok:true,data:d})}
if(action==="trash_list"){const [orgs,snapsRaw]=await Promise.all([select("organizations","select=*&or=(status.eq.deleted,deleted_at.not.is.null)&order=deleted_at.desc"),select("recovery_snapshots","select=id,organization_id,entity_type,record_id,encrypted_payload,deleted_by_user_id,deleted_at,expires_at,restored_at,restored_by_user_id&restored_at=is.null&order=deleted_at.desc&limit=1000")]);const snaps=(snapsRaw||[]).map((s:any)=>({id:s.id,organization_id:s.organization_id,entity_type:s.entity_type,record_id:s.record_id,deleted_by_user_id:s.deleted_by_user_id,deleted_at:s.deleted_at,expires_at:s.expires_at,restored_at:s.restored_at,restored_by_user_id:s.restored_by_user_id,legacy:String(s.encrypted_payload||"").startsWith("fama:v1:")}));return out(req,200,{ok:true,data:{organizations:orgs,snapshots:snaps}})}
if(action==="restore_snapshot"){await rate(admin,action,20,60);const id=String(body.id??"");try{return out(req,200,{ok:true,data:await rpc("fama_control_restore_snapshot",{p_snapshot_id:id,p_actor_user_id:admin.id})})}catch(e){const m=e instanceof Error?e.message:"";if(m.includes("SNAPSHOT_LEGADO_NAO_COMPATIVEL"))return out(req,409,{ok:false,message:"Este item usa criptografia legada e foi preservado, mas não será restaurado automaticamente para evitar corrupção."});throw e}}
if(action==="protected_list")return out(req,200,{ok:true,data:await select("protected_records","select=*&order=protected_at.desc&limit=1000")});
if(action==="records_list"){const table=String(body.entity_type??""),org=String(body.organization_id??"");if(!RECORD_TABLES.includes(table))return out(req,400,{ok:false,message:"Tipo de registro inválido."});if(!org)return out(req,400,{ok:false,message:"Selecione uma empresa."});return out(req,200,{ok:true,data:await select(table,`select=*&organization_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=250`)})}
if(action==="protect_record"){await rate(admin,action,30,60);const org=String(body.organization_id??""),entity=String(body.entity_type??""),record=String(body.record_id??"");if(!RECORD_TABLES.includes(entity)||!org||!record)return out(req,400,{ok:false,message:"Registro inválido."});const existing=await select("protected_records",`select=id&organization_id=eq.${encodeURIComponent(org)}&entity_type=eq.${encodeURIComponent(entity)}&record_id=eq.${encodeURIComponent(record)}&limit=1`);if(existing?.length)return out(req,200,{ok:true,data:existing});const id=crypto.randomUUID();const d=await sj("/rest/v1/protected_records",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,organization_id:org,entity_type:entity,record_id:record,reason:String(body.reason??"").slice(0,500),protected_by_user_id:admin.id})});await audit(admin,"security",entity,record,{action:"protect",reason:String(body.reason??"").slice(0,500)},org);return out(req,200,{ok:true,data:d})}
if(action==="unprotect_record"){await rate(admin,action,30,60);const id=String(body.id??""),rows=await select("protected_records",`select=*&id=eq.${encodeURIComponent(id)}&limit=1`),p=rows?.[0];if(!p)return out(req,404,{ok:false,message:"Proteção não encontrada."});const r=await sf(`/rest/v1/protected_records?id=eq.${encodeURIComponent(id)}`,{method:"DELETE",headers:{Prefer:"return=minimal"}});if(!r.ok)throw new Error("Não foi possível retirar a proteção.");await audit(admin,"security",p.entity_type,p.record_id,{action:"unprotect"},p.organization_id);return out(req,200,{ok:true,data:true})}
if(action==="set_user_password"){await rate(admin,action,10,60);const userId=String(body.user_id??""),password=String(body.password??"");if(password.length<8)return out(req,400,{ok:false,message:"A nova senha precisa ter pelo menos 8 caracteres."});await sj(`/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:"PUT",body:JSON.stringify({password})});await audit(admin,"security","auth_user",userId,{action:"password_reset_without_email"});return out(req,200,{ok:true,data:true})}
if(action==="backup_create"){await rate(admin,action,6,300);const scope=body.scope==="organization"?"organization":"global",org=scope==="organization"?String(body.organization_id??""):null;if(scope==="organization"&&!org)return out(req,400,{ok:false,message:"Selecione uma empresa."});const payload=await collectBackup(scope,org),sum=await checksum(payload),id=crypto.randomUUID(),label=String(body.label??(scope==="global"?"Backup global":"Backup da empresa")).trim().slice(0,160);const d=await sj("/rest/v1/fama_control_backups",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,label,scope,organization_id:org,payload,checksum:sum,created_by_user_id:admin.id})});await audit(admin,"export","fama_control_backup",id,{scope,organization_id:org,checksum:sum},org);return out(req,200,{ok:true,data:d})}
if(action==="backup_list")return out(req,200,{ok:true,data:await select("fama_control_backups","select=id,label,scope,organization_id,checksum,created_by_user_id,created_at,restored_at,restored_by_user_id&order=created_at.desc&limit=200")});
if(action==="backup_export"){await rate(admin,action,12,60);const id=String(body.id??"");const d=await select("fama_control_backups",`select=id,label,scope,organization_id,payload,checksum,created_at&id=eq.${encodeURIComponent(id)}&limit=1`);if(!d?.length)return out(req,404,{ok:false,message:"Backup não encontrado."});await audit(admin,"export","fama_control_backup",id,{download:true},d[0].organization_id??null);return out(req,200,{ok:true,data:d[0]})}
if(action==="export_live"){await rate(admin,action,6,60);const payload=await collectBackup("global",null),sum=await checksum(payload);await audit(admin,"export","fama_control_export","",{checksum:sum});return out(req,200,{ok:true,data:{payload,checksum:sum}})}
if(action==="backup_restore"){await rate(admin,action,3,300);const id=String(body.id??"");try{const d=await rpc("fama_control_restore_backup",{p_backup_id:id,p_actor_user_id:admin.id});return out(req,200,{ok:true,data:d})}catch(e){const m=e instanceof Error?e.message:"";if(m.includes("BACKUP_NOT_FOUND"))return out(req,404,{ok:false,message:"Backup não encontrado."});if(m.includes("BACKUP_CHECKSUM_MISMATCH"))return out(req,409,{ok:false,message:"Checksum do backup não confere. Restauração cancelada sem alterar dados."});if(m.includes("BACKUP_FORMAT_INVALID"))return out(req,409,{ok:false,message:"Formato de backup inválido. Restauração cancelada sem alterar dados."});throw e}}
return out(req,400,{ok:false,message:"Ação administrativa não reconhecida."})}catch(e){console.error(action,e);return out(req,500,{ok:false,message:e instanceof Error?e.message:"Falha interna na função administrativa."})}});