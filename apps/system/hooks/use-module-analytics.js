'use client';
import { useEffect, useState } from 'react';
import { requestJson } from '@/lib/client-request';
import { analyticsRequestsFor, analyticsResources } from '@/lib/module-analytics';

export function useModuleAnalytics({ organizationId, scope, section, allowed }) {
    const resources = analyticsRequestsFor(section, allowed);
    const resourceKey = resources.join(',');
    const key = `${scope}:${organizationId}:${resourceKey}`;
    const [snapshot, setSnapshot] = useState({ key: '', context: {} });
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        const context = Object.fromEntries(resources.map(resource => [resource, { status: 'loading' }]));
        setSnapshot({ key, context });
        for (const resource of resources) {
            const spec = analyticsResources[resource];
            void requestJson(spec.url, { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: controller.signal }).then(data => {
                if (spec.fields.some(field => !Array.isArray(data?.[field]))) throw new Error('Resposta incompleta.');
                if (!controller.signal.aborted) setSnapshot(current => current.key === key ? { key, context: { ...current.context, [resource]: { status: 'ready', data } } } : current);
            }).catch(() => {
                if (!controller.signal.aborted) setSnapshot(current => current.key === key ? { key, context: { ...current.context, [resource]: { status: 'error' } } } : current);
            });
        }
        return () => controller.abort();
    }, [key, resourceKey, organizationId, revision]);
    return { context: snapshot.key === key ? snapshot.context : {}, refresh: () => setRevision(value => value + 1), loading: snapshot.key !== key || Object.values(snapshot.context).some(source => source.status === 'loading') };
}
