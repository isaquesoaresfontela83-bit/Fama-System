import { migrateLegacyReferences, renameProducts } from './hosts.mjs';

export const VERSION = '15.23.22';
export const RELEASE = '2026-11-20-water-demo-button-01';
export const PREFIX = '/assets/water-brand-15.23.21/';
export const DEMO_ACTION_CSS = 'demo-action-15.23.22.css';

const oldIcon = /^(?:\/fama-piscinas-mark\.png|\/favicon\.ico|\/apple-touch-icon(?:-\d+x\d+)?\.png|\/icon-(?:192|512)\.png)$/;
const oldLogo = '/fama-piscinas-logo.png';

function transformManifest(manifest) {
 for (const key of ['name', 'short_name', 'description']) {
  if (typeof manifest[key] === 'string') manifest[key] = renameProducts(manifest[key]).replace(/^Fama$/i, 'Water');
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

export function withWaterBrand(app, resources, product, migratedAssetPaths = []) {
 const migratedAssets = new Set(migratedAssetPaths);
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
   let assetRequest = request;
   const migratedAsset = migratedAssets.has(path);
   if (migratedAsset) {
    const headers = new Headers(request.headers);
    for (const name of ['range', 'if-range', 'if-none-match', 'if-modified-since']) headers.delete(name);
    assetRequest = new Request(request, { headers });
   }
   const response = await app.fetch(assetRequest, env, ctx);
   if (migratedAsset && response.status === 200 && !response.headers.get('content-type')?.includes('text/html')) {
    const headers = headersFor(response);
    headers.delete('accept-ranges');
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(head ? null : migrateLegacyReferences(await response.text()), { headers });
   }
   if (!response.ok && response.status !== 404) return response;
   if (path === '/api/health' && !head && response.ok) {
    const data = await response.json();
    if (typeof data.service === 'string') data.service = renameProducts(data.service);
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
     chunk.replace(chunk.lastInTextNode ? renameProducts(this.title) : '');
     if (chunk.lastInTextNode) this.title = '';
    },
   });
   rewriter.on('meta[content]', {
    element(element) {
     const property = element.getAttribute('property') || element.getAttribute('name') || '';
     if (/^(?:og:|twitter:|description$|application-name$|apple-mobile-web-app-title$)/.test(property)) {
      element.setAttribute('content', migrateLegacyReferences(element.getAttribute('content')));
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
     if (product === 'system' && Object.hasOwn(resources, DEMO_ACTION_CSS)) {
      element.append('<link rel="stylesheet" href="' + PREFIX + DEMO_ACTION_CSS + '">', { html: true });
     }
     const opening = product === 'system' ? ' data-water-opening' : '';
     element.append('<script defer' + opening + ' src="' + PREFIX + 'brand.js"></script>', { html: true });
    },
   });
   return rewriter.transform(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headersFor(response) }));
  },
 };
}
