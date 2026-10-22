'use client';
import { useId, useRef, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AccountAddForm({ currentAccountName, initialEmail = '', connectedEmails = [], onAuthenticated, onCancel, onBusyChange }) {
    const id = useId();
    const pending = useRef(false);
    const completed = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [mfa, setMfa] = useState(null);
    async function send(path, body) {
        const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Não foi possível conectar a conta. Tente novamente.');
        return payload;
    }
    async function submit(event) {
        event.preventDefault();
        if (pending.current || completed.current) return;
        pending.current = true;
        setBusy(true); setError(''); onBusyChange?.(true);
        const values = new FormData(event.currentTarget);
        try {
            if (mfa) {
                const verified = await send('/api/auth/mfa-login', { action: 'verify', factorId: mfa.factorId, challengeId: mfa.challengeId, code: values.get('code') });
                if (!verified.authenticated) throw new Error('Não foi possível confirmar o acesso. Tente novamente.');
            } else {
                const email = String(values.get('email') || '').trim().toLowerCase();
                if (connectedEmails.some(value => value.toLowerCase() === email)) throw new Error('Esta conta já está conectada. Informe o e-mail da outra conta.');
                const result = await send('/api/auth/login', { email, password: values.get('password'), company: String(values.get('company') || '').trim() });
                if (result.requiresMfa && result.factorId) {
                    const challenge = await send('/api/auth/mfa-login', { action: 'challenge', factorId: result.factorId });
                    if (!challenge.challengeId) throw new Error('Não foi possível iniciar a verificação. Tente novamente.');
                    setMfa({ factorId: result.factorId, challengeId: challenge.challengeId });
                    return;
                }
                if (!result.authenticated) throw new Error('Não foi possível confirmar o acesso. Tente novamente.');
            }
            completed.current = true;
            onAuthenticated();
        } catch (cause) {
            setError(cause?.name === 'TimeoutError' ? 'A conexão demorou. Tente novamente.' : cause instanceof Error ? cause.message : 'Não foi possível conectar a conta.');
        } finally {
            pending.current = false;
            if (!completed.current) { setBusy(false); onBusyChange?.(false); }
        }
    }
    return <form className="account-add-form" onSubmit={submit} aria-label={mfa ? 'Verificar segunda conta' : 'Adicionar outra conta'}>
        <p>{currentAccountName ? <>Sua conta <strong>{currentAccountName}</strong> continuará conectada.</> : 'Entre com o e-mail e a senha da conta que deseja conectar.'}</p>
        {mfa ? <>
            <div className="account-add-mfa"><ShieldCheck /><span>Confirme a outra conta com o código do aplicativo autenticador.</span></div>
            <div className="form-field"><Label htmlFor={`${id}-code`}>Código de verificação</Label><Input id={`${id}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} required autoFocus disabled={busy}/></div>
        </> : <>
            <div className="form-field"><Label htmlFor={`${id}-email`}>E-mail da outra conta</Label><Input id={`${id}-email`} name="email" type="email" autoComplete="username" defaultValue={initialEmail} required autoFocus disabled={busy}/></div>
            <div className="form-field"><Label htmlFor={`${id}-password`}>Senha</Label><div className="password-field"><Input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required disabled={busy}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></div>
            <div className="form-field"><Label htmlFor={`${id}-company`}>Empresa (opcional)</Label><Input id={`${id}-company`} name="company" autoComplete="off" placeholder="Empresa da outra conta" disabled={busy}/></div>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin"/>Conectando…</> : mfa ? 'Confirmar e conectar' : 'Conectar outra conta'}</Button>
        <Button variant="ghost" type="button" disabled={busy} onClick={onCancel}>Voltar às contas</Button>
    </form>;
}
