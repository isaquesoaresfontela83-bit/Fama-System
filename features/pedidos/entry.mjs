import { handleOrders } from './api.mjs';
import { VERSION, RELEASE } from './model.mjs';

/** Additive entry: the exact, verified production modules remain the application. */
export function withOrders(app, resources, kind) {
  const css=`/assets/fama-pedidos-${VERSION}.css`;
  const client=`/assets/fama-pedidos-${VERSION}.mjs`;
  return {
    ...app,
    async fetch(request,env,ctx) {
      const url=new URL(request.url);
      if(['GET','HEAD'].includes(request.method) && resources[url.pathname]) {
        const asset=resources[url.pathname];return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
      }
      const response=await handleOrders(app,request,env,ctx,kind);
      if(response)return response;
      const original=await app.fetch(request,env,ctx);
      if(url.pathname==='/api/health' && original.ok && request.method==='GET') {
        const payload=await original.json();
        return Response.json({...payload,version:VERSION,releaseId:RELEASE,release:RELEASE,baselineVersion:payload.version},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
      }
      if(request.method==='GET' && original.headers.get('content-type')?.includes('text/html')) {
        const rewritten=new HTMLRewriter().on('head',{element(element){element.append(`<link rel="stylesheet" href="${css}">`,{html:true});}}).on('body',{element(element){element.append(`<script type="module" src="${client}?app=${kind}" data-fama-pedidos></script>`,{html:true});}}).transform(original);
        const headers=new Headers(rewritten.headers);headers.delete('content-length');headers.delete('etag');headers.set('Cache-Control','no-store');
        return new Response(rewritten.body,{status:rewritten.status,statusText:rewritten.statusText,headers});
      }
      return original;
    },
  };
}
