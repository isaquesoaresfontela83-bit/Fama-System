'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseAssistantSettings, type AssistantSettings } from '@/lib/fama-ai-settings';

export type AssistantSettingsEnvelope = { settings: AssistantSettings; revision: number; updatedAt: string };

async function readEnvelope(response: Response): Promise<AssistantSettingsEnvelope> {
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.message || 'Não foi possível carregar a configuração.');
  const value = payload.data ?? payload;
  if (!Number.isInteger(value.revision) || value.revision < 1) throw new Error('Revisão da configuração inválida.');
  return { settings: parseAssistantSettings(value.settings), revision: value.revision, updatedAt: value.updatedAt };
}

export function useFamaAiSettings() {
  const [value, setValue] = useState<AssistantSettingsEnvelope | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const next = await readEnvelope(await fetch('/api/ai-settings', { cache: 'no-store' }));
      setValue(previous => previous && previous.revision > next.revision ? previous : next); setError(''); return next;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Falha ao carregar a configuração.');
      throw failure;
    }
  }, []);

  useEffect(() => {
    const reload = () => { void refresh().catch(() => undefined); };
    reload();
    window.addEventListener('focus', reload);
    const timer = window.setInterval(reload, 60_000);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fama-ai-settings') : null;
    if (channel) channel.onmessage = reload;
    return () => { window.removeEventListener('focus', reload); window.clearInterval(timer); channel?.close(); };
  }, [refresh]);

  const save = async (settings: AssistantSettings, revision: number) => {
    const next = await readEnvelope(await fetch('/api/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: parseAssistantSettings(settings), revision }) }));
    setValue(next); setError('');
    if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('fama-ai-settings'); channel.postMessage('updated'); channel.close(); }
    return next;
  };
  return { value, error, refresh, save };
}
