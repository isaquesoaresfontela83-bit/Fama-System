'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAssistantSettings, parseAssistantSettingsEnvelope } from '@/lib/fama-ai-settings';
import { requestJson, isTransientRequestError } from '@/lib/client-request';
async function readEnvelope(request) {
    const payload = await request;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Configuração indisponível.');
    if (payload.ok === false)
        throw new Error(payload.error || payload.message || 'Não foi possível carregar a configuração.');
    return parseAssistantSettingsEnvelope(payload.data ?? payload);
}
export function useFamaAiSettings(enabled = true) {
    const [value, setValue] = useState(null);
    const [error, setError] = useState('');
    const mounted = useRef(false);
    const generation = useRef(0);
    const pending = useRef(null);
    const refresh = useCallback(() => {
        if (pending.current)
            return pending.current.promise;
        const controller = new AbortController();
        const attempt = generation.current;
        const promise = readEnvelope(requestJson('/api/ai-settings', { cache: 'no-store', signal: controller.signal }, 15_000)).then(next => {
            if (mounted.current && attempt === generation.current) {
                setValue(previous => previous && previous.revision >= next.revision ? previous : next);
                setError('');
            }
            return next;
        }).catch(failure => {
            if (mounted.current && attempt === generation.current) {
                if (!isTransientRequestError(failure))
                    setValue(null);
                setError(failure instanceof Error ? failure.message : 'Falha ao carregar a configuração.');
            }
            throw failure;
        }).finally(() => { if (pending.current?.controller === controller)
            pending.current = null; });
        pending.current = { controller, promise };
        return promise;
    }, []);
    useEffect(() => {
        if (!enabled)
            return;
        mounted.current = true;
        let lastAutomatic = 0;
        const reload = () => {
            if (document.hidden || navigator.onLine === false || Date.now() - lastAutomatic < 5000)
                return;
            lastAutomatic = Date.now();
            void refresh().catch(() => undefined);
        };
        reload();
        window.addEventListener('focus', reload);
        window.addEventListener('online', reload);
        document.addEventListener('visibilitychange', reload);
        const timer = window.setInterval(reload, 60_000);
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fama-ai-settings') : null;
        if (channel)
            channel.onmessage = () => { void refresh().catch(() => undefined); };
        return () => { mounted.current = false; generation.current++; pending.current?.controller.abort(); pending.current = null; window.removeEventListener('focus', reload); window.removeEventListener('online', reload); document.removeEventListener('visibilitychange', reload); window.clearInterval(timer); channel?.close(); };
    }, [refresh, enabled]);
    const save = async (settings, revision) => {
        const next = await readEnvelope(requestJson('/api/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: parseAssistantSettings(settings), revision }) }, 15_000));
        if (mounted.current) {
            setValue(previous => previous && previous.revision >= next.revision ? previous : next);
            setError('');
        }
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('fama-ai-settings');
            channel.postMessage('updated');
            channel.close();
        }
        return next;
    };
    return { value, error, refresh, save };
}
