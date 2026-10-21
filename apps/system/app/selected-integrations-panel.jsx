'use client';
import { useEffect, useState } from 'react';
import { Link2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectedIntegrations } from '@/lib/selected-integrations';
import { requestJson } from '@/lib/client-request';

export function SelectedIntegrationsPanel({ organizationId }) {
    const [items, setItems] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    useEffect(() => {
        const abort = new AbortController();
        setItems(null); setError('');
        requestJson('/api/integrations', { headers: { 'x-organization-id': organizationId }, signal: abort.signal })
            .then(data => { if (!abort.signal.aborted) setItems(data.integrations); })
            .catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
        return () => abort.abort();
    }, [organizationId, revision]);
    return <details id="integracoes" className="surface settings-section selected-integrations">
        <summary><Link2 aria-hidden="true" /><span><strong>Integrações</strong><small>Drive, e-mail, monitoramento e leitura de documentos</small></span><b>{selectedIntegrations.length}</b></summary>
        <div className="selected-integrations-body">
            <p>Configuração, ativação e testes ficam na central de Integrações do Fama Control. As credenciais permanecem protegidas no servidor.</p>
            {!items && !error && <p role="status"><Loader2 className="spin-icon" /> Conferindo configurações…</p>}
            {error && <p role="alert">{error}</p>}
            {items && selectedIntegrations.map(definition => {
                const item = items.find(value => value.provider === definition.id);
                return <article className="integration-card" key={definition.id}>
                    <div className="integration-card-body"><strong>{definition.name}</strong><p>{definition.description}</p>
                        <span className={`integration-state ${item?.configured ? 'ready' : ''}`}>{item?.configured ? 'Configuração presente' : 'Configuração pendente'}</span>
                        <p className="integration-hint">{definition.id === 'sentry' ? 'O monitoramento utiliza o serviço configurado pela plataforma.' : 'Use Ações do documento nos arquivos anexados a um registro.'}</p>
                    </div>
                </article>;
            })}
            <p><small>A configuração presente ainda depende de validação com o serviço real. Proprietários e administradores podem utilizar as ações dos documentos.</small></p>
            <Button type="button" variant="outline" onClick={() => setRevision(value => value + 1)}><RefreshCw />Conferir novamente</Button>
        </div>
    </details>;
}
