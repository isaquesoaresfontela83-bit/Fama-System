export function installHybridNetwork(scope = window) {
    const original = scope.fetch.bind(scope);
    scope.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, scope.location.href);
        if (url.origin !== scope.location.origin || !url.pathname.startsWith('/api/')) return original(input, init);
        const announce = value => scope.dispatchEvent(new CustomEvent('fama-service-state', { detail: value }));
        const timer = scope.setTimeout(() => announce('waiting'), 5000);
        try {
            const response = await original(input, init);
            announce('ready');
            const type = response.headers.get('content-type') || '';
            if (type.includes('text/html') || response.status >= 500 && !type.includes('application/json')) {
                return new Response(JSON.stringify({ error: 'O serviço está iniciando ou indisponível. Aguarde e tente novamente.' }), {
                    status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
                });
            }
            return response;
        } catch (error) { announce('offline'); throw error; }
        finally { scope.clearTimeout(timer); }
    };
    return () => { scope.fetch = original; };
}
