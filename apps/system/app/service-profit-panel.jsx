"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { costFields, serviceNotes, serviceProfit } from "@/lib/service-profit";
const money = (value) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels = { productCost: "Produtos", laborCost: "Mão de obra", travelCost: "Deslocamento" };
export function ServiceProfitPanel({ orders, organizationId, onSaved }) {
    const [month, setMonth] = useState("");
    const [status, setStatus] = useState("all");
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const rows = useMemo(() => orders.filter(order => (!month || order.scheduledAt.startsWith(month)) && (status === "all" || order.status === status)).map(order => ({ order, profit: serviceProfit(order) })), [orders, month, status]);
    const complete = rows.filter(row => row.profit.complete);
    const revenue = complete.reduce((sum, row) => sum + row.profit.revenueCents, 0);
    const cost = complete.reduce((sum, row) => sum + (row.profit.costCents ?? 0), 0);
    async function save(event) {
        event.preventDefault();
        if (!editing || saving)
            return;
        const form = event.currentTarget;
        setSaving(true);
        try {
            const response = await fetch("/api/service-profit", { method: "PATCH", headers: { "Content-Type": "application/json", "x-organization-id": organizationId }, body: JSON.stringify({ id: editing.id, ...Object.fromEntries(new FormData(form)) }) });
            const data = await response.json();
            if (!response.ok || !data.record)
                throw new Error(data.error || "Não foi possível salvar.");
            onSaved(data.record);
            setEditing(null);
            toast.success("Custos atualizados.");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
        }
        finally {
            setSaving(false);
        }
    }
    return <section className="surface service-profit-panel">
    <div className="panel-heading"><div><small>RESULTADO DOS ATENDIMENTOS</small><h2>Lucro por serviço</h2></div><div className="profit-filters"><Input type="month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Mês dos serviços"/><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Situação dos serviços"><option value="all">Todos</option><option value="concluida">Concluídos</option><option value="em_execucao">Em execução</option><option value="aberta">Abertos</option></select></div></div>
    <p>Margem operacional estimada: valor do serviço menos produtos, mão de obra e deslocamento. Impostos, taxas e despesas gerais não estão incluídos.</p>
    <div className="profit-summary"><article><small>Valor dos serviços com custos completos</small><strong>{money(revenue)}</strong></article><article><small>Custos informados</small><strong>{money(cost)}</strong></article><article><small>Resultado estimado</small><strong className={revenue - cost < 0 ? "profit-negative" : ""}>{money(revenue - cost)}</strong></article><article><small>Custos pendentes</small><strong>{rows.length - complete.length}</strong></article></div>
    <div className="profit-table"><table><thead><tr><th>Serviço / cliente</th><th>Valor</th><th>Custos</th><th>Resultado</th><th>Margem</th><th /></tr></thead><tbody>{rows.map(({ order, profit }) => <tr key={order.id}><td><strong>{order.osNumber}</strong><small>{order.clientName} · {order.service}</small></td><td>{money(profit.revenueCents)}</td><td>{profit.complete ? money(profit.costCents) : "A completar"}</td><td className={(profit.profitCents ?? 0) < 0 ? "profit-negative" : ""}>{profit.complete ? money(profit.profitCents) : "Pendente"}</td><td>{profit.marginPercent === null ? "—" : profit.marginPercent.toFixed(1) + "%"}</td><td><Button size="sm" variant="outline" onClick={() => setEditing(editing?.id === order.id ? null : order)}>Custos</Button></td></tr>)}</tbody></table></div>
    {!rows.length && <p>Nenhum serviço corresponde ao filtro.</p>}
    {editing && <form key={editing.id} className="profit-cost-form" onSubmit={save}><strong>{editing.osNumber} · Custos do serviço</strong>{costFields.map(key => <label key={key}>{labels[key]} (R$)<Input name={key} defaultValue={String(serviceNotes(editing.notes).details[key] ?? "")} inputMode="decimal" required placeholder="0,00"/></label>)}<div><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button><Button disabled={saving}>{saving ? "Salvando…" : "Salvar custos"}</Button></div></form>}
  </section>;
}
