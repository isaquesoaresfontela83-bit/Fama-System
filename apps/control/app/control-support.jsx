"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SupportThread } from "./support-thread";
export function ControlSupport() {
    const [tickets, setTickets] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("pending");
    const load = useCallback(async () => { try {
        const response = await fetch("/api/admin/support", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok)
            throw new Error(payload.error || "Não foi possível carregar o suporte.");
        setTickets(payload.tickets ?? []);
        setError("");
        setLoaded(true);
    }
    catch (error) {
        setError(error instanceof Error ? error.message : "Não foi possível carregar.");
    } }, []);
    useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === "visible")
        void load(); }, 30000); return () => clearInterval(timer); }, [load]);
    const rows = tickets.filter(ticket => (status === "all" || status === "pending" && ticket.status !== "resolvido" || ticket.status === status) && [ticket.title, ticket.organizationName, ticket.assignedTo].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).sort((a, b) => { const rank = { critica: 4, alta: 3, media: 2, baixa: 1 }; return (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0) || a.createdAt.localeCompare(b.createdAt); });
    const waiting = tickets.filter(ticket => ticket.status !== "resolvido" && ticket.messages?.filter(message => !message.internal).at(-1)?.authorKind !== "admin").length;
    return <section className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">ATENDIMENTO ÀS EMPRESAS</p><h2>Central de suporte</h2></div><Button variant="outline" onClick={() => void load()}>Atualizar</Button></div><p>{waiting} chamado(s) aguardam resposta da equipe. Novas mensagens são conferidas a cada 30 segundos enquanto a tela está aberta.</p><div className="support-filters"><input type="search" placeholder="Empresa, chamado ou responsável" aria-label="Buscar chamado" value={search} onChange={event => setSearch(event.target.value)}/><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar situação"><option value="pending">Em andamento</option><option value="all">Todos</option><option value="aberto">Abertos</option><option value="em_analise">Em análise</option><option value="resolvido">Resolvidos</option></select></div>{error && <p role="alert">{error}</p>}{!loaded && !error && <p>Carregando chamados…</p>}<div className="support-conversation-list">{rows.map(ticket => <SupportThread key={ticket.id} ticket={ticket} admin onUpdated={() => void load()}/>)}</div>{loaded && !rows.length && <p>Nenhum chamado corresponde ao filtro.</p>}</section>;
}
