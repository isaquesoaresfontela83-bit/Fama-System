"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
export const supportStatusLabels = { aberto: "Aberto", em_analise: "Em análise", resolvido: "Resolvido" };
export function SupportThread({ ticket, admin, organizationId, onUpdated }) {
    const [reply, setReply] = useState("");
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const latest = ticket.messages?.at(-1);
    async function send(event) { event.preventDefault(); if (busy)
        return; setBusy(true); try {
        const response = await fetch(admin ? "/api/admin/support" : "/api/support/reply", { method: admin ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(organizationId ? { "x-organization-id": organizationId } : {}) }, body: JSON.stringify(admin ? { id: ticket.id, status: ticket.status, reply, internal } : { id: ticket.id, message: reply }) });
        const payload = await response.json();
        if (!response.ok)
            throw new Error(payload.error || "Não foi possível enviar.");
        setReply("");
        onUpdated();
        toast.success(internal ? "Nota interna registrada." : "Resposta registrada.");
    }
    catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar.");
    }
    finally {
        setBusy(false);
    } }
    async function change(patch) { if (busy)
        return; setBusy(true); try {
        const response = await fetch("/api/admin/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ticket.id, status: ticket.status, ...patch }) });
        const payload = await response.json();
        if (!response.ok)
            throw new Error(payload.error || "Não foi possível atualizar.");
        onUpdated();
    }
    catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
    }
    finally {
        setBusy(false);
    } }
    return <article className="support-conversation"><header><div><strong>{ticket.title}</strong><small>{ticket.organizationName || "Sua empresa"} · {new Date(ticket.createdAt).toLocaleDateString("pt-BR")} · {ticket.priority}</small></div><span className={"support-state " + ticket.status}>{supportStatusLabels[ticket.status] ?? ticket.status}</span></header><p>{ticket.message}</p>{ticket.assignedTo && <small>Responsável: {ticket.assignedTo}</small>}{latest && !latest.internal && <div className="support-latest"><strong>{latest.authorKind === "admin" ? "Resposta do suporte" : "Última mensagem do cliente"}</strong><p>{latest.body}</p></div>}
    {admin && <div className="support-admin-controls"><label>Situação<select disabled={busy} value={ticket.status} onChange={e => void change({ status: e.target.value })}>{Object.entries(supportStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Prioridade<select disabled={busy} value={ticket.priority} onChange={e => void change({ priority: e.target.value })}>{["baixa", "media", "alta", "critica"].map(value => <option key={value}>{value}</option>)}</select></label><label>Responsável<input key={ticket.assignedTo} defaultValue={ticket.assignedTo ?? ""} maxLength={120} onBlur={e => { if (e.target.value !== (ticket.assignedTo ?? ""))
        void change({ assignedTo: e.target.value }); }} placeholder="Nome do responsável"/></label></div>}
    <Button size="sm" variant="outline" onClick={() => setOpen(value => !value)}>{open ? "Fechar conversa" : "Abrir conversa"} · {ticket.messages?.length ?? 0}</Button>
    {open && <div className="support-thread-history"><p className="support-history-note">Histórico recente do chamado</p>{ticket.messages?.map(message => <div key={message.id} className={"support-message " + message.authorKind + (message.internal ? " internal" : "")}><header><strong>{message.authorName || (message.authorKind === "admin" ? "Suporte" : "Cliente")}</strong><small>{message.internal ? "Nota interna · " : ""}{new Date(message.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small></header><p>{message.body}</p></div>)}{admin && ticket.adminNotes && <div className="support-message internal"><strong>Observação interna anterior</strong><p>{ticket.adminNotes}</p></div>}<form onSubmit={send}><label>{internal && admin ? "Nota interna" : "Responder ao chamado"}<textarea value={reply} onChange={e => setReply(e.target.value)} minLength={2} maxLength={3000} required/></label>{admin && <label className="support-internal-toggle"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)}/>Somente equipe de suporte</label>}<Button disabled={busy}>{busy ? "Salvando…" : internal && admin ? "Salvar nota interna" : "Enviar resposta"}</Button></form></div>}
  </article>;
}
