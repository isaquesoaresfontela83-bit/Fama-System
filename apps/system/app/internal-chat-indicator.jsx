'use client';
import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/lib/client-request';
export function InternalChatIndicator({ organizationId, onOpen }) {
    const [unread, setUnread] = useState(0);
    useEffect(() => { let stopped = false, busy = false; const controller = new AbortController(); async function refresh() { if (stopped || busy || document.visibilityState !== 'visible')
        return; busy = true; try {
        const result = await requestJson('/api/internal-chat?summary=1', { headers: { 'x-organization-id': organizationId }, signal: controller.signal });
        if (!stopped)
            setUnread(Math.max(0, Number(result.unread) || 0));
    }
    catch {
        if (!stopped)
            setUnread(0);
    }
    finally {
        busy = false;
    } } void refresh(); const timer = setInterval(() => void refresh(), 20000); const changed = () => void refresh(); document.addEventListener('visibilitychange', changed); window.addEventListener('fama:chat-updated', changed); return () => { stopped = true; clearInterval(timer); controller.abort(); document.removeEventListener('visibilitychange', changed); window.removeEventListener('fama:chat-updated', changed); }; }, [organizationId]);
    return <Button variant="outline" size="icon" className="workspace-alert-trigger internal-chat-indicator" onClick={onOpen} aria-label={`Abrir Chat interno${unread ? `, ${unread} mensagens não lidas` : ''}`} title="Chat da equipe"><MessageSquare />{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</Button>;
}
