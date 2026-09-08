"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Droplets,
  FileDown,
  FileSignature,
  FileText,
  Gauge,
  HandCoins,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackagePlus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/app/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";

import {
  Appointment,
  AppointmentStatus,
  BootstrapData,
  Contract,
  ContractStatus,
  Customer,
  Employee,
  emptyData,
  InventoryItem,
  Lead,
  LeadStatus,
  Quote,
  QuoteStatus,
  Transaction,
  TransactionStatus,
  WorkOrder,
  WorkOrderStatus,
  Warranty,
  WarrantyStatus,
  CurrentUser,
  Organization,
} from "./data-model";
import { DeleteButton } from "./delete-button";
import { MembersPanel } from "./members-panel";
import { PlatformCompanies } from "./platform-companies";
import { generateContractPdf } from "@/lib/contract-pdf";
import { generateQuotePdf } from "@/lib/quote-pdf";

type Section = "dashboard" | "crm" | "quotes" | "agenda" | "orders" | "warranties" | "customers" | "contracts" | "inventory" | "finance" | "team" | "members" | "platform";
type Entity = keyof BootstrapData;
type CreateEntity = Entity;
type AnyRecord = Lead | Quote | Appointment | WorkOrder | Customer | InventoryItem | Transaction | Employee | Warranty | Contract;
type Selected = { entity: Entity; record: AnyRecord } | null;
type DeleteRecord = (entity: Entity, record: AnyRecord) => Promise<void>;

const navGroups = [
  {
    label: "Operação",
    items: [
      { id: "dashboard" as Section, label: "Visão geral", icon: LayoutDashboard },
      { id: "crm" as Section, label: "CRM", icon: TrendingUp },
      { id: "quotes" as Section, label: "Orçamentos", icon: FileText },
      { id: "agenda" as Section, label: "Agenda", icon: CalendarDays },
      { id: "orders" as Section, label: "Ordens de serviço", icon: ClipboardCheck },
      { id: "warranties" as Section, label: "Garantias", icon: ShieldCheck },
    ],
  },
  {
    label: "Gestão",
    items: [
      { id: "customers" as Section, label: "Clientes e piscinas", icon: UsersRound },
      { id: "contracts" as Section, label: "Contratos", icon: FileSignature },
      { id: "inventory" as Section, label: "Estoque", icon: Boxes },
      { id: "finance" as Section, label: "Financeiro", icon: CircleDollarSign },
      { id: "team" as Section, label: "Equipe", icon: BriefcaseBusiness },
    ],
  },
];

const sectionMeta: Record<Section, { eyebrow: string; title: string; entity?: CreateEntity; action?: string }> = {
  dashboard: { eyebrow: "Central de operação", title: "Visão geral", entity: "workOrders", action: "Nova ordem" },
  crm: { eyebrow: "Relacionamento comercial", title: "CRM de vendas", entity: "leads", action: "Novo lead" },
  quotes: { eyebrow: "Propostas e aprovações", title: "Orçamentos", entity: "quotes", action: "Novo orçamento" },
  agenda: { eyebrow: "Rotas e compromissos", title: "Agenda", entity: "appointments", action: "Agendar visita" },
  orders: { eyebrow: "Execução em campo", title: "Ordens de serviço", entity: "workOrders", action: "Nova ordem" },
  warranties: { eyebrow: "Pós-venda e cobertura", title: "Garantias", entity: "warranties", action: "Nova garantia" },
  customers: { eyebrow: "Carteira e histórico", title: "Clientes e piscinas", entity: "customers", action: "Novo cliente" },
  contracts: { eyebrow: "Acordos recorrentes", title: "Contratos", entity: "contracts", action: "Novo contrato" },
  inventory: { eyebrow: "Produtos e equipamentos", title: "Estoque", entity: "inventory", action: "Novo item" },
  finance: { eyebrow: "Receitas e despesas", title: "Financeiro", entity: "transactions", action: "Novo lançamento" },
  team: { eyebrow: "Capacidade operacional", title: "Equipe", entity: "employees", action: "Novo membro" },
  members: { eyebrow: "Conta da empresa", title: "Usuários e permissões" },
  platform: { eyebrow: "Fama System", title: "Administração da plataforma" },
};

const leadStages: Array<{ id: LeadStatus; label: string }> = [
  { id: "novo", label: "Novos" },
  { id: "contato", label: "Em contato" },
  { id: "visita", label: "Visita técnica" },
  { id: "proposta", label: "Proposta" },
  { id: "ganho", label: "Fechados" },
];

const quoteLabels: Record<QuoteStatus, string> = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };
const appointmentLabels: Record<AppointmentStatus, string> = { agendado: "Agendado", em_rota: "Em rota", concluido: "Concluído" };
const orderLabels: Record<WorkOrderStatus, string> = { aberta: "Aberta", em_execucao: "Em execução", concluida: "Concluída" };
const transactionLabels: Record<TransactionStatus, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" };
const warrantyLabels: Record<WarrantyStatus, string> = { ativa: "Ativa", agendada: "Atendimento agendado", concluida: "Concluída", expirada: "Expirada" };
const contractLabels: Record<ContractStatus, string> = { rascunho: "Rascunho", ativo: "Ativo", suspenso: "Suspenso", encerrado: "Encerrado" };

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

function parsedDate(value: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value);
}

function shortDate(value: string) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(parsedDate(value));
}

function fullDate(value: string) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(parsedDate(value));
}

function time(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(parsedDate(value));
}

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
}

function dayKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toLocaleUpperCase("pt-BR") || "FP";
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt="" /></span>;
}

function StatusBadge({ value, labels }: { value: string; labels: Record<string, string> }) {
  return <Badge className={`status status-${value}`}>{labels[value] ?? value}</Badge>;
}

function Metric({ icon: Icon, label, value, helper, tone }: { icon: typeof Gauge; label: string; value: string; helper: string; tone: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong><small>{helper}</small></div></article>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state"><Droplets /><p>{children}</p></div>;
}

export function FamaSystemApp({ organizations, currentUser, signOutPath }: { organizations: Organization[]; currentUser: CurrentUser; signOutPath: string }) {
  const [section, setSection] = useState<Section>("dashboard");
  const [activeOrganizationId, setActiveOrganizationId] = useState(organizations[0].id);
  const [data, setData] = useState<BootstrapData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [createEntity, setCreateEntity] = useState<CreateEntity | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySubmitting, setCompanySubmitting] = useState(false);

  const activeOrganization = organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0];
  const canManageAccess = activeOrganization.role === "owner" || activeOrganization.role === "admin";
  const canDelete = canManageAccess;
  const tenantHeaders = { "x-organization-id": activeOrganization.id };

  useEffect(() => {
    fetch("/api/bootstrap", { headers: { "x-organization-id": activeOrganization.id } })
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        const real = (await response.json()) as Partial<BootstrapData>;
        setData({
          leads: real.leads ?? [],
          quotes: real.quotes ?? [],
          appointments: real.appointments ?? [],
          workOrders: real.workOrders ?? [],
          customers: real.customers ?? [],
          inventory: real.inventory ?? [],
          transactions: real.transactions ?? [],
          employees: real.employees ?? [],
          warranties: real.warranties ?? [],
          contracts: real.contracts ?? [],
        });
      })
      .catch(() => toast.error("Não foi possível carregar os registros agora."))
      .finally(() => setLoading(false));
  }, [activeOrganization.id]);

  const filter = <T extends AnyRecord>(items: T[]) => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return items;
    return items.filter((item) => JSON.stringify(item).toLocaleLowerCase("pt-BR").includes(needle));
  };

  const revenue = data.transactions.filter((item) => item.type === "receita" && item.status === "pago").reduce((sum, item) => sum + item.amountCents, 0);
  const receivable = data.transactions.filter((item) => item.type === "receita" && item.status !== "pago").reduce((sum, item) => sum + item.amountCents, 0);
  const salesPipeline = data.leads.filter((item) => item.status !== "ganho").reduce((sum, item) => sum + item.estimatedValueCents, 0);
  const stockAlerts = data.inventory.filter((item) => item.quantity <= item.minimumQuantity).length;
  function putRecord(entity: Entity, record: AnyRecord, mode: "create" | "update") {
    setData((current) => {
      const collection = current[entity] as AnyRecord[];
      const next = mode === "create"
        ? [record, ...collection]
        : collection.map((item) => item.id === record.id ? record : item);
      return { ...current, [entity]: next } as BootstrapData;
    });
    setSelected((current) => current?.entity === entity && current.record.id === record.id ? { entity, record } : current);
  }

  async function patchRecord(entity: Entity, record: AnyRecord, changes: Record<string, unknown>) {
    const response = await fetch(`/api/records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...tenantHeaders },
      body: JSON.stringify({ entity, ...changes }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar.");
    putRecord(entity, payload.record, "update");
    toast.success("Registro atualizado.");
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createEntity) return;
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantHeaders },
      body: JSON.stringify({ entity: createEntity, ...body }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível salvar.");
    putRecord(createEntity, payload.record, "create");
    setCreateEntity(null);
    toast.success("Registro salvo com sucesso.");
  }

  async function scheduleWarranty(warranty: Warranty, scheduledAt: string, technician: string) {
    const response = await fetch(`/api/warranties/${warranty.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantHeaders },
      body: JSON.stringify({ scheduledAt, technician }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível agendar a garantia.");
    putRecord("warranties", payload.warranty as Warranty, "update");
    putRecord("appointments", payload.appointment as Appointment, "create");
  }

  async function deleteRecord(entity: Entity, record: AnyRecord) {
    const response = await fetch(`/api/records/${record.id}?entity=${entity}`, { method: "DELETE", headers: tenantHeaders });
    const payload = await response.json() as { error?: string; relatedAppointmentId?: string | null };
    if (!response.ok) {
      toast.error(payload.error ?? "Não foi possível excluir o registro.");
      throw new Error(payload.error ?? "delete");
    }
    setData((current) => ({
      ...current,
      [entity]: (current[entity] as AnyRecord[]).filter((item) => item.id !== record.id),
      appointments: payload.relatedAppointmentId
        ? current.appointments.filter((item) => item.id !== payload.relatedAppointmentId)
        : current.appointments,
    }) as BootstrapData);
    setSelected((current) => current?.record.id === record.id ? null : current);
    toast.success("Registro excluído.");
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCompanySubmitting(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/organizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível criar a empresa.");
      toast.success("Nova empresa criada.");
      window.location.reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível criar a empresa.");
      setCompanySubmitting(false);
    }
  }

  const title = sectionMeta[section];

  return <SidebarProvider>
    <Sidebar collapsible="icon" className="main-sidebar">
      <SidebarHeader className="sidebar-brand"><BrandMark /><div><strong>Fama System</strong><small>Gestão para piscinas</small></div></SidebarHeader>
      <SidebarContent>
        {[...navGroups, { label: "Conta", items: [
          ...(canManageAccess ? [{ id: "members" as Section, label: "Usuários e empresas", icon: UsersRound }] : []),
          ...(currentUser.isPlatformAdmin ? [{ id: "platform" as Section, label: "Plataforma", icon: Building2 }] : []),
        ] }].filter((group) => group.items.length).map((group) => <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{group.items.map((item) => <SidebarMenuItem key={item.id}>
            <SidebarMenuButton isActive={section === item.id} tooltip={item.label} onClick={() => setSection(item.id)}><item.icon /><span>{item.label}</span></SidebarMenuButton>
          </SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>
      <SidebarFooter className="sidebar-account"><span>{initials(activeOrganization.name)}</span><div><strong>{activeOrganization.name}</strong><small>{activeOrganization.role === "owner" ? "Proprietário" : activeOrganization.role === "admin" ? "Administrador" : activeOrganization.role === "technician" ? "Técnico" : "Colaborador"}</small></div></SidebarFooter>
    </Sidebar>

    <SidebarInset className="application">
      <header className="topbar">
        <div className="heading"><SidebarTrigger><Menu /></SidebarTrigger><div><small>{title.eyebrow}</small><h1>{title.title}</h1></div></div>
        <div className="top-actions"><NativeSelect className="company-switcher" value={activeOrganization.id} onChange={(event) => { if (event.target.value === "__new__") { setCompanyOpen(true); return; } setLoading(true); setData(emptyData); setSelected(null); setActiveOrganizationId(event.target.value); setSection("dashboard"); }} aria-label="Empresa ativa">{organizations.map((organization) => <NativeSelectOption key={organization.id} value={organization.id}>{organization.name}</NativeSelectOption>)}<NativeSelectOption value="__new__">+ Criar nova empresa</NativeSelectOption></NativeSelect><div className="global-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar neste módulo" aria-label="Buscar neste módulo" /></div><ThemeToggle /><Button variant="outline" size="icon" asChild aria-label="Sair"><a href={signOutPath} target="_top"><LogOut /></a></Button>{title.entity && <Button onClick={() => setCreateEntity(title.entity!)}><Plus />{title.action}</Button>}</div>
      </header>

      <main className="workspace">
        {loading ? <div className="loading"><i /><p>Preparando sua operação…</p></div> : <>
          {section === "dashboard" && <Dashboard data={data} revenue={revenue} receivable={receivable} salesPipeline={salesPipeline} stockAlerts={stockAlerts} onSelect={setSelected} onNavigate={setSection} />}
          {section === "crm" && <Crm leads={filter(data.leads)} onSelect={(record) => setSelected({ entity: "leads", record })} onMove={(record, status) => patchRecord("leads", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "quotes" && <Quotes quotes={filter(data.quotes)} organizationName={activeOrganization.name} onSelect={(record) => setSelected({ entity: "quotes", record })} onStatus={(record, status) => patchRecord("quotes", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "agenda" && <Agenda appointments={filter(data.appointments)} employees={data.employees} onSelect={(record) => setSelected({ entity: "appointments", record })} onStatus={(record, status) => patchRecord("appointments", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "orders" && <Orders orders={filter(data.workOrders)} onSelect={(record) => setSelected({ entity: "workOrders", record })} onStatus={(record, status) => patchRecord("workOrders", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "warranties" && <Warranties warranties={filter(data.warranties)} employees={data.employees} onSelect={(record) => setSelected({ entity: "warranties", record })} onStatus={(record, status) => patchRecord("warranties", record, { status })} onSchedule={scheduleWarranty} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "customers" && <Customers customers={filter(data.customers)} onSelect={(record) => setSelected({ entity: "customers", record })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "contracts" && <Contracts contracts={filter(data.contracts)} organizationName={activeOrganization.name} onSelect={(record) => setSelected({ entity: "contracts", record })} onStatus={(record, status) => patchRecord("contracts", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "inventory" && <Inventory items={filter(data.inventory)} onSelect={(record) => setSelected({ entity: "inventory", record })} onAdjust={(record, quantity) => patchRecord("inventory", record, { quantity })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "finance" && <Finance transactions={filter(data.transactions)} revenue={revenue} receivable={receivable} onSelect={(record) => setSelected({ entity: "transactions", record })} onStatus={(record, status) => patchRecord("transactions", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "team" && <Team appointments={data.appointments} employees={filter(data.employees)} onSelect={(record) => setSelected({ entity: "employees", record })} onDelete={canDelete ? deleteRecord : undefined} />}
          {section === "members" && canManageAccess && <MembersPanel organization={activeOrganization} />}
          {section === "platform" && currentUser.isPlatformAdmin && <PlatformCompanies />}
        </>}
      </main>
    </SidebarInset>

    <CreateDialog entity={createEntity} employees={data.employees} onOpenChange={(open) => !open && setCreateEntity(null)} onSubmit={createRecord} />
    <Dialog open={companyOpen} onOpenChange={setCompanyOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Criar nova empresa</DialogTitle><DialogDescription>O novo perfil terá dados, equipe e operação totalmente separados.</DialogDescription></DialogHeader><form className="record-form" onSubmit={createOrganization}><div className="form-field span-2"><Label htmlFor="company-profile-name">Nome da empresa *</Label><Input id="company-profile-name" name="name" minLength={2} maxLength={80} required /></div><DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => setCompanyOpen(false)}>Cancelar</Button><Button type="submit" disabled={companySubmitting}>{companySubmitting ? "Criando…" : <><Building2 />Criar empresa</>}</Button></DialogFooter></form></DialogContent></Dialog>
    <DetailSheet selected={selected} organizationName={activeOrganization.name} onClose={() => setSelected(null)} onDelete={canDelete ? deleteRecord : undefined} />
    <Toaster richColors position="top-right" />
  </SidebarProvider>;
}

function Dashboard({ data, revenue, receivable, salesPipeline, stockAlerts, onSelect, onNavigate }: {
  data: BootstrapData;
  revenue: number;
  receivable: number;
  salesPipeline: number;
  stockAlerts: number;
  onSelect: (value: Selected) => void;
  onNavigate: (section: Section) => void;
}) {
  const today = data.appointments.filter((item) => new Date(item.startAt).toDateString() === new Date().toDateString());
  const latestWater = data.workOrders.find((item) => item.ph !== null);
  const openOrders = data.workOrders.filter((item) => item.status !== "concluida").length;
  const approvedQuotes = data.quotes.filter((item) => item.status === "aprovado").length;

  return <div className="dashboard-grid">
    <section className="day-card">
      <div className="day-intro"><div><small>OPERAÇÃO DE HOJE</small><h2>{todayLabel()}</h2><p>{today.length} compromissos programados · {openOrders} ordens abertas</p></div><span className="weather-mark"><Droplets /><b>Fluxo</b><small>organizado</small></span></div>
      <div className="timeline">
        {today.map((item) => <button key={item.id} onClick={() => onSelect({ entity: "appointments", record: item })}><time>{time(item.startAt)}</time><i className={`timeline-dot status-${item.status}`} /><div><strong>{item.title}</strong><span>{item.clientName} · {item.address}</span></div><Badge variant="secondary">{item.technician}</Badge><ChevronRight /></button>)}
        {!today.length && <Empty>Nenhum compromisso para hoje.</Empty>}
      </div>
      <Button variant="ghost" className="full-link" onClick={() => onNavigate("agenda")}>Abrir agenda completa<ArrowRight /></Button>
    </section>

    <section className="water-card">
      <div className="panel-heading light"><div><small>ÚLTIMA ANÁLISE</small><h2>Saúde da água</h2></div><Droplets /></div>
      {latestWater ? <>
        <p className="water-client">{latestWater.clientName}<span>{shortDate(latestWater.scheduledAt)}</span></p>
        <div className="water-gauges">
          <WaterGauge label="pH" display={String(latestWater.ph ?? "—")} percent={latestWater.ph ? Math.min(100, latestWater.ph / 8.2 * 100) : 0} />
          <WaterGauge label="Cloro" display={`${latestWater.chlorine ?? "—"} ppm`} percent={latestWater.chlorine ? Math.min(100, latestWater.chlorine / 3 * 100) : 0} />
          <WaterGauge label="Alcalin." display={`${latestWater.alkalinity ?? "—"}`} percent={latestWater.alkalinity ? Math.min(100, latestWater.alkalinity / 120 * 100) : 0} />
        </div>
        <div className="water-ok"><Check />Parâmetros registrados na ordem {latestWater.osNumber}</div>
      </> : <Empty>Nenhuma medição registrada.</Empty>}
    </section>

    <section className="dashboard-metrics">
      <Metric icon={BadgeDollarSign} label="Receita recebida" value={money(revenue)} helper="lançamentos pagos" tone="cyan" />
      <Metric icon={HandCoins} label="A receber" value={money(receivable)} helper="pendente ou atrasado" tone="blue" />
      <Metric icon={TrendingUp} label="Pipeline comercial" value={money(salesPipeline)} helper={`${approvedQuotes} orçamento aprovado`} tone="violet" />
      <Metric icon={AlertTriangle} label="Alertas de estoque" value={String(stockAlerts)} helper="itens no mínimo" tone="orange" />
    </section>

    <section className="surface quick-panel">
      <div className="panel-heading"><div><small>PRÓXIMOS PASSOS</small><h2>Atenção necessária</h2></div><Button variant="ghost" size="sm" onClick={() => onNavigate("finance")}>Ver financeiro<ArrowUpRight /></Button></div>
      <div className="attention-list">
        {data.transactions.filter((item) => item.status === "atrasado").map((item) => <button key={item.id} onClick={() => onSelect({ entity: "transactions", record: item })}><span className="attention-icon danger"><ArrowDownLeft /></span><div><strong>Cobrança em atraso</strong><small>{item.description}</small></div><b>{money(item.amountCents)}</b><ChevronRight /></button>)}
        {data.inventory.filter((item) => item.quantity <= item.minimumQuantity).slice(0, 3).map((item) => <button key={item.id} onClick={() => onSelect({ entity: "inventory", record: item })}><span className="attention-icon warning"><PackagePlus /></span><div><strong>Repor estoque</strong><small>{item.name}</small></div><b>{item.quantity} {item.unit}</b><ChevronRight /></button>)}
      </div>
    </section>

    <section className="surface sales-panel">
      <div className="panel-heading"><div><small>CONVERSÃO</small><h2>Funil comercial</h2></div><Button variant="ghost" size="sm" onClick={() => onNavigate("crm")}>Abrir CRM<ArrowUpRight /></Button></div>
      <div className="funnel-summary">
        {leadStages.map((stage, index) => {
          const count = data.leads.filter((lead) => lead.status === stage.id).length;
          return <div key={stage.id}><span style={{ width: `${100 - index * 10}%` }}><b>{count}</b></span><small>{stage.label}</small></div>;
        })}
      </div>
    </section>
  </div>;
}

function WaterGauge({ label, display, percent }: { label: string; display: string; percent: number }) {
  return <div className="gauge"><span style={{ "--gauge": `${percent * 3.6}deg` } as React.CSSProperties}><i /></span><strong>{display}</strong><small>{label}</small></div>;
}

function Crm({ leads, onSelect, onMove, onDelete }: { leads: Lead[]; onSelect: (record: Lead) => void; onMove: (record: Lead, status: LeadStatus) => void; onDelete?: DeleteRecord }) {
  return <div className="crm-board">{leadStages.map((stage, index) => {
    const cards = leads.filter((lead) => lead.status === stage.id);
    const total = cards.reduce((sum, lead) => sum + lead.estimatedValueCents, 0);
    const next = leadStages[index + 1]?.id;
    return <section className="crm-lane" key={stage.id}>
      <header><div><i className={`lead-dot lead-${stage.id}`} /><h2>{stage.label}</h2><Badge variant="secondary">{cards.length}</Badge></div><small>{money(total)}</small></header>
      <div>{cards.map((lead) => <article className="lead-card" key={lead.id}>
        <button className="lead-main" onClick={() => onSelect(lead)}><div className="lead-source"><Badge variant="outline">{lead.source || "Origem não informada"}</Badge></div><h3>{lead.name}</h3><p>{lead.interest}</p><strong>{money(lead.estimatedValueCents)}</strong><span><Clock3 />{lead.nextAction || "Próxima ação não definida"}</span></button>
        <div className="record-actions">{next && <Button variant="ghost" size="sm" onClick={() => onMove(lead, next)}>Avançar<ChevronRight /></Button>}{onDelete && <DeleteButton label={`o lead de ${lead.name}`} onDelete={() => onDelete("leads", lead)} />}</div>
      </article>)}{!cards.length && <Empty>Sem negócios nesta etapa.</Empty>}</div>
    </section>;
  })}</div>;
}

function Quotes({ quotes, organizationName, onSelect, onStatus, onDelete }: { quotes: Quote[]; organizationName: string; onSelect: (record: Quote) => void; onStatus: (record: Quote, status: QuoteStatus) => void; onDelete?: DeleteRecord }) {
  const pending = quotes.filter((item) => item.status === "enviado").reduce((sum, item) => sum + item.totalCents, 0);
  const approved = quotes.filter((item) => item.status === "aprovado").reduce((sum, item) => sum + item.totalCents, 0);
  const download = (quote: Quote) => toast.promise(generateQuotePdf(quote, organizationName), {
    loading: "Gerando PDF…",
    success: "PDF do orçamento gerado.",
    error: "Não foi possível gerar o PDF.",
  });
  return <div className="module-stack"><div className="compact-metrics"><Metric icon={FileText} label="Orçamentos" value={String(quotes.length)} helper="na visão atual" tone="cyan" /><Metric icon={Clock3} label="Aguardando resposta" value={money(pending)} helper="propostas enviadas" tone="orange" /><Metric icon={Check} label="Aprovados" value={money(approved)} helper="prontos para execução" tone="blue" /></div><section className="surface table-surface"><div className="panel-heading"><div><small>PROPOSTAS</small><h2>Controle de orçamentos</h2></div><Badge variant="secondary">{quotes.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Número / cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Validade</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{quotes.map((quote) => <TableRow key={quote.id}><TableCell><button className="table-link" onClick={() => onSelect(quote)}><strong>{quote.quoteNumber}</strong><small>{quote.clientName}</small></button></TableCell><TableCell className="max-cell">{quote.service}</TableCell><TableCell>{shortDate(quote.validUntil)}</TableCell><TableCell><strong>{money(quote.totalCents)}</strong></TableCell><TableCell><NativeSelect value={quote.status} onChange={(event) => onStatus(quote, event.target.value as QuoteStatus)} aria-label={`Status de ${quote.quoteNumber}`}>{Object.entries(quoteLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" onClick={() => download(quote)}><FileDown />PDF</Button><Button variant="ghost" size="icon-sm" onClick={() => onSelect(quote)} aria-label="Abrir orçamento"><ChevronRight /></Button>{onDelete && <DeleteButton label={`o orçamento ${quote.quoteNumber}`} onDelete={() => onDelete("quotes", quote)} />}</div></TableCell></TableRow>)}</TableBody></Table>{!quotes.length && <Empty>Cadastre o primeiro orçamento para gerar propostas em PDF.</Empty>}</section></div>;
}

function Agenda({ appointments, employees, onSelect, onStatus, onDelete }: { appointments: Appointment[]; employees: Employee[]; onSelect: (record: Appointment) => void; onStatus: (record: Appointment, status: AppointmentStatus) => void; onDelete?: DeleteRecord }) {
  const days = Array.from(new Set(appointments.map((item) => item.startAt.slice(0, 10)))).sort();
  return <div className="agenda-layout"><section className="agenda-board">{days.map((day) => {
    const items = appointments.filter((item) => item.startAt.slice(0, 10) === day).sort((a, b) => a.startAt.localeCompare(b.startAt));
    return <div className="agenda-day" key={day}><header><div><strong>{new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" })}</strong><span>{shortDate(day)}</span></div><Badge variant="secondary">{items.length}</Badge></header><div>{items.map((item) => <article key={item.id} className={`agenda-event event-${item.kind.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}`}><button onClick={() => onSelect(item)}><time>{time(item.startAt)}</time><div><h3>{item.title}</h3><p>{item.clientName}</p><span><MapPin />{item.address}</span></div></button><footer><Badge variant="outline">{item.technician}</Badge><div className="record-actions"><NativeSelect value={item.status} onChange={(event) => onStatus(item, event.target.value as AppointmentStatus)} aria-label="Status do agendamento">{Object.entries(appointmentLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect>{onDelete && <DeleteButton label={`o agendamento ${item.title}`} onDelete={() => onDelete("appointments", item)} />}</div></footer></article>)}</div></div>;
  })}{!appointments.length && <Empty>Nenhum agendamento encontrado.</Empty>}</section><aside className="surface route-panel"><div className="panel-heading"><div><small>ROTA DE HOJE</small><h2>Equipe em campo</h2></div><MapPin /></div>{employees.filter((employee) => employee.active).map((employee) => { const todayCount = appointments.filter((item) => item.technician === employee.name && dayKey(item.startAt) === dayKey(new Date())).length; const total = appointments.filter((item) => item.technician === employee.name).length; return <div className="route-tech" key={employee.id}><span className={`avatar ${employee.color}`}>{initials(employee.name)}</span><div><strong>{employee.name}</strong><small>{todayCount} atendimento{todayCount === 1 ? "" : "s"} hoje</small></div><b>{total} total</b></div>; })}{!employees.filter((employee) => employee.active).length && <Empty>Cadastre a equipe para distribuir as rotas.</Empty>}<Separator /><div className="route-note"><Sparkles /><p><strong>Agenda integrada</strong>Visitas, serviços e garantias aparecem juntas nesta programação.</p></div></aside></div>;
}

function Orders({ orders, onSelect, onStatus, onDelete }: { orders: WorkOrder[]; onSelect: (record: WorkOrder) => void; onStatus: (record: WorkOrder, status: WorkOrderStatus) => void; onDelete?: DeleteRecord }) {
  return <section className="surface table-surface"><div className="panel-heading"><div><small>EXECUÇÃO</small><h2>Ordens de serviço</h2></div><div className="legend"><i className="open" />{orders.filter((item) => item.status !== "concluida").length} em andamento</div></div><Table><TableHeader><TableRow><TableHead>OS / cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Data e técnico</TableHead><TableHead>Leitura da água</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id}><TableCell><button className="table-link" onClick={() => onSelect(order)}><strong>{order.osNumber}</strong><small>{order.clientName}</small></button></TableCell><TableCell className="max-cell">{order.service}</TableCell><TableCell><span className="cell-stack"><strong>{shortDate(order.scheduledAt)}</strong><small>{order.technician}</small></span></TableCell><TableCell>{order.ph !== null ? <span className="water-reading"><Droplets />pH {order.ph} · Cl {order.chlorine}</span> : <span className="muted">A medir</span>}</TableCell><TableCell><strong>{money(order.amountCents)}</strong></TableCell><TableCell><NativeSelect value={order.status} onChange={(event) => onStatus(order, event.target.value as WorkOrderStatus)} aria-label={`Status de ${order.osNumber}`}>{Object.entries(orderLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="record-actions"><Button variant="ghost" size="icon-sm" onClick={() => onSelect(order)} aria-label="Abrir ordem"><ChevronRight /></Button>{onDelete && <DeleteButton label={`a ordem ${order.osNumber}`} onDelete={() => onDelete("workOrders", order)} />}</div></TableCell></TableRow>)}</TableBody></Table>{!orders.length && <Empty>Nenhuma ordem de serviço encontrada.</Empty>}</section>;
}

function Warranties({ warranties, employees, onSelect, onStatus, onSchedule, onDelete }: { warranties: Warranty[]; employees: Employee[]; onSelect: (record: Warranty) => void; onStatus: (record: Warranty, status: WarrantyStatus) => void; onSchedule: (record: Warranty, scheduledAt: string, technician: string) => Promise<void>; onDelete?: DeleteRecord }) {
  const [scheduling, setScheduling] = useState<Warranty | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now] = useState(() => Date.now());
  const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const expiring = warranties.filter((item) => { const expiry = new Date(`${item.expiresAt}T12:00:00`).getTime(); return expiry >= now && expiry <= inThirtyDays && item.status !== "concluida"; }).length;
  const scheduled = warranties.filter((item) => item.status === "agendada").length;

  async function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduling) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSubmitting(true);
    try {
      await onSchedule(scheduling, String(values.scheduledAt ?? ""), String(values.technician ?? ""));
      setScheduling(null);
      toast.success("Garantia agendada e adicionada à agenda.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar a garantia.");
    } finally {
      setSubmitting(false);
    }
  }

  return <><div className="module-stack"><div className="compact-metrics"><Metric icon={ShieldCheck} label="Garantias" value={String(warranties.length)} helper="registros cadastrados" tone="cyan" /><Metric icon={Clock3} label="Vencem em 30 dias" value={String(expiring)} helper="acompanhe os prazos" tone="orange" /><Metric icon={CalendarDays} label="Atendimentos marcados" value={String(scheduled)} helper="integrados à agenda" tone="blue" /></div><section className="surface table-surface"><div className="panel-heading"><div><small>PÓS-VENDA</small><h2>Controle de garantias</h2></div><Badge variant="secondary">{warranties.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Garantia / cliente</TableHead><TableHead>Cobertura</TableHead><TableHead>Validade</TableHead><TableHead>Agendamento</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{warranties.map((warranty) => <TableRow key={warranty.id}><TableCell><button className="table-link" onClick={() => onSelect(warranty)}><strong>{warranty.warrantyNumber}</strong><small>{warranty.clientName}</small></button></TableCell><TableCell className="max-cell">{warranty.item}</TableCell><TableCell>{shortDate(warranty.expiresAt)}</TableCell><TableCell><span className="cell-stack"><strong>{warranty.scheduledAt ? fullDate(warranty.scheduledAt) : "Não agendado"}</strong><small>{warranty.technician || "Sem responsável"}</small></span></TableCell><TableCell><NativeSelect value={warranty.status} onChange={(event) => onStatus(warranty, event.target.value as WarrantyStatus)} aria-label={`Status de ${warranty.warrantyNumber}`}>{Object.entries(warrantyLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" onClick={() => setScheduling(warranty)}><CalendarDays />Agendar</Button><Button variant="ghost" size="icon-sm" onClick={() => onSelect(warranty)} aria-label="Abrir garantia"><ChevronRight /></Button>{onDelete && <DeleteButton label={`a garantia ${warranty.warrantyNumber}`} onDelete={() => onDelete("warranties", warranty)} />}</div></TableCell></TableRow>)}</TableBody></Table>{!warranties.length && <Empty>Cadastre a primeira garantia para acompanhar cobertura e atendimento.</Empty>}</section></div><Dialog open={Boolean(scheduling)} onOpenChange={(open) => !open && setScheduling(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Agendar atendimento de garantia</DialogTitle><DialogDescription>{scheduling ? `${scheduling.warrantyNumber} · ${scheduling.clientName}` : "Defina a data e o responsável."}</DialogDescription></DialogHeader><form className="record-form" onSubmit={submitSchedule}><Field label="Data e hora *" name="scheduledAt" type="datetime-local" required className="span-2" /><Field label="Técnico" name="technician" type="select" options={[["", "Não atribuído"], ...employees.filter((employee) => employee.active).map((employee) => [employee.name, employee.name])]} className="span-2" /><DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => setScheduling(null)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Agendando…" : "Confirmar agendamento"}</Button></DialogFooter></form></DialogContent></Dialog></>;
}

function Contracts({ contracts, organizationName, onSelect, onStatus, onDelete }: { contracts: Contract[]; organizationName: string; onSelect: (record: Contract) => void; onStatus: (record: Contract, status: ContractStatus) => void; onDelete?: DeleteRecord }) {
  const [now] = useState(() => Date.now());
  const active = contracts.filter((item) => item.status === "ativo");
  const monthly = active.reduce((sum, item) => sum + item.monthlyCents, 0);
  const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const expiring = active.filter((item) => { const expiry = new Date(`${item.endDate}T12:00:00`).getTime(); return expiry >= now && expiry <= inThirtyDays; }).length;
  const download = (contract: Contract) => toast.promise(generateContractPdf(contract, organizationName), { loading: "Gerando contrato…", success: "PDF do contrato gerado.", error: "Não foi possível gerar o contrato." });
  return <div className="module-stack"><div className="compact-metrics"><Metric icon={FileSignature} label="Contratos ativos" value={String(active.length)} helper="clientes recorrentes" tone="cyan" /><Metric icon={CircleDollarSign} label="Receita mensal" value={money(monthly)} helper="contratos ativos" tone="blue" /><Metric icon={Clock3} label="Vencem em 30 dias" value={String(expiring)} helper="planeje as renovações" tone="orange" /></div><section className="surface table-surface"><div className="panel-heading"><div><small>ACORDOS COMERCIAIS</small><h2>Contratos de clientes</h2></div><Badge variant="secondary">{contracts.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Contrato / cliente</TableHead><TableHead>Objeto</TableHead><TableHead>Vigência</TableHead><TableHead>Mensalidade</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{contracts.map((contract) => <TableRow key={contract.id}><TableCell><button className="table-link" onClick={() => onSelect(contract)}><strong>{contract.contractNumber}</strong><small>{contract.clientName}</small></button></TableCell><TableCell className="max-cell">{contract.service}</TableCell><TableCell><span className="cell-stack"><strong>{shortDate(contract.startDate)} — {shortDate(contract.endDate)}</strong><small>{contract.frequency || "Frequência não informada"}</small></span></TableCell><TableCell><strong>{money(contract.monthlyCents)}</strong></TableCell><TableCell><NativeSelect value={contract.status} onChange={(event) => onStatus(contract, event.target.value as ContractStatus)} aria-label={`Status de ${contract.contractNumber}`}>{Object.entries(contractLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" onClick={() => download(contract)}><FileDown />PDF</Button><Button variant="ghost" size="icon-sm" onClick={() => onSelect(contract)} aria-label="Abrir contrato"><ChevronRight /></Button>{onDelete && <DeleteButton label={`o contrato ${contract.contractNumber}`} onDelete={() => onDelete("contracts", contract)} />}</div></TableCell></TableRow>)}</TableBody></Table>{!contracts.length && <Empty>Cadastre o primeiro contrato para gerar o documento em PDF.</Empty>}</section></div>;
}

function Customers({ customers, onSelect, onDelete }: { customers: Customer[]; onSelect: (record: Customer) => void; onDelete?: DeleteRecord }) {
  return <div className="customer-grid">{customers.map((customer) => <article className="customer-card" key={customer.id}><button className="customer-primary" onClick={() => onSelect(customer)}><div className="customer-head"><span>{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><StatusBadge value={customer.status} labels={{ ativo: "Ativo", prospect: "Prospect" }} /></div><h2>{customer.name}</h2><p><MapPin />{customer.address}</p><div className="pool-profile"><Droplets /><span><strong>{customer.poolType}</strong><small>{customer.poolVolume ? `${customer.poolVolume.toLocaleString("pt-BR")} litros` : "Volume não informado"}</small></span></div></button><footer><span><Wrench />{customer.plan}</span><div className="record-actions"><Button variant="ghost" size="icon-sm" onClick={() => onSelect(customer)} aria-label="Abrir cliente"><ChevronRight /></Button>{onDelete && <DeleteButton label={`o cliente ${customer.name}`} onDelete={() => onDelete("customers", customer)} />}</div></footer></article>)}{!customers.length && <Empty>Nenhum cliente encontrado.</Empty>}</div>;
}

function Inventory({ items, onSelect, onAdjust, onDelete }: { items: InventoryItem[]; onSelect: (record: InventoryItem) => void; onAdjust: (record: InventoryItem, quantity: number) => void; onDelete?: DeleteRecord }) {
  const value = items.reduce((sum, item) => sum + item.costCents * item.quantity, 0);
  const low = items.filter((item) => item.quantity <= item.minimumQuantity).length;
  return <div className="module-stack"><div className="compact-metrics"><Metric icon={Boxes} label="Itens cadastrados" value={String(items.length)} helper="produtos e peças" tone="cyan" /><Metric icon={AlertTriangle} label="Estoque baixo" value={String(low)} helper="exige reposição" tone="orange" /><Metric icon={CircleDollarSign} label="Valor em estoque" value={money(value)} helper="custo aproximado" tone="blue" /></div><section className="surface table-surface"><div className="panel-heading"><div><small>INVENTÁRIO</small><h2>Produtos e equipamentos</h2></div><Badge variant="secondary">Atualização rápida</Badge></div><Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead>Saldo</TableHead><TableHead>Mínimo</TableHead><TableHead>Custo unitário</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => { const warning = item.quantity <= item.minimumQuantity; return <TableRow key={item.id}><TableCell><button className="table-link" onClick={() => onSelect(item)}><strong>{item.name}</strong><small>{warning ? "Reposição necessária" : "Estoque regular"}</small></button></TableCell><TableCell>{item.sku}</TableCell><TableCell><span className={`stock-amount ${warning ? "low" : ""}`}>{item.quantity} {item.unit}</span></TableCell><TableCell>{item.minimumQuantity} {item.unit}</TableCell><TableCell>{money(item.costCents)}</TableCell><TableCell><div className="stepper"><Button variant="outline" size="icon-sm" onClick={() => onAdjust(item, Math.max(0, item.quantity - 1))} aria-label="Retirar uma unidade"><X /></Button><Button variant="outline" size="icon-sm" onClick={() => onAdjust(item, item.quantity + 1)} aria-label="Adicionar uma unidade"><Plus /></Button>{onDelete && <DeleteButton label={`o item ${item.name}`} onDelete={() => onDelete("inventory", item)} />}</div></TableCell></TableRow>; })}</TableBody></Table>{!items.length && <Empty>Nenhum item encontrado.</Empty>}</section></div>;
}

function Finance({ transactions, revenue, receivable, onSelect, onStatus, onDelete }: { transactions: Transaction[]; revenue: number; receivable: number; onSelect: (record: Transaction) => void; onStatus: (record: Transaction, status: TransactionStatus) => void; onDelete?: DeleteRecord }) {
  const expense = transactions.filter((item) => item.type === "despesa").reduce((sum, item) => sum + item.amountCents, 0);
  const projected = revenue + receivable - expense;
  const max = Math.max(...transactions.map((item) => item.amountCents), 1);
  return <div className="finance-grid"><section className="cash-card"><div><small>SALDO PROJETADO</small><h2>{money(projected)}</h2><p>Recebidos + a receber − despesas</p></div><div className="cash-split"><span><ArrowUpRight />Entradas<b>{money(revenue + receivable)}</b></span><span><ArrowDownLeft />Despesas<b>{money(expense)}</b></span></div></section><section className="surface movement-chart"><div className="panel-heading"><div><small>MOVIMENTAÇÃO</small><h2>Valores por lançamento</h2></div></div><div className="bar-chart">{transactions.slice(0, 6).reverse().map((item) => <div key={item.id}><span className={item.type} style={{ height: `${Math.max(15, item.amountCents / max * 100)}%` }} /><small>{shortDate(item.dueDate)}</small></div>)}</div></section><section className="surface table-surface finance-table"><div className="panel-heading"><div><small>LANÇAMENTOS</small><h2>Contas a pagar e receber</h2></div><Badge variant="secondary">{transactions.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{transactions.map((item) => <TableRow key={item.id}><TableCell><button className="table-link" onClick={() => onSelect(item)}><strong>{item.description}</strong></button></TableCell><TableCell>{item.category}</TableCell><TableCell>{shortDate(item.dueDate)}</TableCell><TableCell><Badge variant="outline" className={`type-${item.type}`}>{item.type === "receita" ? "Entrada" : "Saída"}</Badge></TableCell><TableCell><strong className={`money-${item.type}`}>{item.type === "despesa" ? "−" : "+"}{money(item.amountCents)}</strong></TableCell><TableCell><NativeSelect value={item.status} onChange={(event) => onStatus(item, event.target.value as TransactionStatus)} aria-label="Status financeiro">{Object.entries(transactionLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell>{onDelete && <DeleteButton label={`o lançamento ${item.description}`} onDelete={() => onDelete("transactions", item)} />}</TableCell></TableRow>)}</TableBody></Table>{!transactions.length && <Empty>Nenhum lançamento encontrado.</Empty>}</section></div>;
}

function Team({ appointments, employees, onSelect, onDelete }: { appointments: Appointment[]; employees: Employee[]; onSelect: (record: Employee) => void; onDelete?: DeleteRecord }) {
  const maintenance = appointments.filter((item) => item.kind === "Manutenção").length;
  const installations = appointments.filter((item) => item.kind === "Instalação").length;
  const visits = appointments.filter((item) => item.kind === "Visita técnica").length;
  return <div className="team-grid"><section className="surface team-roster"><div className="panel-heading"><div><small>EQUIPE TÉCNICA</small><h2>Carga de trabalho</h2></div><Badge variant="secondary">{employees.length} profissionais</Badge></div>{employees.map((employee) => { const assigned = appointments.filter((item) => item.technician === employee.name).length; const load = Math.min(100, assigned * 20); return <article key={employee.id}><button className="team-profile" onClick={() => onSelect(employee)}><span className={`avatar large ${employee.color}`}>{initials(employee.name)}</span><div><h3>{employee.name}</h3><p>{employee.role}</p><span>{assigned} serviços atribuídos</span></div></button><div className="capacity"><small>Carga atribuída</small><strong>{load}%</strong><Progress value={load} /></div>{onDelete && <DeleteButton label={`o profissional ${employee.name}`} onDelete={() => onDelete("employees", employee)} />}</article>; })}{!employees.length && <Empty>Cadastre o primeiro profissional da equipe.</Empty>}</section><section className="surface team-summary"><div className="panel-heading"><div><small>OPERAÇÃO CADASTRADA</small><h2>Distribuição</h2></div></div><div className="radial-summary"><span><b>{appointments.length}</b><small>atendimentos</small></span></div><dl><div><dt>Manutenções</dt><dd>{maintenance}</dd></div><div><dt>Instalações</dt><dd>{installations}</dd></div><div><dt>Visitas técnicas</dt><dd>{visits}</dd></div></dl><div className="team-tip"><Sparkles /><p><strong>Visão operacional</strong>A carga é calculada a partir dos agendamentos realmente atribuídos.</p></div></section></div>;
}

function CreateDialog({ entity, employees, onOpenChange, onSubmit }: { entity: CreateEntity | null; employees: Employee[]; onOpenChange: (open: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const titles: Record<CreateEntity, [string, string]> = {
    leads: ["Novo lead", "Registre o contato e a próxima ação comercial."],
    quotes: ["Novo orçamento", "Monte a proposta com materiais, mão de obra e validade."],
    appointments: ["Novo agendamento", "Organize o compromisso e o profissional responsável."],
    workOrders: ["Nova ordem de serviço", "Defina o serviço, a execução e o responsável técnico."],
    customers: ["Novo cliente e piscina", "Guarde o contato e o perfil técnico da piscina."],
    inventory: ["Novo item de estoque", "Cadastre produtos, peças ou equipamentos."],
    transactions: ["Novo lançamento", "Registre uma conta a pagar ou a receber."],
    employees: ["Novo membro da equipe", "Cadastre o profissional que receberá serviços e rotas."],
    warranties: ["Nova garantia", "Registre a cobertura e acompanhe seu prazo de validade."],
    contracts: ["Novo contrato", "Crie o acordo comercial que poderá ser emitido em PDF."],
  };
  if (!entity) return null;
  const [title, description] = titles[entity];
  const technicianOptions = [["", "Não atribuído"], ...employees.filter((employee) => employee.active).map((employee) => [employee.name, employee.name])];
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form className="record-form" onSubmit={onSubmit}>{entity === "leads" && <>
    <Field label="Nome do contato *" name="name" required /><Field label="Telefone *" name="phone" required /><Field label="Origem" name="source" placeholder="Instagram, indicação, site…" /><Field label="Interesse *" name="interest" required className="span-2" /><Field label="Valor estimado (R$)" name="estimatedValue" inputMode="decimal" /><Field label="Próxima ação" name="nextAction" /><Field label="Etapa" name="status" type="select" options={leadStages.map((item) => [item.id, item.label])} defaultValue="novo" /></>}
    {entity === "quotes" && <><Field label="Cliente *" name="clientName" required /><Field label="Serviço *" name="service" required className="span-2" /><Field label="Materiais (R$)" name="materials" inputMode="decimal" /><Field label="Mão de obra (R$)" name="labor" inputMode="decimal" /><Field label="Desconto (R$)" name="discount" inputMode="decimal" /><Field label="Validade" name="validUntil" type="date" /><Field label="Observações" name="notes" type="textarea" className="span-2" /></>}
    {entity === "appointments" && <><Field label="Compromisso *" name="title" required /><Field label="Cliente *" name="clientName" required /><Field label="Data e hora *" name="startAt" type="datetime-local" required /><Field label="Técnico" name="technician" type="select" options={technicianOptions} /><Field label="Tipo" name="kind" type="select" options={[["Manutenção", "Manutenção"], ["Visita técnica", "Visita técnica"], ["Instalação", "Instalação"], ["Diagnóstico", "Diagnóstico"], ["Garantia", "Garantia"]]} /><Field label="Endereço" name="address" /><Field label="Observações" name="notes" type="textarea" className="span-2" /></>}
    {entity === "workOrders" && <><Field label="Cliente *" name="clientName" required /><Field label="Serviço *" name="service" required className="span-2" /><Field label="Data e hora" name="scheduledAt" type="datetime-local" /><Field label="Técnico" name="technician" type="select" options={technicianOptions} /><Field label="Valor (R$)" name="amount" inputMode="decimal" /><Field label="Observações" name="notes" type="textarea" className="span-2" /></>}
    {entity === "customers" && <><Field label="Nome *" name="name" required /><Field label="Telefone *" name="phone" required /><Field label="E-mail" name="email" type="email" /><Field label="Endereço" name="address" className="span-2" /><Field label="Tipo da piscina" name="poolType" placeholder="Vinil, fibra, alvenaria…" /><Field label="Volume (litros)" name="poolVolume" inputMode="numeric" /><Field label="Plano ou contrato" name="plan" /><Field label="Observações técnicas" name="notes" type="textarea" className="span-2" /></>}
    {entity === "inventory" && <><Field label="Produto ou peça *" name="name" required /><Field label="SKU" name="sku" /><Field label="Unidade" name="unit" placeholder="unidade, balde, litro…" /><Field label="Quantidade inicial" name="quantity" inputMode="decimal" /><Field label="Estoque mínimo" name="minimumQuantity" inputMode="decimal" /><Field label="Custo unitário (R$)" name="cost" inputMode="decimal" /></>}
    {entity === "transactions" && <><Field label="Descrição *" name="description" required className="span-2" /><Field label="Tipo" name="type" type="select" options={[["receita", "Receita"], ["despesa", "Despesa"]]} /><Field label="Categoria" name="category" /><Field label="Valor (R$) *" name="amount" inputMode="decimal" required /><Field label="Vencimento" name="dueDate" type="date" /><Field label="Status" name="status" type="select" options={Object.entries(transactionLabels)} defaultValue="pendente" /></>}
    {entity === "employees" && <><Field label="Nome *" name="name" required /><Field label="Função *" name="role" required placeholder="Técnico, instalador, comercial…" /><Field label="Telefone" name="phone" /><Field label="Cor de identificação" name="color" type="select" options={[["aqua", "Turquesa"], ["blue", "Azul"], ["violet", "Violeta"], ["orange", "Laranja"]]} /></>}
    {entity === "warranties" && <><Field label="Cliente *" name="clientName" required /><Field label="Referência de origem" name="originReference" placeholder="Orçamento, OS ou nota fiscal" /><Field label="Item ou serviço coberto *" name="item" required className="span-2" /><Field label="Data da compra/entrega" name="purchaseDate" type="date" /><Field label="Validade da garantia *" name="expiresAt" type="date" required /><Field label="Condições e observações" name="notes" type="textarea" className="span-2" /></>}
    {entity === "contracts" && <><Field label="Cliente *" name="clientName" required /><Field label="CPF/CNPJ" name="clientDocument" /><Field label="Endereço do cliente" name="clientAddress" className="span-2" /><Field label="Objeto do contrato *" name="service" type="textarea" required className="span-2" /><Field label="Início *" name="startDate" type="date" required /><Field label="Término *" name="endDate" type="date" required /><Field label="Frequência" name="frequency" type="select" options={[["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"], ["trimestral", "Trimestral"], ["sob demanda", "Sob demanda"]]} defaultValue="mensal" /><Field label="Mensalidade (R$)" name="monthly" inputMode="decimal" /><Field label="Dia de pagamento" name="paymentDay" type="number" min="1" max="31" /><Field label="Cláusulas e condições" name="terms" type="textarea" className="span-2" placeholder="Descreva obrigações, materiais incluídos, reajuste e rescisão." /></>}
    <DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Salvar registro</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, name, type = "text", options, className = "", ...props }: { label: string; name: string; type?: string; options?: string[][]; className?: string; [key: string]: unknown }) {
  return <div className={`form-field ${className}`}><Label htmlFor={name}>{label}</Label>{type === "textarea" ? <Textarea id={name} name={name} {...props} /> : type === "select" ? <NativeSelect id={name} name={name} {...props}>{options?.map(([value, text]) => <NativeSelectOption value={value} key={value}>{text}</NativeSelectOption>)}</NativeSelect> : <Input id={name} name={name} type={type} {...props} />}</div>;
}

function DetailSheet({ selected, organizationName, onClose, onDelete }: { selected: Selected; organizationName: string; onClose: () => void; onDelete?: DeleteRecord }) {
  if (!selected) return null;
  const record = selected.record;
  let title = "Detalhes";
  let subtitle = "Registro operacional";
  let content: ReactNode = null;

  if (selected.entity === "leads") {
    const lead = record as Lead; title = lead.name; subtitle = lead.interest; content = <><DetailGrid items={[["Telefone", lead.phone], ["Origem", lead.source], ["Valor potencial", money(lead.estimatedValueCents)], ["Etapa", leadStages.find((item) => item.id === lead.status)?.label ?? lead.status]]} /><DetailBlock label="Próxima ação">{lead.nextAction || "Não definida"}</DetailBlock></>;
  } else if (selected.entity === "quotes") {
    const quote = record as Quote; title = quote.quoteNumber; subtitle = quote.clientName; content = <><DetailBlock label="Serviço">{quote.service}</DetailBlock><div className="quote-breakdown"><span>Materiais<b>{money(quote.materialsCents)}</b></span><span>Mão de obra<b>{money(quote.laborCents)}</b></span><span>Desconto<b>− {money(quote.discountCents)}</b></span><strong>Total<em>{money(quote.totalCents)}</em></strong></div><DetailGrid items={[["Status", quoteLabels[quote.status]], ["Validade", shortDate(quote.validUntil)]]} /><DetailBlock label="Observações">{quote.notes || "Sem observações."}</DetailBlock></>;
  } else if (selected.entity === "appointments") {
    const item = record as Appointment; title = item.title; subtitle = item.clientName; content = <><DetailGrid items={[["Data e hora", fullDate(item.startAt)], ["Técnico", item.technician], ["Tipo", item.kind], ["Status", appointmentLabels[item.status]]]} /><DetailBlock label="Endereço">{item.address || "Não informado"}</DetailBlock><DetailBlock label="Observações">{item.notes || "Sem observações."}</DetailBlock></>;
  } else if (selected.entity === "workOrders") {
    const order = record as WorkOrder; title = order.osNumber; subtitle = `${order.clientName} · ${order.service}`; content = <><DetailGrid items={[["Agendamento", fullDate(order.scheduledAt)], ["Técnico", order.technician], ["Status", orderLabels[order.status]], ["Valor", money(order.amountCents)]]} /><div className="reading-detail"><span><small>pH</small><b>{order.ph ?? "—"}</b></span><span><small>Cloro</small><b>{order.chlorine !== null ? `${order.chlorine} ppm` : "—"}</b></span><span><small>Alcalinidade</small><b>{order.alkalinity !== null ? `${order.alkalinity} ppm` : "—"}</b></span></div><DetailBlock label="Produtos utilizados">{order.productsUsed || "Ainda não registrados."}</DetailBlock><DetailBlock label="Relatório técnico">{order.notes || "Sem observações."}</DetailBlock></>;
  } else if (selected.entity === "customers") {
    const customer = record as Customer; title = customer.name; subtitle = customer.plan; content = <><DetailGrid items={[["Telefone", customer.phone], ["E-mail", customer.email || "Não informado"], ["Tipo da piscina", customer.poolType || "Não informado"], ["Volume", customer.poolVolume ? `${customer.poolVolume.toLocaleString("pt-BR")} litros` : "Não informado"]]} /><DetailBlock label="Endereço">{customer.address || "Não informado"}</DetailBlock><DetailBlock label="Observações técnicas">{customer.notes || "Sem observações."}</DetailBlock></>;
  } else if (selected.entity === "inventory") {
    const item = record as InventoryItem; title = item.name; subtitle = item.sku || "Item sem SKU"; content = <><div className={`inventory-balance ${item.quantity <= item.minimumQuantity ? "low" : ""}`}><small>SALDO ATUAL</small><strong>{item.quantity} <span>{item.unit}</span></strong><p>Mínimo recomendado: {item.minimumQuantity} {item.unit}</p></div><DetailGrid items={[["Custo unitário", money(item.costCents)], ["Valor do saldo", money(item.costCents * item.quantity)]]} /></>;
  } else if (selected.entity === "transactions") {
    const item = record as Transaction; title = item.description; subtitle = item.category; content = <><div className={`transaction-total ${item.type}`}><small>{item.type === "receita" ? "ENTRADA" : "SAÍDA"}</small><strong>{money(item.amountCents)}</strong></div><DetailGrid items={[["Vencimento", shortDate(item.dueDate)], ["Status", transactionLabels[item.status]], ["Categoria", item.category], ["Tipo", item.type === "receita" ? "Receita" : "Despesa"]]} /></>;
  } else if (selected.entity === "employees") {
    const employee = record as Employee; title = employee.name; subtitle = employee.role; content = <DetailGrid items={[["Telefone", employee.phone || "Não informado"], ["Situação", employee.active ? "Ativo" : "Inativo"], ["Cadastrado em", shortDate(employee.createdAt)]]} />;
  } else if (selected.entity === "warranties") {
    const warranty = record as Warranty; title = warranty.warrantyNumber; subtitle = warranty.clientName; content = <><DetailBlock label="Cobertura">{warranty.item}</DetailBlock><DetailGrid items={[["Status", warrantyLabels[warranty.status]], ["Origem", warranty.originReference || "Não informada"], ["Compra/entrega", shortDate(warranty.purchaseDate)], ["Validade", shortDate(warranty.expiresAt)], ["Atendimento", warranty.scheduledAt ? fullDate(warranty.scheduledAt) : "Não agendado"], ["Técnico", warranty.technician || "Não atribuído"]]} /><DetailBlock label="Condições e observações">{warranty.notes || "Sem observações."}</DetailBlock></>;
  } else if (selected.entity === "contracts") {
    const contract = record as Contract; title = contract.contractNumber; subtitle = contract.clientName; content = <><div className="transaction-total"><small>MENSALIDADE</small><strong>{money(contract.monthlyCents)}</strong></div><DetailBlock label="Objeto do contrato">{contract.service}</DetailBlock><DetailGrid items={[["CPF/CNPJ", contract.clientDocument || "Não informado"], ["Vigência", `${shortDate(contract.startDate)} — ${shortDate(contract.endDate)}`], ["Frequência", contract.frequency], ["Pagamento", contract.paymentDay ? `Dia ${contract.paymentDay}` : "Não informado"], ["Status", contractLabels[contract.status]]]} /><DetailBlock label="Endereço do cliente">{contract.clientAddress || "Não informado"}</DetailBlock><DetailBlock label="Cláusulas e condições">{contract.terms || "Sem cláusulas adicionais."}</DetailBlock><Button variant="outline" onClick={() => void generateContractPdf(contract, organizationName)}><FileDown />Gerar contrato em PDF</Button></>;
  }

  return <Sheet open onOpenChange={(open) => !open && onClose()}><SheetContent className="detail-sheet sm:max-w-xl"><SheetHeader><Badge variant="secondary">Registro</Badge><SheetTitle>{title}</SheetTitle><SheetDescription>{subtitle}</SheetDescription></SheetHeader><div className="detail-content">{content}{onDelete && <div className="detail-delete"><DeleteButton compact={false} label={title} onDelete={() => onDelete(selected.entity, selected.record)} /></div>}</div></SheetContent></Sheet>;
}

function DetailGrid({ items }: { items: string[][] }) {
  return <dl className="detail-grid">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>;
}

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return <section className="detail-block"><small>{label}</small><p>{children}</p></section>;
}
