import { requireTenant,tenantError,RequestError } from '@/lib/tenant';
import { hasFeaturePermission } from '@/lib/permissions';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { readAgendaSettings,saveAgendaSettings,agendaHealth } from '@/lib/agenda-automation';
const headers={'Cache-Control':'private,no-store'};
async function context(request){const value=await requireTenant(request,['owner','admin']);if(!['agenda','team','chat'].every(feature=>hasFeaturePermission(value.organization.role,value.organization.permissions,feature,value.organization.moduleAccess)))throw new RequestError('Seu perfil precisa de acesso à Agenda, Equipe e WhatsApp.',403);return value;}
async function result(organizationId){return {settings:await readAgendaSettings(organizationId),...await agendaHealth(organizationId)};}
export async function GET(request){try{const {organization}=await context(request);return Response.json(await result(organization.id),{headers});}catch(error){return tenantError(error,'Não foi possível conferir o envio automático.');}}
export async function POST(request){try{const {organization,user}=await context(request);await assertRateLimit(request,'agenda_automation',user.id,20,60);await saveAgendaSettings(organization.id,user.id,await readJsonObject(request));return Response.json(await result(organization.id),{headers});}catch(error){return tenantError(error,'Não foi possível salvar o envio automático.');}}
