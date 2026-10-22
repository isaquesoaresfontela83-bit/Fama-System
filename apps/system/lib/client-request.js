export class ClientRequestError extends Error {
    kind;
    status;
    constructor(message, kind, status) {
        super(message);
        this.kind = kind;
        this.status = status;
        this.name = 'ClientRequestError';
    }
}
export function isTransientRequestError(error) {
    return error instanceof ClientRequestError && (['network', 'timeout'].includes(error.kind) || error.kind === 'http' && (error.status === 408 || error.status === 429 || (error.status ?? 0) >= 500));
}
/** Bound both fetching and reading JSON. Never retry a mutation. */
export async function requestJson(url, init = {}, timeoutMs = 20_000) {
    const controller = new AbortController();
    let rejectStopped = () => { };
    const stopped = new Promise((_, reject) => { rejectStopped = reject; });
    const cancel = () => { rejectStopped(new ClientRequestError('Solicitação cancelada.', 'aborted')); controller.abort(); };
    const timer = setTimeout(() => { rejectStopped(new ClientRequestError('A conexão demorou mais que o esperado. Tente novamente.', 'timeout')); controller.abort(); }, timeoutMs);
    init.signal?.addEventListener('abort', cancel, { once: true });
    if (init.signal?.aborted)
        cancel();
    const operation = async () => {
        if (controller.signal.aborted)
            throw new ClientRequestError('Solicitação cancelada.', 'aborted');
        let response;
        try {
            response = await fetch(url, { ...init, signal: controller.signal });
        }
        catch {
            throw new ClientRequestError('Não foi possível conectar ao sistema. Confira a conexão e tente novamente.', controller.signal.aborted ? 'aborted' : 'network');
        }
        let data;
        try {
            data = await response.json();
        }
        catch {
            throw new ClientRequestError(response.ok ? 'O sistema retornou uma resposta inválida. Tente novamente.' : 'Não foi possível concluir a solicitação.', response.ok ? 'invalid' : 'http', response.status);
        }
        if (!response.ok) {
            if (response.status >= 500 && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                try { window.dispatchEvent(new CustomEvent('fama:request-failed')); }
                catch { /* Monitoring must never change the original request result. */ }
            }
            const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error.slice(0, 1000) : 'Não foi possível concluir a solicitação.';
            throw new ClientRequestError(message, 'http', response.status);
        }
        return data;
    };
    try {
        return await Promise.race([operation(), stopped]);
    }
    finally {
        clearTimeout(timer);
        init.signal?.removeEventListener('abort', cancel);
    }
}
