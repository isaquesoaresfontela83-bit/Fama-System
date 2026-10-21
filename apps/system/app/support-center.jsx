"use client";
import { SupportThread } from "./support-thread";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Loader2, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
const typeLabels = { melhoria: "Melhoria", erro: "Erro", duvida: "Dúvida", financeiro: "Financeiro" };
const statusLabels = { aberto: "Aberto", em_analise: "Em análise", resolvido: "Resolvido" };
export function SupportCenter({ organization }) {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        let active = true;
        async function refresh() {
            try {
                const response = await fetch("/api/support", { headers: { "x-organization-id": organization.id }, cache: "no-store" });
                const payload = await response.json();
                if (!response.ok)
                    throw new Error(payload.error || "Não foi possível carregar o suporte.");
                if (active)
                    setTickets(payload.tickets ?? []);
            }
            catch (error) {
                if (active)
                    toast.error(error instanceof Error ? error.message : "Não foi possível carregar o suporte.");
            }
            finally {
                if (active)
                    setLoading(false);
            }
        }
        void refresh();
        const timer = setInterval(() => { if (document.visibilityState === "visible")
            void refresh(); }, 30000);
        return () => { active = false; clearInterval(timer); };
    }, [organization.id]);
    async function refreshTickets() { const response = await fetch("/api/support", { headers: { "x-organization-id": organization.id }, cache: "no-store" }); const payload = await response.json(); if (response.ok)
        setTickets(payload.tickets ?? []); }
    async function submit(event) {
        event.preventDefault();
        setSubmitting(true);
        const form = event.currentTarget;
        const body = Object.fromEntries(new FormData(form).entries());
        try {
            const response = await fetch("/api/support", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-organization-id": organization.id },
                body: JSON.stringify(body),
            });
            const payload = await response.json();
            if (!response.ok || !payload.ticket)
                throw new Error(payload.error ?? "Não foi possível enviar.");
            setTickets((current) => [payload.ticket, ...current]);
            form.reset();
            toast.success("Chamado enviado para o Fama Control.");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível enviar.");
        }
        finally {
            setSubmitting(false);
        }
    }
    if (loading)
        return <div className="module-stack">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full"/>)}</div>;
    const openTickets = tickets.filter((ticket) => ticket.status !== "resolvido").length;
    const resolvedTickets = tickets.filter((ticket) => ticket.status === "resolvido").length;
    return (<div className="support-layout">
      <section className="surface support-hero">
        <div>
          <small>SUPORTE FAMA SYSTEM</small>
          <h2>Envie erros, melhorias e dúvidas com contexto</h2>
          <p>Seu chamado chega direto no Fama Control com empresa, usuário, prioridade e histórico para análise.</p>
        </div>
        <div className="support-hero-stats">
          <span><Clock3 /><strong>{openTickets}</strong><small>em andamento</small></span>
          <span><ShieldCheck /><strong>{resolvedTickets}</strong><small>resolvidos</small></span>
        </div>
      </section>

      <div className="support-grid">
        <section className="surface support-form-card">
          <div className="panel-heading"><div><small>NOVO CHAMADO</small><h2>Descrever solicitação</h2></div><Send /></div>
          <p className="support-helper">Informe onde ocorreu, o que tentou fazer e qual resultado esperava. Isso reduz ida e volta no atendimento.</p>
          <form className="record-form" onSubmit={submit}>
            <div className="form-field"><Label htmlFor="support-type">Tipo</Label><NativeSelect id="support-type" name="type" defaultValue="melhoria"><NativeSelectOption value="melhoria">Melhoria</NativeSelectOption><NativeSelectOption value="erro">Erro</NativeSelectOption><NativeSelectOption value="duvida">Dúvida</NativeSelectOption><NativeSelectOption value="financeiro">Financeiro</NativeSelectOption></NativeSelect></div>
            <div className="form-field"><Label htmlFor="support-priority">Prioridade</Label><NativeSelect id="support-priority" name="priority" defaultValue="media"><NativeSelectOption value="baixa">Baixa</NativeSelectOption><NativeSelectOption value="media">Média</NativeSelectOption><NativeSelectOption value="alta">Alta</NativeSelectOption><NativeSelectOption value="critica">Crítica</NativeSelectOption></NativeSelect></div>
            <div className="form-field span-2"><Label htmlFor="support-title">Título</Label><Input id="support-title" name="title" minLength={4} maxLength={120} required placeholder="Ex.: Erro ao gerar orçamento"/></div>
            <div className="form-field span-2"><Label htmlFor="support-message">Detalhes</Label><Textarea id="support-message" name="message" minLength={10} maxLength={3000} required placeholder="Explique o que aconteceu, onde clicou e o que esperava ver."/></div>
            <Button className="span-2" type="submit" disabled={submitting}>{submitting ? <><Loader2 className="spin-icon"/>Enviando…</> : <><MessageCircle />Enviar para suporte</>}</Button>
          </form>
        </section>

        <section className="surface support-list-card">
          <div className="panel-heading"><div><small>HISTÓRICO</small><h2>Chamados enviados</h2></div><Badge variant="secondary">{tickets.length}</Badge></div>
          <div className="support-ticket-list">
            {tickets.map(ticket => <SupportThread key={ticket.id} ticket={ticket} organizationId={organization.id} onUpdated={() => void refreshTickets()}/>)}
            {!tickets.length && <div className="empty-state"><CheckCircle2 /><p>Nenhum chamado enviado ainda.</p></div>}
          </div>
        </section>
      </div>
    </div>);
}
