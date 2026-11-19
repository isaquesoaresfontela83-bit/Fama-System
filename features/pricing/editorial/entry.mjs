export const VERSION='15.23.6';
export const RELEASE='2026-11-18-editorial-pricing-01';
export function withPricing(app,kind,assets,css){return {...app,async fetch(request,env,ctx){
 const url=new URL(request.url),readable=['GET','HEAD'].includes(request.method);
 if(kind==='system'&&readable&&url.pathname==='/assets/fama-pricing-15.23.6.css')return new Response(request.method==='HEAD'?null:css,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'}});
 if(kind==='system'&&readable&&Object.hasOwn(assets,url.pathname))return new Response(request.method==='HEAD'?null:assets[url.pathname].replaceAll('plans-15173-1','editorial-15.23.6').replaceAll('pricing-15.23.5','editorial-15.23.6').replaceAll('pricing-15.23.6','editorial-15.23.6'),{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 let response=await app.fetch(request,env,ctx);
 if(url.pathname==='/api/health'&&request.method==='GET'&&response.ok){const data=await response.json();const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');return Response.json({...data,version:VERSION,release:RELEASE,releaseId:RELEASE},{status:response.status,headers});}
 if(kind!=='system'||request.method!=='GET')return response;
 const type=response.headers.get('content-type')||'';
 if(type.includes('javascript')&&url.pathname.startsWith('/assets/')){
  let text=await response.text();text=text.replaceAll('plans-15173-1','editorial-15.23.6').replaceAll('pricing-15.23.5','editorial-15.23.6').replaceAll('pricing-15.23.6','editorial-15.23.6');
  if(url.pathname.includes('company-onboarding'))text=text.replaceAll('Teste grátis de 7 dias. Depois disso o acesso será bloqueado até o pagamento do plano.','Confirme o pagamento do plano para criar o ambiente da empresa.').replaceAll('7 dias grátis','Pagamento');
  const headers=new Headers(response.headers);for(const h of ['content-length','etag','content-encoding'])headers.delete(h);headers.set('Cache-Control','no-store');return new Response(text,{status:response.status,headers});
 }
 if(type.includes('text/html')){
  let text=(await response.text()).replaceAll('plans-15173-1','editorial-15.23.6').replaceAll('pricing-15.23.5','editorial-15.23.6').replaceAll('pricing-15.23.6','editorial-15.23.6');
  const headers=new Headers(response.headers);for(const h of ['content-length','etag','content-encoding'])headers.delete(h);headers.set('Cache-Control','private,no-store');
  response=new Response(text,{status:response.status,headers});
  return new HTMLRewriter().on('head',{element(e){e.append('<link rel="stylesheet" href="/assets/fama-pricing-15.23.6.css">',{html:true});}}).transform(response);
 }
 return response;
}};}
