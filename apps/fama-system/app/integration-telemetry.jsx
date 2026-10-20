'use client';
import { useEffect } from 'react';
import { integrationErrorFrames } from '@/lib/integration-telemetry';

export function IntegrationTelemetry({ organizationId }) {
    useEffect(() => {
        const abort = new AbortController();
        let active = true, enabled = false, sent = 0;
        const headers = { 'x-organization-id': organizationId };
        function refresh() { return fetch('/api/integrations/sentry', { headers, signal: abort.signal, cache: 'no-store' })
            .then(async response => { if (response.ok) { const data = await response.json(); if (active) enabled = data.enabled === true; } })
            .catch(() => {}); }
        void refresh();
        function report(kind, error) {
            if (!active || !enabled || sent >= 10) return;
            sent++;
            void fetch('/api/integrations/sentry', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: abort.signal,
                body: JSON.stringify({ kind, frames: integrationErrorFrames(error, window.location.origin) }) }).then(response => response.body?.cancel()).catch(() => {});
        }
        const onError = event => report('browser_error', event.error);
        const onRejection = event => report('unhandled_rejection', event.reason);
        const onFailure = () => report('browser_error', null);
        window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection); window.addEventListener('fama:request-failed', onFailure);
        window.addEventListener('fama:integrations-updated', refresh);
        return () => { active = false; abort.abort(); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); window.removeEventListener('fama:request-failed', onFailure); window.removeEventListener('fama:integrations-updated', refresh); };
    }, [organizationId]);
    return null;
}
