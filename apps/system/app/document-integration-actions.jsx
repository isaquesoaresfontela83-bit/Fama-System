'use client';

import { useEffect, useRef, useState } from 'react';
import { CloudUpload, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { requestJson } from '@/lib/client-request';

export function DocumentIntegrationActions({ organizationId, attachments }) {
    const [status, setStatus] = useState(null), [fileId, setFileId] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [text, setText] = useState(''), [driveUrl, setDriveUrl] = useState('');
    const alive = useRef(true), abort = useRef(new AbortController());
    const selectedId = fileId || attachments[0]?.id || '';
    const attachment = attachments.find(item => item.id === selectedId);
    const headers = { 'x-organization-id': organizationId };
    useEffect(() => { alive.current = true; const controller = new AbortController(); abort.current = controller; return () => { alive.current = false; controller.abort(); }; }, []);
    async function load() {
        if (status || busy) return;
        setBusy('loading'); setError('');
        try {
            const data = await requestJson('/api/integrations/documents', { headers, signal: abort.current.signal });
            if (alive.current) setStatus(data);
        } catch (cause) { if (alive.current) setError(cause.message); }
        finally { if (alive.current) setBusy(''); }
    }
    async function run(provider) {
        if (!attachment || busy) return;
        setBusy(provider); setError(''); setNotice(''); setDriveUrl('');
        if (provider === 'ocrspace') setText('');
        try {
            if (!alive.current) return;
            const result = await requestJson('/api/integrations/documents', { method: 'POST', signal: abort.current.signal,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, attachmentId: attachment.id }) }, 60000);
            if (!alive.current) return;
            if (provider === 'ocrspace') { setText(result.text); setNotice(result.partial ? 'A leitura foi parcial. Confira o texto e o limite de 3 páginas.' : 'Texto extraído. Revise antes de copiar e utilizar.'); }
            else if (provider === 'drive') { setDriveUrl(result.url); setNotice('Uma cópia do documento foi criada na pasta Google Drive configurada no servidor.'); }
        } catch (cause) { if (alive.current) setError(cause.message); }
        finally { if (alive.current) setBusy(''); }
    }
    return <details className="document-integration-actions" onToggle={event => { if (event.currentTarget.open) void load(); }}>
        <summary>Ações do documento · Drive e leitura de texto</summary>
        <div className="document-integration-body">
            <label className="form-field"><span>Documento</span><select value={selectedId} disabled={Boolean(busy)} onChange={event => { setFileId(event.target.value); setText(''); setNotice(''); setError(''); setDriveUrl(''); }}>{attachments.map(item => <option key={item.id} value={item.id}>{item.fileName}</option>)}</select></label>
            {busy === 'loading' && <p role="status">Consultando as integrações desta empresa…</p>}
            {status && <>
                <div className="integration-actions">
                    <Button type="button" variant="outline" disabled={Boolean(busy) || !status.drive.configured || !attachment || attachment.sizeBytes > 5 * 1024 * 1024} onClick={() => void run('drive')}><CloudUpload />{busy === 'drive' ? 'Copiando…' : 'Copiar para o Drive'}</Button>
                    <Button type="button" variant="outline" disabled={Boolean(busy) || !status.ocrspace.configured || !attachment || !['application/pdf','image/jpeg','image/png'].includes(attachment.mimeType) || attachment.sizeBytes > 1024 * 1024} onClick={() => void run('ocrspace')}><FileSearch />{busy === 'ocrspace' ? 'Lendo…' : 'Extrair texto'}</Button>
                </div>
                <small>Disponível para proprietários e administradores. As conexões são gerenciadas no backend pelo Fama Control. Drive aceita até 5 MB; leitura de texto, até 1 MB. Confira o texto extraído antes de utilizá-lo.</small>
            </>}
            {notice && <p role="status">{notice}</p>}
            {driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer">Abrir cópia no Google Drive</a>}
            {text && <label className="form-field"><span>Texto extraído para revisão</span><Textarea readOnly value={text} rows={10} /></label>}
            {error && <p className="integration-error" role="alert">{error}</p>}
            {error && !status && <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void load()}>Tentar novamente</Button>}
        </div>
    </details>;
}
