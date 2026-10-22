const csp="default-src 'self'; base-uri 'self'; frame-ancestors 'none'; frame-src 'self' https://www.openstreetmap.org https://accounts.google.com https://embed.waze.com; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client; script-src-attr 'none'; worker-src 'self'; connect-src 'self' http://127.0.0.1:17843/status http://127.0.0.1:17843/scan https://accounts.google.com https://www.googleapis.com https://cep.awesomeapi.com.br https://brasilapi.com.br https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://*.supabase.co https://huggingface.co https://*.hf.co https://*.huggingface.co; form-action 'self'";
export function createEdgeProxy({publicOrigin,staticOrigin,apiOrigin,control=false},send=fetch){
    const expected=new URL(publicOrigin).origin,staticUrl=new URL(staticOrigin).origin,apiUrl=new URL(apiOrigin).origin;
    if([expected,staticUrl,apiUrl].some(origin=>!origin.startsWith('https://')))throw new Error('HTTPS required');
    return {async fetch(request){
        const source=new URL(request.url);
        if(source.origin!==expected)return new Response('Not Found',{status:404});
        const api=source.pathname==='/api'||source.pathname.startsWith('/api/')||source.pathname.startsWith('/_next/')||['/robots.txt','/sitemap.xml'].includes(source.pathname)||/^\/(?:configurar-asaas|atualizar-leitor)(?:\/|$)/.test(source.pathname);
        const target=new URL(api?apiUrl:staticUrl);target.pathname=source.pathname;target.search=source.search;
        const document=!api&&['GET','HEAD'].includes(request.method)&&!source.pathname.split('/').at(-1).includes('.');
        if(document){target.pathname='/';target.search='';}
        const headers=new Headers(request.headers);headers.delete('host');headers.set('X-Forwarded-Host',source.host);headers.set('X-Forwarded-Proto','https');
        if(!api){headers.delete('cookie');headers.delete('authorization');}
        const options={method:request.method,headers,redirect:'manual',signal:AbortSignal.any([request.signal,AbortSignal.timeout(55000)])};
        if(!['GET','HEAD'].includes(request.method)){options.body=request.body;options.duplex='half';}
        let upstream;try{upstream=await send(new Request(target,options));}catch{return new Response(api?JSON.stringify({error:'O serviço está iniciando ou indisponível. Aguarde e tente novamente.'}):'O serviço está iniciando. Aguarde e atualize a página.',{status:503,headers:{'Content-Type':api?'application/json':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
        const response=new Response(upstream.body,upstream),location=response.headers.get('location');
        if(location){const dest=new URL(location,target);if([staticUrl,apiUrl].includes(dest.origin)){dest.host=source.host;dest.protocol=source.protocol;response.headers.set('location',dest.href);}}
        response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
        response.headers.set('Permissions-Policy',control?'camera=(), microphone=(self), geolocation=(), payment=()':'camera=(self), microphone=(self), geolocation=(self), payment=()');
        response.headers.set('Cross-Origin-Opener-Policy','same-origin-allow-popups');response.headers.set('Cross-Origin-Resource-Policy','same-origin');response.headers.set('Content-Security-Policy',csp);
        if(api||document)response.headers.set('Cache-Control','private, no-store');
        response.headers.set('X-Fama-Edge','hybrid-15.8.0');return response;
    }};
}
