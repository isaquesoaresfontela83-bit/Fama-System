export const VERSION = '15.22.3';
export const RELEASE = '2026-11-06-animated-dock-01';
export const CSS_PATH = '/assets/fama-liquid-glass-15.22.3.css';

/** Wrap the current live application without rebuilding its recovered modules. */
export function withLiquidGlass(app, css) {
  return {
    ...app,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.pathname === CSS_PATH && ['GET','HEAD'].includes(request.method)) {
        return new Response(request.method === 'HEAD' ? null : css, {headers: {
          'Content-Type':'text/css; charset=utf-8',
          'Cache-Control':'public, max-age=31536000, immutable',
          'X-Content-Type-Options':'nosniff',
        }});
      }
      const response = await app.fetch(request, env, ctx);
      if (request.method === 'GET' && url.pathname === '/api/health' && response.ok) {
        const payload = await response.json();
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('etag');
        headers.set('Cache-Control','no-store');
        return Response.json({...payload,version:VERSION,release:RELEASE,releaseId:RELEASE,glassBaselineVersion:payload.version},{status:response.status,headers});
      }
      if (request.method !== 'GET' || !response.headers.get('content-type')?.includes('text/html')) return response;
      const rewritten = new HTMLRewriter()
        .on('head', {element(element) {element.append(`<link rel="stylesheet" href="${CSS_PATH}" data-fama-glass-style>`,{html:true});}})
        .transform(response);
      const headers = new Headers(rewritten.headers);
      headers.delete('content-length'); headers.delete('etag');
      headers.set('Cache-Control','no-store');
      return new Response(rewritten.body,{status:rewritten.status,statusText:rewritten.statusText,headers});
    },
  };
}
