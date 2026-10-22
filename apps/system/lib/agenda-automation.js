import { env } from 'cloudflare:workers';
import { database } from './database';
import { insertRow,selectOne,selectRows,updateRows,usesSupabase } from './supabase';
import { encryptText } from './crypto';
import { sha256 } from './security';
import { RequestError } from './request-error';
import { hasFeaturePermission } from './permissions';
import { isPlanAccessBlocked } from './billing-access';
import { memberBlockAccess } from './fama-blocks-server';
import { planBlockAccess } from './fama-blocks';
import { baileysBridge } from './baileys-server';
import { loadDailyAgenda } from './daily-agenda';
import { agendaRecipients,recipientMessage,splitAgendaMessage } from './agenda-delivery';
export const agendaDefaults={enabled:false,time:'07:00',days:[0,1,2,3,4,5,6],employeeIds:[],timezone:'America/Sao_Paulo'};
export async function agendaTables(){
    if(usesSupabase())return;
    const db=database();await db.batch([
        db.prepare('CREATE TABLE IF NOT EXISTS fama_agenda_settings (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, config TEXT NOT NULL, updated_at TEXT NOT NULL)'),
        db.prepare("CREATE TABLE IF NOT EXISTS fama_agenda_deliveries (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, day TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    ]);
}
export function parseAgendaSettings(body){
    if(typeof body.enabled!=='boolean'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.time||''))throw new RequestError('Escolha um horário válido.',400);
    if(!Array.isArray(body.days)||!body.days.length||body.days.length>7||body.days.some(day=>!Number.isInteger(day)||day<0||day>6))throw new RequestError('Selecione os dias da semana.',400);
    if(!Array.isArray(body.employeeIds)||body.employeeIds.length>100||body.employeeIds.some(id=>typeof id!=='string'||!id||id.length>100))throw new RequestError('Selecione profissionais válidos.',400);
    return {enabled:body.enabled,time:body.time,days:[...new Set(body.days)],employeeIds:[...new Set(body.employeeIds)],timezone:agendaDefaults.timezone};
}
function unpack(row){return row?{...parseAgendaSettings({...JSON.parse(row.config),enabled:Boolean(row.enabled)}),updatedAt:row.updated_at}:{...agendaDefaults};}
async function rows(table,filter={},options={}){
    if(usesSupabase())return selectRows(table,filter,options);
    const keys=Object.keys(filter),order=table==='fama_agenda_deliveries'?' ORDER BY updated_at DESC':' ORDER BY id';
    return (await database().prepare('SELECT * FROM '+table+(keys.length?' WHERE '+keys.map(key=>key+'=?').join(' AND '):'')+order+' LIMIT '+(options.limit||1000)).bind(...keys.map(key=>typeof filter[key]==='boolean'?Number(filter[key]):filter[key])).all()).results;
}
export async function readAgendaSettings(organizationId){await agendaTables();return unpack((await rows('fama_agenda_settings',{organization_id:organizationId}))[0]);}
export async function saveAgendaSettings(organizationId,userId,input){
    const config=parseAgendaSettings(input);
    const employees=usesSupabase()?await selectRows('employees',{organization_id:organizationId}):(await database().prepare('SELECT id FROM employees WHERE organization_id=?').bind(organizationId).all()).results;
    if(config.employeeIds.some(id=>!employees.some(employee=>employee.id===id)))throw new RequestError('Um profissional não pertence à empresa atual.',400);
    await agendaTables();const row={id:organizationId,organization_id:organizationId,user_id:userId,enabled:config.enabled,config:JSON.stringify(config),updated_at:new Date().toISOString()};
    if(usesSupabase()){if(await selectOne('fama_agenda_settings',{organization_id:organizationId}))await updateRows('fama_agenda_settings',row,{organization_id:organizationId});else await insertRow('fama_agenda_settings',row);}
    else await database().prepare('INSERT INTO fama_agenda_settings(id,organization_id,user_id,enabled,config,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,enabled=excluded.enabled,config=excluded.config,updated_at=excluded.updated_at').bind(row.id,organizationId,userId,Number(config.enabled),row.config,row.updated_at).run();
    return {...config,updatedAt:row.updated_at};
}
export function agendaDue(config,now=new Date()){
    if(!config.enabled)return false;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:agendaDefaults.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),get=key=>parts.find(part=>part.type===key).value;
    const day=`${get('year')}-${get('month')}-${get('day')}`,minute=Number(get('hour'))*60+Number(get('minute')),[h,m]=config.time.split(':').map(Number);
    return config.days.includes(new Date(day+'T12:00:00Z').getUTCDay())&&minute>=h*60+m&&minute<Math.min(1440,h*60+m+180)?day:false;
}
async function authorizedOrganization(setting){
    const member=usesSupabase()?await selectOne('organization_members',{organization_id:setting.organization_id,user_id:setting.user_id,status:'active'}):await database().prepare("SELECT * FROM organization_members WHERE organization_id=? AND user_id=? AND status='active'").bind(setting.organization_id,setting.user_id).first();
    const organization=member&&(usesSupabase()?await selectOne('organizations',{id:setting.organization_id,status:'active'}):await database().prepare("SELECT * FROM organizations WHERE id=? AND status='active'").bind(setting.organization_id).first());
    if(!organization||!['owner','admin'].includes(member.role)||isPlanAccessBlocked(organization.plan_status,organization.plan_expires_at,organization.billing_enabled!==false&&organization.billing_enabled!==0,organization.block_on_expiry!==false&&organization.block_on_expiry!==0))return null;
    const access=usesSupabase()?await memberBlockAccess(member,organization.plan):planBlockAccess(member.role,member.permissions,organization.plan),can=feature=>hasFeaturePermission(member.role,member.permissions,feature,access);
    return ['agenda','team','chat'].every(can)?{can}:null;
}
async function claim(row){
    if(usesSupabase()){try{await insertRow('fama_agenda_deliveries',row);return true;}catch(error){if(error.code==='23505')return false;throw error;}}
    return Boolean((await database().prepare('INSERT OR IGNORE INTO fama_agenda_deliveries(id,organization_id,employee_id,day,status,payload,detail,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(row.id,row.organization_id,row.employee_id,row.day,row.status,row.payload,row.detail,row.created_at,row.updated_at).run()).meta.changes);
}
async function finish(id,organizationId,status,detail){
    const updated_at=new Date().toISOString();
    if(usesSupabase())await updateRows('fama_agenda_deliveries',{status,detail,updated_at},{id,organization_id:organizationId});
    else await database().prepare('UPDATE fama_agenda_deliveries SET status=?,detail=?,updated_at=? WHERE id=? AND organization_id=?').bind(status,detail,updated_at,id,organizationId).run();
}
export async function agendaHealth(organizationId=''){
    await agendaTables();const filter=organizationId?{organization_id:organizationId}:{},settings=await rows('fama_agenda_settings',filter),deliveries=await rows('fama_agenda_deliveries',filter,{order:'updated_at.desc',limit:20});
    return {schedulerConfigured:String(env.FAMA_AGENDA_CRON_SECRET||'').length>=32,enabledCompanies:settings.filter(row=>row.enabled===true||row.enabled===1).length,deliveries:deliveries.map(({id,organization_id,employee_id,day,status,detail,updated_at})=>({id,organizationId:organization_id,employeeId:employee_id,day,status,detail,updatedAt:updated_at}))};
}
export async function runAgendaBatch(now=new Date()){
    await agendaTables();const settings=await rows('fama_agenda_settings',{enabled:true}),result={sent:0,uncertain:0,skipped:0,disconnected:0},started=Date.now();
    for(const setting of settings){
        if(result.sent+result.uncertain>=10||Date.now()-started>45000)break;
        const config=unpack(setting),day=agendaDue(config,now);if(!day)continue;
        const organization=await authorizedOrganization(setting);if(!organization){result.skipped++;continue;}
        let connection;try{connection=await baileysBridge(setting.organization_id,'status');}catch{result.disconnected++;continue;}
        if(connection.status!=='connected'){result.disconnected++;continue;}
        const data=await loadDailyAgenda(setting.organization_id,day,{orders:organization.can('orders'),warranties:organization.can('warranties')});
        for(const recipient of agendaRecipients(data,config.employeeIds)){
            if(result.sent+result.uncertain>=10||Date.now()-started>45000)break;
            if(recipient.reason){result.skipped++;continue;}
            const hash=await sha256(`fama:agenda:${setting.organization_id}:${day}:${recipient.employee.id}`),id=hash;
            if((await rows('fama_agenda_deliveries',{id,organization_id:setting.organization_id})).length)continue;
            const parts=splitAgendaMessage(recipientMessage(recipient,day)),timestamp=new Date().toISOString();
            const latest=(await rows('fama_agenda_settings',{id:setting.id,organization_id:setting.organization_id}))[0],currentAccess=latest&&await authorizedOrganization(latest);
            if(!latest?.enabled||latest.config!==setting.config||latest.user_id!==setting.user_id||!currentAccess||['orders','warranties'].some(feature=>organization.can(feature)&&!currentAccess.can(feature))){result.skipped++;continue;}
            const row={id,organization_id:setting.organization_id,employee_id:recipient.employee.id,day,status:'reserved',payload:await encryptText(JSON.stringify({phone:recipient.phone,parts})),detail:'',created_at:timestamp,updated_at:timestamp};
            if(!await claim(row))continue;let count=0;
            try{
                for(let index=0;index<parts.length;index++){
                    const partHash=await sha256(`${hash}:${index}`),clientId=`${partHash.slice(0,8)}-${partHash.slice(8,12)}-8${partHash.slice(13,16)}-a${partHash.slice(17,20)}-${partHash.slice(20,32)}`;
                    const confirmation=await baileysBridge(setting.organization_id,'send',{phone:recipient.phone,text:parts[index],clientId});
                    if(confirmation.status!=='sent'||typeof confirmation.id!=='string'||!confirmation.id)throw new Error('Confirmação de envio ausente.');count++;
                }
                await finish(id,setting.organization_id,'sent',`${count} parte(s) confirmada(s).`);result.sent++;
            }catch{await finish(id,setting.organization_id,'uncertain',`${count}/${parts.length} partes confirmadas. Confira o WhatsApp antes de reenviar.`);result.uncertain++;}
        }
    }
    return result;
}
