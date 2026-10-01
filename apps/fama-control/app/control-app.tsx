"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  Activity,
  Sparkles,
  Settings2,
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Trash2,
  UsersRound,
  UserCog,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/app/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { featurePermissions, type FeaturePermission } from "@/lib/permissions";
import { defaultPoolQuoteConfig, type PoolQuoteConfig } from "@/lib/pool-quote-catalog";
import { CompanyAccountsDialog, type CompanyAccountAction } from "@/app/company-accounts-dialog";
import { AccessValidationPanel } from "@/app/access-validation-panel";
import { FamaAiPanel } from "./fama-ai-panel";
import { FamaAiSettingsPanel } from "./fama-ai-settings-panel";
import { useFamaAiSettings } from "@/hooks/use-fama-ai-settings";
import type { AssistantData, AssistantSource } from "@/lib/fama-ai";

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deleted";
  plan?: string;
  planStatus?: string;
  planExpiresAt?: string;
  billingProvider?: string;
  billingEnabled?: boolean;
  blockOnExpiry?: boolean;
  billingCycle?: string;
  billingPaymentId?: string;
  memberCount: number;
  createdAt: string;
};

type SecurityStatus = {
  checkedAt: string;
  owner: { configured: boolean; currentUser: string };
  backend: { mode: string; supabaseConfigured: boolean; storageConfigured: boolean };
  encryption: { configured: boolean; algorithm: string; note: string };
  headers: { https: boolean; hardening: string[] };
  production: { rateLimiting: boolean; audit: boolean; recovery: boolean; backups: boolean; mfa: boolean };
  tables: { name: string; rows: number | null; state: "ok" | "unavailable" }[];
};

type AuditEvent = {
  id: string | number;
  organizationId: string | null;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  recordId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

type PrivacyRequest = {
  id: string;
  organizationId: string | null;
  requesterUserId: string;
  contact: string;
  requestType: string;
  status: "open" | "in_progress" | "completed" | "rejected";
  details: string;
  resolution: string;
  createdAt: string;
  completedAt: string | null;
};

type SupportTicket = {
  id: string;
  organizationId: string;
  organizationName: string;
  userEmail: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  status: "aberto" | "em_analise" | "resolvido";
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
};

type PlanCatalogItem = {
  id: string;
  name: string;
  price: number;
  users: string;
  clients: string;
  modules: string;
};

type ControlSection = "assistant" | "ai-settings" | "overview" | "sales" | "companies" | "finance" | "plans" | "support" | "health" | "quotes" | "permissions" | "security" | "audit" | "privacy";

function date(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function planStatusLabel(status: string | undefined, provider?: string, billingEnabled = true) {
  if (!billingEnabled || provider === "courtesy") return "Isenta de mensalidade";
  if (status === "active") return "Pago";
  if (status === "pending_payment") return "Aguardando Pix";
  if (status === "payment_attention") return "Atenção";
  if (status === "expired") return "Vencido";
  if (status === "cancelled") return "Cancelado";
  return "Teste";
}

function dueSoon(value?: string) {
  if (!value) return false;
  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return false;
  return due >= Date.now() && due <= Date.now() + 7 * 24 * 60 * 60 * 1000;
}

function ticketStatusLabel(status: string) {
  if (status === "em_analise") return "Em análise";
  if (status === "resolvido") return "Resolvido";
  return "Aberto";
}

function Brand() {
  return <div className="control-brand"><span className="control-brand-mark"><img src="/fama-piscinas-mark.png" alt="" /></span><div><strong>Fama Control</strong><small>Administração privada</small></div></div>;
}

function StateBadge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <Badge className={`control-state ${ok ? "control-state-ok" : "control-state-warn"}`}>{ok ? <CheckCircle2 /> : <KeyRound />}{children}</Badge>;
}

type AccessMember = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  permissions: FeaturePermission[];
};

const permissionPresets: { label: string; permissions: FeaturePermission[] }[] = [
  { label: "Proprietário", permissions: featurePermissions.map((item) => item.id) },
  { label: "Administrador", permissions: featurePermissions.map((item) => item.id) },
  { label: "Comercial", permissions: ["dashboard", "crm", "quotes", "customers"] },
  { label: "Técnico", permissions: ["dashboard", "mobile", "agenda", "orders", "customers", "warranties"] },
  { label: "Financeiro", permissions: ["dashboard", "quotes", "contracts", "finance"] },
  { label: "Suporte", permissions: ["dashboard", "crm", "customers", "warranties"] },
];

const defaultPlanCatalog: PlanCatalogItem[] = [
  { id: "inicial", name: "Inicial", price: 4990, users: "2 usuários", clients: "200 clientes", modules: "CRM, agenda, orçamentos, suporte" },
  { id: "intermediario", name: "Intermediário", price: 9990, users: "6 usuários", clients: "1.000 clientes", modules: "Contratos, garantias, financeiro e integrações" },
  { id: "profissional", name: "Profissional", price: 14990, users: "15 usuários", clients: "Ilimitado operacional", modules: "IA, multiunidade, prioridade e automações" },
];

const permissionGroups = ["Operação", "Gestão"] as const;
const navigationMemoryKey = "fama-control:navigation";

function readNavigationMemory() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(navigationMemoryKey) ?? "null") as { current?: ControlSection; history?: ControlSection[] } | null;
  } catch {
    window.sessionStorage.removeItem(navigationMemoryKey);
    return null;
  }
}

function PoolQuoteCatalogEditor({ systemUrl }: { systemUrl: string }) {
  const [config, setConfig] = useState<PoolQuoteConfig>(defaultPoolQuoteConfig);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/quote-config").then((response) => response.json()).then((payload: { config?: PoolQuoteConfig }) => {
      if (active && payload.config) setConfig(payload.config);
    }).catch(() => toast.error("Não foi possível carregar o catálogo.")).finally(() => { if (active) setLoadingConfig(false); });
    return () => { active = false; };
  }, []);
  function changeCategory(index: number, patch: Partial<PoolQuoteConfig["catalog"][number]>) {
    setConfig((current) => ({ ...current, catalog: current.catalog.map((category, i) => i === index ? { ...category, ...patch } : category) }));
  }
  function changeItem(categoryIndex: number, itemIndex: number, patch: Partial<PoolQuoteConfig["catalog"][number]["items"][number]>) {
    setConfig((current) => ({ ...current, catalog: current.catalog.map((category, i) => i === categoryIndex ? { ...category, items: category.items.map((item, j) => j === itemIndex ? { ...item, ...patch } : item) } : category) }));
  }
  function changeField(categoryIndex: number, itemIndex: number, fieldIndex: number, patch: Partial<PoolQuoteConfig["catalog"][number]["items"][number]["fields"][number]>) {
    setConfig((current) => ({ ...current, catalog: current.catalog.map((category, i) => i === categoryIndex ? { ...category, items: category.items.map((item, j) => j === itemIndex ? { ...item, fields: item.fields.map((field, k) => k === fieldIndex ? { ...field, ...patch } : field) } : item) } : category) }));
  }
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/quote-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
      const payload = await response.json() as { error?: string; config?: PoolQuoteConfig };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.");
      if (payload.config) setConfig(payload.config);
      toast.success("Orçamento de piscinas atualizado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  const slug = (value: string) => {
    const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (normalized.startsWith("comprimento")) return "length";
    if (normalized.startsWith("largura")) return "width";
    if (normalized.startsWith("profundidade")) return "depth";
    if (normalized.startsWith("area")) return "area";
    if (normalized.startsWith("quantidade")) return "quantity";
    return normalized;
  };
  return <section id="quotes" className="control-panel control-quote-panel pool-admin-panel">
    <div className="control-panel-heading"><div><p className="control-kicker">ORÇAMENTO INTELIGENTE</p><h2>Orçamento de piscinas</h2></div><StateBadge ok={true}>{loadingConfig ? "Carregando…" : "Pronto para editar"}</StateBadge></div>
    <p className="control-muted">Edite os serviços e preços que aparecem no Fama System. As mudanças só entram em vigor quando você salvar.</p>
    {loadingConfig ? <Skeleton className="pool-admin-loading" /> : <>
      <label className="pool-admin-label"><span>Nome do configurador</span><input value={config.title} onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="pool-urgency-editor"><strong>Acréscimo por urgência</strong>{(["normal", "urgente", "emergencia"] as const).map((key) => <label key={key}><span>{key === "normal" ? "Normal" : key === "urgente" ? "Urgente" : "Emergência"}</span><div><input type="number" min="0" max="500" value={config.urgency[key]} onChange={(event) => setConfig((current) => ({ ...current, urgency: { ...current.urgency, [key]: Number(event.target.value) } }))} /><b>%</b></div></label>)}</div>
      <div className="pool-admin-section-heading"><div><strong>Catálogo</strong><small>{config.catalog.length} categorias · os clientes verão estas opções no orçamento</small></div><Button type="button" variant="outline" size="sm" onClick={() => setConfig((current) => ({ ...current, catalog: [...current.catalog, { category: "Nova categoria", items: [] }] }))}><Plus /> Categoria</Button></div>
      <div className="pool-admin-categories">{config.catalog.map((category, ci) => <details className="pool-admin-category" key={ci} open={ci === 0}><summary><span>{category.category || "Nova categoria"}</span><small>{category.items.length} serviços</small></summary>
        <div className="pool-admin-category-body"><div className="pool-admin-category-title"><label className="pool-admin-label"><span>Nome da categoria</span><input value={category.category} onChange={(event) => changeCategory(ci, { category: event.target.value })} /></label><Button type="button" variant="ghost" size="sm" aria-label="Remover categoria" onClick={() => setConfig((current) => ({ ...current, catalog: current.catalog.filter((_, i) => i !== ci) }))}><Trash2 /> Remover</Button></div>
          {category.items.map((item, ii) => <article className="pool-admin-item" key={ii}><div className="pool-admin-item-head"><strong>{item.name || "Novo serviço"}</strong><Button type="button" variant="ghost" size="sm" aria-label="Remover serviço" onClick={() => changeCategory(ci, { items: category.items.filter((_, i) => i !== ii) })}><Trash2 /> Remover</Button></div>
            <div className="pool-admin-fields"><label className="pool-admin-label"><span>Serviço ou modelo</span><input value={item.name} onChange={(event) => changeItem(ci, ii, { name: event.target.value })} /></label><label className="pool-admin-label"><span>Unidade de cobrança</span><input value={item.unit} placeholder="m², m³, unidade" onChange={(event) => changeItem(ci, ii, { unit: event.target.value })} /></label><label className="pool-admin-label"><span>Preço por unidade (R$)</span><input type="number" min="0" step="0.01" value={item.price} onChange={(event) => changeItem(ci, ii, { price: Number(event.target.value) })} /></label><label className="pool-admin-label"><span>Margem (%)</span><input type="number" min="0" step="0.1" value={item.markup} onChange={(event) => changeItem(ci, ii, { markup: Number(event.target.value) })} /></label></div>
            <div className="pool-admin-subheading"><strong>Campos pedidos no orçamento</strong><Button type="button" variant="outline" size="sm" onClick={() => changeItem(ci, ii, { fields: [...item.fields, { key: "novo_campo", label: "Novo campo", type: "text" }] })}><Plus /> Campo</Button></div>
            {item.fields.map((field, fi) => <div className="pool-admin-field-row" key={fi}><label className="pool-admin-label"><span>Rótulo</span><input value={field.label} onChange={(event) => { const label = event.target.value; changeField(ci, ii, fi, { label, key: slug(label) || field.key }); }} /></label><label className="pool-admin-label"><span>Unidade</span><input value={field.unit ?? ""} placeholder="m, m², litros…" onChange={(event) => changeField(ci, ii, fi, { unit: event.target.value })} /></label><label className="pool-admin-label"><span>Tipo</span><select value={field.type ?? "text"} onChange={(event) => changeField(ci, ii, fi, { type: event.target.value as "text" | "number" })}><option value="text">Texto</option><option value="number">Número</option></select></label><Button type="button" variant="ghost" size="icon-sm" aria-label="Remover campo" onClick={() => changeItem(ci, ii, { fields: item.fields.filter((_, i) => i !== fi) })}><Trash2 /></Button></div>)}
          </article>)}
          <Button type="button" variant="outline" size="sm" onClick={() => changeCategory(ci, { items: [...category.items, { name: "Novo serviço", unit: "m²", price: 0, markup: 0, fields: [{ key: "area", label: "Área", type: "number", unit: "m²" }] }] })}><Plus /> Adicionar serviço</Button>
        </div></details>)}</div>
      <div className="pool-admin-footer"><span>O catálogo é compartilhado com o Fama System.</span><Button type="button" onClick={() => void save()} disabled={saving || loadingConfig}>{saving ? "Salvando…" : "Salvar alterações"}</Button></div>
    </>}
    <div className="control-security-footer"><span>As propostas são criadas no Fama System.</span><div className="control-security-actions"><Button size="sm" variant="outline" asChild><a href={`${systemUrl}#quotes`} target="_blank" rel="noreferrer">Abrir orçamentos <ExternalLink /></a></Button></div></div>
  </section>;
}

export function ControlApp({ displayName, email, signOutPath, systemUrl }: { displayName: string; email: string; signOutPath: string; systemUrl: string }) {
  const [activeSection, setActiveSection] = useState<ControlSection>(() => readNavigationMemory()?.current ?? "overview");
  const [sectionHistory, setSectionHistory] = useState<ControlSection[]>(() => readNavigationMemory()?.history ?? []);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companyAccountAction, setCompanyAccountAction] = useState<CompanyAccountAction | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [plans, setPlans] = useState<PlanCatalogItem[]>(defaultPlanCatalog);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assistantDataLoaded, setAssistantDataLoaded] = useState(false);
  const ai = useFamaAiSettings();
  const [busy, setBusy] = useState(false);
  const [editingMember, setEditingMember] = useState<AccessMember | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<FeaturePermission[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingPlans, setSavingPlans] = useState(false);
  const [reEncrypting, setReEncrypting] = useState(false);
  const [validatingBackup, setValidatingBackup] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => document.getElementById(activeSection)?.scrollIntoView({ block: "start" }));
  }, [activeSection]);

  async function load() {
    setBusy(true);
    try {
      const [organizationsResponse, securityResponse, membersResponse, auditResponse, privacyResponse] = await Promise.all([
        fetch("/api/admin/organizations"),
        fetch("/api/admin/security"),
        fetch("/api/admin/members"),
        fetch("/api/admin/audit"),
        fetch("/api/admin/privacy"),
      ]);
      const plansResponse = await fetch("/api/admin/plans").catch(() => null);
      const supportResponse = await fetch("/api/admin/support").catch(() => null);
      const organizationPayload = await organizationsResponse.json() as { organizations?: Organization[]; error?: string };
      const securityPayload = await securityResponse.json() as SecurityStatus & { error?: string };
      const membersPayload = await membersResponse.json() as { members?: AccessMember[]; error?: string };
      const auditPayload = await auditResponse.json() as { audit?: AuditEvent[]; error?: string };
      const privacyPayload = await privacyResponse.json() as { requests?: PrivacyRequest[]; error?: string };
      const plansPayload = plansResponse ? await plansResponse.json().catch(() => ({})) as { plans?: PlanCatalogItem[] | null; error?: string } : {};
      const supportPayload = supportResponse ? await supportResponse.json().catch(() => ({})) as { tickets?: SupportTicket[]; error?: string } : {};
      if (!organizationsResponse.ok) throw new Error(organizationPayload.error ?? "Não foi possível carregar as empresas.");
      if (!securityResponse.ok) throw new Error(securityPayload.error ?? "Não foi possível conferir a segurança.");
      if (!membersResponse.ok) throw new Error(membersPayload.error ?? "Não foi possível carregar os acessos.");
      if (!auditResponse.ok) throw new Error(auditPayload.error ?? "Não foi possível carregar a auditoria.");
      if (!privacyResponse.ok) throw new Error(privacyPayload.error ?? "Não foi possível carregar as solicitações de privacidade.");
      setAssistantDataLoaded(true);
      setOrganizations(organizationPayload.organizations ?? []);
      setMembers(membersPayload.members ?? []);
      setSecurity(securityPayload);
      setAudit(auditPayload.audit ?? []);
      setPrivacyRequests(privacyPayload.requests ?? []);
      if (plansResponse?.ok && Array.isArray(plansPayload.plans) && plansPayload.plans.length) setPlans(plansPayload.plans);
      if (plansResponse && !plansResponse.ok) toast.warning("Planos usando valores padrão até a tabela de configurações estar conectada.");
      setTickets(supportResponse?.ok ? supportPayload.tickets ?? [] : []);
      if (supportResponse && !supportResponse.ok) toast.warning("Suporte ainda sem tabela conectada. O restante do painel foi carregado.");
    } catch (cause) {
      setAssistantDataLoaded(false);
      toast.error(cause instanceof Error ? cause.message : "Não foi possível carregar o painel.");
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);


  async function toggle(organization: Organization) {
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

  async function remove(organization: Organization) {
    if (!window.confirm(`Mover a empresa ${organization.name} para a lixeira? Os dados poderão ser restaurados pelo servidor.`)) return;
    const response = await fetch(`/api/admin/organizations/${organization.id}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível excluir a empresa.");
    setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status: "deleted" } : item));
    toast.success("Empresa movida para a lixeira.");
  }

  async function restoreOrganization(organization: Organization) {
    const response = await fetch(`/api/admin/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível restaurar a empresa.");
    setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status: "active" } : item));
    toast.success("Empresa restaurada.");
  }

  async function updatePlanStatus(organization: Organization, planStatus: string) {
    const response = await fetch(`/api/admin/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planStatus }),
    });
    const payload = await response.json() as { error?: string; planExpiresAt?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar o plano.");
    setOrganizations((current) => current.map((item) => item.id === organization.id ? {
      ...item,
      planStatus,
      planExpiresAt: payload.planExpiresAt ?? item.planExpiresAt,
    } : item));
    toast.success(planStatus === "active" ? "Plano ativado no Fama Control." : "Plano marcado para atenção.");
  }

  async function updateTicket(ticket: SupportTicket, status: SupportTicket["status"], adminNotes = ticket.adminNotes) {
    const response = await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status, adminNotes }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar o chamado.");
    setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status, adminNotes } : item));
    toast.success("Chamado atualizado no Fama Control.");
  }

  function updatePlan(index: number, patch: Partial<PlanCatalogItem>) {
    setPlans((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function savePlans() {
    setSavingPlans(true);
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });
      const payload = await response.json() as { plans?: PlanCatalogItem[]; error?: string };
      if (!response.ok || !payload.plans) throw new Error(payload.error ?? "Não foi possível salvar os planos.");
      setPlans(payload.plans);
      toast.success("Valores dos planos salvos.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar os planos.");
    } finally {
      setSavingPlans(false);
    }
  }

  async function updatePrivacyRequest(request: PrivacyRequest, status: PrivacyRequest["status"]) {
    const resolution = ["completed", "rejected"].includes(status)
      ? (window.prompt("Informe a resposta registrada para o titular (opcional):", request.resolution || "") ?? request.resolution)
      : request.resolution;
    const response = await fetch("/api/admin/privacy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: request.id, status, resolution }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return toast.error(payload.error ?? "Não foi possível atualizar a solicitação.");
    setPrivacyRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, resolution, completedAt: ["completed", "rejected"].includes(status) ? new Date().toISOString() : null } : item));
    toast.success("Solicitação de privacidade atualizada.");
  }

  function openPermissions(member: AccessMember) {
    setEditingMember(member);
    setEditingPermissions(member.permissions);
  }

  function togglePermission(permission: FeaturePermission, checked: boolean) {
    setEditingPermissions((current) => checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission));
  }

  function applyPermissionPreset(permissions: FeaturePermission[]) {
    setEditingPermissions([...permissions]);
  }

  async function savePermissions() {
    if (!editingMember) return;
    setSavingPermissions(true);
    try {
      const response = await fetch(`/api/admin/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editingPermissions }),
      });
      const payload = await response.json() as { error?: string; permissions?: FeaturePermission[]; verified?: boolean };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar os acessos.");
      if (!payload.verified || !payload.permissions) {
        throw new Error("O servidor não confirmou a gravação dos acessos.");
      }
      const permissions = payload.permissions;
      setMembers((current) => current.map((item) => item.id === editingMember.id ? { ...item, permissions } : item));
      setEditingMember(null);
      toast.success("Acessos salvos e confirmados no banco.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar os acessos.");
    } finally {
      setSavingPermissions(false);
    }
  }

  async function reEncryptRecords() {
    if (!window.confirm("Proteger os campos sensíveis que ainda estiverem em texto? Essa operação pode levar alguns instantes.")) return;
    setReEncrypting(true);
    try {
      const response = await fetch("/api/admin/security/re-encrypt", { method: "POST" });
      const payload = await response.json() as { error?: string; processed?: number; encrypted?: number };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível proteger os registros.");
      toast.success(`${payload.encrypted ?? 0} registro(s) protegido(s) de ${payload.processed ?? 0} analisado(s).`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível proteger os registros.");
    } finally {
      setReEncrypting(false);
    }
  }

  async function validateBackup() {
    setValidatingBackup(true);
    try {
      const response = await fetch("/api/admin/backup?verify=1", { cache: "no-store" });
      const payload = await response.json() as { valid?: boolean; records?: number; organizations?: number; members?: number; attachments?: number; error?: string };
      if (!response.ok || !payload.valid) throw new Error(payload.error ?? "A validação do backup não foi concluída.");
      toast.success(`Backup conferido: ${payload.organizations ?? 0} empresa(s), ${payload.records ?? 0} registro(s), ${payload.members ?? 0} usuário(s) e ${payload.attachments ?? 0} arquivo(s).`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível validar o backup.");
    } finally {
      setValidatingBackup(false);
    }
  }

  const billableOrganizations = useMemo(() => organizations.filter((item) => item.status === "active" && item.planStatus !== "cancelled" && item.billingEnabled !== false && item.billingProvider !== "courtesy"), [organizations]);
  const activePlans = useMemo(() => organizations.filter((item) => item.status === "active" && item.billingEnabled !== false && item.billingProvider !== "courtesy" && (item.planStatus === "active" || !item.planStatus)), [organizations]);
  const attentionPlans = useMemo(() => organizations.filter((item) => item.status !== "deleted" && item.billingEnabled !== false && item.billingProvider !== "courtesy" && ["payment_attention", "expired", "pending_payment"].includes(item.planStatus ?? "")), [organizations]);
  const expiringPlans = useMemo(() => organizations.filter((item) => item.status === "active" && item.billingEnabled !== false && item.billingProvider !== "courtesy" && dueSoon(item.planExpiresAt)), [organizations]);
  const monthlyProjection = useMemo(() => billableOrganizations.reduce((sum, item) => {
    const price = plans.find((plan) => plan.id === item.plan)?.price ?? plans[0]?.price ?? 0;
    return sum + price;
  }, 0), [billableOrganizations, plans]);
  const filteredCompanies = useMemo(() => organizations.filter(item => {
    const free = item.billingEnabled === false || item.billingProvider === "courtesy";
    return `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(companySearch.toLocaleLowerCase("pt-BR"))
      && (companyFilter === "all" || (companyFilter === "free" && free) || (companyFilter === "billable" && !free) || (companyFilter === "suspended" && item.status === "suspended"));
  }), [organizations, companySearch, companyFilter]);
  const trialPlans = useMemo(() => organizations.filter((item) => item.status === "active" && item.billingEnabled !== false && item.billingProvider !== "courtesy" && (!item.planStatus || item.planStatus === "trial")), [organizations]);
  const openTickets = useMemo(() => tickets.filter((item) => item.status !== "resolvido"), [tickets]);
  const criticalTickets = useMemo(() => tickets.filter((item) => ["critica", "alta"].includes(item.priority) && item.status !== "resolvido"), [tickets]);
  const salesFunnel = useMemo(() => [
    { label: "Interessados", value: organizations.length },
    { label: "Aguardando Pix", value: organizations.filter((item) => item.planStatus === "pending_payment").length },
    { label: "Conta criada", value: billableOrganizations.length },
    { label: "Treinamento", value: tickets.filter((item) => item.type === "duvida" && item.status !== "resolvido").length },
    { label: "Ativos", value: activePlans.length },
  ], [activePlans.length, billableOrganizations.length, organizations, tickets]);
  const platformAlerts = useMemo(() => [
    ...attentionPlans.slice(0, 4).map((item) => ({ title: `${item.name} precisa de cobrança`, detail: planStatusLabel(item.planStatus), tone: "warn" })),
    ...expiringPlans.slice(0, 3).map((item) => ({ title: `${item.name} vence em breve`, detail: item.planExpiresAt ? date(item.planExpiresAt) : "Sem data", tone: "warn" })),
    ...criticalTickets.slice(0, 3).map((item) => ({ title: item.title, detail: `${item.organizationName || "Empresa"} · suporte ${item.priority}`, tone: "danger" })),
    ...(!security?.encryption.configured ? [{ title: "Criptografia pendente", detail: "Configure a chave de dados sensíveis", tone: "danger" }] : []),
  ], [attentionPlans, criticalTickets, expiringPlans, security?.encryption.configured]);

  function openSection(event: MouseEvent<HTMLAnchorElement>, next: ControlSection) {
    event.preventDefault();
    navigateSection(next);
  }

  function navigateSection(next: ControlSection) {
    if (next !== activeSection) {
      const nextHistory = [...sectionHistory, activeSection];
      setSectionHistory(nextHistory);
      setActiveSection(next);
      window.sessionStorage.setItem(navigationMemoryKey, JSON.stringify({ current: next, history: nextHistory }));
    }
    document.getElementById(next)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${next}`);
  }

  function goBack() {
    const previous = sectionHistory.at(-1);
    if (!previous) return;
    const nextHistory = sectionHistory.slice(0, -1);
    setSectionHistory(nextHistory);
    setActiveSection(previous);
    window.sessionStorage.setItem(navigationMemoryKey, JSON.stringify({ current: previous, history: nextHistory }));
    document.getElementById(previous)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${previous}`);
  }

  const assistantSources: AssistantSource[] = ["overview", "companies", "users", "audit", "privacy"];
  const assistantData: AssistantData = {
    organizations,
    members: members.map(item => ({ id: item.id, display_name: item.displayName, role: item.role, status: item.status })),
    audit: audit.map(item => ({ id: String(item.id), event_type: item.eventType, occurred_at: item.occurredAt })),
    privacy: privacyRequests.map(item => ({ id: item.id, request_type: item.requestType, status: item.status })),
  };

  return <div className="control-shell">
    <aside className="control-sidebar">
      <Brand />
      <nav className="control-nav" aria-label="Administração">
        <a className={`control-nav-item ${activeSection === "assistant" ? "active" : ""}`} href="#assistant" onClick={event => openSection(event, "assistant")}><Sparkles /> Fama IA</a>
        <a className={`control-nav-item ${activeSection === "ai-settings" ? "active" : ""}`} href="#ai-settings" onClick={event => openSection(event, "ai-settings")}><Settings2 /> Configurar IA</a>
        <a className={`control-nav-item ${activeSection === "overview" ? "active" : ""}`} href="#overview" onClick={(event) => openSection(event, "overview")}><LayoutDashboard /> Visão geral</a>
        <a className={`control-nav-item ${activeSection === "sales" ? "active" : ""}`} href="#sales" onClick={(event) => openSection(event, "sales")}><TrendingUp /> Vendas</a>
        <a className={`control-nav-item ${activeSection === "companies" ? "active" : ""}`} href="#companies" onClick={(event) => openSection(event, "companies")}><Building2 /> Empresas e usuários</a>
        <a className={`control-nav-item ${activeSection === "finance" ? "active" : ""}`} href="#finance" onClick={(event) => openSection(event, "finance")}><CircleDollarSign /> Financeiro</a>
        <a className={`control-nav-item ${activeSection === "plans" ? "active" : ""}`} href="#plans" onClick={(event) => openSection(event, "plans")}><CreditCard /> Planos</a>
        <a className={`control-nav-item ${activeSection === "support" ? "active" : ""}`} href="#support" onClick={(event) => openSection(event, "support")}><MessageCircle /> Suporte</a>
        <a className={`control-nav-item ${activeSection === "health" ? "active" : ""}`} href="#health" onClick={(event) => openSection(event, "health")}><Bell /> Alertas</a>
        <a className={`control-nav-item ${activeSection === "quotes" ? "active" : ""}`} href="#quotes" onClick={(event) => openSection(event, "quotes")}><FileText /> Orçamento</a>
        <a className={`control-nav-item ${activeSection === "permissions" ? "active" : ""}`} href="#permissions" onClick={(event) => openSection(event, "permissions")}><UserCog /> Usuários</a>
        <a className={`control-nav-item ${activeSection === "security" ? "active" : ""}`} href="#security" onClick={(event) => openSection(event, "security")}><ShieldCheck /> Segurança</a>
        <a className={`control-nav-item ${activeSection === "audit" ? "active" : ""}`} href="#audit" onClick={(event) => openSection(event, "audit")}><Activity /> Auditoria</a>
        <a className={`control-nav-item ${activeSection === "privacy" ? "active" : ""}`} href="#privacy" onClick={(event) => openSection(event, "privacy")}><Database /> Privacidade</a>
      </nav>
      <div className="control-account"><span>{displayName.slice(0, 2).toLocaleUpperCase("pt-BR")}</span><div><strong>{displayName}</strong><small>{email}</small></div></div>
    </aside>
    <main className="control-main">
      <header className="control-topbar"><div className="control-heading"><Button className="back-navigation" variant="outline" size="sm" onClick={goBack} disabled={!sectionHistory.length} aria-label="Voltar para a aba anterior"><ArrowLeft /><span>Voltar</span></Button><div><p className="control-kicker">PAINEL DO PROPRIETÁRIO</p><h1>Administração da plataforma</h1></div></div><div className="control-actions"><Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}><RefreshCw className={busy ? "spin" : ""} /> Atualizar</Button><ThemeToggle /><Button variant="outline" size="icon" asChild aria-label="Sair"><a href={signOutPath} target="_top"><LogOut /></a></Button></div></header>
      {(activeSection === "assistant" || activeSection === "ai-settings") && <section id={activeSection} className="control-panel control-ai-panel space-y-4">
        {ai.value ? activeSection === "ai-settings" ? <FamaAiSettingsPanel settings={ai.value.settings} revision={ai.value.revision} updatedAt={ai.value.updatedAt} onSave={ai.save} onReload={ai.refresh} /> : assistantDataLoaded ? <>
          <FamaAiPanel key={`${email}:${ai.value.revision}`} data={assistantData} settings={ai.value.settings} scopeLabel="Administração da plataforma" allowedSources={assistantSources} allowedSections={assistantSources} onAction={action => {
            const destinations: Record<string, ControlSection> = { companies: "companies", users: "permissions", audit: "audit", privacy: "privacy" };
            const next = destinations[action.section];
            if (next && !action.create && ai.value?.settings.enabled && ai.value.settings.allowNavigation) navigateSection(next);
          }} />
          <p className="control-muted">Para consultar agenda, orçamentos, contratos e financeiro de uma empresa, selecione a empresa no Fama System.</p><Button variant="outline" asChild><a href={systemUrl}>Abrir Fama System <ExternalLink /></a></Button>
        </> : <div className="space-y-3"><p className="control-muted">{loading ? "Carregando os registros da plataforma…" : "Não foi possível carregar os registros para a assistente."}</p><Button variant="outline" disabled={busy} onClick={() => void load()}>Carregar registros</Button></div> : <div className="space-y-3"><p className="control-muted">{ai.error || "Carregando a configuração da assistente…"}</p>{ai.error && <Button variant="outline" onClick={() => void ai.refresh().catch(() => undefined)}>Tentar novamente</Button>}</div>}
      </section>}
      <section id="overview" className="control-grid">
        <article className="control-metric"><span><Building2 /></span><div><small>Empresas cadastradas</small><strong>{loading ? "—" : organizations.length}</strong><p>perfis separados</p></div></article>
        <article className="control-metric"><span><Activity /></span><div><small>Inadimplência/atenção</small><strong>{loading ? "—" : attentionPlans.length}</strong><p>cobranças para revisar</p></div></article>
        <article className="control-metric"><span><UsersRound /></span><div><small>Chamados abertos</small><strong>{loading ? "—" : openTickets.length}</strong><p>suporte e melhorias</p></div></article>
        <article className="control-metric"><span><CircleDollarSign /></span><div><small>MRR estimado</small><strong>{loading ? "—" : money(monthlyProjection)}</strong><p>{activePlans.length} plano(s) ativo(s)</p></div></article>
      </section>

      <section id="health" className="control-panel control-alert-panel"><div className="control-panel-heading"><div><p className="control-kicker">CENTRAL DE ALERTAS</p><h2>O que precisa de atenção agora</h2></div><StateBadge ok={!platformAlerts.length}>{platformAlerts.length ? `${platformAlerts.length} alerta(s)` : "Tudo em ordem"}</StateBadge></div><div className="control-alert-list">{platformAlerts.map((alert, index) => <article className={`control-alert ${alert.tone}`} key={`${alert.title}-${index}`}><Bell /><div><strong>{alert.title}</strong><p>{alert.detail}</p></div></article>)}{!platformAlerts.length && <p className="control-empty">Nenhum alerta crítico no momento.</p>}</div></section>

      <section id="sales" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">MODO REVENDA</p><h2>Funil de venda e implantação</h2></div><StateBadge ok={true}>Baixa escala organizada</StateBadge></div><p className="control-muted">Acompanhe a jornada do cliente: interesse, pagamento, criação da conta, treinamento e ativação. Use esta visão para vender sem perder controle operacional.</p><div className="control-funnel">{salesFunnel.map((stage) => <article key={stage.label}><small>{stage.label}</small><strong>{stage.value}</strong><span>{stage.label === "Aguardando Pix" ? "cobrar ou confirmar" : stage.label === "Ativos" ? "pagando" : "acompanhar"}</span></article>)}</div></section>

      <PoolQuoteCatalogEditor systemUrl={systemUrl} />

      <section id="companies" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">CONTROLE DE ACESSO</p><h2>Empresas e usuários</h2></div><Button onClick={() => setCompanyAccountAction({ mode: "create" })}><Plus /> Nova empresa</Button></div><p className="control-muted">Crie empresas gratuitas, gerencie a equipe e escolha quando habilitar a mensalidade. Os dados e as operações de cada empresa continuam separados.</p><div className="company-list-filters"><label><span>Buscar empresa</span><input type="search" placeholder="Nome da empresa…" value={companySearch} onChange={event => setCompanySearch(event.target.value)} /></label><label><span>Filtrar acesso</span><select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}><option value="all">Todas as empresas</option><option value="free">Isentas de mensalidade</option><option value="billable">Com mensalidade</option><option value="suspended">Bloqueadas</option></select></label><small>{filteredCompanies.length} empresa(s)</small></div>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Usuários</TableHead><TableHead>Acesso</TableHead><TableHead>Prazo</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{filteredCompanies.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong><small className="control-muted block">{organization.slug}</small></TableCell><TableCell>{organization.memberCount}</TableCell><TableCell>{planStatusLabel(organization.planStatus, organization.billingProvider, organization.billingEnabled)}<small className="control-cell-note">{organization.billingEnabled === false ? "Gratuita por tempo indeterminado" : organization.blockOnExpiry === false ? "Bloqueio automático desativado" : "Bloqueio por vencimento ativo"}</small></TableCell><TableCell>{organization.billingEnabled === false || (organization.billingProvider === "courtesy" && organization.planExpiresAt?.startsWith("9999-")) ? "Sem vencimento" : organization.planExpiresAt ? date(organization.planExpiresAt) : "—"}</TableCell><TableCell><Badge className={`status ${organization.status === "active" ? "status-ativo" : organization.status === "deleted" ? "status-expirada" : "status-pendente"}`}>{organization.status === "active" ? "Ativa" : organization.status === "deleted" ? "Na lixeira" : "Bloqueada"}</Badge></TableCell><TableCell><div className="control-row-actions">{organization.status === "deleted" ? <Button variant="outline" size="sm" onClick={() => void restoreOrganization(organization)}>Restaurar</Button> : <><Button variant="outline" size="sm" onClick={() => setCompanyAccountAction({ mode: "users", company: organization })}><UsersRound /> Usuários</Button><Button variant="outline" size="sm" onClick={() => setCompanyAccountAction({ mode: "access", company: organization })}>Empresa e mensalidade</Button><Button variant="outline" size="sm" onClick={() => void toggle(organization)}>{organization.status === "active" ? "Bloquear" : "Reativar"}</Button><Button variant="ghost" size="sm" onClick={() => void remove(organization)}>Lixeira</Button></>}</div></TableCell></TableRow>)}</TableBody></Table>{!filteredCompanies.length && <p className="control-empty">{organizations.length ? "Nenhuma empresa corresponde aos filtros." : "Nenhuma empresa cadastrada ainda. Use Nova empresa para liberar o primeiro acesso."}</p>}</div>}<AccessValidationPanel onComplete={() => void load()} /></section>

      <section id="finance" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">FINANCEIRO DA PLATAFORMA</p><h2>Planos, vencimentos e receita</h2></div><StateBadge ok={attentionPlans.length === 0}>{attentionPlans.length ? `${attentionPlans.length} precisa(m) de ação` : "Planos em dia"}</StateBadge></div><p className="control-muted">Esta aba acompanha o financeiro da plataforma Fama Control: planos ativos, previsão mensal, vencimentos e cobranças que precisam de atenção.</p><div className="control-grid control-finance-grid"><article className="control-metric"><span><CircleDollarSign /></span><div><small>MRR estimado</small><strong>{money(monthlyProjection)}</strong><p>receita mensal ativa</p></div></article><article className="control-metric"><span><CheckCircle2 /></span><div><small>Planos ativos</small><strong>{activePlans.length}</strong><p>acessos liberados</p></div></article><article className="control-metric"><span><Activity /></span><div><small>Atenção</small><strong>{attentionPlans.length}</strong><p>Pix, vencidos ou revisão</p></div></article><article className="control-metric"><span><KeyRound /></span><div><small>Vencem em 7 dias</small><strong>{expiringPlans.length}</strong><p>acompanhar renovação</p></div></article></div>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead><TableHead>Provedor</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{organizations.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong><small className="control-cell-note">{organization.slug}</small></TableCell><TableCell>{organization.plan || "inicial"}</TableCell><TableCell><Badge className={`status ${organization.planStatus === "active" ? "status-ativo" : organization.planStatus === "payment_attention" || organization.planStatus === "expired" ? "status-expirada" : "status-pendente"}`}>{planStatusLabel(organization.planStatus, organization.billingProvider, organization.billingEnabled)}</Badge></TableCell><TableCell>{organization.billingEnabled === false || (organization.billingProvider === "courtesy" && organization.planExpiresAt?.startsWith("9999-")) ? "Sem vencimento" : organization.planExpiresAt ? date(organization.planExpiresAt) : "Sem vencimento"}</TableCell><TableCell>{organization.billingEnabled === false || organization.billingProvider === "courtesy" ? "Gratuidade" : organization.billingProvider || "sem cobrança"}</TableCell><TableCell><div className="control-row-actions">{organization.billingEnabled === false || organization.billingProvider === "courtesy" ? <Button variant="outline" size="sm" onClick={() => setCompanyAccountAction({ mode: "access", company: organization })}>Empresa e mensalidade</Button> : <><Button variant="outline" size="sm" onClick={() => void updatePlanStatus(organization, "active")}>Ativar</Button><Button variant="ghost" size="sm" onClick={() => void updatePlanStatus(organization, "payment_attention")}>Atenção</Button></>}</div></TableCell></TableRow>)}</TableBody></Table>{!organizations.length && <p className="control-empty">Nenhuma empresa cadastrada ainda.</p>}</div>}</section>

      <section id="plans" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">GESTÃO DE PLANOS</p><h2>Valores, limites e liberação</h2></div><div className="control-row-actions"><StateBadge ok={true}>{trialPlans.length} em teste</StateBadge><Button size="sm" onClick={() => void savePlans()} disabled={savingPlans}>{savingPlans ? "Salvando…" : "Salvar planos"}</Button></div></div><p className="control-muted">Altere os valores e limites comerciais que você usa para vender. O MRR do Fama Control passa a usar estes preços salvos.</p><div className="control-plan-grid">{plans.map((plan, index) => <article className="control-plan-card control-plan-editor" key={plan.id}><header><small>{plan.id.toLocaleUpperCase("pt-BR")}</small><input value={plan.name} onChange={(event) => updatePlan(index, { name: event.target.value })} aria-label={`Nome do plano ${plan.name}`} /></header><label><span>Valor mensal</span><div><b>R$</b><input type="number" min="0" step="0.01" value={(plan.price / 100).toFixed(2)} onChange={(event) => updatePlan(index, { price: Math.round(Number(event.target.value || 0) * 100) })} /></div></label><label><span>Usuários</span><input value={plan.users} onChange={(event) => updatePlan(index, { users: event.target.value })} /></label><label><span>Clientes</span><input value={plan.clients} onChange={(event) => updatePlan(index, { clients: event.target.value })} /></label><label><span>Módulos e benefícios</span><textarea value={plan.modules} onChange={(event) => updatePlan(index, { modules: event.target.value })} /></label></article>)}</div></section>

      <section id="support" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">SUPORTE E FEEDBACK</p><h2>Erros, melhorias e pedidos dos clientes</h2></div><StateBadge ok={!criticalTickets.length}>{criticalTickets.length ? `${criticalTickets.length} prioridade alta` : "Sem crítico"}</StateBadge></div><p className="control-muted">Tudo que o cliente envia pela aba Suporte do Fama System aparece aqui para triagem, resposta interna e acompanhamento até resolver.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : <div className="control-ticket-list">{tickets.map((ticket) => <article className={`control-ticket priority-${ticket.priority}`} key={ticket.id}><header><div><strong>{ticket.title}</strong><small>{ticket.organizationName || "Empresa"} · {ticket.userEmail || "sem e-mail"} · {date(ticket.createdAt)}</small></div><Badge className={`status status-${ticket.status}`}>{ticketStatusLabel(ticket.status)}</Badge></header><p>{ticket.message}</p><footer><span>{ticket.type} · prioridade {ticket.priority}</span><div className="control-row-actions"><Button variant="outline" size="sm" onClick={() => void updateTicket(ticket, "em_analise")}>Em análise</Button><Button variant="outline" size="sm" onClick={() => void updateTicket(ticket, "resolvido")}>Resolver</Button></div></footer><textarea defaultValue={ticket.adminNotes} placeholder="Observação interna do suporte" onBlur={(event) => { if (event.currentTarget.value !== ticket.adminNotes) void updateTicket(ticket, ticket.status, event.currentTarget.value); }} /></article>)}{!tickets.length && <p className="control-empty">Nenhum chamado recebido ainda.</p>}</div>}</section>

      <section id="permissions" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">ACESSO POR MÓDULO</p><h2>Usuários e permissões</h2></div><StateBadge ok={true}>Controle individual</StateBadge></div><p className="control-muted">Escolha exatamente quais áreas cada pessoa pode abrir e operar. Somente o proprietário mantém acesso total; administradores, colaboradores e técnicos seguem a seleção abaixo.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Empresa</TableHead><TableHead>Perfil</TableHead><TableHead>Situação</TableHead><TableHead>Módulos</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.id}><TableCell><strong>{member.displayName || "Convite pendente"}</strong><small className="control-cell-note">{member.email}</small></TableCell><TableCell>{member.organizationName}</TableCell><TableCell>{member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : member.role === "technician" ? "Técnico" : "Colaborador"}</TableCell><TableCell><Badge className={`status ${member.status === "active" ? "status-ativo" : "status-pendente"}`}>{member.status === "active" ? "Ativo" : member.status === "inactive" ? "Desativado" : "Convidado"}</Badge></TableCell><TableCell>{member.role === "owner" ? "Todos" : `${member.permissions.length} de ${featurePermissions.length}`}</TableCell><TableCell><Button variant="outline" size="sm" disabled={member.role === "owner"} onClick={() => openPermissions(member)}><UserCog />Configurar</Button></TableCell></TableRow>)}</TableBody></Table>{!members.length && <p className="control-empty">Nenhum usuário convidado ainda.</p>}</div>}</section>

      <section id="security" className="control-security"><div className="control-panel-heading"><div><p className="control-kicker">DEFESA EM CAMADAS</p><h2>Segurança do Fama System</h2></div><StateBadge ok={Boolean(security?.owner.configured)}>Proprietário verificado</StateBadge></div><div className="control-security-grid"><article><KeyRound /><div><strong>Identidade do proprietário</strong><p>{security?.owner.configured ? "Conta autorizada por allowlist no servidor." : "Configure o e-mail do proprietário no ambiente."}</p></div></article><article><ShieldCheck /><div><strong>Criptografia de dados</strong><p>{security?.encryption.configured ? `${security.encryption.algorithm} ativo para dados sensíveis.` : "Aguardando a chave FAMA_DATA_ENCRYPTION_KEY no servidor."}</p></div></article><article><Database /><div><strong>Supabase e Storage</strong><p>{security?.backend.supabaseConfigured ? "Conectado por chave secreta server-side." : "Chave secreta do Supabase ainda não configurada."}</p></div></article></div><div className="control-security-grid control-production-grid"><article><ShieldCheck /><div><strong>Limite de requisições</strong><p>{security?.production.rateLimiting ? "Ativo por IP, identidade e ação." : "Tabela de limites indisponível."}</p></div></article><article><Activity /><div><strong>Auditoria</strong><p>{security?.production.audit ? "Eventos de segurança registrados." : "Registro de auditoria indisponível."}</p></div></article><article><Database /><div><strong>Recuperação e backup</strong><p>{security?.production.recovery ? "Lixeira restaurável por 30 dias." : "Snapshots indisponíveis."}</p></div></article></div><div className="control-security-footer"><span>Última conferência: {security ? date(security.checkedAt) : "—"}</span><div className="control-security-actions"><Button variant="outline" size="sm" onClick={() => void reEncryptRecords()} disabled={reEncrypting || !security?.encryption.configured}>{reEncrypting ? "Protegendo…" : "Proteger registros existentes"}</Button><Button variant="outline" size="sm" onClick={() => void validateBackup()} disabled={validatingBackup}>{validatingBackup ? "Conferindo backup…" : "Validar backup"}</Button><a href="/api/admin/backup" target="_blank" rel="noreferrer">Baixar backup global <Database /></a><a href={systemUrl} target="_blank" rel="noreferrer">Abrir Fama System <ExternalLink /></a></div></div></section>

      <section id="audit" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">RASTREABILIDADE</p><h2>Auditoria de operações</h2></div><StateBadge ok={Boolean(security?.production.audit)}>Registro protegido</StateBadge></div><p className="control-muted">Os eventos são gravados no Supabase com organização, usuário, ação e horário. Dados sensíveis não são incluídos no log.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead><TableHead>Entidade</TableHead><TableHead>Organização</TableHead><TableHead>Registro</TableHead></TableRow></TableHeader><TableBody>{audit.map((event) => <TableRow key={String(event.id)}><TableCell>{date(event.occurredAt)}</TableCell><TableCell><strong>{event.eventType}</strong></TableCell><TableCell>{event.entityType}</TableCell><TableCell>{event.organizationId || "Plataforma"}</TableCell><TableCell>{event.recordId || "—"}</TableCell></TableRow>)}</TableBody></Table>{!audit.length && <p className="control-empty">Nenhum evento de auditoria registrado.</p>}</div>}</section>

      <section id="privacy" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">LGPD</p><h2>Solicitações de privacidade</h2></div><StateBadge ok={true}>Titular no controle</StateBadge></div><p className="control-muted">Acompanhe pedidos de acesso, correção, exportação e exclusão. O contato é descriptografado apenas nesta área privada para atendimento.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Recebida</TableHead><TableHead>Contato</TableHead><TableHead>Tipo</TableHead><TableHead>Detalhes</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{privacyRequests.map((request) => <TableRow key={request.id}><TableCell>{date(request.createdAt)}</TableCell><TableCell>{request.contact || "—"}</TableCell><TableCell>{request.requestType}</TableCell><TableCell className="control-long-cell">{request.details || "—"}</TableCell><TableCell><Badge className={`status ${request.status === "completed" ? "status-ativo" : request.status === "rejected" ? "status-expirada" : "status-pendente"}`}>{request.status === "open" ? "Aberta" : request.status === "in_progress" ? "Em andamento" : request.status === "completed" ? "Concluída" : "Rejeitada"}</Badge></TableCell><TableCell><div className="control-row-actions">{request.status === "open" && <Button variant="outline" size="sm" onClick={() => void updatePrivacyRequest(request, "in_progress")}>Assumir</Button>}{request.status === "in_progress" && <><Button variant="outline" size="sm" onClick={() => void updatePrivacyRequest(request, "completed")}>Concluir</Button><Button variant="ghost" size="sm" onClick={() => void updatePrivacyRequest(request, "rejected")}>Rejeitar</Button></>}</div></TableCell></TableRow>)}</TableBody></Table>{!privacyRequests.length && <p className="control-empty">Nenhuma solicitação de privacidade pendente.</p>}</div>}</section>
    </main>
    <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}><DialogContent className="control-permissions-dialog"><DialogHeader><DialogTitle>Definir acesso por módulo</DialogTitle><DialogDescription>{editingMember ? `${editingMember.displayName || editingMember.email} · ${editingMember.organizationName}` : "Escolha as áreas permitidas."}</DialogDescription></DialogHeader><div className="control-permission-presets"><span>Começar por um modelo</span>{permissionPresets.map((preset) => <Button type="button" key={preset.label} variant="outline" size="sm" onClick={() => applyPermissionPreset(preset.permissions)}>{preset.label}</Button>)}</div><div className="control-permission-grid">{permissionGroups.map((group) => <section className="control-permission-group" key={group}><header><strong>{group}</strong><small>{group === "Operação" ? "Rotina de atendimento, vendas e execução." : "Cadastros, contratos, estoque, financeiro e equipe."}</small></header>{featurePermissions.filter((permission) => permission.group === group).map((permission) => <label className="control-permission-option" key={permission.id}><Checkbox checked={editingPermissions.includes(permission.id)} onCheckedChange={(checked) => togglePermission(permission.id, checked === true)} /><span><strong>{permission.label}</strong><small>{permission.description}</small></span></label>)}</section>)}</div><p className="control-permission-hint">Ao salvar, o Fama Control relê o registro no banco. O Fama System aplica a mudança automaticamente quando o usuário volta à janela e também bloqueia chamadas diretas no servidor.</p><DialogFooter><Button type="button" variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button><Button type="button" onClick={() => void savePermissions()} disabled={savingPermissions}>{savingPermissions ? "Salvando e conferindo…" : "Salvar acessos"}</Button></DialogFooter></DialogContent></Dialog>
    {companyAccountAction && <CompanyAccountsDialog key={`${companyAccountAction.mode}:${companyAccountAction.company?.id ?? "new"}`} action={companyAccountAction} onClose={() => setCompanyAccountAction(null)} onSaved={load} />}
    <Toaster richColors position="top-right" />
  </div>;
}
