/** A fresh document response bypasses an old app tab without clearing credentials. */
export function readerRefreshResponse() {
    const destination = `/?leitor=camera-foto&atualizacao=${crypto.randomUUID()}`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atualizar leitor · Fama System</title><style>body{margin:0;background:#07182b;color:#edf6ff;font:16px system-ui;display:grid;min-height:100dvh;place-items:center}main{padding:28px;max-width:440px}h1{font-size:26px}p{line-height:1.6;color:#b9cee2}a{display:inline-block;background:#1496ee;color:white;padding:14px 20px;border-radius:12px;text-decoration:none}</style></head><body><main><h1>Atualizando o leitor</h1><p>Estamos reabrindo o sistema com a leitura por câmera e foto. Seu login e seus cadastros serão mantidos.</p><a href="${destination}">Abrir sistema atualizado</a></main><script>(async()=>{try{if('serviceWorker' in navigator){const registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(registration=>registration.unregister()));}}catch{}window.location.replace(${JSON.stringify(destination)});})();</script></body></html>`;
    return new Response(html, { headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
            "Clear-Site-Data": '"cache"',
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Fama-Reader": "camera-photo-wasm-1",
        } });
}
