'use client';

import { useEffect, useRef, useState } from 'react';
import type { AssistantAnswer, AssistantSource } from '@/lib/fama-ai';

type Question = { question: string; source: AssistantSource; history: string[]; customerName?: string };
export function useAssistantConnection({ organizationId, platform, preview }: { organizationId?: string; platform?: boolean; preview?: boolean }) {
  const [configured, setConfigured] = useState(false);
  const [useGenerative, setUseGenerative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    if (preview || (!organizationId && !platform)) return;
    const statusController = new AbortController();
    void fetch('/api/assistant', { cache: 'no-store', credentials: 'same-origin', headers: organizationId ? { 'x-organization-id': organizationId } : {}, signal: statusController.signal }).then(async response => {
      if (!response.ok) return;
      const result = await response.json() as { configured?: boolean };
      if (!statusController.signal.aborted) setConfigured(result.configured === true);
    }).catch(() => undefined);
    return () => { statusController.abort(); controller.current?.abort(); };
  }, [organizationId, platform, preview]);
  function cancel() { sequence.current++; controller.current?.abort(); controller.current = null; setBusy(false); setError(''); }
  async function ask(input: Question): Promise<AssistantAnswer | null> {
    if (!configured || preview) return null;
    controller.current?.abort();
    const requestController = new AbortController(); controller.current = requestController;
    const requestId = ++sequence.current;
    setBusy(true); setError('');
    const timeout = setTimeout(() => requestController.abort(), 45_000);
    try {
      const response = await fetch('/api/assistant', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(organizationId ? { 'x-organization-id': organizationId } : {}) }, body: JSON.stringify({ ...input, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), signal: requestController.signal });
      const result = await response.json() as { answer?: AssistantAnswer; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || 'Não foi possível responder agora.');
      if (requestId !== sequence.current || requestController.signal.aborted) return null;
      return result.answer;
    } catch (cause) {
      if (requestId === sequence.current) setError(requestController.signal.aborted ? 'A consulta levou mais tempo que o esperado. Tente novamente ou use as consultas internas.' : cause instanceof Error ? cause.message : 'Não foi possível conectar a conversa livre.');
      return null;
    } finally {
      clearTimeout(timeout);
      if (requestId === sequence.current) { setBusy(false); controller.current = null; }
    }
  }
  return { configured, useGenerative, setUseGenerative, busy, error, ask, cancel };
}
