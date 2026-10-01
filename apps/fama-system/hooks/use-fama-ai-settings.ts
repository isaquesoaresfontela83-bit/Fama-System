'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAssistantSettings, parseAssistantSettingsEnvelope, type AssistantSettings, type AssistantSettingsEnvelope } from '@/lib/fama-ai-settings';
export type { AssistantSettingsEnvelope } from '@/lib/fama-ai-settings';

async function readEnvelope(response: Response): Promise<AssistantSettingsEnvelope> {
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.message || 'Não foi possível carregar a configuração.');
  return parseAssistantSettingsEnvelope(payload.data ?? payload);
}

export function useFamaAiSettings() {
  const [value, setValue] = useState<AssistantSettingsEnvelope | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const next = await readEnvelope(await fetch('/api/ai-settings', { cache: 'no-store', signal: AbortSignal.timeout(15_000) }));
      if (mounted.current) { setValue(previous => previous && previous.revision > next.revision ? previous : next); setError(''); }
      return next;
    } catch (failure) {
      if (mounted.current) { setValue(null); setError(failure instanceof Error ? failure.message : 'Falha ao carregar a configuração.'); }
      throw failure;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const reload = () => { void refresh().catch(() => undefined); };
    reload();
    window.addEventListener('focus', reload);
    const timer = window.setInterval(reload, 60_000);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fama-ai-settings') : null;
    if (channel) channel.onmessage = reload;
    return () => { mounted.current = false; window.removeEventListener('focus', reload); window.clearInterval(timer); channel?.close(); };
  }, [refresh]);

  const save = async (settings: AssistantSettings, revision: number) => {
    const next = await readEnvelope(await fetch('/api/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000), body: JSON.stringify({ settings: parseAssistantSettings(settings), revision }) }));
    if (mounted.current) { setValue(previous => previous && previous.revision > next.revision ? previous : next); setError(''); }
    if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('fama-ai-settings'); channel.postMessage('updated'); channel.close(); }
    return next;
  };
  return { value, error, refresh, save };
}
