'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAssistantConnectionStatus } from '@/lib/fama-ai-connection';
import { ClientRequestError, requestJson } from '@/lib/client-request';
export function useAssistantConnection({ organizationId, platform, preview }) {
    const scope = preview ? 'preview' : organizationId ? `company:${organizationId}` : platform ? 'platform' : 'none';
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const [status, setStatus] = useState({ scope, state: scope === 'none' || preview ? 'unavailable' : 'checking' });
    const [checking, setChecking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const controller = useRef(null);
    const sequence = useRef(0);
    const refreshRef = useRef(null);
    const state = status.scope === scope ? status.state : 'checking';
    const configured = state === 'ready';
    const cloud = status.scope === scope && configured ? status.cloud : undefined;
    useEffect(() => {
        sequence.current++;
        controller.current?.abort();
        controller.current = null;
        setBusy(false);
        setError('');
        if (preview || (!organizationId && !platform))
            return;
        let active = true;
        let check = 0;
        let statusController = null;
        const verify = async () => {
            if (statusController)
                return;
            const current = new AbortController();
            statusController = current;
            const checkId = ++check;
            setChecking(true);
            setStatus(previous => previous.scope === scope && previous.state === 'ready' ? previous : { scope, state: 'checking' });
            const timeout = setTimeout(() => current.abort(), 10_000);
            try {
                const result = parseAssistantConnectionStatus(await requestJson('/api/assistant', { cache: 'no-store', credentials: 'same-origin', headers: organizationId ? { 'x-organization-id': organizationId } : {}, signal: current.signal }, 10_000));
                if (active && checkId === check && !current.signal.aborted) {
                    setStatus({ scope, state: result.state, cloud: result.cloud });
                }
            }
            catch (cause) {
                if (active && checkId === check) {
                    setStatus({ scope, state: 'unavailable' });
                    if (cause instanceof ClientRequestError && [401, 403].includes(cause.status ?? 0)) {
                        sequence.current++;
                        controller.current?.abort();
                        controller.current = null;
                        setBusy(false);
                    }
                }
            }
            finally {
                clearTimeout(timeout);
                if (statusController === current)
                    statusController = null;
                if (active && checkId === check)
                    setChecking(false);
            }
        };
        refreshRef.current = verify;
        void verify();
        const onVisible = () => { if (!document.hidden)
            void verify(); };
        const timer = setInterval(onVisible, 60_000);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            active = false;
            check++;
            statusController?.abort();
            sequence.current++;
            controller.current?.abort();
            controller.current = null;
            refreshRef.current = null;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [organizationId, platform, preview, scope]);
    const refresh = useCallback(() => refreshRef.current?.(), []);
    function cancel() { sequence.current++; controller.current?.abort(); controller.current = null; setBusy(false); setError(''); }
    async function ask(input) {
        if (preview || scope === 'none')
            return null;
        controller.current?.abort();
        const requestController = new AbortController();
        controller.current = requestController;
        const requestId = ++sequence.current;
        setBusy(true);
        setError('');
        const timeout = setTimeout(() => requestController.abort(), 45_000);
        try {
            const response = await fetch('/api/assistant', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(organizationId ? { 'x-organization-id': organizationId } : {}) }, body: JSON.stringify({ ...input, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), signal: requestController.signal });
            const result = await response.json();
            if (!response.ok || !result.answer)
                throw new Error(result.error || 'Não foi possível responder agora.');
            if (requestId !== sequence.current || requestController.signal.aborted || scopeRef.current !== scope)
                return null;
            return result.answer;
        }
        catch (cause) {
            if (requestId === sequence.current && scopeRef.current === scope)
                setError(requestController.signal.aborted ? 'A consulta levou mais tempo que o esperado. Tente novamente ou consulte os registros carregados.' : cause instanceof Error ? cause.message : 'Não foi possível consultar o sistema.');
            return null;
        }
        finally {
            clearTimeout(timeout);
            if (requestId === sequence.current && scopeRef.current === scope) {
                setBusy(false);
                controller.current = null;
            }
        }
    }
    return { configured, state, cloud, checking, refresh, busy, error, ask, cancel };
}
