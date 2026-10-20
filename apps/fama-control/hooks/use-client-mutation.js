'use client';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ClientRequestError, requestJson } from '@/lib/client-request';
/** One write per key, no automatic retry, and no reply crossing account scopes. */
export function useClientMutation(scope) {
    const currentScope = useRef(scope);
    currentScope.current = scope;
    const pending = useRef(new Map());
    useEffect(() => {
        const requests = pending.current;
        return () => { for (const controller of requests.values())
            controller.abort(); requests.clear(); };
    }, [scope]);
    return useCallback(async function write(url, init, key = url) {
        if (currentScope.current !== scope || pending.current.has(key))
            return null;
        const controller = new AbortController();
        const startedScope = scope;
        pending.current.set(key, controller);
        try {
            const data = await requestJson(url, { ...init, signal: controller.signal });
            if (!data || typeof data !== 'object' || Array.isArray(data))
                throw new ClientRequestError('O sistema não confirmou a gravação. Atualize os registros.', 'invalid');
            return currentScope.current === startedScope && !controller.signal.aborted ? data : null;
        }
        catch (cause) {
            if (controller.signal.aborted || currentScope.current !== startedScope)
                return null;
            const uncertain = cause instanceof ClientRequestError && ['network', 'timeout'].includes(cause.kind);
            toast.error(uncertain ? 'Não foi possível confirmar a gravação. Atualize os registros antes de tentar novamente.' : cause instanceof Error ? cause.message : 'Não foi possível salvar.');
            return null;
        }
        finally {
            if (pending.current.get(key) === controller)
                pending.current.delete(key);
        }
    }, [scope]);
}
