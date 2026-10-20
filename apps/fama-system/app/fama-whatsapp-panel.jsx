'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Loader2, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { requestJson } from '@/lib/client-request';
import { whatsappChatUrl, whatsappPhoneInput } from '@/lib/fama-whatsapp';
function preferredMember(data) {
    return data.members.some(member => member.id === data.currentMemberId) ? data.currentMemberId : data.members.length === 1 ? data.members[0].id : '';
}
export function FamaWhatsappPanel({ organizationId, mode = 'assistant' }) {
    const chatMode = mode === 'chat', title = chatMode ? 'Conectar WhatsApp ao Chat' : 'Fama IA no WhatsApp';
    const [loaded, setLoaded] = useState(null);
    const data = loaded?.organizationId === organizationId ? loaded.data : null;
    const [error, setError] = useState(''), [reload, setReload] = useState(0), [busy, setBusy] = useState(false), [checking, setChecking] = useState(false);
    const [phoneNumberId, setPhoneNumberId] = useState(''), [accessToken, setAccessToken] = useState(''), [appSecret, setAppSecret] = useState('');
    const [memberId, setMemberId] = useState(''), [phone, setPhone] = useState(''), [confirmed, setConfirmed] = useState(false);
    const [editing, setEditing] = useState(false), [showWebhook, setShowWebhook] = useState(false);
    const scope = useRef(organizationId), controller = useRef(null), saving = useRef(false), refreshing = useRef(false), revision = useRef(0);
    useEffect(() => {
        scope.current = organizationId;
        const abort = new AbortController();
        controller.current = abort;
        saving.current = false;
        refreshing.current = false;
        revision.current++;
        queueMicrotask(() => {
            if (abort.signal.aborted)
                return;
            setLoaded(null);
            setError('');
            setBusy(false);
            setChecking(false);
            setEditing(false);
            setShowWebhook(false);
            setAccessToken('');
            setAppSecret('');
            setPhone('');
            setMemberId('');
            setConfirmed(false);
            setPhoneNumberId('');
        });
        requestJson('/api/whatsapp/assistant', { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: abort.signal })
            .then(value => {
            if (!abort.signal.aborted && scope.current === organizationId) {
                setLoaded({ organizationId, data: value });
                setPhoneNumberId(value.connection?.phoneNumberId || '');
                setMemberId(preferredMember(value));
            }
        })
            .catch(reason => { if (!abort.signal.aborted && scope.current === organizationId)
            setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o WhatsApp.'); });
        return () => abort.abort();
    }, [organizationId, reload]);
    const refreshConnection = useCallback(async (manual = false) => {
        const abort = controller.current, version = revision.current;
        if (!abort || abort.signal.aborted || saving.current || refreshing.current)
            return;
        refreshing.current = true;
        if (manual) {
            setChecking(true);
            setError('');
        }
        try {
            const value = await requestJson('/api/whatsapp/assistant', { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: abort.signal });
            if (!abort.signal.aborted && scope.current === organizationId && revision.current === version)
                setLoaded({ organizationId, data: value });
        }
        catch (reason) {
            if (manual && !abort.signal.aborted && scope.current === organizationId && revision.current === version)
                setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a confirmação.');
        }
        finally {
            if (!abort.signal.aborted && scope.current === organizationId) {
                refreshing.current = false;
                setChecking(false);
            }
        }
    }, [organizationId]);
    const connection = data?.connection;
    const connectionId = connection?.id, webhookVerified = connection?.webhookVerified;
    useEffect(() => {
        if (!connectionId || webhookVerified)
            return;
        let cancelled = false, timer;
        const check = async () => {
            if (typeof document === 'undefined' || !document.hidden)
                await refreshConnection();
            if (!cancelled)
                timer = setTimeout(check, 5000);
        };
        timer = setTimeout(check, 5000);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [connectionId, webhookVerified, refreshConnection]);
    async function save(body) {
        if (saving.current)
            return;
        saving.current = true;
        revision.current++;
        setBusy(true);
        setError('');
        const current = organizationId, abort = controller.current;
        try {
            const value = await requestJson('/api/whatsapp/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': current }, body: JSON.stringify(body), signal: abort?.signal }, 30_000);
            if (abort?.signal.aborted || scope.current !== current)
                return;
            setLoaded({ organizationId: current, data: value });
            if (body.action === 'save') {
                setPhoneNumberId(value.connection?.phoneNumberId || '');
                setEditing(false);
            }
            if (body.action === 'link') {
                setPhone('');
                setMemberId(preferredMember(value));
                setConfirmed(false);
            }
            toast.success(body.action === 'enable' ? body.enabled ? 'Fama IA ativada no WhatsApp.' : 'Fama IA pausada no WhatsApp.' : body.action === 'link' ? 'Telefone autorizado.' : 'Configuração do WhatsApp salva.');
        }
        catch (reason) {
            if (!abort?.signal.aborted && scope.current === current)
                setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
        }
        finally {
            if (!abort?.signal.aborted && scope.current === current) {
                setAccessToken('');
                setAppSecret('');
                saving.current = false;
                setBusy(false);
            }
        }
    }
    async function copy(value) {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Copiado.');
        }
        catch {
            toast.error('Selecione e copie o texto do campo.');
        }
    }
    if (!data)
        return <section className="surface settings-section" aria-label={title}><h2>{title}</h2>{error ? <><p role="alert">{error}</p><Button type="button" onClick={() => setReload(value => value + 1)}>Tentar novamente</Button></> : <p role="status">Carregando conexão…</p>}</section>;
    const ready = connection?.verified && connection.webhookVerified && (chatMode || data.links.length > 0);
    let normalizedPhone = '';
    try {
        normalizedPhone = whatsappPhoneInput(phone);
    }
    catch { /* Incomplete numbers keep authorization disabled. */ }
    const chatUrl = connection?.enabled && ready ? whatsappChatUrl(connection.displayPhone) : '';
    const steps = [
        { label: 'Conectar número', complete: Boolean(connection?.verified) },
        { label: 'Confirmar recebimento', complete: Boolean(connection?.webhookVerified) },
        ...(!chatMode ? [{ label: 'Autorizar e ativar', complete: Boolean(ready && connection?.enabled) }] : []),
    ];
    return <section className="surface settings-section" aria-label={title}>
    <div className="panel-heading"><div><small>WHATSAPP DA EMPRESA</small><h2><MessageCircle aria-hidden="true"/> {title}</h2></div>{!chatMode && <Button type="button" variant={connection?.enabled ? 'outline' : 'default'} disabled={busy || (!connection?.enabled && !ready)} onClick={() => void save({ action: 'enable', enabled: !connection?.enabled })}>{busy && <Loader2 className="spin-icon"/>}{connection?.enabled ? 'Pausar IA' : 'Ativar IA'}</Button>}</div>
    <p className="finance-help">{chatMode ? 'Conecte a API oficial do WhatsApp Business para receber mensagens e atender dentro do Chat.' : 'Consulte agenda, orçamentos e financeiro pelo WhatsApp da empresa. Cada telefone autorizado usa as permissões do seu usuário. As respostas usam a IA nativa Fama.'}</p>
    <ol className="fama-whatsapp-steps" aria-label="Etapas do vínculo">{steps.map((step, index) => <li key={step.label} className={step.complete ? 'complete' : ''}><span aria-hidden="true">{step.complete ? <Check /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.complete ? 'Concluído' : 'Pendente'}</small></div></li>)}</ol>
    <p role="status">{chatMode ? ready ? 'Conexão pronta para atendimento no Chat.' : !connection ? 'Conecte o número oficial do WhatsApp Business da empresa para começar.' : 'Número conectado. Confirme o recebimento na Meta para continuar.' : connection?.enabled ? 'IA ativa para a equipe autorizada.' : !connection ? 'Conecte o número oficial do WhatsApp Business da empresa para começar.' : !connection.webhookVerified ? 'Número conectado. Confirme o recebimento na Meta para continuar.' : !data.links.length ? 'Recebimento confirmado. Autorize seu telefone pessoal para continuar.' : 'Tudo pronto. Ative a IA para começar a conversar.'}{connection?.displayPhone ? ' Número da empresa: ' + connection.displayPhone + '.' : ''}</p>
    {error && <p role="alert">{error}</p>}

    <div className="fama-whatsapp-step">
      <div className="panel-heading"><h3>1. Número da empresa</h3>{connection && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(value => !value)}>{editing ? 'Fechar configuração' : 'Alterar conexão'}</Button>}</div>
      {(!connection || editing) ? <>
        <p className="finance-help">Abra o aplicativo da empresa na Meta e copie os dados da API do WhatsApp. A chave secreta fica nas configurações do aplicativo. Você só precisa cadastrar esses dados uma vez.</p>
        <div className="settings-grid">
          <label className="form-field"><Label>ID do número na Meta</Label><Input aria-label="ID do número na Meta" value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} inputMode="numeric" autoComplete="off" maxLength={30} disabled={busy}/></label>
          <label className="form-field"><Label>Token de acesso{connection ? ' — deixe vazio para manter' : ''}</Label><Input aria-label="Token de acesso Meta" type="password" value={accessToken} onChange={event => setAccessToken(event.target.value)} autoComplete="new-password" maxLength={4096} disabled={busy}/></label>
          <label className="form-field"><Label>Chave secreta do aplicativo Meta{connection ? ' — deixe vazia para manter' : ''}</Label><Input aria-label="Chave secreta Meta" type="password" value={appSecret} onChange={event => setAppSecret(event.target.value)} autoComplete="new-password" maxLength={32} disabled={busy}/></label>
        </div>
        <div className="fiscal-portal-actions"><Button type="button" disabled={busy || !phoneNumberId.trim() || (!connection && (!accessToken || !appSecret))} onClick={() => void save({ action: 'save', phoneNumberId: phoneNumberId.trim(), accessToken: accessToken.trim(), appSecret: appSecret.trim() })}>Conferir e salvar conexão</Button>{!chatMode && <Button asChild type="button" variant="outline"><a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"><ExternalLink />Abrir aplicativo na Meta</a></Button>}</div>
      </> : <p className="finance-help">Número conectado: <strong>{connection.displayPhone || connection.phoneNumberId}</strong>. As credenciais estão salvas com segurança.</p>}
    </div>

    {connection && <>
      <div className="fama-whatsapp-step">
        <div className="panel-heading"><h3>2. Receber mensagens</h3>{connection.webhookVerified && <Button type="button" size="sm" variant="outline" onClick={() => setShowWebhook(value => !value)}>{showWebhook ? 'Ocultar dados' : 'Ver configuração'}</Button>}</div>
        {(!connection.webhookVerified || showWebhook) && <>
          <p className="finance-help">No WhatsApp do aplicativo Meta, configure o recebimento de mensagens: cole o endereço e o token abaixo, confirme a verificação e assine o campo <strong>messages</strong>.</p>
          <div className="settings-grid">
            <label className="form-field span-2"><Label>Endereço para recebimento</Label><Input aria-label="Endereço para recebimento" value={connection.webhookUrl} readOnly/><Button type="button" size="sm" variant="outline" onClick={() => void copy(connection.webhookUrl)}><Copy />Copiar endereço</Button></label>
            <label className="form-field"><Label>Token de verificação</Label><Input aria-label="Token de verificação" value={connection.verifyToken} readOnly/><Button type="button" size="sm" variant="outline" onClick={() => void copy(connection.verifyToken)}><Copy />Copiar token</Button></label>
          </div>
          <div className="fiscal-portal-actions">{!chatMode && <Button asChild type="button" variant="outline"><a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"><ExternalLink />Abrir Meta</a></Button>}<Button type="button" variant="outline" disabled={busy || checking} onClick={() => void refreshConnection(true)}><RefreshCw />{checking ? 'Conferindo…' : 'Atualizar confirmação'}</Button></div>
        </>}
        <p role="status" aria-live="polite">{connection.webhookVerified ? 'Recebimento confirmado pela Meta.' : 'Aguardando a confirmação de recebimento pela Meta. Esta tela confere automaticamente a cada 5 segundos.'}</p>
      </div>

      {!chatMode && <div className="fama-whatsapp-step">
        <h3>3. Autorize seu telefone e ative a IA</h3>
        <p className="finance-help">Escolha quem vai conversar com a IA e informe o telefone pessoal dessa pessoa. Use um telefone diferente do número da empresa.</p>
        <div className="settings-grid">
          <label className="form-field"><Label>Usuário da empresa</Label><NativeSelect aria-label="Usuário autorizado" value={memberId} onChange={event => { setMemberId(event.target.value); setConfirmed(false); }} disabled={busy}><NativeSelectOption value="">Selecione</NativeSelectOption>{data.members.map(member => <NativeSelectOption key={member.id} value={member.id}>{member.name}{member.id === data.currentMemberId ? ' (você)' : ''} — {member.email}</NativeSelectOption>)}</NativeSelect></label>
          <label className="form-field"><Label>Telefone pessoal com DDD</Label><Input aria-label="Telefone autorizado" value={phone} onChange={event => { setPhone(event.target.value); setConfirmed(false); }} placeholder="(61) 99123-4567" inputMode="tel" maxLength={40} disabled={busy}/><small>Brasil: informe DDD + número. Para outro país, comece com +DDI.</small></label>
        </div>
        {normalizedPhone && <p className="finance-help">Telefone que será autorizado: <strong>+{normalizedPhone}</strong></p>}
        <label className="settings-toggle"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/><span>Conferi que este telefone pertence ao usuário selecionado e pode receber seus dados autorizados.</span></label>
        <Button type="button" disabled={busy || !memberId || !normalizedPhone || !confirmed} onClick={() => void save({ action: 'link', memberId, phone: '+' + normalizedPhone })}>Autorizar telefone</Button>
        <h4>Telefones autorizados</h4>
        {!data.links.length && <p className="finance-help">Nenhum telefone autorizado.</p>}
        <ul className="fama-whatsapp-links">{data.links.map(link => <li key={link.id}><span>{link.name} · +{link.phone}</span><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save({ action: 'revoke', linkId: link.id })}>Revogar</Button></li>)}</ul>
        {chatUrl && <div className="fama-whatsapp-test"><Button asChild type="button"><a href={chatUrl} target="_blank" rel="noopener noreferrer"><MessageCircle />Abrir conversa de teste</a></Button><p className="finance-help">Abra usando um dos telefones autorizados, revise a pergunta “Agenda de hoje” e envie no WhatsApp.</p></div>}
        <p className="finance-help">{!connection.enabled && <>Depois de autorizar o telefone, use <strong>Ativar IA</strong> no topo. </>}Experimente também “Orçamentos pendentes” e “Resumo financeiro”. Alterações nos registros continuam sendo revisadas no sistema.</p>
      </div>}
    </>}
  </section>;
}
