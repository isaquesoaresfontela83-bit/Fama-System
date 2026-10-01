"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Building2, Clock3, CreditCard, KeyRound, MessageCircle, Settings2, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DeleteButton } from "./delete-button";
import { featurePermissions } from "@/lib/permissions";
import { defaultCompanySettings, type CompanySettings } from "@/lib/company-settings";

type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deleted";
  plan: string;
  planStatus: string;
  planExpiresAt: string;
  billingProvider: string;
  billingPaymentId: string;
  memberCount: number;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  organizationName: string;
  userEmail: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  status: string;
  adminNotes: string;
  createdAt: string;
};

type ManualCheckout = {
  id: string;
  plan: string;
  billingCycle?: string;
  installments?: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  provider: string;
  proofText: string;
  proofSubmittedAt: string;
  adminNotes: string;
  status: string;
  createdAt: string;
};

type BillingSettings = {
  configured: boolean;
  environment: "production" | "sandbox";
  updatedAt: string;
};

type PlatformMember = {
  id: string;
  organizationName: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  permissions: string[];
};

type ControlTab = "overview" | "finance" | "access" | "support" | "companies";

const permissionGroups = ["Operação", "Gestão"] as const;

function permissionSummary(permissions: string[]) {
  const total = featurePermissions.length;
  if (permissions.length === total) return "Todas as abas";
  if (!permissions.length) return "Sem abas operacionais";
  return `${permissions.length} de ${total} abas`;
}

function ticketStatusLabel(status: string) {
  if (status === "em_analise") return "Em análise";
  if (status === "resolvido") return "Resolvido";
  return "Aberto";
}

function checkoutStatusLabel(status: string) {
  if (status === "paid") return "Aprovado";
  if (status === "payment_rejected") return "Reprovado";
  if (status === "awaiting_review") return "Aguardando aprovação";
  return "Aguardando comprovante";
}

function planStatusLabel(status: string) {
  if (status === "active") return "Pago";
  if (status === "pending_payment") return "Aguardando Pix";
  if (status === "payment_attention") return "Atenção";
  if (status === "expired") return "Vencido";
  if (status === "cancelled") return "Cancelado";
  return "Teste";
}

function planDueLabel(value: string) {
  if (!value) return "Sem vencimento";
  return new Date(value).toLocaleDateString("pt-BR");
}

function expiresSoon(value: string) {
  if (!value) return false;
  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return false;
  const now = Date.now();
  return due >= now && due <= now + 7 * 24 * 60 * 60 * 1000;
}

export function PlatformCompanies() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [members, setMembers] = useState<PlatformMember[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [checkouts, setCheckouts] = useState<ManualCheckout[]>([]);
  const [tab, setTab] = useState<ControlTab>("overview");
  const [permissionsMember, setPermissionsMember] = useState<PlatformMember | null>(null);
  const [settingsOrganization, setSettingsOrganization] = useState<PlatformOrganization | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [billing, setBilling] = useState<BillingSettings>({ configured: false, environment: "production", updatedAt: "" });
  const [billingKey, setBillingKey] = useState("");
  const [billingEnvironment, setBillingEnvironment] = useState<"production" | "sandbox">("production");
  const [savingBilling, setSavingBilling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/organizations").then(async (response) => {
        const payload = await response.json() as { organizations?: PlatformOrganization[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as empresas.");
        return payload.organizations ?? [];
      }),
      fetch("/api/admin/support").then(async (response) => {
        const payload = await response.json() as { tickets?: SupportTicket[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os chamados.");
        return payload.tickets ?? [];
      }),
      fetch("/api/admin/members").then(async (response) => {
        const payload = await response.json() as { members?: PlatformMember[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os acessos.");
        return payload.members ?? [];
      }),
      fetch("/api/admin/checkouts").then(async (response) => {
        const payload = await response.json() as { checkouts?: ManualCheckout[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os pagamentos.");
        return payload.checkouts ?? [];
      }),
      fetch("/api/admin/billing").then(async (response) => {
        const payload = await response.json() as Partial<BillingSettings> & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar a configuração Asaas.");
        return {
          configured: Boolean(payload.configured),
          environment: payload.environment === "sandbox" ? "sandbox" : "production",
          updatedAt: payload.updatedAt ?? "",
        } satisfies BillingSettings;
      }),
    ])
    .then(([nextOrganizations, nextTickets, nextMembers, nextCheckouts, nextBilling]) => {
        setOrganizations(nextOrganizations);
        setTickets(nextTickets);
        setMembers(nextMembers);
        setCheckouts(nextCheckouts);
        setBilling(nextBilling);
        setBillingEnvironment(nextBilling.environment);
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

  async function updatePlanStatus(organization: PlatformOrganization, planStatus: string) {
    const body: Record<string, unknown> = { planStatus };
    const response = await fetch(`/api/admin/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as { error?: string; planExpiresAt?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar o plano.");
    setOrganizations((current) => current.map((item) => item.id === organization.id ? {
      ...item,
      planStatus,
      planExpiresAt: payload.planExpiresAt ?? item.planExpiresAt,
    } : item));
    toast.success(planStatus === "active" ? "Plano ativado." : "Plano marcado para atenção.");
  }

  async function remove(organization: PlatformOrganization) {
    const response = await fetch(`/api/admin/organizations/${organization.id}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      toast.error(payload.error ?? "Não foi possível excluir a empresa.");
      throw new Error(payload.error ?? "delete");
    }
    setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status: "deleted" } : item));
    toast.success("Empresa movida para a lixeira e bloqueada.");
  }

  async function updateTicket(ticket: SupportTicket, status: string, adminNotes = ticket.adminNotes) {
    const response = await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status, adminNotes }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar o chamado.");
    setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status, adminNotes } : item));
    toast.success("Chamado atualizado.");
  }

  async function updateCheckout(checkout: ManualCheckout, status: string, adminNotes = checkout.adminNotes) {
    const response = await fetch("/api/admin/checkouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: checkout.id, status, adminNotes }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar o pagamento.");
    setCheckouts((current) => current.map((item) => item.id === checkout.id ? { ...item, status, adminNotes } : item));
    toast.success(status === "paid" ? "Pagamento aprovado. O cliente já pode criar a conta." : "Pagamento atualizado.");
  }

  async function saveMemberPermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissionsMember) return;
    const response = await fetch(`/api/admin/members/${permissionsMember.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: selectedPermissions }),
    });
    const payload = await response.json() as { error?: string; permissions?: string[] };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível salvar as permissões.");
    setMembers((current) => current.map((member) => member.id === permissionsMember.id ? { ...member, permissions: payload.permissions ?? selectedPermissions } : member));
    setPermissionsMember(null);
    toast.success("Permissões atualizadas pelo Fama Control.");
  }

  async function openCompanySettings(organization: PlatformOrganization) {
    setSettingsOrganization(organization);
    setLoadingSettings(true);
    try {
      const response = await fetch(`/api/admin/organization-settings/${organization.id}`, { cache: "no-store" });
      const payload = await response.json() as { settings?: CompanySettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Não foi possível carregar as configurações.");
      setCompanySettings(payload.settings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as configurações.");
      setSettingsOrganization(null);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function saveCompanySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsOrganization) return;
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/admin/organization-settings/${settingsOrganization.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: companySettings }),
      });
      const payload = await response.json() as { settings?: CompanySettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Não foi possível salvar as configurações.");
      setCompanySettings(payload.settings);
      setSettingsOrganization(null);
      toast.success("Configurações da empresa atualizadas pelo Fama Control.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBilling(true);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: billingKey, environment: billingEnvironment }),
      });
      const payload = await response.json() as Partial<BillingSettings> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a chave Asaas.");
      const nextBilling = {
        configured: true,
        environment: payload.environment === "sandbox" ? "sandbox" : "production",
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      } satisfies BillingSettings;
      setBilling(nextBilling);
      setBillingKey("");
      toast.success("Asaas configurada. O checkout público já pode gerar Pix automático.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a chave Asaas.");
    } finally {
      setSavingBilling(false);
    }
  }

  if (loading) return <div className="module-stack">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>;

  const activeOrganizations = organizations.filter((item) => item.status === "active").length;
  const openTickets = tickets.filter((item) => item.status !== "resolvido").length;
  const pendingPayments = checkouts.filter((item) => item.status === "awaiting_review").length;
  const approvedPayments = checkouts.filter((item) => item.status === "paid").length;
  const activePlans = organizations.filter((item) => item.planStatus === "active").length;
  const attentionPlans = organizations.filter((item) => ["payment_attention", "expired"].includes(item.planStatus)).length;
  const expiringPlans = organizations.filter((item) => expiresSoon(item.planExpiresAt)).length;
  const newestCheckout = checkouts[0];
  const monthlyProjection = organizations.filter((item) => item.planStatus === "active").reduce((total, item) => {
    if (item.plan === "intermediario") return total + 9990;
    if (item.plan === "profissional") return total + 14990;
    return total + 4990;
  }, 0);

  return <div className="platform-control">
    <section className="surface platform-hero">
      <div>
        <small>FAMA CONTROL</small>
        <h2>Centro de comando da plataforma</h2>
        <p>Controle empresas, acompanhe chamados e mantenha a operação comercial protegida sem entrar nos dados internos dos clientes.</p>
      </div>
      <div className="platform-hero-actions">
        <span><Sparkles /><strong>v15.0</strong><small>produção ativa</small></span>
        <span><CreditCard /><strong>{attentionPlans}</strong><small>planos com atenção</small></span>
      </div>
    </section>

    <nav className="platform-tabs" aria-label="Áreas do Fama Control">
      {[
        ["overview", "Visão geral"],
        ["finance", "Financeiro"],
        ["access", "Acessos"],
        ["support", "Suporte"],
        ["companies", "Empresas"],
      ].map(([id, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id as ControlTab)}>{label}</button>)}
    </nav>

    <div className="compact-metrics platform-metrics">
      <article className="metric-card"><span className="metric-icon cyan"><Building2 /></span><div><p>Empresas</p><strong>{organizations.length}</strong><small>{activeOrganizations} ativas</small></div></article>
      <article className="metric-card"><span className="metric-icon blue"><UsersRound /></span><div><p>Usuários</p><strong>{organizations.reduce((total, item) => total + item.memberCount, 0)}</strong><small>em todos os clientes</small></div></article>
      <article className="metric-card"><span className="metric-icon violet"><MessageCircle /></span><div><p>Suporte</p><strong>{openTickets}</strong><small>chamados em aberto</small></div></article>
      <article className="metric-card"><span className="metric-icon orange"><Clock3 /></span><div><p>Pagamentos</p><strong>{pendingPayments}</strong><small>{approvedPayments} aprovados</small></div></article>
      <article className="metric-card"><span className="metric-icon cyan"><CreditCard /></span><div><p>Planos ativos</p><strong>{activePlans}</strong><small>{expiringPlans} vencem em 7 dias</small></div></article>
    </div>

    <section className="surface platform-insight-strip">
      <div><CreditCard /><span><strong>{newestCheckout ? newestCheckout.buyerName || newestCheckout.buyerEmail : "Nenhuma venda ainda"}</strong><small>{newestCheckout ? `Última solicitação: plano ${newestCheckout.plan}` : "Quando alguém pagar pelo site, aparece aqui para aprovação."}</small></span></div>
      <div><ShieldCheck /><span><strong>{billing.configured ? "Asaas automática ativa" : "Pix manual como reserva"}</strong><small>{billing.configured ? `Ambiente ${billing.environment === "production" ? "produção" : "sandbox"} configurado.` : "Cole a chave Asaas abaixo para ativar Pix automático."}</small></span></div>
      <div><Clock3 /><span><strong>{attentionPlans ? `${attentionPlans} plano(s) precisam de ação` : "Nenhum plano crítico"}</strong><small>Use os botões abaixo para ativar, revisar ou suspender sem mexer no banco.</small></span></div>
    </section>

    {(tab === "overview" || tab === "finance") && <section className="surface platform-billing-config">
      <div className="panel-heading"><div><small>COBRANÇA AUTOMÁTICA</small><h2>API Asaas da plataforma</h2></div><div className="record-actions"><a className="button button-outline" href="/configurar-asaas">Abrir tela direta</a><Badge variant={billing.configured ? "default" : "secondary"}>{billing.configured ? "Configurada" : "Pendente"}</Badge></div></div>
      <form onSubmit={saveBilling} className="platform-billing-form">
        <div><KeyRound /><span><strong>Chave protegida</strong><small>A chave é validada na Asaas, criptografada no servidor e nunca exibida novamente.</small></span></div>
        <NativeSelect value={billingEnvironment} onChange={(event) => setBillingEnvironment(event.target.value === "sandbox" ? "sandbox" : "production")} aria-label="Ambiente Asaas">
          <NativeSelectOption value="production">Produção</NativeSelectOption>
          <NativeSelectOption value="sandbox">Sandbox</NativeSelectOption>
        </NativeSelect>
        <Textarea className="asaas-key-input" value={billingKey} onChange={(event) => setBillingKey(event.target.value)} placeholder={billingEnvironment === "production" ? "$aact_prod_..." : "$aact_hmlg_..."} autoComplete="off" spellCheck={false} />
        <Button type="submit" disabled={savingBilling || !billingKey.trim()}>{savingBilling ? "Validando..." : "Salvar chave Asaas"}</Button>
      </form>
      <p>{billing.configured ? `Última atualização: ${billing.updatedAt ? new Date(billing.updatedAt).toLocaleString("pt-BR") : "configuração por ambiente"}.` : "Enquanto não salvar a chave, o site continua usando o Pix manual aprovado no Fama Control."}</p>
    </section>}

    {tab === "finance" && <section className="surface platform-finance-control">
      <div className="panel-heading"><div><small>FINANCEIRO DA PLATAFORMA</small><h2>Receita, planos e cobranças</h2></div><Badge variant="secondary">{activePlans} planos ativos</Badge></div>
      <div className="compact-metrics">
        <article className="metric-card"><span className="metric-icon cyan"><CreditCard /></span><div><p>MRR estimado</p><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(monthlyProjection / 100)}</strong><small>com planos ativos</small></div></article>
        <article className="metric-card"><span className="metric-icon orange"><Clock3 /></span><div><p>Vencendo</p><strong>{expiringPlans}</strong><small>próximos 7 dias</small></div></article>
        <article className="metric-card"><span className="metric-icon violet"><ShieldCheck /></span><div><p>Atenção</p><strong>{attentionPlans}</strong><small>revisar cobrança</small></div></article>
      </div>
      <Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{organizations.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong><small className="table-muted">{organization.slug}</small></TableCell><TableCell>{organization.plan || "inicial"}</TableCell><TableCell><Badge className={`status status-${organization.planStatus}`}>{planStatusLabel(organization.planStatus)}</Badge></TableCell><TableCell>{planDueLabel(organization.planExpiresAt)}</TableCell><TableCell><div className="record-actions"><Button variant="outline" size="sm" onClick={() => void updatePlanStatus(organization, "active")}>Ativar</Button><Button variant="outline" size="sm" onClick={() => void updatePlanStatus(organization, "payment_attention")}>Atenção</Button></div></TableCell></TableRow>)}</TableBody></Table>
    </section>}

    {(tab === "overview" || tab === "support") && <div className="platform-main-grid">
    <section className="surface platform-support-surface platform-payment-surface">
      <div className="panel-heading"><div><small>PAGAMENTOS PIX</small><h2>Aprovação manual</h2></div><Badge variant="secondary">{checkouts.length} solicitações</Badge></div>
      <div className="platform-ticket-list">
        {checkouts.map((checkout) => <article className={`platform-ticket checkout-status-${checkout.status}`} key={checkout.id}>
          <header><div><strong>{checkout.buyerName || "Cliente"}</strong><small>{checkout.buyerEmail} · {checkout.buyerPhone || "sem WhatsApp"} · plano {checkout.plan} · {checkout.billingCycle || "monthly"} · {Number(checkout.installments ?? 1)}x</small></div><Badge className={`status status-${checkout.status}`}>{checkoutStatusLabel(checkout.status)}</Badge></header>
          <p>{checkout.proofText || "Cliente ainda não enviou comprovante."}</p>
          <footer><span>{checkout.provider === "manual_pix" ? "Mercado Pago manual" : checkout.provider} · {checkout.proofSubmittedAt ? new Date(checkout.proofSubmittedAt).toLocaleString("pt-BR") : new Date(checkout.createdAt).toLocaleDateString("pt-BR")}</span><div className="record-actions"><Button size="sm" onClick={() => void updateCheckout(checkout, "paid")}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => void updateCheckout(checkout, "payment_rejected")}>Reprovar</Button></div></footer>
          <Textarea defaultValue={checkout.adminNotes} placeholder="Observação interna do pagamento" onBlur={(event) => { if (event.currentTarget.value !== checkout.adminNotes) void updateCheckout(checkout, checkout.status, event.currentTarget.value); }} />
        </article>)}
        {!checkouts.length && <div className="empty-state"><ShieldCheck /><p>Nenhum pagamento recebido ainda.</p></div>}
      </div>
    </section>

    <section className="surface platform-support-surface">
      <div className="panel-heading"><div><small>ATENDIMENTO</small><h2>Suporte e melhorias</h2></div><Badge variant="secondary">{tickets.length} chamados</Badge></div>
      <div className="platform-ticket-list">
        {tickets.map((ticket) => <article className={`platform-ticket priority-${ticket.priority}`} key={ticket.id}>
          <header><div><strong>{ticket.title}</strong><small>{ticket.organizationName || "Empresa"} · {ticket.userEmail} · {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}</small></div><Badge className={`status status-${ticket.status}`}>{ticketStatusLabel(ticket.status)}</Badge></header>
          <p>{ticket.message}</p>
          <footer><span>{ticket.type} · prioridade {ticket.priority}</span><NativeSelect value={ticket.status} onChange={(event) => void updateTicket(ticket, event.target.value)} aria-label={`Status de ${ticket.title}`}><NativeSelectOption value="aberto">Aberto</NativeSelectOption><NativeSelectOption value="em_analise">Em análise</NativeSelectOption><NativeSelectOption value="resolvido">Resolvido</NativeSelectOption></NativeSelect></footer>
          <Textarea defaultValue={ticket.adminNotes} placeholder="Observação interna do suporte" onBlur={(event) => { if (event.currentTarget.value !== ticket.adminNotes) void updateTicket(ticket, ticket.status, event.currentTarget.value); }} />
        </article>)}
        {!tickets.length && <div className="empty-state"><ShieldCheck /><p>Nenhum chamado recebido ainda.</p></div>}
      </div>
    </section>
    </div>}

    {tab === "access" && <section className="surface platform-access-control">
      <div className="panel-heading"><div><small>ACESSOS E ABAS</small><h2>Permissões dos usuários</h2></div><Badge variant="secondary">{members.length} usuários</Badge></div>
      <p className="members-intro">Controle no Fama Control quais abas cada usuário pode abrir na Fama System, mantendo a lista atualizada com a estrutura mais recente do sistema.</p>
      <Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Empresa</TableHead><TableHead>Perfil</TableHead><TableHead>Abas liberadas</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.id}><TableCell><strong>{member.displayName || "Convite pendente"}</strong><small className="table-muted">{member.email}</small></TableCell><TableCell>{member.organizationName}</TableCell><TableCell>{member.role}</TableCell><TableCell>{member.role === "owner" ? "Todas as abas" : permissionSummary(member.permissions)}</TableCell><TableCell>{member.role === "owner" ? <Badge variant="outline">Proprietário</Badge> : <Button variant="outline" size="sm" onClick={() => { setPermissionsMember(member); setSelectedPermissions(member.permissions ?? []); }}>Configurar abas</Button>}</TableCell></TableRow>)}</TableBody></Table>
    </section>}

    {(tab === "overview" || tab === "companies") && <section className="surface table-surface platform-companies-card">
      <div className="panel-heading"><div><small>EMPRESAS</small><h2>Clientes cadastrados</h2></div><Badge variant="secondary">Visão sem dados operacionais</Badge></div>
      <p className="members-intro">Controle cadastro e acesso. Empresas excluídas ficam bloqueadas e podem ser restauradas sem expor seus dados operacionais.</p>
      <Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Vencimento</TableHead><TableHead>Usuários</TableHead><TableHead>Situação</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{organizations.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong><small className="table-muted">{organization.slug}</small></TableCell><TableCell><div className="plan-cell"><Badge className={`status status-${organization.planStatus}`}>{planStatusLabel(organization.planStatus)}</Badge><small>{organization.plan || "inicial"} · {organization.billingProvider || "sem cobrança"}</small></div></TableCell><TableCell>{planDueLabel(organization.planExpiresAt)}</TableCell><TableCell>{organization.memberCount}</TableCell><TableCell><Badge className={`status ${organization.status === "active" ? "status-ativo" : "status-expirada"}`}>{organization.status === "active" ? "Ativa" : organization.status === "deleted" ? "Na lixeira" : "Suspensa"}</Badge></TableCell><TableCell><div className="record-actions"><Button variant="outline" size="sm" onClick={() => void openCompanySettings(organization)}><Settings2 />Config.</Button><Button variant="outline" size="sm" onClick={() => void updatePlanStatus(organization, "active")}>Ativar plano</Button><Button variant="outline" size="sm" onClick={() => void updatePlanStatus(organization, "payment_attention")}>Atenção</Button><Button variant="outline" size="sm" onClick={() => void toggle(organization)}>{organization.status === "active" ? "Suspender" : organization.status === "deleted" ? "Restaurar" : "Reativar"}</Button>{organization.status !== "deleted" && <DeleteButton label={`a empresa ${organization.name}`} onDelete={() => remove(organization)} />}</div></TableCell></TableRow>)}</TableBody></Table>
    </section>}
    <Dialog open={Boolean(settingsOrganization)} onOpenChange={(open) => !open && setSettingsOrganization(null)}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>Configurações da empresa</DialogTitle><DialogDescription>{settingsOrganization?.name}. Use em caso de suporte, implantação ou correção administrativa.</DialogDescription></DialogHeader>{loadingSettings ? <Skeleton className="h-52 w-full" /> : <form className="platform-company-settings-form" onSubmit={saveCompanySettings}>
      <div className="settings-grid">
        <label className="form-field"><Label>Nome para documentos</Label><Input value={companySettings.legalName} onChange={(event) => setCompanySettings((current) => ({ ...current, legalName: event.target.value }))} /></label>
        <label className="form-field"><Label>CPF/CNPJ</Label><Input value={companySettings.document} onChange={(event) => setCompanySettings((current) => ({ ...current, document: event.target.value }))} /></label>
        <label className="form-field"><Label>WhatsApp</Label><Input value={companySettings.whatsapp} onChange={(event) => setCompanySettings((current) => ({ ...current, whatsapp: event.target.value }))} /></label>
        <label className="form-field"><Label>E-mail</Label><Input value={companySettings.email} onChange={(event) => setCompanySettings((current) => ({ ...current, email: event.target.value }))} /></label>
        <label className="form-field span-2"><Label>Endereço</Label><Input value={companySettings.address} onChange={(event) => setCompanySettings((current) => ({ ...current, address: event.target.value }))} /></label>
        <label className="form-field span-2"><Label>Condições do orçamento</Label><Textarea value={companySettings.quoteTerms} onChange={(event) => setCompanySettings((current) => ({ ...current, quoteTerms: event.target.value }))} /></label>
        <label className="form-field span-2"><Label>Cláusulas do contrato</Label><Textarea value={companySettings.contractTerms} onChange={(event) => setCompanySettings((current) => ({ ...current, contractTerms: event.target.value }))} /></label>
        <label className="form-field"><Label>Validade orçamento (dias)</Label><Input type="number" value={companySettings.defaultQuoteValidityDays} onChange={(event) => setCompanySettings((current) => ({ ...current, defaultQuoteValidityDays: Number(event.target.value) }))} /></label>
        <label className="form-field"><Label>Alerta estoque baixo</Label><Input type="number" value={companySettings.lowStockAlert} onChange={(event) => setCompanySettings((current) => ({ ...current, lowStockAlert: Number(event.target.value) }))} /></label>
        <label className="settings-toggle"><input type="checkbox" checked={companySettings.requireCustomerDocument} onChange={(event) => setCompanySettings((current) => ({ ...current, requireCustomerDocument: event.target.checked }))} /><span>Exigir CPF/CNPJ em clientes</span></label>
        <label className="settings-toggle"><input type="checkbox" checked={companySettings.allowTechnicianPrices} onChange={(event) => setCompanySettings((current) => ({ ...current, allowTechnicianPrices: event.target.checked }))} /><span>Técnico pode ver valores</span></label>
        <label className="form-field"><Label>Provedor fiscal</Label><NativeSelect value={companySettings.fiscalProvider} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalProvider: event.target.value }))}><NativeSelectOption value="notaas">Notaas (50 notas grátis/mês)</NativeSelectOption><NativeSelectOption value="none">Não conectado</NativeSelectOption><NativeSelectOption value="nuvem_fiscal">Nuvem Fiscal</NativeSelectOption><NativeSelectOption value="focus_nfe">Focus NFe</NativeSelectOption><NativeSelectOption value="plugnotas">PlugNotas</NativeSelectOption><NativeSelectOption value="tecnospeed">TecnoSpeed</NativeSelectOption><NativeSelectOption value="custom">Conector próprio</NativeSelectOption></NativeSelect></label>
        <label className="form-field"><Label>Ambiente fiscal</Label><NativeSelect value={companySettings.fiscalEnvironment} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalEnvironment: event.target.value as CompanySettings["fiscalEnvironment"] }))}><NativeSelectOption value="sandbox">Teste / homologação</NativeSelectOption><NativeSelectOption value="production">Produção</NativeSelectOption></NativeSelect></label>
        <label className="form-field span-2"><Label>URL da API fiscal</Label><Input value={companySettings.fiscalApiBaseUrl} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalApiBaseUrl: event.target.value }))} /></label>
        <label className="form-field span-2"><Label>API Key / token fiscal</Label><Input type="password" value={companySettings.fiscalApiToken} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalApiToken: event.target.value }))} /></label>
        <label className="form-field"><Label>Inscrição municipal</Label><Input value={companySettings.fiscalMunicipalRegistration} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalMunicipalRegistration: event.target.value }))} /></label>
        <label className="form-field"><Label>Código de serviço / CNAE</Label><Input value={companySettings.fiscalServiceCode} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalServiceCode: event.target.value }))} /></label>
        <label className="form-field"><Label>Regime tributário</Label><Input value={companySettings.fiscalTaxRegime} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalTaxRegime: event.target.value }))} /></label>
        <label className="form-field"><Label>Alíquota de ISS (%)</Label><Input value={companySettings.fiscalIssRate} onChange={(event) => setCompanySettings((current) => ({ ...current, fiscalIssRate: event.target.value }))} /></label>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setSettingsOrganization(null)}>Cancelar</Button><Button type="submit" disabled={savingSettings}>{savingSettings ? "Salvando..." : "Salvar configurações"}</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
    <Dialog open={Boolean(permissionsMember)} onOpenChange={(open) => !open && setPermissionsMember(null)}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Permissões por aba</DialogTitle><DialogDescription>{permissionsMember?.displayName || permissionsMember?.email} · {permissionsMember?.organizationName}. Lista alinhada com as abas atuais da Fama System.</DialogDescription></DialogHeader><form className="platform-permission-picker" onSubmit={saveMemberPermissions}>
      <div className="permission-toolbar"><div><strong>{permissionSummary(selectedPermissions)}</strong><small>Manual, suporte e privacidade seguem disponíveis para orientação e segurança.</small></div><div className="record-actions"><Button type="button" variant="outline" size="sm" onClick={() => setSelectedPermissions(featurePermissions.map((permission) => permission.id))}>Liberar tudo</Button><Button type="button" variant="outline" size="sm" onClick={() => setSelectedPermissions([])}>Limpar abas</Button></div></div>
      {permissionGroups.map((group) => <section className="permission-group" key={group}><header><span>{group}</span><small>{group === "Operação" ? "Atendimento, venda e execução." : "Cadastros, estoque, financeiro e equipe."}</small></header><div>{featurePermissions.filter((permission) => permission.group === group).map((permission) => <label key={permission.id}><input type="checkbox" checked={selectedPermissions.includes(permission.id)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.id] : current.filter((item) => item !== permission.id))} /><span><strong>{permission.label}</strong><small>{permission.description}</small></span></label>)}</div></section>)}
      <div className="permission-always-on"><ShieldCheck /><p><strong>Controle centralizado</strong>Essa alteração afeta o acesso do usuário dentro da empresa selecionada, sem expor dados internos das outras empresas.</p></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setPermissionsMember(null)}>Cancelar</Button><Button type="submit">Salvar permissões</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
