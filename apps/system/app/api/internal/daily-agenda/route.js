import { env } from 'cloudflare:workers';
import { isInternalRequest } from '@/lib/internal-auth';
import { agendaHealth,runAgendaBatch } from '@/lib/agenda-automation';
const headers={'Cache-Control':'private,no-store'};
async function cronRequest(request){const secret=String(env.FAMA_AGENDA_CRON_SECRET||''),token=request.headers.get('authorization')||'';if(secret.length<32||!token.startsWith('Bearer '))return false;const digest=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),[a,b]=await Promise.all([digest(secret),digest(token.slice(7))]);return a.reduce((diff,value,index)=>diff|(value^b[index]),0)===0;}
export async function GET(request){if(!await isInternalRequest(request))return Response.json({error:'Acesso não autorizado.'},{status:401});try{return Response.json(await agendaHealth(),{headers});}catch{return Response.json({error:'Não foi possível conferir a automação.'},{status:503,headers});}}
export async function POST(request){if(!await cronRequest(request))return Response.json({error:'Acesso não autorizado.'},{status:401});try{return Response.json(await runAgendaBatch(),{headers});}catch{return Response.json({error:'O processamento da agenda não foi confirmado. Confira o histórico antes de reenviar.'},{status:503,headers});}}
