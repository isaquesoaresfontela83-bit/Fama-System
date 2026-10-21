"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function ControlCommercial() {
    const [data, setData] = useState(null), [days, setDays] = useState("30"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const load = useCallback(async () => { setBusy(true); try {
        const response = await fetch("/api/admin/commercial?days=" + days, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok)
            throw new Error(payload.error || "Não foi possível carregar.");
        setData(payload);
        setError("");
    }
    catch (error) {
        setError(error instanceof Error ? error.message : "Não foi possível carregar.");
    }
    finally {
        setBusy(false);
    } }, [days]);
    useEffect(() => { void load(); }, [load]);
    const metrics = data?.metrics;
    const money = (value) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return <section className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">CRESCIMENTO DA PLATAFORMA</p><h2>Painel comercial</h2></div><div className="control-row-actions"><select value={days} onChange={event => setDays(event.target.value)} aria-label="Período comercial"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option></select><Button variant="outline" disabled={busy} onClick={() => void load()}>{busy ? "Atualizando…" : "Atualizar"}</Button></div></div>{error && <p role="alert">{error}</p>}{!data && !error && <p>Carregando indicadores…</p>}{metrics && <>
    <div className="commercial-metrics">{[["Empresas assinantes", metrics.paid], ["Empresas em teste", metrics.trials], ["Aguardando pagamento", metrics.pending], ["Receita mensal estimada", money(metrics.monthlyEstimateCents)], ["Conversão dos testes acompanhados", metrics.conversionPercent === null ? "Sem amostra" : metrics.conversionPercent.toFixed(1) + "%"], ["Cancelamentos no período", metrics.cancellations]].map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
    <p className="control-muted">Receita estimada pelo catálogo atual e desconto do ciclo das assinaturas ativas, com referência de pagamento. Não representa saldo nem valor liquidado. Empresas isentas e testes ficam separados.</p><p className="control-muted">Conversão: {metrics.converted} de {metrics.cohortTrials} empresa(s) que iniciaram teste no período e tiveram ativação com referência de pagamento após o início do acompanhamento. Inclui testes ainda em andamento; o histórico anterior não é presumido.</p>
    <div className="commercial-detail-grid"><article><h3>Distribuição por plano</h3>{metrics.distribution.map(row => <div className="commercial-plan-row" key={row.id}><strong>{data.plans.find(plan => plan.id === row.id)?.name}</strong><div className="commercial-plan-bar"><i style={{ width: (metrics.paid ? row.paid / metrics.paid * 100 : 0) + "%" }}/></div><span>{row.paid} assinante(s) · {row.trials} teste(s)</span></div>)}</article><article><h3>Testes encerrando em até 7 dias</h3>{metrics.ending.map(company => <div key={company.id}><strong>{company.name}</strong><p>{new Date(company.planExpiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>)}{!metrics.ending.length && <p>Nenhum teste encerra nos próximos 7 dias.</p>}<p>{metrics.free} empresa(s) isentas · {metrics.total} empresa(s) cadastradas</p></article></div></>}
  </section>;
}
