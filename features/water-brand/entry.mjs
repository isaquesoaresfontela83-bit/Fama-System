export const VERSION = '15.23.17';
export const RELEASE = '2026-11-19-water-brand-05';
export const PREFIX = '/assets/water-brand-15.23.17/';

const oldIcon = /^(?:\/fama-piscinas-mark\.png|\/favicon\.ico|\/apple-touch-icon(?:-\d+x\d+)?\.png|\/icon-(?:192|512)\.png)$/;
const oldLogo = '/fama-piscinas-logo.png';

export function brandName(value) {
 return value.replace(/\bFama[ \t]+(System|Control)\b/gi, (name, product) => {
  const brand = product.toLowerCase() === 'system' ? 'Water System' : 'Water Control';
  return name === name.toUpperCase() ? brand.toUpperCase() : brand;
 });
}

function transformManifest(manifest) {
 for (const key of ['name', 'short_name', 'description']) {
  if (typeof manifest[key] === 'string') manifest[key] = brandName(manifest[key]).replace(/^Fama$/i, 'Water');
 }
 if (Array.isArray(manifest.icons)) {
  manifest.icons = [192, 512].map(size => ({ src: PREFIX + 'icon-' + size + '.webp', sizes: size + 'x' + size, type: 'image/webp', purpose: 'any' }));
 }
 return manifest;
}

function headersFor(response) {
 const headers = new Headers(response.headers);
 for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
 return headers;
}

export function withWaterBrand(app, resources) {
 return {
  ...app,
  async fetch(request, env, ctx) {
   const url = new URL(request.url);
   if (request.method !== 'GET' && request.method !== 'HEAD') return app.fetch(request, env, ctx);
   const head = request.method === 'HEAD';
   const path = url.pathname;
   const assetName = oldIcon.test(path) ? 'icon.webp' : path === oldLogo ? 'logo.webp' : path.startsWith(PREFIX) ? path.slice(PREFIX.length) : '';
   if (Object.hasOwn(resources, assetName)) {
    const asset = resources[assetName];
    const body = asset.base64 ? Uint8Array.from(atob(asset.base64), char => char.charCodeAt(0)) : asset.body;
    return new Response(head ? null : body, { headers: {
     'Content-Type': asset.type,
     'Cache-Control': path.startsWith(PREFIX) ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
     'X-Content-Type-Options': 'nosniff',
    } });
   }
   const response = await app.fetch(request, env, ctx);
   if (!response.ok && response.status !== 404) return response;
   if (path === '/api/health' && !head && response.ok) {
    const data = await response.json();
    if (typeof data.service === 'string') data.service = brandName(data.service);
    return Response.json({ ...data, version: VERSION, release: RELEASE, releaseId: RELEASE }, { status: response.status, headers: headersFor(response) });
   }
   if (path === '/site.webmanifest' && !head && response.ok) {
    const data = await response.clone().json().catch(() => null);
    return data ? Response.json(transformManifest(data), { headers: { ...Object.fromEntries(headersFor(response)), 'content-type': 'application/manifest+json' } }) : response;
   }
   if (head || !response.headers.get('content-type')?.includes('text/html') || path.startsWith('/api/')) return response;

   const rewriter = new HTMLRewriter();
   rewriter.on('title', {
    text(chunk) {
     this.title = (this.title || '') + chunk.text;
     chunk.replace(chunk.lastInTextNode ? brandName(this.title) : '');
     if (chunk.lastInTextNode) this.title = '';
    },
   });
   rewriter.on('meta[content]', {
    element(element) {
     const property = element.getAttribute('property') || element.getAttribute('name') || '';
     if (/^(?:og:|twitter:|description$|application-name$|apple-mobile-web-app-title$)/.test(property)) {
      element.setAttribute('content', brandName(element.getAttribute('content')));
     }
    },
   });
   rewriter.on('link[rel][href]', {
    element(element) {
     if (!/\b(?:icon|apple-touch-icon)\b/.test(element.getAttribute('rel'))) return;
     element.setAttribute('href', PREFIX + 'icon.webp');
     element.setAttribute('type', 'image/webp');
     element.removeAttribute('sizes');
    },
   });
   rewriter.on('head', {
    element(element) {
     element.append('<link rel="stylesheet" href="' + PREFIX + 'brand.css">', { html: true });
     element.append('<script defer src="' + PREFIX + 'brand.js"></script>', { html: true });
    },
   });
   return rewriter.transform(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headersFor(response) }));
  },
 };
}
