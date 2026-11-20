export const VERSION = '15.23.4';
export const RELEASE = '2026-11-15-seo-discovery-01';
export const ORIGIN = 'https://watersystem.online';
export const PAGES = {
  '/': ['Water System — Sistema de gestão para empresas de piscinas', 'Organize sua empresa de piscinas com CRM, agenda, orçamentos, ordens de serviço, estoque e financeiro. Conheça os planos do Water System.'],
  '/manual': ['Manual de uso | Water System', 'Aprenda a usar o Water System para organizar clientes, orçamentos, serviços e a rotina da sua empresa de piscinas.'],
  '/termos': ['Termos de Uso | Water System', 'Consulte os Termos de Uso do Water System, sistema de gestão para empresas de piscinas.'],
  '/privacidade': ['Política de Privacidade | Water System', 'Saiba como o Water System trata os dados pessoais e consulte sua Política de Privacidade.'],
};
const escape = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(PAGES).map(path=>`<url><loc>${ORIGIN}${path === '/' ? '/' : path}</loc></url>`).join('')}</urlset>\n`;
export const llms = `# Water System

> Sistema de gestão para empresas de piscinas, em português do Brasil.

O Water System reúne CRM, clientes, orçamentos em PDF, agenda, ordens de serviço, contratos, garantias, estoque e financeiro. A disponibilidade de cada recurso depende do plano contratado, das permissões e das integrações configuradas.

## Fontes oficiais
- [Site e planos](https://watersystem.online/): apresentação, recursos e condições comerciais atuais.
- [Manual](https://watersystem.online/manual): orientações de uso.
- [Termos de Uso](https://watersystem.online/termos): condições do serviço.
- [Privacidade](https://watersystem.online/privacidade): tratamento de dados pessoais.

## Contexto
O serviço é acessado pelo navegador no computador ou no celular. Preços, limites e condições devem ser consultados no site oficial; não são fixados neste resumo. Recursos de IA, pagamentos e emissão fiscal dependem do plano e da configuração correspondente.

## Conteúdo privado
Login, painel administrativo Water Control, APIs, propostas compartilhadas e dados de clientes não fazem parte desta documentação pública. Este arquivo não concede acesso a áreas autenticadas nem altera as regras de robots.txt.
`;
export function robots(kind) {
  if (kind === 'control') return 'User-agent: *\nDisallow: /\n';
  // Explicit public allowlist: operational routes and shared proposal links stay excluded.
  return `User-agent: *\nDisallow: /\nAllow: /$\nAllow: /manual$\nAllow: /termos$\nAllow: /privacidade$\nAllow: /assets/\nAllow: /favicon.ico\nAllow: /fama-piscinas-logo.png\nAllow: /fama-piscinas-mark.png\nAllow: /site.webmanifest\nAllow: /sitemap.xml\nAllow: /llms.txt\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}
export function structuredData(path) {
  const [name, description] = PAGES[path];
  const graph = [{ '@type':'Organization', '@id':ORIGIN+'/#organization', name:'Water System', url:ORIGIN+'/', logo:ORIGIN+'/fama-piscinas-logo.png' },
    { '@type':'WebSite', '@id':ORIGIN+'/#website', name:'Water System', url:ORIGIN+'/', inLanguage:'pt-BR', publisher:{'@id':ORIGIN+'/#organization'} },
    { '@type':'WebPage', '@id':ORIGIN+path+'#webpage', url:ORIGIN+path, name, description, inLanguage:'pt-BR', isPartOf:{'@id':ORIGIN+'/#website'} }];
  if (path === '/') graph.push({'@type':'SoftwareApplication', name:'Water System', url:ORIGIN+'/', applicationCategory:'BusinessApplication', operatingSystem:'Web', inLanguage:'pt-BR', description, publisher:{'@id':ORIGIN+'/#organization'}});
  return {'@context':'https://schema.org','@graph':graph};
}
export function metadata(path) {
  const [title, description] = PAGES[path];
  const canonical = ORIGIN+path;
  return `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><script type="application/ld+json" data-fama-seo>${JSON.stringify(structuredData(path)).replaceAll('<','\\u003c')}</script>`;
}
const noindex = 'noindex, nofollow, noarchive';
function resource(request, body, type) {
  return new Response(request.method === 'HEAD' ? null : body, {headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
}
export function withSEO(app, kind) {
  return {...app, async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const readable = ['GET','HEAD'].includes(request.method);
    if (readable && url.pathname === '/robots.txt') return resource(request,robots(kind),'text/plain');
    if (kind === 'system' && readable && url.pathname === '/sitemap.xml') return resource(request,sitemap,'application/xml');
    if (kind === 'system' && readable && url.pathname === '/llms.txt') return resource(request,llms,'text/plain');
    let response = await app.fetch(request,env,ctx);
    if (url.pathname === '/api/health' && request.method === 'GET' && response.ok) {
      const data = await response.json();
      const headers = new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
      return Response.json({...data,version:VERSION,release:RELEASE,releaseId:RELEASE},{status:response.status,headers});
    }
    const isHTML = response.headers.get('Content-Type')?.includes('text/html');
    // A request carrying any session context must never be labelled public/indexable.
    const publicPage = kind === 'system' && Object.hasOwn(PAGES,url.pathname) && !url.search && !request.headers.has('cookie') && !request.headers.has('authorization') && response.status === 200;
    if (isHTML && readable) {
      if (publicPage && request.method === 'GET') {
        response = new HTMLRewriter()
          .on('title, meta[name="description"], meta[name="robots"], meta[property="og:title"], meta[property="og:description"], meta[property="og:url"], meta[name="twitter:title"], meta[name="twitter:description"], link[rel="canonical"], script[data-fama-seo]',{element(e){e.remove();}})
          .on('head',{element(e){e.append(metadata(url.pathname),{html:true});}}).transform(response);
      }
      const headers = new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
      headers.set('X-Robots-Tag',publicPage?'index, follow':noindex);
      headers.set('Cache-Control','private, no-store');
      if (!publicPage && request.method === 'GET') response = new HTMLRewriter().on('meta[name="robots"]',{element(e){e.remove();}}).on('head',{element(e){e.append(`<meta name="robots" content="${noindex}">`,{html:true});}}).transform(response);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if (kind === 'control' || url.pathname.startsWith('/api/')) {
      const headers = new Headers(response.headers);headers.set('X-Robots-Tag',noindex);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    return response;
  }};
}
