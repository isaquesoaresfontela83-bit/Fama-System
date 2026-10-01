"use client";

import { FormEvent, useEffect, useState } from "react";
import { Mail, Plus, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteButton } from "./delete-button";
import type { Organization, OrganizationRole } from "./data-model";
import { featurePermissions } from "@/lib/permissions";

type Member = {
  id: string;
  email: string;
  displayName: string;
  role: OrganizationRole;
  status: "active" | "invited";
  createdAt: string;
  permissions: string[];
};

const roleLabels: Record<OrganizationRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Colaborador",
  technician: "Técnico",
};

export function MembersPanel({ organization }: { organization: Organization }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissionsMember, setPermissionsMember] = useState<Member | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const headers = { "x-organization-id": organization.id };

  useEffect(() => {
    fetch("/api/members", { headers: { "x-organization-id": organization.id } })
      .then(async (response) => {
        const payload = await response.json() as { members?: Member[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os usuários.");
        setMembers(payload.members ?? []);
      })
      .catch((cause) => toast.error(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários."))
      .finally(() => setLoading(false));
  }, [organization.id]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { member?: Member; error?: string };
      if (!response.ok || !payload.member) throw new Error(payload.error ?? "Não foi possível adicionar o usuário.");
      setMembers((current) => [...current, payload.member!]);
      setInviteOpen(false);
      toast.success("Convite criado. O acesso será liberado quando esse e-mail entrar no Fama System.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível adicionar o usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMember(member: Member) {
    const response = await fetch(`/api/members/${member.id}`, { method: "DELETE", headers });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      toast.error(payload.error ?? "Não foi possível remover o usuário.");
      return;
    }
    setMembers((current) => current.filter((item) => item.id !== member.id));
    toast.success("Usuário removido da empresa.");
  }

  async function savePermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissionsMember) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/members/${permissionsMember.id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ permissions: selectedPermissions }) });
      const payload = await response.json() as { error?: string; member?: { permissions?: string[] } };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar as permissões.");
      setMembers((current) => current.map((item) => item.id === permissionsMember.id ? { ...item, permissions: payload.member?.permissions ?? selectedPermissions } : item));
      setPermissionsMember(null);
      toast.success("Permissões atualizadas com segurança.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar as permissões."); }
    finally { setSubmitting(false); }
  }

  return <div className="module-stack">
    <div className="compact-metrics">
      <article className="metric-card"><span className="metric-icon cyan"><UsersRound /></span><div><p>Usuários</p><strong>{members.length}</strong><small>nesta empresa</small></div></article>
      <article className="metric-card"><span className="metric-icon blue"><ShieldCheck /></span><div><p>Acessos ativos</p><strong>{members.filter((item) => item.status === "active").length}</strong><small>identidades confirmadas</small></div></article>
      <article className="metric-card"><span className="metric-icon orange"><Mail /></span><div><p>Convites</p><strong>{members.filter((item) => item.status === "invited").length}</strong><small>aguardando primeiro acesso</small></div></article>
    </div>
    <section className="surface members-surface">
      <div className="panel-heading"><div><small>ACESSO DA EMPRESA</small><h2>Usuários e permissões</h2></div><div className="panel-actions"><Button onClick={() => setInviteOpen(true)}><UserPlus />Adicionar usuário</Button></div></div>
      <p className="members-intro">Cada usuário entra com o próprio e-mail. O Fama System valida a participação e mantém os registros de {organization.name} separados de todas as outras empresas.</p>
      <div className="members-list">
        {loading ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />) : members.map((member) => <article key={member.id}>
          <span className="member-avatar">{(member.displayName || member.email).slice(0, 2).toLocaleUpperCase("pt-BR")}</span>
          <div><strong>{member.displayName || "Convite pendente"}</strong><small>{member.email}</small></div>
          <Badge variant="outline">{roleLabels[member.role]}</Badge>
          <Badge className={`status ${member.status === "active" ? "status-ativo" : "status-pendente"}`}>{member.status === "active" ? "Ativo" : "Convidado"}</Badge><small className="member-permissions">{member.role === "owner" ? "Todos os módulos" : `${member.permissions?.length ?? featurePermissions.length} módulos`}</small>
          {member.role !== "owner" && <Button type="button" variant="outline" size="sm" onClick={() => { setPermissionsMember(member); setSelectedPermissions(member.permissions ?? []); }}>Configurar</Button>}
          {member.role !== "owner" && <DeleteButton label={`o acesso de ${member.email}`} onDelete={() => removeMember(member)} />}
        </article>)}
      </div>
    </section>

    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Adicionar usuário</DialogTitle><DialogDescription>Informe o e-mail que a pessoa usará na Fama System.</DialogDescription></DialogHeader><form className="record-form" onSubmit={invite}><div className="form-field span-2"><Label htmlFor="member-email">E-mail *</Label><Input id="member-email" name="email" type="email" required /></div><div className="form-field"><Label htmlFor="member-name">Nome</Label><Input id="member-name" name="displayName" /></div><div className="form-field"><Label htmlFor="member-role">Permissão</Label><NativeSelect id="member-role" name="role" defaultValue="member"><NativeSelectOption value="member">Colaborador</NativeSelectOption><NativeSelectOption value="technician">Técnico</NativeSelectOption>{organization.role === "owner" && <NativeSelectOption value="admin">Administrador</NativeSelectOption>}</NativeSelect></div><DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Adicionando…" : <><Plus />Adicionar</>}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(permissionsMember)} onOpenChange={(open) => !open && setPermissionsMember(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Permissões por módulo</DialogTitle><DialogDescription>{permissionsMember?.displayName || permissionsMember?.email}. Marque somente o que esta pessoa precisa operar.</DialogDescription></DialogHeader><form className="permission-picker" onSubmit={savePermissions}>{featurePermissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={selectedPermissions.includes(permission.id)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.id] : current.filter((item) => item !== permission.id))} /><span>{permission.label}</span></label>)}<DialogFooter><Button type="button" variant="outline" onClick={() => setPermissionsMember(null)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar permissões"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
