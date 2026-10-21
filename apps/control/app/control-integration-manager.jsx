'use client';
import { useEffect, useRef, useState } from 'react';
import { Save, ShieldCheck, RefreshCw, FileText, CloudUpload, FileSearch, Mail, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { integrationProviders } from '@/lib/integration-catalog';
import { integrationFields } from '@/lib/integration-settings';
import { requestJson } from '@/lib/client-request';

function ConfigurationCard({ definition, value, legacy, onSave, onTest, onConnect, busy }) {
    const [fields, setFields] = useState({}), [enabled, setEnabled] = useState(true), [clearFields, setClearFields] = useState([]);
    useEffect(() => {
        setFields(Object.fromEntries(integrationFields[definition.id].map(field => [field.id, field.secret ? '' : value?.fields?.[field.id] || ''])));
        setEnabled(value?.enabled !== false); setClearFields([]);
    }, [definition.id, value?.revision]);
    const state = !value ? 'Conferindo configuração' : !value.enabled ? 'Pausada' : value.configured ? 'Configuração salva' : legacy?.configured ? 'Conexão existente · cadastro interno em preparação' : 'Configuração pendente';
    return <article className="control-integration-card">
        <div className="control-integration-card-heading"><h3>{definition.name}</h3><span className={value?.configured && value.enabled ? 'configured' : ''}>{state}</span></div>
        <p>{definition.description}</p>
        <details className="integration-config-form"><summary>Configurar {definition.name}</summary>
            <form onSubmit={event => { event.preventDefault(); void onSave({ provider: definition.id, fields, enabled, clearFields, expectedRevision: value?.revision ?? 0 }); }}>
                {integrationFields[definition.id].map(field => <label className="form-field" key={field.id}><span>{field.label}</span>
                    <Input aria-label={`${definition.name}: ${field.label}`} type={field.secret ? 'password' : 'text'} autoComplete={field.secret ? 'new-password' : 'off'} value={fields[field.id] || ''} placeholder={field.secret && value?.present?.[field.id] ? 'Valor salvo · preencha para substituir' : ''} disabled={busy || clearFields.includes(field.id)} maxLength={6000} onChange={event => setFields(current => ({ ...current, [field.id]: event.target.value }))}/>
                    {value?.present?.[field.id] && <span className="integration-remove-field"><input type="checkbox" checked={clearFields.includes(field.id)} disabled={busy} onChange={event => setClearFields(current => event.target.checked ? [...current, field.id] : current.filter(id => id !== field.id))}/>Apagar este valor ao salvar</span>}
                </label>)}
                <label className="integration-enabled"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)}/>Ativar esta integração</label>
                <p className="integration-form-help">Valores secretos ficam ocultos após salvar. Campos secretos vazios preservam o valor atual. Um cadastro incompleto mantém a conexão anterior até ficar pronto; pausar interrompe o uso.</p>
                {definition.id === 'drive' && <p className="integration-form-help">Salve o identificador e o segredo do aplicativo e clique em Conectar Google. Se a pasta ficar vazia, o Fama cria uma pasta de documentos durante a conexão. Retorno autorizado do aplicativo: <code>https://control.famasystem.online/api/admin/integrations/google/callback</code>.</p>}
                {definition.id === 'ipinfo' && <p className="integration-form-help">Sem token, utiliza a consulta pública disponível. Com o token, utiliza IPinfo Lite.</p>}
                <Button type="submit" disabled={busy || !value}><Save />Salvar configuração</Button>
            </form>
        </details>
        <div className="integration-card-actions"><Button type="button" variant="outline" disabled={busy || !value?.managed} onClick={() => void onTest(definition.id)}><ShieldCheck />Testar configuração salva</Button>
            {definition.id === 'drive' && <Button type="button" variant="outline" disabled={busy || !value?.present?.clientId || !value?.present?.clientSecret || !value?.enabled} onClick={() => void onConnect()}><Link2 />Conectar Google</Button>}
        </div>
    </article>;
}

export function ControlIntegrationManager({ legacyProviders, onChanged }) {
    const [state, setState] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0), [busy, setBusy] = useState('');
    const [file, setFile] = useState(null), [recipient, setRecipient] = useState(''), [subject, setSubject] = useState('Documento enviado pelo Fama'), [message, setMessage] = useState('Segue o documento solicitado.');
    const [text, setText] = useState(''), [driveFiles, setDriveFiles] = useState(null), [issues, setIssues] = useState(null);
    const operation = useRef(null), controller = useRef(null);
    useEffect(() => { const abort = new AbortController(); controller.current = abort; return () => abort.abort(); }, []);
    useEffect(() => {
        const abort = new AbortController();
        requestJson('/api/admin/integrations/config', { cache: 'no-store', signal: abort.signal }).then(setState).catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
        return () => abort.abort();
    }, [revision]);
    useEffect(() => {
        const status = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('drive') : '';
        if (status === 'connected') setNotice('Google Drive conectado. Os documentos podem ser gerenciados aqui.');
        if (status === 'failed') setError('A conexão com o Google não foi concluída. Confira os dados do aplicativo e conecte novamente.');
    }, []);
    async function run(name, job) {
        if (busy) return;
        setBusy(name); setError(''); setNotice('');
        try { await job(); setRevision(value => value + 1); }
        catch (cause) { if (!controller.current?.signal.aborted) setError(cause.message); }
        finally { setBusy(''); }
    }
    async function action(body) {
        return requestJson('/api/admin/integrations/actions', { method: 'POST', signal: controller.current?.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 65000);
    }
    function save(input) { return run('save-' + input.provider, async () => {
        await requestJson('/api/admin/integrations/config', { method: 'PATCH', signal: controller.current?.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        setNotice(input.enabled ? 'Configuração salva com proteção no servidor.' : 'Integração pausada para toda a plataforma.'); onChanged?.();
    }); }
    function test(provider) { return run('test-' + provider, async () => { const result = await action({ action: 'test', provider }); setNotice(result.message); }); }
    function connect() { return run('connect', async () => {
        const result = await requestJson('/api/admin/integrations/google', { method: 'POST', signal: controller.current?.signal });
        const url = new URL(result.authorizationUrl);
        if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') throw new Error('Endereço de autorização inválido.');
        window.location.assign(url.href);
    }); }
    async function encodedFile() {
        if (!file) throw new Error('Selecione um PDF, JPG ou PNG.');
        if (file.size > 5 * 1024 * 1024) throw new Error('Selecione um documento de até 5 MB.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset+8192));
        return { name: file.name, mime_type: file.type, base64: btoa(binary) };
    }
    function documentAction(provider) { return run(provider, async () => {
        if (provider === 'ocrspace' && file?.size > 1024 * 1024) throw new Error('A leitura de texto aceita até 1 MB.');
        operation.current ||= crypto.randomUUID();
        const result = await action({ action: { drive: 'drive_upload', resend: 'resend_send', ocrspace: 'ocr_extract' }[provider], file: await encodedFile(), ...(provider === 'resend' ? { to: recipient, subject, text: message, request_id: operation.current } : {}) });
        if (provider === 'ocrspace') { setText(result.text); setNotice(result.partial ? 'Leitura parcial. Revise o texto extraído.' : 'Texto extraído. Revise antes de utilizar.'); }
        else if (provider === 'drive') setNotice('Cópia criada na pasta de documentos do Google Drive.');
        else setNotice(result.alreadySent ? 'Este envio já havia sido aceito; nenhuma duplicata foi enviada.' : 'E-mail aceito pelo Resend. A aceitação ainda não confirma entrega.');
    }); }
    const ready = provider => state?.integrations?.some(item => item.provider === provider && item.available);
    const stateLabel = value => ({ saved: 'Configuração salva', confirmed: 'Confirmado', accepted: 'Aceito pelo provedor', processing: 'Em processamento', uncertain: 'Sem confirmação', review: 'Precisa de validação' }[value] || value);
    return <div className="integration-manager">
        <p className="control-muted">Configure, ative, teste e acompanhe as seis integrações aqui. Na primeira conexão, cada provedor ainda pode exigir cadastro, credenciais ou autorização da própria conta.</p>
        {error && <p className="control-error" role="alert">{error}</p>}
        {notice && <p className="integration-notice" role="status">{notice}</p>}
        <div className="control-integration-grid">{integrationProviders.map(definition => <ConfigurationCard key={definition.id} definition={definition} value={state?.integrations?.find(item => item.provider === definition.id)} legacy={legacyProviders?.find(item => item.id === definition.id)} onSave={save} onTest={test} onConnect={connect} busy={Boolean(busy)}/>)}</div>
        {!state && <Button variant="outline" onClick={() => setRevision(value => value + 1)} disabled={Boolean(busy)}><RefreshCw />Conferir central novamente</Button>}
        <section className="integration-document-center" aria-label="Documentos e consultas das integrações"><h3><FileText />Documentos e monitoramento</h3>
            <label className="form-field"><span>Documento para Drive, e-mail ou leitura de texto</span><Input type="file" accept="application/pdf,image/png,image/jpeg" disabled={Boolean(busy)} onChange={event => { setFile(event.target.files?.[0] || null); setText(''); operation.current = null; }}/></label>
            <p className="integration-form-help">O arquivo só é enviado ao clicar em uma ação. Drive e e-mail aceitam até 5 MB; extração de texto, até 1 MB.</p>
            <div className="integration-card-actions"><Button variant="outline" disabled={Boolean(busy) || !file || !ready('drive')} onClick={() => void documentAction('drive')}><CloudUpload />Copiar documento para o Drive</Button><Button variant="outline" disabled={Boolean(busy) || !file || !ready('ocrspace')} onClick={() => void documentAction('ocrspace')}><FileSearch />Extrair texto</Button></div>
            {text && <label className="form-field"><span>Texto extraído para revisão</span><Textarea readOnly value={text} rows={10}/></label>}
            <form className="integration-email-form" onSubmit={event => { event.preventDefault(); void documentAction('resend'); }}><h4><Mail />Enviar documento por e-mail</h4>
                <label className="form-field"><span>Destinatário</span><Input type="email" value={recipient} required disabled={Boolean(busy)} onChange={event => { setRecipient(event.target.value); operation.current = null; }}/></label>
                <label className="form-field"><span>Assunto</span><Input value={subject} maxLength={180} required disabled={Boolean(busy)} onChange={event => { setSubject(event.target.value); operation.current = null; }}/></label>
                <label className="form-field"><span>Mensagem</span><Textarea value={message} maxLength={4000} disabled={Boolean(busy)} onChange={event => { setMessage(event.target.value); operation.current = null; }}/></label>
                <p>Confira o destinatário e o arquivo <strong>{file?.name || 'ainda não selecionado'}</strong> antes de enviar.</p><Button type="submit" disabled={Boolean(busy) || !file || !ready('resend')}>Confirmar e enviar documento</Button>
            </form>
            <div className="integration-card-actions"><Button variant="outline" disabled={Boolean(busy) || !ready('drive')} onClick={() => void run('files', async () => { setDriveFiles((await action({ action: 'drive_list' })).files); })}>Ver documentos do Drive</Button><Button variant="outline" disabled={Boolean(busy) || !ready('sentry')} onClick={() => void run('issues', async () => { setIssues((await action({ action: 'sentry_issues' })).issues); })}>Consultar erros do Sentry</Button></div>
            {driveFiles && <div className="integration-result-list"><h4>Documentos na pasta do Fama</h4>{driveFiles.length ? <ul>{driveFiles.map(item => <li key={item.id}><span>{item.name}</span>{['application/pdf','image/png','image/jpeg'].includes(item.mimeType) && <a href={'/api/admin/integrations/documents?id=' + encodeURIComponent(item.id)} download>Baixar documento</a>}</li>)}</ul> : <p>Nenhum documento nesta pasta.</p>}</div>}
            {issues && <div className="integration-result-list"><h4>Erros pendentes no Sentry</h4>{issues.length ? <ul>{issues.map(item => <li key={item.id}>{item.title} · {item.count} ocorrência(s)</li>)}</ul> : <p>Nenhum erro retornado pelo projeto.</p>}</div>}
        </section>
        <section className="integration-history"><h3>Atividade no Fama</h3><p>Operações iniciadas por esta central e envios de documentos. Não inclui ações realizadas diretamente nos provedores.</p>{state?.activity?.length ? <ul>{state.activity.map((item,index) => <li key={`${item.createdAt}-${index}`}><strong>{integrationProviders.find(provider => provider.id === item.provider)?.name || item.provider}</strong><span>{stateLabel(item.status)}</span><time>{new Date(item.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time>{item.action === 'resend_send' && item.status === 'accepted' && <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void run('delivery', async () => { const result = await action({ action: 'resend_status', id: item.resultId }); setNotice('Situação do envio no Resend: ' + result.status); })}>Consultar entrega</Button>}</li>)}</ul> : <p>Nenhuma atividade registrada nesta central.</p>}</section>
    </div>;
}
