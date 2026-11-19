export const VERSION='15.23.7';
export const RELEASE='2026-11-19-optical-glass-preview-01';
export const PREVIEW='/previa-liquidglass';
export function withOpticalPreview(app,kind,resources){return {...app,async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(kind==='system'&&(path===PREVIEW||path===PREVIEW+'/'||Object.hasOwn(resources,path))){
  if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  const resource=resources[path===PREVIEW+'/'?PREVIEW:path];
  return new Response(request.method==='HEAD'?null:resource.body,{headers:{'Content-Type':resource.type+'; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}});
 }
 const response=await app.fetch(request,env,ctx);
 if(path==='/api/health'&&request.method==='GET'&&response.ok){const body=await response.json(),headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');return Response.json({...body,version:VERSION,release:RELEASE,releaseId:RELEASE},{status:response.status,headers});}
 return response;
}};}
