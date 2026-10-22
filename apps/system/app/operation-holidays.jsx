"use client";
import { useEffect, useState } from 'react';
import { brasilCatalog } from '@/lib/brasil-data';
export function OperationHolidays({ organizationId }) {
    const [days, setDays] = useState([]), [error, setError] = useState(false);
    useEffect(() => { const controller = new AbortController(), year = new Date().getFullYear(), entry = brasilCatalog.find(e => e.path === '/feriados/v1/{ano}'); if (!entry)
        return; fetch('/api/brasil-data', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ id: entry.id, parameters: { ano: String(year) } }), signal: controller.signal }).then(async (response) => { if (!response.ok)
        throw new Error(); const result = await response.json(); if (!Array.isArray(result.data))
        throw new Error(); const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); if (!controller.signal.aborted)
        setDays(result.data.filter((day) => typeof day.date === 'string' && day.date >= today && typeof day.name === 'string').slice(0, 3)); }).catch(() => { if (!controller.signal.aborted)
        setError(true); }); return () => controller.abort(); }, [organizationId]);
    return <div className="operation-holidays"><strong>Próximos feriados nacionais</strong>{error ? <span>Consulta temporariamente indisponível.</span> : days.length ? days.map(day => <span key={day.date}>{new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {day.name}</span>) : <span>Sem próximos feriados carregados.</span>}<small>BrasilAPI · confirme também os feriados locais antes de agendar.</small></div>;
}
