import { migrateLegacyReferences, renameProducts } from './hosts.mjs';

export const VERSION = '15.23.27';
export const RELEASE = '2026-11-20-water-mobile-transparent-logo-01';
export const PREFIX = '/assets/water-brand-15.23.21/';
export const SYSTEM_BRAND_JS = 'brand-15.23.26.js';
export const BRAND_CSS = 'brand-15.23.27.css';
export const DEMO_ACTION_CSS = 'demo-action-15.23.22.css';
export const CONTROL_OPENING = 'control-opening-15.23.25-r2';
export const CONTROL_BRAND = 'control-brand-15.23.25';
export const CONTROL_BRAND_CSS = 'control-brand-15.23.25-r2.css';

const oldIcon = /^(?:\/favicon\.ico|\/apple-touch-icon(?:-\d+x\d+)?\.png|\/icon-(?:192|512)\.png)$/;
const oldMark = '/fama-piscinas-mark.png';
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
 const controlMark = CONTROL_BRAND + '-mark.webp';
 const controlScript = CONTROL_BRAND + '.js';
 const hasControlBrand = product === 'control' && [controlMark, controlScript].every(name => Object.hasOwn(resources, name));
 const mark = hasControlBrand ? controlMark : 'icon.webp';
 return {
  ...app,
  async fetch(request, env, ctx) {
   const url = new URL(request.url);
   if (request.method !== 'GET' && request.method !== 'HEAD') return app.fetch(request, env, ctx);
   const head = request.method === 'HEAD';
   const path = url.pathname;
   let assetName = '';
   if (path === oldMark || oldIcon.test(path)) assetName = mark;
   else if (path === oldLogo) assetName = hasControlBrand ? controlMark : 'logo.webp';
   else if (path.startsWith(PREFIX)) assetName = path.slice(PREFIX.length);
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
     element.setAttribute('href', PREFIX + mark);
     element.setAttribute('type', 'image/webp');
     element.removeAttribute('sizes');
    },
   });
   rewriter.on('head', {
    element(element) {
     element.append('<link rel="stylesheet" href="' + PREFIX + BRAND_CSS + '">', { html: true });
     if (hasControlBrand && Object.hasOwn(resources, CONTROL_BRAND_CSS)) {
      element.append('<link rel="stylesheet" href="' + PREFIX + CONTROL_BRAND_CSS + '">', { html: true });
     }
     if (product === 'system' && Object.hasOwn(resources, DEMO_ACTION_CSS)) {
      element.append('<link rel="stylesheet" href="' + PREFIX + DEMO_ACTION_CSS + '">', { html: true });
     }
     const brandAttributes = hasControlBrand ? ' data-water-mark="' + controlMark + '"' : product === 'system' ? ' data-water-opening' : '';
     element.append('<script defer' + brandAttributes + ' src="' + PREFIX + (hasControlBrand ? controlScript : SYSTEM_BRAND_JS) + '"></script>', { html: true });
     if (product === 'control' && Object.hasOwn(resources, CONTROL_OPENING + '.css') && Object.hasOwn(resources, CONTROL_OPENING + '.js')) {
      element.append('<link rel="stylesheet" href="' + PREFIX + CONTROL_OPENING + '.css">', { html: true });
      element.append('<link rel="preload" as="image" href="' + PREFIX + 'icon.webp">', { html: true });
      element.append('<script defer src="' + PREFIX + CONTROL_OPENING + '.js"></script>', { html: true });
     }
    },
   });
   return rewriter.transform(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headersFor(response) }));
  },
 };
}
