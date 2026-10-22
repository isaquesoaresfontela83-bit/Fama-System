import { getFamaUser, appSignOutPath } from '@/app/system-auth';
import { isPlatformAdmin } from '@/lib/tenant';
export async function GET() {
 try {
  const user=await getFamaUser();
  if (!user) return Response.json({authenticated:false},{status:401,headers:{'Cache-Control':'private,no-store'}});
  if (!isPlatformAdmin(user)) return Response.json({error:'Acesso restrito ao proprietário.'},{status:403,headers:{'Cache-Control':'private,no-store'}});
  return Response.json({authenticated:true,displayName:user.displayName,email:user.email,signOutPath:appSignOutPath('/')},{headers:{'Cache-Control':'private,no-store','Vary':'Cookie'}});
 } catch {return Response.json({error:'Não foi possível verificar o acesso agora.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
