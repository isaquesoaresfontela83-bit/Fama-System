"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
const categoryLabels = { payments: "Pagamentos", email: "E-mails", fiscal: "Notas fiscais" };
const codeLabels = { recovery_requested: "Recuperação solicitada", recovery_provider_error: "Falha ao solicitar recuperação", provider_unavailable: "Provedor indisponível ou acesso rejeitado", subscription_event_processed: "Confirmação de pagamento processada", subscription_event_error: "Falha ao processar confirmação", fiscal_operation_failed: "Falha na operação fiscal" };
const labels = { ok: "Verificado", warning: "Atenção", error: "Falha", unknown: "Sem comprovação" };
export function ControlHealth() {
    const [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const load = useCallback(async () => { setBusy(true); try {
        const response = await fetch("/api/admin/health", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok)
            throw new Error(payload.error || "Não foi possível consultar.");
        setData(payload);
        setError("");
    }
    catch (error) {
        setError(error instanceof Error ? error.message : "Não foi possível consultar.");
    }
    finally {
        setBusy(false);
    } }, []);
    useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === "visible")
        void load(); }, 60000); return () => clearInterval(timer); }, [load]);
    return <section className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">OPERAÇÃO DA PLATAFORMA</p><h2>Central de saúde</h2></div><Button variant="outline" disabled={busy} onClick={() => void load()}>{busy ? "Conferindo…" : "Conferir agora"}</Button></div><p className="control-muted">Cada indicador informa a evidência disponível. A ausência de eventos ou de homologação aparece como pendência.</p>{error && <p role="alert">{error}</p>}<div className="health-check-grid">{data?.checks.map(check => <article key={check.id} className={"health-check " + check.state}><header><h3>{check.label}</h3><span>{labels[check.state] ?? check.state}</span></header><p>{check.detail}</p><small>{check.lastAt ? "Último registro: " + new Date(check.lastAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Sem registro confirmado"}</small></article>)}</div>{!data && !error && <p>Conferindo serviços…</p>}<details className="health-events"><summary>Histórico recente de operações</summary>{data?.events.map((event, index) => <p key={index}><strong>{categoryLabels[event.category] ?? "Operação"} · {event.outcome === "ok" ? "Concluída" : "Falha"}</strong> · {codeLabels[event.code] ?? "Registro de operação"} · {new Date(event.occurredAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>)}{data && !data.events.length && <p>Nenhuma operação registrada desde a ativação deste acompanhamento.</p>}</details></section>;
}
