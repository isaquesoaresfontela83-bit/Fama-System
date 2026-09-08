"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteButton } from "./delete-button";

type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  memberCount: number;
  createdAt: string;
};

export function PlatformCompanies() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/organizations")
      .then(async (response) => {
        const payload = await response.json() as { organizations?: PlatformOrganization[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as empresas.");
        setOrganizations(payload.organizations ?? []);
      })
      .catch((cause) => toast.error(cause instanceof Error ? cause.message : "Não foi possível carregar as empresas."))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(organization: PlatformOrganization) {
    const status = organization.status === "active" ? "suspended" : "active";
    const response = await fetch(`/api/admin/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível alterar a empresa.");
    setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status } : item));
    toast.success(status === "active" ? "Empresa reativada." : "Empresa suspensa.");
  }

  async function remove(organization: PlatformOrganization) {
    const response = await fetch(`/api/admin/organizations/${organization.id}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      toast.error(payload.error ?? "Não foi possível excluir a empresa.");
      throw new Error(payload.error ?? "delete");
    }
    setOrganizations((current) => current.filter((item) => item.id !== organization.id));
    toast.success("Empresa e dados associados excluídos.");
  }

  if (loading) return <div className="module-stack">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>;

  return <div className="module-stack">
    <div className="compact-metrics">
      <article className="metric-card"><span className="metric-icon cyan"><Building2 /></span><div><p>Empresas</p><strong>{organizations.length}</strong><small>perfis cadastrados</small></div></article>
      <article className="metric-card"><span className="metric-icon blue"><CheckCircle2 /></span><div><p>Ativas</p><strong>{organizations.filter((item) => item.status === "active").length}</strong><small>com acesso liberado</small></div></article>
      <article className="metric-card"><span className="metric-icon violet"><ShieldCheck /></span><div><p>Privacidade</p><strong>Isolada</strong><small>sem acesso aos dados internos</small></div></article>
    </div>
    <section className="surface table-surface"><div className="panel-heading"><div><small>ADMINISTRAÇÃO DA PLATAFORMA</small><h2>Empresas cadastradas</h2></div><Badge variant="secondary">Visão sem dados operacionais</Badge></div><p className="members-intro">Esta área permite controlar somente cadastro e acesso. Clientes, valores e operações de cada empresa permanecem privados.</p><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Identificador</TableHead><TableHead>Usuários</TableHead><TableHead>Cadastro</TableHead><TableHead>Situação</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{organizations.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong></TableCell><TableCell>{organization.slug}</TableCell><TableCell>{organization.memberCount}</TableCell><TableCell>{new Date(organization.createdAt).toLocaleDateString("pt-BR")}</TableCell><TableCell><Badge className={`status ${organization.status === "active" ? "status-ativo" : "status-expirada"}`}>{organization.status === "active" ? "Ativa" : "Suspensa"}</Badge></TableCell><TableCell><div className="record-actions"><Button variant="outline" size="sm" onClick={() => void toggle(organization)}>{organization.status === "active" ? "Suspender" : "Reativar"}</Button><DeleteButton label={`a empresa ${organization.name}`} onDelete={() => remove(organization)} /></div></TableCell></TableRow>)}</TableBody></Table></section>
  </div>;
}
