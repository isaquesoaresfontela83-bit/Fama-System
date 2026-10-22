"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { defaultPlanCatalog, PLAN_PRICE_NOTICE } from "@/lib/plan-catalog";
import { catalogFeatures, defaultPlanPolicy, effectivePlans } from "@/lib/plan-policy";
import { PLAN_FEATURES, planIncludesFeature } from "@/lib/plan-features";
const featureLabels = { dashboard: "Visão geral", crm: "CRM", quotes: "Orçamentos", agenda: "Agenda e mapa", orders: "Ordens de serviço", customers: "Clientes e piscinas", finance: "Financeiro e lucro por serviço", contracts: "Contratos", warranties: "Garantias", inventory: "Estoque", team: "Equipe", mobile: "Modo técnico", chat: "Chat interno", assistant: "Fama IA", freight: "Frete automático", invoices: "Notas fiscais" };
export function PlanPolicyEditor({ companies, onSaved }) {
    const [customerCounts, setCustomerCounts] = useState({});
    const [policy, setPolicy] = useState(defaultPlanPolicy());
    const [plans, setPlans] = useState(defaultPlanCatalog);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [effectiveAt, setEffectiveAt] = useState("");
    const [notice, setNotice] = useState("");
    useEffect(() => { let active = true; fetch("/api/admin/plans", { cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok)
        throw new Error(payload.error || "Não foi possível carregar os planos."); if (active) {
        const state = payload.policy ?? defaultPlanPolicy(payload.plans?.length ? payload.plans : defaultPlanCatalog);
        setCustomerCounts(payload.customerCounts ?? {});
        setPolicy(state);
        setPlans(state.pending && Date.parse(state.pending.effectiveAt) > Date.now() ? state.pending.plans : effectivePlans(state));
        setNotice(state.pending?.notice ?? "");
        if (state.pending && Date.parse(state.pending.effectiveAt) > Date.now())
            setEffectiveAt(new Date(Date.parse(state.pending.effectiveAt) - 3 * 3600000).toISOString().slice(0, 16));
        setLoaded(true);
    } }).catch(error => { if (active)
        setError(error.message); }); return () => { active = false; }; }, []);
    function change(index, patch) { setPlans(current => current.map((plan, i) => i === index ? { ...plan, ...patch } : plan)); }
    async function save() {
        if (!loaded || busy)
            return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/admin/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plans, expectedRevision: policy.revision, effectiveAt: effectiveAt ? new Date(effectiveAt + "-03:00").toISOString() : "", notice }) });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error || "Não foi possível salvar.");
            setPolicy(payload.policy);
            setPlans(payload.policy.pending?.plans ?? payload.plans);
            onSaved(payload.plans);
            toast.success(payload.policy.pending ? "Alteração agendada com aviso aos clientes." : "Preços, limites e recursos atualizados.");
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível salvar.");
        }
        finally {
            setBusy(false);
        }
    }
    const affected = companies.filter(company => company.status !== "deleted");
    return <section className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">GESTÃO DE PLANOS</p><h2>Preços, limites e recursos</h2></div><Button onClick={() => void save()} disabled={!loaded || busy}>{busy ? "Salvando…" : "Salvar configuração"}</Button></div><p className="control-muted">{PLAN_PRICE_NOTICE} As escolhas de recursos são aplicadas no servidor e nas telas do System.</p>{error && <p role="alert" className="control-error">{error}</p>}
    <div className="control-plan-grid">{plans.map((plan, index) => <article key={plan.id} className="control-plan-card control-plan-editor"><header><small>{plan.id}</small><input aria-label={"Nome " + plan.id} value={plan.name} onChange={event => change(index, { name: event.target.value })}/></header><label><span>Preço mensal (R$)</span><input type="number" min="0.01" step="0.01" value={plan.price / 100} onChange={event => change(index, { price: Math.round(Number(event.target.value) * 100) })}/></label><label><span>Limite de usuários</span><input type="number" min="1" max="1000" value={plan.userLimit ?? Number(plan.users.match(/[\d.]+/)?.[0]?.replace(/\./g, ""))} onChange={event => change(index, { userLimit: Number(event.target.value) })}/></label><label><span>Limite de clientes</span><input type="number" min="1" max="1000000" value={plan.customerLimit ?? Number(plan.clients.match(/[\d.]+/)?.[0]?.replace(/\./g, ""))} onChange={event => change(index, { customerLimit: Number(event.target.value) })}/></label><label><span>Descrição</span><textarea value={plan.description} onChange={event => change(index, { description: event.target.value })}/></label><fieldset className="plan-feature-options"><legend>Recursos liberados</legend>{PLAN_FEATURES.profissional.map(feature => <label key={feature}><input type="checkbox" checked={catalogFeatures(plan).includes(feature)} disabled={feature === "dashboard" || !planIncludesFeature(plan.id, feature)} onChange={event => { const featureIds = event.target.checked ? [...catalogFeatures(plan), feature] : catalogFeatures(plan).filter(id => id !== feature); change(index, { featureIds, modules: featureIds.map(id => featureLabels[id]).join("\n") }); }}/><span>{featureLabels[feature]}</span></label>)}</fieldset><small>{affected.filter(company => company.plan === plan.id).length} empresa(s) usam este plano</small></article>)}</div>
    <div className="plan-release-form"><label>Aplicar em (horário de Brasília)<input type="datetime-local" value={effectiveAt} onChange={event => setEffectiveAt(event.target.value)}/><small>Deixe vazio para aplicar agora.</small></label><label>Aviso aos clientes<textarea value={notice} onChange={event => setNotice(event.target.value)} placeholder="Descreva o que muda e quando." maxLength={2000}/></label><p>{affected.length} empresa(s) terão os limites e recursos do respectivo plano. Cobranças já emitidas mantêm o valor original; preços novos valem nas próximas contratações ou renovações.</p>{policy.pending && <p>Alteração programada para {new Date(policy.pending.effectiveAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Ao salvar, esta programação será substituída.</p>}<div className="plan-impact-list">{plans.map(plan => <p key={plan.id}><strong>{plan.name}</strong>: {affected.filter(company => company.plan === plan.id).map(company => company.name + (company.memberCount > (plan.userLimit ?? 1000) ? " · acima do novo limite de usuários" : (customerCounts[company.id] ?? 0) > (plan.customerLimit ?? 1000000) ? " · acima do novo limite de clientes" : "")).join(", ") || "nenhuma empresa"}</p>)}</div></div>
    <details className="plan-history"><summary>Histórico de alterações · revisão {policy.revision}</summary>{policy.history.slice().reverse().map(item => <p key={item.revision}>Revisão {item.revision} · {new Date(item.effectiveAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {item.notice || "Configuração administrativa"}</p>)}</details>
  </section>;
}
