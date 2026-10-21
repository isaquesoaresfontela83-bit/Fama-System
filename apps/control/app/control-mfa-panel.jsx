"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export function ControlMfaPanel() {
    const [enabled, setEnabled] = useState(null), [enrollment, setEnrollment] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { let active = true; fetch('/api/auth/mfa', { cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok)
        throw new Error(data.error ?? 'Não foi possível conferir o autenticador.'); if (active)
        setEnabled(data.factors.some((factor) => factor.status === 'verified')); }).catch(cause => { if (active)
        setError(cause.message); }); return () => { active = false; }; }, []);
    async function call(body) { const response = await fetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok)
        throw new Error(result.error ?? 'Não foi possível configurar o autenticador.'); return result; }
    async function enroll() { setBusy(true); setError(''); try {
        const factor = await call({ action: 'enroll' });
        const challenge = await call({ action: 'challenge', factorId: factor.factorId });
        setEnrollment({ ...factor, challengeId: challenge.challengeId });
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível configurar.');
    }
    finally {
        setBusy(false);
    } }
    async function verify(event) { event.preventDefault(); if (!enrollment)
        return; const code = new FormData(event.currentTarget).get('code'); setBusy(true); setError(''); try {
        await call({ action: 'verify', factorId: enrollment.factorId, challengeId: enrollment.challengeId, code });
        setEnabled(true);
        setEnrollment(null);
        toast.success('Verificação em duas etapas ativada.');
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Código não confirmado.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="control-panel" aria-label="Verificação em duas etapas"><h3>Verificação em duas etapas</h3><p>{enabled === true ? 'Seu autenticador está ativo. As operações exigem uma sessão verificada.' : enabled === false ? 'Proteja a conta da administração com um aplicativo autenticador.' : 'Conferindo o autenticador…'}</p>{error && <p role="alert">{error}</p>}{enabled === false && !enrollment && <Button onClick={() => void enroll()} disabled={busy}>{busy ? 'Preparando…' : 'Ativar autenticador'}</Button>}{enrollment && <form onSubmit={verify}><p>Escaneie o QR code no seu autenticador e digite o código para concluir.</p>{enrollment.qrCode.startsWith('data:image/') && <img src={enrollment.qrCode} width={220} height={220} alt="QR code para configurar o autenticador"/>}<p><code>{enrollment.secret}</code></p>{enrollment.uri && <a href={enrollment.uri}>Abrir no autenticador</a>}<Input name="code" aria-label="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000"/><Button type="submit" disabled={busy}>Confirmar ativação</Button></form>}</section>;
}
