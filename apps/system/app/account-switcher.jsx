'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Check, LoaderCircle, LogOut, Plus, ShieldCheck, UsersRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { announceAccountChange } from '@/lib/account-switcher-client';

export function AccountSwitcher({ currentUser, login = false, sidebar = false, companyName, roleLabel, signOutPath }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [reauth, setReauth] = useState(null);
    const [mfa, setMfa] = useState(null);
    const refresh = useCallback(async signal => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/auth/accounts', { cache: 'no-store', signal });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar as contas.');
            if (currentUser?.id && payload.activeId !== currentUser.id) { window.location.replace('/'); return; }
            setData(payload);
        } finally { setLoading(false); }
    }, [currentUser?.id]);
    useEffect(() => {
        if (!open) { setMfa(null); setReauth(null); if (!sidebar) { setError(''); return; } }
        const controller = new AbortController();
        void refresh(controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
        return () => controller.abort();
    }, [open, sidebar, refresh]);
    function complete(userId = null) {
        announceAccountChange(userId);
        window.location.replace('/');
    }
    async function action(actionName, accountId = '') {
        setBusy(accountId || actionName); setError(''); setReauth(null);
        try {
            const response = await fetch('/api/auth/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, accountId }) });
            const payload = await response.json();
            if (!response.ok) {
                if (actionName === 'switch' && ['ACCOUNT_SESSION_EXPIRED', 'ACCOUNT_NOT_CONNECTED'].includes(payload.code)) {
                    const account = data?.accounts.find(item => item.id === accountId);
                    if (account) setReauth(account);
                    setData(current => current ? { ...current, accounts: current.accounts.filter(item => item.id !== accountId) } : current);
                }
                throw new Error(payload.error || 'Não foi possível continuar.');
            }
            if (payload.requiresMfa) {
                setOpen(true);
                const challenge = await fetch('/api/auth/mfa-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'challenge', factorId: payload.factorId }) });
                const next = await challenge.json();
                if (!challenge.ok) throw new Error(next.error || 'Não foi possível iniciar a verificação.');
                setMfa({ accountId, factorId: payload.factorId, challengeId: next.challengeId });
            } else if (actionName === 'switch' || payload.activeRemoved) complete(payload.activeId ?? null);
            else await refresh();
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível continuar.'); }
        finally { setBusy(''); }
    }
    async function verify(event) {
        event.preventDefault(); setBusy('mfa'); setError('');
        try {
            const code = new FormData(event.currentTarget).get('code');
            const response = await fetch('/api/auth/mfa-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', factorId: mfa.factorId, challengeId: mfa.challengeId, code }) });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Código inválido.');
            complete(mfa.accountId);
        } catch (cause) { setError(cause.message || 'Não foi possível validar o código.'); }
        finally { setBusy(''); }
    }
    const connectedAccounts = data?.accounts ?? (currentUser ? [{ id: currentUser.id, email: currentUser.email, displayName: currentUser.displayName || currentUser.email }] : []);
    const visibleAccounts = reauth && !connectedAccounts.some(account => account.id === reauth.id) ? [...connectedAccounts, reauth] : connectedAccounts;
    const selectedAccountId = data ? data.activeId : currentUser?.id;
    const reconnectPath = reauth ? `/entrar?add_account=1&reconnect=1&email=${encodeURIComponent(reauth.email)}` : '/entrar?add_account=1';
    return <>
        {sidebar ? <section className="sidebar-connected-accounts" aria-label="Contas conectadas">
            <div className="sidebar-accounts-heading"><span>Suas contas</span><small>{loading ? '…' : `${connectedAccounts.length} de 2`}</small></div>
            <div className="sidebar-accounts-list">{visibleAccounts.map(account => {
                const active = account.id === selectedAccountId;
                const expired = account.id === reauth?.id;
                const name = active && companyName ? companyName : account.displayName;
                const Tag = expired ? 'a' : 'button';
                const control = expired ? { href: reconnectPath } : { type: 'button', disabled: Boolean(busy) || active, onClick: () => void action('switch', account.id) };
                return <Tag key={account.id} {...control} className="sidebar-account-choice" data-active={active} data-expired={expired} aria-current={active ? 'true' : undefined} aria-label={expired ? `Reconectar ${account.email}` : active ? `${account.email}, conta em uso` : `Usar conta ${account.email}`} title={`${name} · ${account.email}${expired ? ' · Sessão encerrada' : active ? ' · Em uso' : ' · Alternar conta'}`}>
                    <span className="sidebar-account-avatar" aria-hidden="true">{name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <span className="sidebar-account-details"><strong>{name}</strong><small>{account.email}</small><span className="sidebar-account-state">{expired ? 'Entrar novamente' : active ? `Em uso${roleLabel ? ` · ${roleLabel}` : ''}` : busy === account.id ? 'Alternando…' : 'Alternar conta'}</span></span>
                    <span className="sidebar-account-indicator" aria-hidden="true">{active ? <Check /> : busy === account.id ? <LoaderCircle /> : <ArrowRightLeft />}</span>
                </Tag>;
            })}</div>
            {loading && <p className="sidebar-accounts-loading" role="status">Carregando contas…</p>}
            {data?.enabled && data.accounts.length < data.limit && <a className="sidebar-account-add" href="/entrar?add_account=1" aria-disabled={Boolean(busy)} title="Adicionar outra conta" onClick={event => { if (busy) event.preventDefault(); }}><Plus /><span>Adicionar outra conta</span></a>}
            {error && !open && <div className="sidebar-accounts-error"><p role="alert">{error}</p>{reauth ? <a href={reconnectPath}>Entrar novamente</a> : <button type="button" disabled={loading || Boolean(busy)} onClick={() => void refresh().catch(cause => setError(cause.message))}>Tentar novamente</button>}</div>}
            <div className="sidebar-account-actions"><button type="button" className="sidebar-account-manage" title="Gerenciar contas" aria-label="Gerenciar contas" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><UsersRound /><span>Gerenciar contas</span></button>{signOutPath && <a className="sidebar-account-signout" href={signOutPath} title="Sair desta conta" aria-label="Sair desta conta"><LogOut /></a>}</div>
        </section> : <Button type="button" variant="outline" size="sm" className={`account-switch-trigger${login ? ' account-switch-login' : ''}`} aria-label="Alternar contas" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><UsersRound /><span>{login ? 'Contas conectadas' : 'Contas'}</span></Button>}
        <Sheet open={open} onOpenChange={setOpen}><SheetContent className="account-switch-sheet">
            <SheetHeader><SheetTitle><UsersRound />Suas contas</SheetTitle><SheetDescription>Conecte até duas contas neste navegador e escolha qual usar.</SheetDescription></SheetHeader>
            {mfa ? <form className="account-switch-mfa" onSubmit={verify}><ShieldCheck /><h3>Confirme esta conta</h3><p>Digite o código do aplicativo autenticador para continuar.</p><Label htmlFor="switch-account-code">Código de verificação</Label><Input id="switch-account-code" name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} required autoFocus/><Button disabled={Boolean(busy)} type="submit">{busy ? 'Validando…' : 'Confirmar e alternar'}</Button><Button variant="ghost" type="button" disabled={Boolean(busy)} onClick={() => setMfa(null)}>Voltar às contas</Button></form> : <>
                <div className="account-switch-count"><span>Conectadas neste navegador</span><strong>{data?.accounts.length ?? 0} de 2</strong></div>
                {loading && <p className="account-switch-status" role="status"><LoaderCircle />Consultando contas…</p>}
                <div className="account-switch-list">{data?.accounts.map(account => {
                    const active = account.id === data.activeId;
                    return <article className="account-switch-card" data-active={active} key={account.id}><button type="button" className="account-switch-select" disabled={Boolean(busy) || active} onClick={() => void action('switch', account.id)} aria-label={active ? `${account.email}, conta em uso` : `Usar conta ${account.email}`}><span className="account-switch-avatar">{account.displayName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="account-switch-name"><strong>{account.displayName}</strong><small>{account.email}</small><em>{active ? 'Em uso' : 'Alternar para esta conta'}</em></span>{active ? <Check /> : busy === account.id ? <LoaderCircle /> : <ArrowRightLeft />}</button><button className="account-switch-remove" type="button" disabled={Boolean(busy)} aria-label={`Desconectar ${account.email}`} title="Sair desta conta" onClick={() => void action('remove', account.id)}><X /></button></article>;
                })}</div>
                {!loading && data && !data.accounts.length && <p className="account-switch-empty">Nenhuma conta conectada. Entre para começar.</p>}
                {data?.enabled === false && <p className="form-error">A alternância de contas está temporariamente indisponível.</p>}
                {data?.enabled && data.accounts.length < data.limit ? <Button className="account-switch-add" variant="outline" disabled={Boolean(busy)} asChild><a href="/entrar?add_account=1"><Plus />{data.accounts.length ? 'Adicionar outra conta' : 'Entrar em uma conta'}</a></Button> : data?.accounts.length >= 2 ? <p className="account-switch-hint">Para adicionar outra conta, desconecte uma das duas acima.</p> : null}
                {Boolean(data?.accounts.length) && <Button className="account-switch-logout" variant="ghost" disabled={Boolean(busy)} onClick={() => void action('logout_all')}><LogOut />Sair de todas as contas</Button>}
            </>}
            {error && <p className="form-error account-switch-error" role="alert">{error}</p>}
            {reauth && <a className="account-switch-reauth" href={reconnectPath}>Entrar novamente nesta conta</a>}
        </SheetContent></Sheet>
    </>;
}
