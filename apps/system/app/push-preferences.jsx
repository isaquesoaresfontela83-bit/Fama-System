"use client";
import { useEffect, useRef, useState } from 'react';
import { displayForegroundPush } from '@/lib/push-display';
import { Button } from '@/components/ui/button';
const labels = { agenda: 'Visitas e agenda', orders: 'Ordens de serviço', inventory: 'Estoque baixo', finance: 'Cobranças vencidas', quotes: 'Orçamentos a vencer', warranties: 'Garantias' };
export function PushPreferences({ organizationId }) {
    const [settings, setSettings] = useState(null), [categories, setCategories] = useState(Object.keys(labels)), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [receiverReady, setReceiverReady] = useState(false);
    const active = useRef(true), received = useRef(0);
    useEffect(() => { active.current = true; const controller = new AbortController(); fetch('/api/push', { headers: { 'x-organization-id': organizationId }, signal: controller.signal }).then(async (response) => { if (!response.ok)
        throw new Error('Não foi possível consultar as notificações.'); const value = await response.json(); if (!controller.signal.aborted) {
        setSettings(value);
        setCategories(value.categories);
    } }).catch(error => { if (!controller.signal.aborted)
        setMessage(error.message); }); return () => { active.current = false; controller.abort(); }; }, [organizationId]);
    async function post(body) { const response = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok)
        throw new Error(data.error || 'Não foi possível atualizar as notificações.'); return data; }
    async function enable() { setBusy(true); setMessage(''); try {
        const { isSupported, getMessaging, getToken, onMessage } = await import('firebase/messaging');
        if (!await isSupported())
            throw new Error('Este navegador não oferece notificações push. Os alertas internos continuam disponíveis.');
        if (await Notification.requestPermission() !== 'granted')
            throw new Error('As notificações não foram permitidas. Você pode continuar usando os alertas dentro do Fama.');
        const { initializeApp, getApps } = await import('firebase/app');
        const app = getApps().find(app => app.name === 'fama-push') || initializeApp(settings.config, 'fama-push');
        const params = new URLSearchParams(settings.config);
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?' + params, { scope: '/fama-notifications/' });
        if (!registration.active)
            await new Promise((resolve, reject) => { const worker = registration.installing || registration.waiting; if (!worker) {
                reject(new Error('O serviço de notificações não iniciou. Tente novamente.'));
                return;
            } const timer = setTimeout(() => reject(new Error('A ativação demorou. Tente novamente.')), 20000); worker.addEventListener('statechange', () => { if (worker.state === 'activated') {
                clearTimeout(timer);
                resolve();
            }
            else if (worker.state === 'redundant') {
                clearTimeout(timer);
                reject(new Error('Não foi possível ativar as notificações.'));
            } }); });
        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: settings.vapidKey, serviceWorkerRegistration: registration });
        await post({ action: 'subscribe', token, categories });
        if (active.current) {
            setSettings({ ...settings, subscribed: true });
            setMessage('Notificações ativadas neste navegador.');
        }
        void post({ action: 'sync' }).catch(() => { });
    }
    catch (error) {
        if (active.current)
            setMessage(error.message);
    }
    finally {
        if (active.current)
            setBusy(false);
    } }
    async function disable() { setBusy(true); try {
        await post({ action: 'disable' });
        const { getApps } = await import('firebase/app');
        const app = getApps().find(app => app.name === 'fama-push');
        if (app) {
            const { getMessaging, deleteToken } = await import('firebase/messaging');
            await deleteToken(getMessaging(app)).catch(() => { });
        }
        if (active.current) {
            setSettings({ ...settings, subscribed: false });
            setMessage('Notificações desativadas neste navegador.');
        }
    }
    catch (error) {
        if (active.current)
            setMessage(error.message);
    }
    finally {
        if (active.current)
            setBusy(false);
    } }
    useEffect(() => { setReceiverReady(false); if (!settings?.subscribed)
        return; let cancel = false, unsubscribe; const sync = () => { if (!cancel)
        void post({ action: 'sync' }).catch(() => { }); }; sync(); const timer = setInterval(sync, 5 * 60 * 1000); import('firebase/app').then(async ({ getApps, initializeApp }) => { const app = getApps().find(app => app.name === 'fama-push') || initializeApp(settings.config, 'fama-push'); const { getMessaging, onMessage, isSupported } = await import('firebase/messaging'); if (!await isSupported() || cancel)
        return; unsubscribe = onMessage(getMessaging(app), payload => { if (payload.data?.organizationId !== organizationId || cancel)
        return; received.current++; void displayForegroundPush(payload.data, organizationId).then(() => { if (!cancel)
        setMessage(payload.data?.body || 'Notificação recebida neste aparelho.'); }).catch(error => { if (!cancel)
        setMessage(error.message); }); }); setReceiverReady(true); }).catch(() => { if (!cancel)
        setMessage('Não foi possível preparar o recebimento. Recarregue a página.'); }); return () => { cancel = true; clearInterval(timer); unsubscribe?.(); }; }, [organizationId, settings?.subscribed]);
    return <details className="push-preferences" open><summary>Notificações neste aparelho</summary><p>Escolha os alertas que deseja receber. Nenhuma chave de API é solicitada aos usuários.</p>{!settings ? <p>Consultando disponibilidade…</p> : !settings.configured ? <p>Notificações no celular em preparação no Fama. A central de alertas já funciona dentro do sistema.</p> : <><div className="push-category-options">{Object.entries(labels).map(([key, label]) => <label key={key}><input type="checkbox" checked={categories.includes(key)} onChange={event => setCategories(values => event.target.checked ? [...values, key] : values.filter(value => value !== key))}/>{label}</label>)}</div><div className="push-preference-actions"><Button disabled={busy || !categories.length} onClick={enable}>{settings.subscribed ? 'Salvar preferências' : 'Ativar notificações'}</Button>{settings.subscribed && <><Button disabled={busy || !receiverReady} variant="outline" onClick={() => { if (Notification.permission !== 'granted') {
        setMessage('Permita as notificações deste site no navegador e ative novamente.');
        return;
    } const before = received.current; setBusy(true); setMessage('Enviando teste para este aparelho…'); void post({ action: 'test' }).then(data => { if (before === received.current)
        setMessage(data.sent ? 'Teste aceito pelo Firebase. Aguardando o recebimento neste aparelho…' : 'Este aparelho não está mais inscrito. Ative as notificações novamente.'); }).catch(error => setMessage(error.message)).finally(() => setBusy(false)); }}>Testar</Button><Button disabled={busy} variant="ghost" onClick={disable}>Desativar neste aparelho</Button></>}</div></>}{message && <p role="status">{message}</p>}</details>;
}
