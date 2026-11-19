import { normalizeCatalog } from './catalog-runtime.mjs';

export const VERSION = '15.23.8';
export const RELEASE = '2026-11-19-premium-public-themes-01';
export const PREFIX = '/assets/fama-presentation-15.23.8/';

function serialize(value) {
 return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

export function withPresentation(app, kind, resources, requestCatalog) {
 return {
  ...app,
  async fetch(request, env, ctx) {
   const url = new URL(request.url);
   const readable = request.method === 'GET' || request.method === 'HEAD';
   if (kind === 'system' && readable && Object.hasOwn(resources, url.pathname)) {
    const asset = resources[url.pathname];
    return new Response(request.method === 'HEAD' ? null : asset.body, {
     headers: {
      'Content-Type': asset.type + '; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
     },
    });
   }
   const original = await app.fetch(request, env, ctx);
   if (url.pathname === '/api/health' && request.method === 'GET' && original.ok) {
    const data = await original.json();
    const headers = new Headers(original.headers);
    headers.delete('content-length');
    headers.delete('etag');
    headers.delete('content-encoding');
    return Response.json({ ...data, version: VERSION, release: RELEASE, releaseId: RELEASE }, { status: original.status, headers });
   }
   if (kind !== 'system' || !readable || !['/', '/planos'].includes(url.pathname) ||
       !original.ok || !original.headers.get('content-type')?.includes('text/html')) return original;
   const text = await original.clone().text();
   // The existing Worker remains responsible for sessions, legal consent and onboarding.
   if (!/<main\b[^>]*class=["'][^"']*\b(?:fp-page|plans-public-page)\b/.test(text)) return original;
   let catalog;
   try {
    // Reuse the application's public catalog handler and its existing Control
    // bridge. A second external Worker request is unnecessary here.
    const catalogUrl = new URL('/api/public/plans', request.url).href;
    const result = requestCatalog ? await requestCatalog(catalogUrl, { signal: AbortSignal.timeout(5000), redirect: 'error' }) :
     await app.fetch(new Request(catalogUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }), env, ctx);
    if (!result.ok) return original;
    catalog = normalizeCatalog(await result.json());
   } catch {
    return original;
   }
   const headers = new Headers(original.headers);
   for (const header of ['content-length', 'content-encoding', 'etag']) headers.delete(header);
   headers.set('Cache-Control', 'private, no-store');
   const robots = headers.get('X-Robots-Tag') === 'index, follow' ? 'index, follow' : 'noindex, nofollow';
   const structuredData = text.match(/<script\b[^>]*data-fama-seo[^>]*>[\s\S]*?<\/script>/)?.[0] || '';
   const html = resources.html.body
    .replace('<!--FAMA_CATALOG-->', '<script type="application/json" id="fama-public-catalog">' + serialize(catalog) + '</script>')
    .replace('content="noindex,nofollow"', 'content="' + robots + '"')
    .replace('</head>', structuredData + '</head>');
   return new Response(request.method === 'HEAD' ? null : html, {
    status: original.status,
    statusText: original.statusText,
    headers,
   });
  },
 };
}
