"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  BriefcaseBusiness,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
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
  Smartphone,
  WifiOff,
  RefreshCw,
  PackagePlus,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  LockKeyhole,
  MessageCircle,
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
import { RecordAttachments } from "./record-attachments";
import { generateContractPdf } from "@/lib/contract-pdf";
import { generateQuotePdf } from "@/lib/quote-pdf";
import { generateWorkOrderPdf } from "@/lib/work-order-pdf";
import { quoteCardPayment, quoteTravelCents, quoteUrgency, quoteUrgencySurcharge } from "@/lib/quote-calculation";
import { FinanceWorkspace, type FinanceTab } from "@/app/finance-workspace";
import { defaultPoolQuoteConfig, isPoolQuoteConfig, poolQuoteConfigError, poolQuoteFieldRole, poolQuoteQuantity, type PoolQuoteFieldRole, type PoolQuoteConfig, type PoolQuoteField, type PoolQuoteItem } from "@/lib/pool-quote-catalog";
import { entityPermissions, hasFeaturePermission, type FeaturePermission } from "@/lib/permissions";
import { Manual } from "./manual";
import { PrivacyCenter } from "./privacy-center";
import { isPlanAccessBlocked } from "@/lib/billing-access";
import { BillingCenter } from "./billing-center";
import { SupportCenter } from "./support-center";
import { CompanySettingsPanel } from "./company-settings-panel";
import { defaultCompanySettings, type CompanySettings } from "@/lib/company-settings";
import { FamaAiPanel } from "./fama-ai-panel";
import { useFamaAiSettings } from "@/hooks/use-fama-ai-settings";
import { systemAssistantData, systemAssistantSources } from "@/lib/fama-ai-access";

type Section = "assistant" | "dashboard" | "crm" | "quotes" | "agenda" | "orders" | "warranties" | "customers" | "contracts" | "inventory" | "finance" | "team" | "mobile" | "manual" | "privacy" | "support" | "billing" | "settings" | "members" | "platform";
type NavigationEntry = { section: Section; subpage?: FinanceTab };
type Entity = keyof BootstrapData;
type CreateEntity = Entity;
type AnyRecord = Lead | Quote | Appointment | WorkOrder | Customer | InventoryItem | Transaction | Employee | Warranty | Contract;
type Selected = { entity: Entity; record: AnyRecord } | null;
type DeleteRecord = (entity: Entity, record: AnyRecord) => Promise<void>;
type AccessOverride = Pick<Organization, "role" | "permissions" | "plan" | "planStatus" | "planExpiresAt" | "billingEnabled" | "blockOnExpiry">;
type PoolQuoteSelection = { category: string; name: string };

const navGroups = [
  {
    label: "Operação",
    items: [
      { id: "dashboard" as Section, label: "Visão geral", icon: LayoutDashboard },
      { id: "assistant" as Section, label: "Fama IA", icon: Sparkles },
      { id: "crm" as Section, label: "CRM", icon: TrendingUp },
      { id: "quotes" as Section, label: "Orçamentos", icon: FileText },
      { id: "agenda" as Section, label: "Agenda", icon: CalendarDays },
      { id: "mobile" as Section, label: "Modo técnico", icon: Smartphone },
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
  assistant: { eyebrow: "Assistente de gestão", title: "Fama IA" },
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
  mobile: { eyebrow: "Execução em campo", title: "Modo técnico" },
  manual: { eyebrow: "Ajuda e operação", title: "Manual do Fama System" },
  privacy: { eyebrow: "Conta e conformidade", title: "Privacidade e segurança" },
  support: { eyebrow: "Atendimento e melhorias", title: "Suporte" },
  billing: { eyebrow: "Assinatura e Pix", title: "Planos e pagamentos" },
  settings: { eyebrow: "Empresa", title: "Configurações" },
  members: { eyebrow: "Conta da empresa", title: "Usuários e permissões" },
  platform: { eyebrow: "Fama Control", title: "Central de administração" },
};

function defaultSectionFor(organization: Organization): Section {
  if (hasFeaturePermission(organization.role, organization.permissions, "dashboard")) return "dashboard";
  const firstAllowed = navGroups.flatMap((group) => group.items)
    .find((item) => hasFeaturePermission(organization.role, organization.permissions, item.id as FeaturePermission));
  return firstAllowed?.id ?? "manual";
}

function canOpenSectionFor(organization: Organization, section: Section, isPlatformAdmin: boolean) {
  if (section === "assistant" || section === "manual" || section === "privacy") return true;
  if (section === "support") return true;
  if (section === "members") return organization.role === "owner" || organization.role === "admin";
  if (section === "billing") return organization.role === "owner" || organization.role === "admin";
  if (section === "settings") return organization.role === "owner" || organization.role === "admin";
  if (section === "mobile") return organization.role === "owner" || organization.role === "admin" || organization.role === "technician";
  if (section === "platform") return isPlatformAdmin;
  return hasFeaturePermission(organization.role, organization.permissions, section as FeaturePermission);
}

function pruneDataForAccess(current: BootstrapData, organization: Organization): BootstrapData {
  const allowed = (entity: Entity) => hasFeaturePermission(
    organization.role,
    organization.permissions,
    entityPermissions[entity],
  );
  return {
    leads: allowed("leads") ? current.leads : [],
    quotes: allowed("quotes") ? current.quotes : [],
    appointments: allowed("appointments") ? current.appointments : [],
    workOrders: allowed("workOrders") ? current.workOrders : [],
    customers: allowed("customers") ? current.customers : [],
    inventory: allowed("inventory") ? current.inventory : [],
    transactions: allowed("transactions") ? current.transactions : [],
    employees: allowed("employees") ? current.employees : [],
    warranties: allowed("warranties") ? current.warranties : [],
    contracts: allowed("contracts") ? current.contracts : [],
  };
}

const leadStages: Array<{ id: LeadStatus; label: string }> = [
  { id: "novo", label: "Novo lead" },
  { id: "contato", label: "Primeiro contato" },
  { id: "visita", label: "Visita marcada" },
  { id: "proposta", label: "Orçamento enviado" },
  { id: "negociacao", label: "Negociação" },
  { id: "ganho", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
];

const quoteLabels: Record<QuoteStatus, string> = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };
const appointmentLabels: Record<AppointmentStatus, string> = { agendado: "Agendado", em_rota: "Em rota", concluido: "Executado", remarcado: "Remarcado", cancelado: "Cancelado" };
const orderLabels: Record<WorkOrderStatus, string> = { aberta: "Aberta", em_execucao: "Em execução", concluida: "Concluída" };
const transactionLabels: Record<TransactionStatus, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" };
const warrantyLabels: Record<WarrantyStatus, string> = { ativa: "Ativa", agendada: "Atendimento agendado", concluida: "Concluída", expirada: "Expirada" };
const contractLabels: Record<ContractStatus, string> = { rascunho: "Rascunho", ativo: "Ativo", suspenso: "Suspenso", encerrado: "Encerrado" };

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
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

function daysFromToday(value: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const today = new Date(`${dayKey(new Date())}T12:00:00-03:00`).getTime();
  const target = parsedDate(value).getTime();
  return Math.ceil((target - today) / 86400000);
}

function isBillingBlocked(organization: Organization, now = Date.now()) {
  return isPlanAccessBlocked(organization.planStatus, organization.planExpiresAt, organization.billingEnabled, organization.blockOnExpiry, now);
}

function shareText(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function unpackNotes(value: string) {
  try {
    const parsed = JSON.parse(value) as { text?: string; details?: Record<string, string> };
    return { text: parsed.text ?? "", details: parsed.details ?? {} };
  } catch { return { text: value || "", details: {} as Record<string, string> }; }
}

function workOrderCompletion(value: string) {
  const encoded = unpackNotes(value).details.completionReport;
  if (!encoded) return null;
  try { return JSON.parse(encoded) as { summary?: string; customerName?: string; confirmedAt?: string }; }
  catch { return null; }
}

function quoteProductsSummary(value: string) {
  try {
    const items = JSON.parse(value) as { name?: string; quantity?: number; unit?: string; totalCents?: number }[];
    if (Array.isArray(items)) return items.map((item) => `${item.name ?? "Item"} · ${Number(item.quantity ?? 0).toLocaleString("pt-BR")} ${item.unit ?? ""} · ${money(Number(item.totalCents ?? 0))}`).join("  |  ");
  } catch { /* Older quotes contain plain text. */ }
  return value || "Não informado";
}

const detailLabels: Record<string, string> = {
  frequency: "Frequência", duration: "Tempo estimado", routeOrder: "Ordem da rota", products: "Produtos previstos", travel: "Deslocamento", urgency: "Urgência", paymentTerms: "Pagamento",
  calciumHardness: "Dureza cálcica", stabilizer: "Estabilizante", waterAppearance: "Aspecto da água", productCost: "Custo de produtos", laborCost: "Custo da mão de obra", travelCost: "Custo de deslocamento", checklist: "Checklist executado",
  poolShape: "Formato", filterType: "Filtro", pump: "Bomba", problemHistory: "Histórico de problemas", billingDay: "Dia de cobrança", responsible: "Responsável", clientDocument: "CPF/CNPJ",
};

function StructuredNotes({ value }: { value: string }) {
  const notes = unpackNotes(value);
  return <><DetailGrid items={Object.entries(notes.details).filter(([key]) => key !== "completionReport").map(([key, item]) => [detailLabels[key] ?? key, key === "clientDocument" ? formatTaxDocument(item) : item])} />{notes.text && <DetailBlock label="Observações">{notes.text}</DetailBlock>}</>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toLocaleUpperCase("pt-BR") || "FP";
}

function formatTaxDocument(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function documentDigits(value: string) { return value.replace(/\D/g, ""); }

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
  const [section, setSection] = useState<Section>(() => defaultSectionFor(organizations[0]));
  const [sectionHistory, setSectionHistory] = useState<NavigationEntry[]>([]);
  const [financeTab, setFinanceTab] = useState<FinanceTab>("visao");
  const [activeOrganizationId, setActiveOrganizationId] = useState(organizations[0].id);
  const [data, setData] = useState<BootstrapData>(emptyData);
  const [loadedDataScope, setLoadedDataScope] = useState<string | null>(null);
  const ai = useFamaAiSettings();
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [createEntity, setCreateEntity] = useState<CreateEntity | null>(null);
  const [financeEntryType, setFinanceEntryType] = useState<"receita" | "despesa">("receita");
  const [initialQuoteSelection, setInitialQuoteSelection] = useState<PoolQuoteSelection | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [closingOrder, setClosingOrder] = useState<WorkOrder | null>(null);
  const [accessOverrides, setAccessOverrides] = useState<Record<string, AccessOverride>>({});
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [billingClock, setBillingClock] = useState(() => Date.now());
  const stockQueue = useRef<Promise<unknown>>(Promise.resolve());

  const sourceOrganization = organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0];
  const activeOrganization = useMemo(() => (
    accessOverrides[sourceOrganization.id]
      ? { ...sourceOrganization, ...accessOverrides[sourceOrganization.id] }
      : sourceOrganization
  ), [accessOverrides, sourceOrganization]);
  const accessKey = `${activeOrganization.role}:${activeOrganization.permissions.join(",")}`;
  const dataScope = `${activeOrganization.id}:${accessKey}`;
  const assistantSources = systemAssistantSources(activeOrganization.role, activeOrganization.permissions);
  const assistantData = systemAssistantData(data, activeOrganization.role, activeOrganization.permissions);
  const canManageAccess = activeOrganization.role === "owner" || activeOrganization.role === "admin";
  const billingBlocked = isBillingBlocked(activeOrganization, billingClock);
  const canDelete = canManageAccess;
  const canAccess = (value: string) => hasFeaturePermission(activeOrganization.role, activeOrganization.permissions, value as FeaturePermission);
  const canOpenSection = (value: Section) => canOpenSectionFor(activeOrganization, value, currentUser.isPlatformAdmin);
  const navigationMemoryKey = `fama-system:navigation:${activeOrganization.id}`;
  const currentNavigationEntry = (): NavigationEntry => ({
    section,
    subpage: section === "finance" ? financeTab : undefined,
  });
  const rememberNavigation = (current: NavigationEntry, history: NavigationEntry[]) => {
    window.sessionStorage.setItem(navigationMemoryKey, JSON.stringify({ current, history }));
  };
  const navigate = (value: Section) => {
    if (billingBlocked && !["billing", "support", "privacy", "manual"].includes(value)) {
      toast.error("O teste grátis terminou. Regularize o pagamento para voltar aos módulos.");
      setSection(canManageAccess ? "billing" : "support");
      return;
    }
    if (!canOpenSection(value)) {
      toast.error("Seu perfil não possui acesso a este módulo.");
      return;
    }
    if (value === section) return;
    const nextHistory = [...sectionHistory, currentNavigationEntry()];
    setSectionHistory(nextHistory);
    setSection(value);
    rememberNavigation({ section: value, subpage: value === "finance" ? financeTab : undefined }, nextHistory);
  };
  const navigateFinanceTab = (value: FinanceTab) => {
    if (section !== "finance" || value === financeTab) return;
    const nextHistory: NavigationEntry[] = [...sectionHistory, { section: "finance", subpage: financeTab }];
    setSectionHistory(nextHistory);
    setFinanceTab(value);
    rememberNavigation({ section: "finance", subpage: value }, nextHistory);
  };
  const navigateBack = () => {
    const previous = sectionHistory.at(-1);
    if (!previous) return;
    const nextHistory = sectionHistory.slice(0, -1);
    setSectionHistory(nextHistory);
    setSection(previous.section);
    if (previous.section === "finance" && previous.subpage) {
      setFinanceTab(previous.subpage);
    }
    rememberNavigation(previous, nextHistory);
  };
  const tenantHeaders = { "x-organization-id": activeOrganization.id };

  useEffect(() => {
    const updateOnline = () => setOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  useEffect(() => {
    let disposed = false;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(navigationMemoryKey) ?? "null") as { current?: NavigationEntry; history?: NavigationEntry[] } | null;
      if (!saved?.current?.section || !canOpenSectionFor(activeOrganization, saved.current.section, currentUser.isPlatformAdmin)) return undefined;
      const validHistory = (saved.history ?? []).filter((item) => item.section && canOpenSectionFor(activeOrganization, item.section, currentUser.isPlatformAdmin));
      queueMicrotask(() => {
        if (disposed) return;
        setSection(saved.current!.section);
        if (saved.current!.section === "finance" && saved.current!.subpage) {
          setFinanceTab(saved.current!.subpage);
        }
        setSectionHistory(validHistory);
      });
    } catch {
      window.sessionStorage.removeItem(navigationMemoryKey);
    }
    return () => { disposed = true; };
  }, [activeOrganization, currentUser.isPlatformAdmin, navigationMemoryKey]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) setCompanySettings(defaultCompanySettings);
    });
    fetch("/api/company-settings", { headers: { "x-organization-id": activeOrganization.id }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { settings?: CompanySettings };
      })
      .then((payload) => {
        if (!disposed && payload?.settings) setCompanySettings(payload.settings);
      })
      .catch(() => undefined);
    return () => { disposed = true; };
  }, [activeOrganization.id]);

  useEffect(() => {
    let disposed = false;
    const refreshAccess = async () => {
      try {
        const response = await fetch("/api/access", {
          cache: "no-store",
          headers: { "x-organization-id": sourceOrganization.id },
        });
        if (response.status === 401 || response.status === 403) {
          window.location.reload();
          return;
        }
        const payload = await response.json() as {
          access?: { organizationId: string; role: Organization["role"]; permissions: string[]; plan?: string; planStatus?: string; planExpiresAt?: string; billingEnabled?: boolean; blockOnExpiry?: boolean };
        };
        if (!response.ok || !payload.access || payload.access.organizationId !== sourceOrganization.id || disposed) return;
        const nextOrganization: Organization = {
          ...sourceOrganization,
          role: payload.access.role,
          permissions: payload.access.permissions,
          plan: payload.access.plan,
          planStatus: payload.access.planStatus,
          planExpiresAt: payload.access.planExpiresAt,
          billingEnabled: payload.access.billingEnabled,
          blockOnExpiry: payload.access.blockOnExpiry,
        };
        setAccessOverrides((current) => {
          const previous = current[sourceOrganization.id] ?? sourceOrganization;
          if (previous.role === nextOrganization.role
            && previous.permissions.join(",") === nextOrganization.permissions.join(",")
            && previous.plan === nextOrganization.plan && previous.planStatus === nextOrganization.planStatus
            && previous.planExpiresAt === nextOrganization.planExpiresAt && previous.billingEnabled === nextOrganization.billingEnabled && previous.blockOnExpiry === nextOrganization.blockOnExpiry) return current;
          return {
            ...current,
            [sourceOrganization.id]: {
              role: nextOrganization.role,
              permissions: nextOrganization.permissions,
              plan: nextOrganization.plan,
              planStatus: nextOrganization.planStatus,
              planExpiresAt: nextOrganization.planExpiresAt,
              billingEnabled: nextOrganization.billingEnabled,
              blockOnExpiry: nextOrganization.blockOnExpiry,
            },
          };
        });
        setBillingClock(Date.now());
        setData((current) => pruneDataForAccess(current, nextOrganization));
        setSection((current) => canOpenSectionFor(nextOrganization, current, currentUser.isPlatformAdmin)
          ? current
          : defaultSectionFor(nextOrganization));
      } catch {
        // The next foreground refresh retries without interrupting active work.
      }
    };
    const onFocus = () => { void refreshAccess(); };
    void refreshAccess();
    const interval = window.setInterval(refreshAccess, 30_000);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [sourceOrganization, currentUser.isPlatformAdmin]);

  useEffect(() => {
    if (billingBlocked) {
      queueMicrotask(() => {
        setLoading(false);
        setData(emptyData);
        setSelected(null);
        setCreateEntity(null);
        setSection((current) => ["billing", "support", "privacy", "manual"].includes(current) ? current : canManageAccess ? "billing" : "support");
      });
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const cacheKey = `fama-system:offline:${activeOrganization.id}:${currentUser.id}:${accessKey}`;
    fetch("/api/bootstrap", { headers: { "x-organization-id": activeOrganization.id }, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        const real = (await response.json()) as Partial<BootstrapData>;
        if (disposed) return;
        const nextData = {
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
        };
        try { window.localStorage.setItem(cacheKey, JSON.stringify(nextData)); } catch { /* The live data remains available when storage is full. */ }
        setData(nextData);
        setLoadedDataScope(`${activeOrganization.id}:${accessKey}`);
      })
      .catch(() => {
        if (disposed) return;
        try {
          const cached = JSON.parse(window.localStorage.getItem(cacheKey) ?? "null") as BootstrapData | null;
          if (cached) { setData(pruneDataForAccess(cached, activeOrganization)); setLoadedDataScope(`${activeOrganization.id}:${accessKey}`); toast.info("Modo offline: exibindo a última atualização salva."); }
          else { setLoadedDataScope(null); toast.error("Não foi possível carregar os registros agora."); }
        } catch { setLoadedDataScope(null); toast.error("Não foi possível carregar os registros agora."); }
      })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); };
  }, [activeOrganization, currentUser.id, accessKey, refreshNonce, billingBlocked, canManageAccess]);

  async function refreshOfflineData() {
    if (!online) return toast.info("Conecte-se à internet para sincronizar os dados.");
    setSyncingOffline(true);
    try { setLoading(true); setRefreshNonce((value) => value + 1); window.dispatchEvent(new Event("focus")); toast.success("Sincronização solicitada. Os dados serão atualizados automaticamente."); }
    finally { setSyncingOffline(false); }
  }

  const filter = <T extends AnyRecord>(items: T[]) => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return items;
    const documentNeedle = documentDigits(needle);
    return items.filter((item) => {
      if (JSON.stringify(item).toLocaleLowerCase("pt-BR").includes(needle)) return true;
      if (section !== "customers" || documentNeedle.length < 3) return false;
      const notes = (item as unknown as Record<string, unknown>).notes;
      return typeof notes === "string" && documentDigits(unpackNotes(notes).details.clientDocument ?? "").includes(documentNeedle);
    });
  };

  const revenue = data.transactions.filter((item) => item.type === "receita" && item.status === "pago").reduce((sum, item) => sum + item.amountCents, 0);
  const receivable = data.transactions.filter((item) => item.type === "receita" && item.status !== "pago").reduce((sum, item) => sum + item.amountCents, 0);
  const payable = data.transactions.filter((item) => item.type === "despesa" && item.status !== "pago").reduce((sum, item) => sum + item.amountCents, 0);
  const salesPipeline = data.leads.filter((item) => !["ganho", "perdido"].includes(item.status)).reduce((sum, item) => sum + item.estimatedValueCents, 0);
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

  async function adjustStock(record: InventoryItem, delta: number): Promise<boolean> {
    const organizationId = activeOrganization.id;
    const operation = stockQueue.current.then(async () => {
      try {
        const response = await fetch(`/api/records/${record.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json", "x-organization-id": organizationId },
          body: JSON.stringify({ entity: "inventory", action: "adjustStock", delta }),
        });
        const payload = await response.json() as { record?: InventoryItem; error?: string };
        if (!response.ok || !payload.record) throw new Error(payload.error || "Não foi possível atualizar o estoque.");
        putRecord("inventory", payload.record, "update");
        toast.success(`${delta > 0 ? "Entrada" : "Saída"} registrada: ${record.name}`);
        return true;
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o estoque."); return false; }
    });
    stockQueue.current = operation;
    return operation;
  }

  async function convertQuote(quote: Quote) {
    try {
      const response = await fetch(`/api/quotes/${quote.id}/convert`, { method: "POST", headers: { "Content-Type": "application/json", ...tenantHeaders }, body: "{}" });
      const payload = await response.json() as { error?: string; workOrder?: WorkOrder };
      if (!response.ok || !payload.workOrder) throw new Error(payload.error ?? "Não foi possível criar a ordem de serviço.");
      if (!data.workOrders.some((item) => item.id === payload.workOrder?.id)) putRecord("workOrders", payload.workOrder, "create");
      toast.success("Ordem de serviço criada a partir do orçamento aprovado.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível criar a ordem de serviço."); }
  }

  async function completeWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closingOrder) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await fetch(`/api/records/${closingOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...tenantHeaders },
      body: JSON.stringify({ entity: "workOrders", action: "complete", completionReport: { summary: values.summary, customerName: values.customerName, confirmed: values.confirmed === "on" } }),
    });
    const payload = await response.json() as { error?: string; record?: WorkOrder };
    if (!response.ok || !payload.record) return toast.error(payload.error ?? "Não foi possível concluir a ordem.");
    putRecord("workOrders", payload.record, "update");
    setClosingOrder(null);
    toast.success("Ordem concluída e relatório técnico registrado.");
  }

  async function rescheduleAppointment(record: Appointment, suggested?: string) {
    const current = record.startAt.slice(0, 16);
    const next = suggested ?? window.prompt("Nova data e hora (AAAA-MM-DDTHH:MM)", current);
    if (!next || next === current) return;
    await patchRecord("appointments", record, { action: "reschedule", startAt: next });
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createEntity) return;
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (createEntity === "quotes") {
      try {
        const items = JSON.parse(String(body.poolItems ?? "[]")) as unknown[];
        if (!items.length) return toast.error("Adicione pelo menos um item ao orçamento.");
      } catch { return toast.error("Confira os itens adicionados ao orçamento."); }
    }
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

  const title = sectionMeta[section];

  return <SidebarProvider>
    <Sidebar collapsible="icon" className="main-sidebar">
      <SidebarHeader className="sidebar-brand"><BrandMark /><div><strong>Fama System</strong><small>Gestão para piscinas</small></div></SidebarHeader>
      <SidebarContent>
        {[...navGroups, { label: "Conta", items: [
          ...(canManageAccess ? [{ id: "billing" as Section, label: "Planos e pagamentos", icon: BadgeDollarSign }] : []),
          ...(canManageAccess ? [{ id: "settings" as Section, label: "Configurações da empresa", icon: Settings2 }] : []),
          ...(canManageAccess ? [{ id: "members" as Section, label: "Usuários e empresas", icon: UsersRound }] : []),
          { id: "support" as Section, label: "Suporte", icon: MessageCircle },
          { id: "privacy" as Section, label: "Privacidade e segurança", icon: LockKeyhole },
          { id: "manual" as Section, label: "Manual de uso", icon: BookOpenCheck },
        ] }].map((group) => ({ ...group, items: group.items.filter((item) => item.id === "assistant" || item.id === "members" || item.id === "billing" || item.id === "settings" || item.id === "platform" || item.id === "support" || item.id === "manual" || item.id === "privacy" || item.id === "mobile" || canAccess(item.id)) })).filter((group) => group.items.length).map((group) => <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{group.items.map((item) => <SidebarMenuItem key={item.id}>
          <SidebarMenuButton isActive={section === item.id} tooltip={item.label} onClick={() => navigate(item.id)}><item.icon /><span>{item.label}</span></SidebarMenuButton>
          </SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>
      <SidebarFooter className="sidebar-account"><span>{initials(activeOrganization.name)}</span><div><strong>{activeOrganization.name}</strong><small>{activeOrganization.role === "owner" ? "Proprietário" : activeOrganization.role === "admin" ? "Administrador" : activeOrganization.role === "technician" ? "Técnico" : "Colaborador"}</small></div></SidebarFooter>
    </Sidebar>

    <SidebarInset className="application">
      <header className="topbar">
        <div className="heading"><SidebarTrigger><Menu /></SidebarTrigger><Button className="back-navigation" variant="outline" size="sm" onClick={navigateBack} disabled={!sectionHistory.length} aria-label="Voltar para a aba anterior"><ArrowLeft /><span>Voltar</span></Button><div><small>{title.eyebrow}</small><h1>{title.title}</h1></div></div>
        <div className="top-actions"><NativeSelect className="company-switcher" value={activeOrganization.id} onChange={(event) => { const nextOrganization = organizations.find((organization) => organization.id === event.target.value) ?? activeOrganization; setLoading(true); setData(emptyData); setLoadedDataScope(null); setSelected(null); setCreateEntity(null); setActiveOrganizationId(event.target.value); const defaultSection = isBillingBlocked(nextOrganization) ? (nextOrganization.role === "owner" || nextOrganization.role === "admin" ? "billing" : "support") : defaultSectionFor(nextOrganization); setSectionHistory([]); setSection(defaultSection); }} aria-label="Empresa ativa">{organizations.map((organization) => <NativeSelectOption key={organization.id} value={organization.id}>{organization.name}</NativeSelectOption>)}</NativeSelect>{section !== "customers" && !billingBlocked && <div className="global-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar neste módulo" aria-label="Buscar neste módulo" /></div>}<ThemeToggle /><Button variant="outline" size="icon" asChild aria-label="Sair"><a href={signOutPath} target="_top"><LogOut /></a></Button>{title.entity && !billingBlocked && <Button onClick={() => setCreateEntity(title.entity!)}><Plus />{title.action}</Button>}</div>
      </header>

      <main className="workspace">
        {loading ? <div className="loading"><i /><p>Preparando sua operação…</p></div> : <>
          {billingBlocked && section !== "billing" && section !== "support" && section !== "privacy" && section !== "manual" && <BillingBlocked canManageAccess={canManageAccess} onBilling={() => navigate("billing")} />}
          {!billingBlocked && section === "assistant" && <>
            {loadedDataScope !== dataScope ? <div className="empty-state"><p>A assistente precisa dos registros da empresa selecionada.</p><Button variant="outline" onClick={() => setRefreshNonce(value => value + 1)}>Carregar registros</Button></div> : ai.value ?
              <FamaAiPanel key={`${dataScope}:${ai.value.revision}`} data={assistantData} settings={ai.value.settings} scopeLabel={activeOrganization.name} allowedSources={assistantSources} allowedSections={assistantSources} onAction={action => {
                if (!Object.hasOwn(sectionMeta, action.section) || !canOpenSection(action.section as Section)) return toast.error("Seu perfil não possui acesso a este módulo.");
                if (billingBlocked || !ai.value?.settings.enabled) return;
                if (action.create) {
                  if (!ai.value.settings.allowCreate || !canAccess(entityPermissions[action.create])) return;
                  if (action.create === "quotes") setInitialQuoteSelection(null);
                  if (action.create === "transactions") setFinanceEntryType("receita");
                  setCreateEntity(action.create);
                } else if (ai.value.settings.allowNavigation) navigate(action.section as Section);
              }} /> : <div className="empty-state"><p>{ai.error || "Carregando a configuração da assistente…"}</p>{ai.error && <Button variant="outline" onClick={() => void ai.refresh().catch(() => undefined)}>Tentar novamente</Button>}</div>}
          </>}
          {!billingBlocked && section === "dashboard" && canOpenSection("dashboard") && <Dashboard data={data} settings={companySettings} revenue={revenue} receivable={receivable} payable={payable} salesPipeline={salesPipeline} onSelect={setSelected} onNavigate={navigate} />}
          {!billingBlocked && section === "crm" && canOpenSection("crm") && <Crm leads={filter(data.leads)} onSelect={(record) => setSelected({ entity: "leads", record })} onMove={(record, status) => patchRecord("leads", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "quotes" && canOpenSection("quotes") && <Quotes key={activeOrganization.id} organizationId={activeOrganization.id} quotes={filter(data.quotes)} organizationName={activeOrganization.name} canManageCatalog={canManageAccess} onCreateProject={(selection) => { setInitialQuoteSelection(selection); setCreateEntity("quotes"); }} onCreate={() => { setInitialQuoteSelection(null); setCreateEntity("quotes"); }} onSelect={(record) => setSelected({ entity: "quotes", record })} onStatus={(record, status) => patchRecord("quotes", record, { status })} onConvert={convertQuote} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "agenda" && canOpenSection("agenda") && <Agenda organizationId={activeOrganization.id} appointments={filter(data.appointments)} employees={data.employees} onSelect={(record) => setSelected({ entity: "appointments", record })} onStatus={(record, status) => patchRecord("appointments", record, { status })} onReschedule={rescheduleAppointment} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "orders" && canOpenSection("orders") && <Orders orders={filter(data.workOrders)} onSelect={(record) => setSelected({ entity: "workOrders", record })} onStatus={(record, status) => status === "concluida" ? setClosingOrder(record) : void patchRecord("workOrders", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "warranties" && canOpenSection("warranties") && <Warranties warranties={filter(data.warranties)} employees={data.employees} onSelect={(record) => setSelected({ entity: "warranties", record })} onStatus={(record, status) => patchRecord("warranties", record, { status })} onSchedule={scheduleWarranty} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "customers" && canOpenSection("customers") && <Customers customers={data.customers} query={query} onQueryChange={setQuery} onSelect={(record) => setSelected({ entity: "customers", record })} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "contracts" && canOpenSection("contracts") && <Contracts contracts={filter(data.contracts)} organizationName={activeOrganization.name} onSelect={(record) => setSelected({ entity: "contracts", record })} onStatus={(record, status) => patchRecord("contracts", record, { status })} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "inventory" && canOpenSection("inventory") && <Inventory items={filter(data.inventory)} lowStockAlert={companySettings.lowStockAlert} onSelect={(record) => setSelected({ entity: "inventory", record })} onAdjust={adjustStock} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "finance" && canOpenSection("finance") && <FinanceWorkspace onAssistant={() => navigate("assistant")} organizationId={activeOrganization.id} transactions={filter(data.transactions)} quotes={filter(data.quotes)} tab={financeTab} onTabChange={navigateFinanceTab} onStatus={(record, status) => patchRecord("transactions", record, { status })} onOpenEntry={(type) => { setFinanceEntryType(type); setCreateEntity("transactions"); }} onReconciled={(transactionId, created) => setData((current) => ({ ...current, transactions: current.transactions.some((item) => item.id === transactionId) ? current.transactions.map((item) => item.id === transactionId ? { ...item, status: "pago" } : item) : created ? [created, ...current.transactions] : current.transactions }))} onPurchasePayable={(record) => setData((current) => ({ ...current, transactions: [record, ...current.transactions] }))} />}
          {!billingBlocked && section === "team" && canOpenSection("team") && <Team appointments={data.appointments} employees={filter(data.employees)} onSelect={(record) => setSelected({ entity: "employees", record })} onDelete={canDelete ? deleteRecord : undefined} />}
          {!billingBlocked && section === "mobile" && canOpenSection("mobile") && <TechnicianMobile appointments={data.appointments} orders={data.workOrders} onAppointmentStatus={(record, status) => patchRecord("appointments", record, { status })} onOrderStatus={(record, status) => status === "concluida" ? setClosingOrder(record) : void patchRecord("workOrders", record, { status })} />}
          {section === "manual" && <Manual />}
          {section === "privacy" && <PrivacyCenter organization={activeOrganization} />}
          {section === "support" && <SupportCenter organization={activeOrganization} />}
          {section === "billing" && canManageAccess && <BillingCenter organization={activeOrganization} currentUser={currentUser} />}
          {section === "settings" && canManageAccess && <CompanySettingsPanel organization={activeOrganization} />}
          {!billingBlocked && section === "members" && canManageAccess && <MembersPanel organization={activeOrganization} />}
          {!billingBlocked && section === "platform" && currentUser.isPlatformAdmin && <PlatformCompanies />}
        </>}
        {!online && <div className="offline-banner"><WifiOff /><span>Sem conexão. O sistema está mostrando a última atualização salva.</span><Button size="sm" variant="outline" onClick={() => void refreshOfflineData()} disabled={syncingOffline}><RefreshCw />Tentar sincronizar</Button></div>}
      </main>
      <footer className="app-footer">
        <span>Fama System · v15.0</span>
        <a href="/manual" target="_blank" rel="noreferrer">Manual completo</a>
      </footer>
    </SidebarInset>

    <CreateDialog organizationId={activeOrganization.id} key={`${activeOrganization.id}:${createEntity ?? "none"}:${financeEntryType}`} entity={createEntity} employees={data.employees} customers={data.customers} settings={companySettings} initialQuoteSelection={initialQuoteSelection} initialTransactionType={financeEntryType} onExistingCustomer={(customer) => { setCreateEntity(null); setSelected({ entity: "customers", record: customer }); }} onOpenChange={(open) => { if (!open) { setCreateEntity(null); setInitialQuoteSelection(null); } }} onSubmit={createRecord} />
    <CloseWorkOrderDialog order={closingOrder} onClose={() => setClosingOrder(null)} onSubmit={completeWorkOrder} />
    <DetailSheet selected={selected} organizationId={activeOrganization.id} organizationName={activeOrganization.name} onClose={() => setSelected(null)} onDelete={canDelete ? deleteRecord : undefined} />
    <Toaster richColors position="top-right" />
  </SidebarProvider>;
}

function BillingBlocked({ canManageAccess, onBilling }: { canManageAccess: boolean; onBilling: () => void }) {
  return <section className="surface billing-blocked">
    <BadgeDollarSign />
    <div>
      <small>ACESSO BLOQUEADO</small>
      <h2>O teste grátis terminou</h2>
      <p>{canManageAccess ? "Gere o Pix do plano para liberar novamente todos os módulos do Fama System." : "Peça ao proprietário ou administrador da empresa para regularizar o pagamento."}</p>
    </div>
    {canManageAccess && <Button type="button" onClick={onBilling}><QrCode />Ir para pagamento</Button>}
  </section>;
}

function Dashboard({ data, settings, revenue, receivable, payable, salesPipeline, onSelect, onNavigate }: {
  data: BootstrapData;
  settings: CompanySettings;
  revenue: number;
  receivable: number;
  payable: number;
  salesPipeline: number;
  onSelect: (value: Selected) => void;
  onNavigate: (section: Section) => void;
}) {
  const today = data.appointments.filter((item) => new Date(item.startAt).toDateString() === new Date().toDateString());
  const latestWater = data.workOrders.find((item) => item.ph !== null);
  const openOrders = data.workOrders.filter((item) => item.status !== "concluida").length;
  const approvedQuotes = data.quotes.filter((item) => item.status === "aprovado").length;
  const staleLeads = data.leads.filter((item) => !["ganho", "perdido"].includes(item.status) && daysFromToday(item.createdAt) <= -3);
  const expiringQuotes = data.quotes.filter((item) => ["rascunho", "enviado"].includes(item.status) && daysFromToday(item.validUntil) <= 3);
  const urgentWarranties = data.warranties.filter((item) => item.status !== "concluida" && (daysFromToday(item.expiresAt) <= 30 || !item.scheduledAt));
  const overdueTransactions = data.transactions.filter((item) => item.status === "atrasado");
  const lowInventory = data.inventory.filter((item) => item.quantity <= Math.max(item.minimumQuantity, settings.lowStockAlert));
  const priorityScore = overdueTransactions.length * 3 + staleLeads.length + expiringQuotes.length * 2 + urgentWarranties.length * 2 + lowInventory.length;
  const dailySummary = [
    today.length ? `${today.length} visita${today.length === 1 ? "" : "s"} hoje` : "Agenda livre hoje",
    overdueTransactions.length ? `${overdueTransactions.length} cobrança${overdueTransactions.length === 1 ? "" : "s"} vencida${overdueTransactions.length === 1 ? "" : "s"}` : "Sem cobrança vencida",
    staleLeads.length ? `${staleLeads.length} lead${staleLeads.length === 1 ? "" : "s"} parado${staleLeads.length === 1 ? "" : "s"}` : "CRM sem lead parado",
    urgentWarranties.length ? `${urgentWarranties.length} garantia${urgentWarranties.length === 1 ? "" : "s"} em atenção` : "Garantias sob controle",
  ];
  const topPriority = overdueTransactions[0]
    ? `Cobrar ${overdueTransactions[0].description} (${money(overdueTransactions[0].amountCents)})`
    : expiringQuotes[0]
      ? `Retomar orçamento ${expiringQuotes[0].quoteNumber}`
      : staleLeads[0]
        ? `Fazer follow-up com ${staleLeads[0].name}`
        : urgentWarranties[0]
          ? `Agendar garantia de ${urgentWarranties[0].clientName}`
          : "Operação sem urgências críticas";
  const shareDailySummary = () => shareText(`Resumo Fama System de hoje:\n\n${dailySummary.map((item) => `• ${item}`).join("\n")}\n\nPrioridade recomendada: ${topPriority}`);

  return <div className="dashboard-grid">
    <section className={`surface ai-daily-brief ${priorityScore >= 5 ? "danger" : priorityScore > 0 ? "warning" : "ok"}`}>
      <div className="panel-heading"><div><small>IA OPERACIONAL</small><h2>Resumo diário</h2></div><Sparkles /></div>
      <p>{dailySummary.join(" · ")}.</p>
      <div className="daily-priority"><span><AlertTriangle /></span><div><small>Prioridade de hoje</small><strong>{topPriority}</strong></div></div>
      <div className="daily-actions"><Button size="sm" onClick={shareDailySummary}><MessageCircle />Enviar resumo</Button><Button size="sm" variant="outline" onClick={() => onNavigate(overdueTransactions.length ? "finance" : staleLeads.length ? "crm" : today.length ? "agenda" : "dashboard")}>Resolver agora<ArrowRight /></Button></div>
    </section>
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
      <Metric icon={ArrowDownLeft} label="A pagar" value={money(payable)} helper="despesas em aberto" tone="orange" />
      <Metric icon={TrendingUp} label="Resultado previsto" value={money(revenue + receivable - payable)} helper={`${approvedQuotes} orçamento aprovado · pipeline ${money(salesPipeline)}`} tone="violet" />
    </section>

    <section className="surface quick-panel">
      <div className="panel-heading"><div><small>PRÓXIMOS PASSOS</small><h2>Atenção necessária</h2></div><Button variant="ghost" size="sm" onClick={() => onNavigate("finance")}>Ver financeiro<ArrowUpRight /></Button></div>
      <div className="attention-list">
        {overdueTransactions.map((item) => <button key={item.id} onClick={() => onSelect({ entity: "transactions", record: item })}><span className="attention-icon danger"><ArrowDownLeft /></span><div><strong>Cobrança em atraso</strong><small>{item.description}</small></div><b>{money(item.amountCents)}</b><ChevronRight /></button>)}
        {staleLeads.slice(0, 3).map((item) => <button key={item.id} onClick={() => onSelect({ entity: "leads", record: item })}><span className="attention-icon warning"><Clock3 /></span><div><strong>Lead parado há 3+ dias</strong><small>{item.name} · {item.nextAction || "defina a próxima ação"}</small></div><b>{money(item.estimatedValueCents)}</b><ChevronRight /></button>)}
        {expiringQuotes.slice(0, 3).map((item) => <button key={item.id} onClick={() => onSelect({ entity: "quotes", record: item })}><span className="attention-icon warning"><FileText /></span><div><strong>Orçamento vencendo</strong><small>{item.quoteNumber} · validade {shortDate(item.validUntil)}</small></div><b>{money(item.totalCents)}</b><ChevronRight /></button>)}
        {urgentWarranties.slice(0, 3).map((item) => <button key={item.id} onClick={() => onSelect({ entity: "warranties", record: item })}><span className="attention-icon warning"><ShieldCheck /></span><div><strong>Garantia exige atenção</strong><small>{item.clientName} · {item.scheduledAt ? `vence ${shortDate(item.expiresAt)}` : "sem atendimento agendado"}</small></div><b>{warrantyLabels[item.status]}</b><ChevronRight /></button>)}
        {lowInventory.slice(0, 3).map((item) => <button key={item.id} onClick={() => onSelect({ entity: "inventory", record: item })}><span className="attention-icon warning"><PackagePlus /></span><div><strong>Repor estoque</strong><small>{item.name}</small></div><b>{item.quantity} {item.unit}</b><ChevronRight /></button>)}
        {!overdueTransactions.length && !staleLeads.length && !expiringQuotes.length && !urgentWarranties.length && !lowInventory.length && <Empty>Nenhuma pendência crítica agora.</Empty>}
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
        <button className="lead-main" onClick={() => onSelect(lead)}><div className="lead-source"><Badge variant="outline">{lead.source || "Origem não informada"}</Badge>{!["ganho", "perdido"].includes(lead.status) && daysFromToday(lead.createdAt) <= -3 && <Badge variant="destructive">Parado</Badge>}</div><h3>{lead.name}</h3><p>{lead.interest}</p><strong>{money(lead.estimatedValueCents)}</strong><span><Clock3 />{lead.nextAction || "Próxima ação não definida"}</span></button>
        <div className="record-actions">{next && <Button variant="ghost" size="sm" onClick={() => onMove(lead, next)}>Avançar<ChevronRight /></Button>}{onDelete && <DeleteButton label={`o lead de ${lead.name}`} onDelete={() => onDelete("leads", lead)} />}</div>
      </article>)}{!cards.length && <Empty>Sem negócios nesta etapa.</Empty>}</div>
    </section>;
  })}</div>;
}

function Quotes({ organizationId, quotes, organizationName, canManageCatalog, onCreateProject, onCreate, onSelect, onStatus, onConvert, onDelete }: { organizationId: string; quotes: Quote[]; organizationName: string; canManageCatalog: boolean; onCreateProject: (selection: PoolQuoteSelection) => void; onCreate: () => void; onSelect: (record: Quote) => void; onStatus: (record: Quote, status: QuoteStatus) => void; onConvert: (record: Quote) => void; onDelete?: DeleteRecord }) {
  const [view, setView] = useState<"projects" | "saved">("projects");
  const [catalog, setCatalog] = useState<PoolQuoteConfig>(defaultPoolQuoteConfig);
  const [activeCategory, setActiveCategory] = useState(defaultPoolQuoteConfig.catalog[0]?.category ?? "");
  const [search, setSearch] = useState("");
  const [catalogEditorOpen, setCatalogEditorOpen] = useState(false);
  const [catalogForm, setCatalogForm] = useState<PoolQuoteConfig>(catalog);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogReload, setCatalogReload] = useState(0);
  useEffect(() => {
    let disposed = false;
    fetch("/api/quote-config", { headers: { "x-organization-id": organizationId }, cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as { config?: PoolQuoteConfig; error?: string };
        if (!response.ok || !isPoolQuoteConfig(payload.config)) throw new Error(payload.error || "Não foi possível carregar o catálogo.");
        if (!disposed) { setCatalog(payload.config); setActiveCategory(payload.config.catalog[0]?.category ?? ""); setCatalogError(""); }
      })
      .catch(error => { if (!disposed) setCatalogError(error instanceof Error ? error.message : "Não foi possível carregar o catálogo."); })
      .finally(() => { if (!disposed) setCatalogLoading(false); });
    return () => { disposed = true; };
  }, [organizationId, catalogReload]);
  const category = catalog.catalog.find((item) => item.category === activeCategory) ?? catalog.catalog[0];
  const projects = (category?.items ?? []).filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  function openCatalogEditor() {
    setCatalogForm(structuredClone(catalog));
    setCatalogEditorOpen(true);
  }
  function syncCatalogForm(updater: (current: PoolQuoteConfig) => PoolQuoteConfig) {
    setCatalogForm((current) => {
      const next = updater(current);
      return next;
    });
  }
  function updateCategory(categoryIndex: number, value: string) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, index) => index === categoryIndex ? { ...group, category: value } : group) }));
  }
  function updateItem(categoryIndex: number, itemIndex: number, patch: Partial<PoolQuoteItem>) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, ...patch } : item) } : group) }));
  }
  function updateField(categoryIndex: number, itemIndex: number, fieldIndex: number, patch: Partial<PoolQuoteField>) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, fields: item.fields.map((field, nextFieldIndex) => nextFieldIndex === fieldIndex ? { ...field, ...patch } : field) } : item) } : group) }));
  }
  function addCategory() {
    syncCatalogForm((current) => ({ ...current, catalog: [...current.catalog, { category: "Nova categoria", items: [{ name: "Novo item", unit: "unidade", price: 0, markup: 20, fields: [{ key: "medida", label: "Medida", type: "number", unit: "" }] }] }]}));
  }
  function removeCategory(categoryIndex: number) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.filter((_, index) => index !== categoryIndex) }));
  }
  function addItem(categoryIndex: number) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, index) => index === categoryIndex ? { ...group, items: [...group.items, { name: "Novo item", unit: "unidade", price: 0, markup: 20, fields: [{ key: "medida", label: "Medida", type: "number", unit: "" }] }] } : group) }));
  }
  function removeItem(categoryIndex: number, itemIndex: number) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, index) => index === categoryIndex ? { ...group, items: group.items.filter((_, nextIndex) => nextIndex !== itemIndex) } : group) }));
  }
  function addField(categoryIndex: number, itemIndex: number) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, fields: [...item.fields, { key: `campo_${crypto.randomUUID()}`, label: "Novo campo", type: "text", unit: "" }] } : item) } : group) }));
  }
  function removeField(categoryIndex: number, itemIndex: number, fieldIndex: number) {
    syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, fields: item.fields.filter((_, nextIndex) => nextIndex !== fieldIndex) } : item) } : group) }));
  }
  async function saveCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCatalog(true);
    try {
      const parsed = catalogForm;
      if (!isPoolQuoteConfig(parsed)) throw new Error(poolQuoteConfigError(parsed) || "Confira os dados do catálogo.");
      const response = await fetch("/api/quote-config", { method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": organizationId }, body: JSON.stringify({ config: parsed }) });
      const payload = await response.json() as { config?: PoolQuoteConfig; error?: string };
      if (!response.ok || !payload.config) throw new Error(payload.error ?? "Não foi possível salvar o catálogo.");
      setCatalog(payload.config);
      setActiveCategory(payload.config.catalog[0]?.category ?? "");
      setCatalogEditorOpen(false);
      toast.success("Orçamento automático atualizado para esta empresa.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar o catálogo.");
    } finally {
      setSavingCatalog(false);
    }
  }
  if (catalogLoading) return <div className="loading"><i /><p>Carregando catálogo da empresa…</p></div>;
  if (catalogError) return <section className="surface settings-section"><p role="alert">{catalogError}</p><Button onClick={() => { setCatalogLoading(true); setCatalogReload(value => value + 1); }}>Tentar novamente</Button></section>;
  return <div className="module-stack pool-projects-view">
    <div className="pool-projects-title"><div><small>ORÇAMENTOS</small><h2>Configurador inteligente</h2><p>Medidas, preços, margens e projeto de piscina gerados automaticamente.</p></div><div className="panel-actions">{canManageCatalog && <Button variant="outline" onClick={openCatalogEditor}>Editar orçamento automático</Button>}<Button onClick={onCreate}><Plus /> Novo orçamento</Button></div></div>
    <div className="pool-project-tabs" role="tablist"><button type="button" role="tab" aria-selected={view === "projects"} className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>Projetos</button><button type="button" role="tab" aria-selected={view === "saved"} className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}>Orçamentos salvos <span>{quotes.length}</span></button></div>
    {view === "projects" ? <section className="pool-project-catalog"><div className="pool-project-catalog-head"><div><strong>Escolha um projeto ou serviço</strong><small>Administrador edita o catálogo, preços, margens e medidas direto aqui na Fama System.</small></div><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projetos no catálogo" aria-label="Buscar projetos no catálogo" /></div><div className="pool-category-chips">{catalog.catalog.map((item) => <button type="button" key={item.category} className={activeCategory === item.category ? "active" : ""} onClick={() => setActiveCategory(item.category)}>{item.category}</button>)}</div><div className="pool-project-cards">{projects.map((item) => <article className="pool-project-card" key={item.name}><div><small>{category?.category}</small><h3>{item.name}</h3><p>{item.fields.map((field) => field.label).join(" · ") || "Serviço sem campos adicionais"}</p></div><footer><strong>{money(Math.round(item.price * (1 + item.markup / 100) * 100))} <small>/ {item.unit}</small></strong><Button variant="outline" size="sm" onClick={() => onCreateProject({ category: category?.category ?? "", name: item.name })}>Configurar projeto <ChevronRight /></Button></footer></article>)}</div>{!projects.length && <Empty>Nenhum serviço corresponde à busca.</Empty>}</section> : <SavedQuotes quotes={quotes} organizationName={organizationName} onSelect={onSelect} onStatus={onStatus} onConvert={onConvert} onDelete={onDelete} />}
    <Dialog open={catalogEditorOpen} onOpenChange={setCatalogEditorOpen}><DialogContent className="catalog-editor-dialog"><DialogHeader><DialogTitle>Editar orçamento automático</DialogTitle><DialogDescription>Edite tudo por campos normais. Cada empresa mantém seu próprio catálogo.</DialogDescription></DialogHeader><form className="catalog-editor-form" onSubmit={saveCatalog}><div className="catalog-normal-editor"><div className="catalog-editor-toolbar"><div className="form-field"><Label htmlFor="catalog-title">Título</Label><Input id="catalog-title" value={catalogForm.title} onChange={(event) => syncCatalogForm((current) => ({ ...current, title: event.target.value }))} /></div><Button type="button" variant="outline" onClick={addCategory}><Plus />Categoria</Button></div><section className="catalog-urgency-editor"><strong>Urgência</strong><div><Label>Normal (%)<Input type="number" value={catalogForm.urgency.normal} onChange={(event) => syncCatalogForm((current) => ({ ...current, urgency: { ...current.urgency, normal: Number(event.target.value) } }))} /></Label><Label>Urgente (%)<Input type="number" value={catalogForm.urgency.urgente} onChange={(event) => syncCatalogForm((current) => ({ ...current, urgency: { ...current.urgency, urgente: Number(event.target.value) } }))} /></Label><Label>Emergência (%)<Input type="number" value={catalogForm.urgency.emergencia} onChange={(event) => syncCatalogForm((current) => ({ ...current, urgency: { ...current.urgency, emergencia: Number(event.target.value) } }))} /></Label></div></section>{catalogForm.catalog.map((group, categoryIndex) => <section className="catalog-editor-category" key={categoryIndex}><header><div className="form-field"><Label>Categoria</Label><Input value={group.category} onChange={(event) => updateCategory(categoryIndex, event.target.value)} /></div><div className="record-actions"><Button type="button" variant="outline" size="sm" onClick={() => addItem(categoryIndex)}><Plus />Item</Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCategory(categoryIndex)} aria-label="Remover categoria"><X /></Button></div></header><div className="catalog-editor-items">{group.items.map((item, itemIndex) => <article className="catalog-edit-item" key={itemIndex}><div className="catalog-edit-item-head"><strong>Item {itemIndex + 1}</strong><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(categoryIndex, itemIndex)} aria-label="Remover item"><X /></Button></div><div className="catalog-item-grid"><Label>Nome<Input value={item.name} onChange={(event) => updateItem(categoryIndex, itemIndex, { name: event.target.value })} /></Label><Label>Unidade<Input value={item.unit} onChange={(event) => updateItem(categoryIndex, itemIndex, { unit: event.target.value })} /></Label><Label>Preço base (R$)<Input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(categoryIndex, itemIndex, { price: Number(event.target.value) })} /></Label><Label>Margem (%)<Input type="number" min="0" step="1" value={item.markup} onChange={(event) => updateItem(categoryIndex, itemIndex, { markup: Number(event.target.value) })} /></Label></div><div className="catalog-fields-editor"><div><strong>Campos de medida</strong><Button type="button" variant="outline" size="sm" onClick={() => addField(categoryIndex, itemIndex)}><Plus />Campo</Button></div>{item.fields.map((field, fieldIndex) => <div className="catalog-field-row" key={fieldIndex}><Label>Nome<Input value={field.label} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { label: event.target.value })} /></Label><Label>Usar no cálculo<NativeSelect value={poolQuoteFieldRole(field)} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { role: event.target.value as PoolQuoteFieldRole, ...(event.target.value !== "info" ? { type: "number" as const } : {}) })}><NativeSelectOption value="info">Informação adicional</NativeSelectOption><NativeSelectOption value="length">Comprimento</NativeSelectOption><NativeSelectOption value="width">Largura</NativeSelectOption><NativeSelectOption value="depth">Profundidade</NativeSelectOption><NativeSelectOption value="area">Área informada</NativeSelectOption><NativeSelectOption value="volume">Volume informado</NativeSelectOption><NativeSelectOption value="quantity">Quantidade</NativeSelectOption></NativeSelect></Label><Label>Tipo<NativeSelect value={field.type ?? "text"} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { type: event.target.value as PoolQuoteField["type"] })}><NativeSelectOption value="text">Texto</NativeSelectOption><NativeSelectOption value="number">Número</NativeSelectOption></NativeSelect></Label><Label>Unidade<Input value={field.unit ?? ""} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { unit: event.target.value })} /></Label><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(categoryIndex, itemIndex, fieldIndex)} aria-label="Remover campo"><X /></Button></div>)}</div></article>)}</div></section>)}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setCatalogEditorOpen(false)}>Cancelar</Button><Button type="submit" disabled={savingCatalog}>{savingCatalog ? "Salvando…" : "Salvar orçamento automático"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function SavedQuotes({ quotes, organizationName, onSelect, onStatus, onConvert, onDelete }: { quotes: Quote[]; organizationName: string; onSelect: (record: Quote) => void; onStatus: (record: Quote, status: QuoteStatus) => void; onConvert: (record: Quote) => void; onDelete?: DeleteRecord }) {
  const pending = quotes.filter((item) => item.status === "enviado").reduce((sum, item) => sum + item.totalCents, 0);
  const approved = quotes.filter((item) => item.status === "aprovado").reduce((sum, item) => sum + item.totalCents, 0);
  const download = (quote: Quote) => toast.promise(generateQuotePdf(quote, organizationName), {
    loading: "Gerando PDF…",
    success: "PDF do orçamento gerado.",
    error: "Não foi possível gerar o PDF.",
  });
  const share = async (quote: Quote) => {
    try {
      const response = await fetch(`/api/quotes/${quote.id}/approval-link`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const payload = await response.json() as { error?: string; approvalToken?: string; status?: QuoteStatus };
      if (!response.ok || !payload.approvalToken) throw new Error(payload.error ?? "Não foi possível preparar o link.");
      const link = `${window.location.origin}/proposta/${encodeURIComponent(quote.id)}?token=${encodeURIComponent(payload.approvalToken)}`;
      const text = `Orçamento ${quote.quoteNumber} · ${quote.clientName}\n${quote.service}\nTotal: ${money(quote.totalCents)}\nAprove ou recuse a proposta: ${link}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      if (payload.status && payload.status !== quote.status) onStatus(quote, payload.status);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível preparar o link."); }
  };
  return <div className="module-stack"><div className="compact-metrics"><Metric icon={FileText} label="Orçamentos" value={String(quotes.length)} helper="na visão atual" tone="cyan" /><Metric icon={Clock3} label="Aguardando resposta" value={money(pending)} helper="propostas enviadas" tone="orange" /><Metric icon={Check} label="Aprovados" value={money(approved)} helper="prontos para execução" tone="blue" /></div><section className="surface table-surface"><div className="panel-heading"><div><small>PROPOSTAS</small><h2>Controle de orçamentos</h2></div><Badge variant="secondary">{quotes.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Número / cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Validade</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{quotes.map((quote) => <TableRow key={quote.id}><TableCell><button className="table-link" onClick={() => onSelect(quote)}><strong>{quote.quoteNumber}</strong><small>{quote.clientName}</small></button></TableCell><TableCell className="max-cell">{quote.service}</TableCell><TableCell>{shortDate(quote.validUntil)}</TableCell><TableCell><strong>{money(quote.totalCents)}</strong></TableCell><TableCell><NativeSelect value={quote.status} onChange={(event) => onStatus(quote, event.target.value as QuoteStatus)} aria-label={`Status de ${quote.quoteNumber}`}>{Object.entries(quoteLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" onClick={() => download(quote)}><FileDown />PDF</Button><Button variant="outline" size="sm" onClick={() => void share(quote)}>WhatsApp</Button>{quote.status === "aprovado" && <Button variant="outline" size="sm" onClick={() => onConvert(quote)}>Criar OS</Button>}<Button variant="ghost" size="icon-sm" onClick={() => onSelect(quote)} aria-label="Abrir orçamento"><ChevronRight /></Button>{onDelete && <DeleteButton label={`o orçamento ${quote.quoteNumber}`} onDelete={() => onDelete("quotes", quote)} />}</div></TableCell></TableRow>)}</TableBody></Table>{!quotes.length && <Empty>Cadastre o primeiro orçamento para gerar propostas em PDF.</Empty>}</section></div>;
}

function Agenda({ organizationId, appointments, employees, onSelect, onStatus, onReschedule, onDelete }: { organizationId: string; appointments: Appointment[]; employees: Employee[]; onSelect: (record: Appointment) => void; onStatus: (record: Appointment, status: AppointmentStatus) => void; onReschedule: (record: Appointment, nextStartAt?: string) => Promise<void>; onDelete?: DeleteRecord }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [technician, setTechnician] = useState("todos");
  const [sendingDaily, setSendingDaily] = useState(false);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return dayKey(day);
  });
  const visibleAppointments = technician === "todos" ? appointments : appointments.filter((item) => item.technician === technician);
  const caption = `${shortDate(days[0])} – ${shortDate(days[6])}`;
  function moveAppointment(event: React.DragEvent<HTMLDivElement>, day: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) return;
    const clock = appointment.startAt.slice(11, 16) || "09:00";
    void onReschedule(appointment, `${day}T${clock}`);
  }
  function shareTechnicianSchedule(name: string) {
    const items = appointments.filter((item) => item.technician === name && days.includes(dayKey(item.startAt))).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const lines = items.length
      ? items.map((item) => `• ${fullDate(item.startAt)}\n${item.clientName} — ${item.title}\n${item.address || "Endereço não informado"}\nStatus: ${appointmentLabels[item.status]}`)
      : ["Sem atendimentos cadastrados nesta semana."];
    shareText(`Olá, ${name}.\n\nSegue seu cronograma da semana (${caption}):\n\n${lines.join("\n\n")}\n\nQualquer ajuste me avise por aqui.`);
  }
  async function sendDailyWhatsApp() {
    setSendingDaily(true);
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": organizationId },
        body: JSON.stringify({ action: "dailyAgenda", technician: technician === "todos" ? "" : technician }),
      });
      const payload = await response.json() as { sent?: unknown[]; skipped?: unknown[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar a agenda pelo WhatsApp.");
      toast.success(`Agenda enviada para ${payload.sent?.length ?? 0} técnico(s). ${payload.skipped?.length ? `${payload.skipped.length} ignorado(s).` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar a agenda.");
    } finally {
      setSendingDaily(false);
    }
  }
  return <div className="agenda-layout"><section className="agenda-board-wrap">
    <div className="agenda-toolbar"><NativeSelect aria-label="Filtrar agenda por técnico" value={technician} onChange={(event) => setTechnician(event.target.value)}><NativeSelectOption value="todos">Todos os técnicos</NativeSelectOption>{employees.filter((employee) => employee.active).map((employee) => <NativeSelectOption value={employee.name} key={employee.id}>{employee.name}</NativeSelectOption>)}</NativeSelect><Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)}>Semana anterior</Button><strong>{caption}</strong><Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)}>Próxima semana</Button><Button type="button" variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button><Button type="button" size="sm" onClick={() => void sendDailyWhatsApp()} disabled={sendingDaily}>{sendingDaily ? "Enviando..." : "Enviar agenda de hoje"}</Button></div>
    <div className="agenda-board">{days.map((day) => {
      const items = visibleAppointments.filter((item) => dayKey(item.startAt) === day).sort((a, b) => a.startAt.localeCompare(b.startAt));
      return <div className="agenda-day" key={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveAppointment(event, day)}><header><div><strong>{new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" })}</strong><span>{shortDate(day)}</span></div><Badge variant="secondary">{items.length}</Badge></header><div>{items.map((item) => <article className={`agenda-event event-${item.kind.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}`} key={item.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }} title="Arraste para outro dia para reagendar"><button onClick={() => onSelect(item)}><time>{time(item.startAt)}</time><div><h3>{item.title}</h3><p>{item.clientName}</p><span><MapPin />{item.address}</span></div></button><footer><Badge variant="outline">{item.technician || "Sem técnico"}</Badge><div className="record-actions"><Button variant="ghost" size="icon-sm" onClick={() => void onReschedule(item)} aria-label="Reagendar visita"><CalendarClock /></Button><NativeSelect value={item.status} onChange={(event) => onStatus(item, event.target.value as AppointmentStatus)} aria-label={`Status de ${item.title}`}>{Object.entries(appointmentLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect>{onDelete && <DeleteButton label={`o agendamento ${item.title}`} onDelete={() => onDelete("appointments", item)} />}</div></footer></article>)}</div>{!items.length && <p className="agenda-drop-hint">Solte aqui para reagendar</p>}</div>;
    })}</div>
  </section><aside className="surface route-panel"><div className="panel-heading"><div><small>ROTA DA SEMANA</small><h2>Equipe em campo</h2></div><MapPin /></div>{employees.filter((employee) => employee.active).map((employee) => { const todayCount = visibleAppointments.filter((item) => item.technician === employee.name && days.includes(dayKey(item.startAt))).length; return <div className="route-tech" key={employee.id}><span className={`avatar ${employee.color}`}>{initials(employee.name)}</span><div><strong>{employee.name}</strong><small>{todayCount} atendimento{todayCount === 1 ? "" : "s"} nesta semana</small></div><Button type="button" variant="ghost" size="sm" onClick={() => shareTechnicianSchedule(employee.name)}>WhatsApp</Button><b>{todayCount}</b></div>; })}{!employees.filter((employee) => employee.active).length && <Empty>Cadastre a equipe para distribuir as rotas.</Empty>}<Separator /><div className="route-note"><Sparkles /><p><strong>Arraste para reagendar</strong>Distribua os compromissos por dia. No celular, use o botão de calendário em cada visita.</p></div></aside></div>;
}

function TechnicianMobile({ appointments, orders, onAppointmentStatus, onOrderStatus }: { appointments: Appointment[]; orders: WorkOrder[]; onAppointmentStatus: (record: Appointment, status: AppointmentStatus) => void; onOrderStatus: (record: WorkOrder, status: WorkOrderStatus) => void }) {
  const today = dayKey(new Date());
  const todayAppointments = appointments.filter((item) => dayKey(item.startAt) === today).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const activeOrders = orders.filter((item) => item.status !== "concluida").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return <div className="technician-mobile module-stack">
    <section className="surface technician-mobile-hero"><div><small>APP DO TÉCNICO</small><h2>Seu dia em campo</h2><p>Agenda, rota, checklist e conclusão em uma tela feita para o celular.</p></div><Smartphone /></section>
    <div className="technician-mobile-metrics"><Metric icon={CalendarDays} label="Visitas hoje" value={String(todayAppointments.length)} helper="na sua agenda" tone="cyan" /><Metric icon={ClipboardCheck} label="OS abertas" value={String(activeOrders.length)} helper="para concluir" tone="blue" /></div>
    <section className="surface technician-mobile-list"><div className="panel-heading"><div><small>PRÓXIMAS VISITAS</small><h2>Rota de hoje</h2></div><Badge variant="secondary">{todayAppointments.length} itens</Badge></div>{todayAppointments.map((item) => <article className="technician-mobile-item" key={item.id}><div className="technician-mobile-time"><strong>{time(item.startAt)}</strong><span>{appointmentLabels[item.status]}</span></div><div><h3>{item.title}</h3><p>{item.clientName}</p><small><MapPin />{item.address || "Endereço não informado"}</small></div><NativeSelect value={item.status} onChange={(event) => onAppointmentStatus(item, event.target.value as AppointmentStatus)} aria-label={`Status de ${item.title}`}>{Object.entries(appointmentLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></article>)}{!todayAppointments.length && <Empty>Nenhuma visita prevista para hoje.</Empty>}</section>
    <section className="surface technician-mobile-list"><div className="panel-heading"><div><small>EXECUÇÃO</small><h2>Ordens abertas</h2></div><Badge variant="secondary">{activeOrders.length} itens</Badge></div>{activeOrders.map((item) => <article className="technician-mobile-item" key={item.id}><div className="technician-mobile-time"><strong>{item.osNumber}</strong><span>{orderLabels[item.status]}</span></div><div><h3>{item.service}</h3><p>{item.clientName}</p><small>{item.ph === null ? "Medições pendentes" : `pH ${item.ph} · Cloro ${item.chlorine}`}</small></div><NativeSelect value={item.status} onChange={(event) => onOrderStatus(item, event.target.value as WorkOrderStatus)} aria-label={`Status de ${item.osNumber}`}>{Object.entries(orderLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></article>)}{!activeOrders.length && <Empty>Nenhuma ordem aberta.</Empty>}</section>
  </div>;
}

function Orders({ orders, onSelect, onStatus, onDelete }: { orders: WorkOrder[]; onSelect: (record: WorkOrder) => void; onStatus: (record: WorkOrder, status: WorkOrderStatus) => void; onDelete?: DeleteRecord }) {
  return <section className="surface table-surface"><div className="panel-heading"><div><small>EXECUÇÃO</small><h2>Ordens de serviço</h2></div><div className="legend"><i className="open" />{orders.filter((item) => item.status !== "concluida").length} em andamento</div></div><Table><TableHeader><TableRow><TableHead>OS / cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Data e técnico</TableHead><TableHead>Leitura da água</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id}><TableCell><button className="table-link" onClick={() => onSelect(order)}><strong>{order.osNumber}</strong><small>{order.clientName}</small></button></TableCell><TableCell className="max-cell">{order.service}</TableCell><TableCell><span className="cell-stack"><strong>{shortDate(order.scheduledAt)}</strong><small>{order.technician}</small></span></TableCell><TableCell>{order.ph !== null ? <span className="water-reading"><Droplets />pH {order.ph} · Cl {order.chlorine}</span> : <span className="muted">A medir</span>}</TableCell><TableCell><strong>{money(order.amountCents)}</strong></TableCell><TableCell><NativeSelect value={order.status} onChange={(event) => onStatus(order, event.target.value as WorkOrderStatus)} aria-label={`Status de ${order.osNumber}`}>{Object.entries(orderLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="record-actions"><Button variant="ghost" size="icon-sm" onClick={() => onSelect(order)} aria-label="Abrir ordem"><ChevronRight /></Button>{onDelete && <DeleteButton label={`a ordem ${order.osNumber}`} onDelete={() => onDelete("workOrders", order)} />}</div></TableCell></TableRow>)}</TableBody></Table>{!orders.length && <Empty>Nenhuma ordem de serviço encontrada.</Empty>}</section>;
}

function CloseWorkOrderDialog({ order, onClose, onSubmit }: { order: WorkOrder | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const checklist = ["Medir pH e cloro", "Limpar bordas e pré-filtro", "Aspirar fundo", "Aplicar produtos necessários", "Registrar foto antes/depois", "Confirmar com o cliente"];
  return <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Concluir ordem de serviço</DialogTitle><DialogDescription>{order ? `${order.osNumber} · ${order.clientName}` : "Registre o serviço realizado."} Anexe fotos na ficha da ordem antes de concluir.</DialogDescription></DialogHeader><form className="record-form" onSubmit={onSubmit}><section className="service-checklist span-2">{checklist.map((item) => <label key={item}><input type="checkbox" /><span>{item}</span><CheckCircle2 /></label>)}</section><Field label="Relatório do serviço realizado *" name="summary" type="textarea" className="span-2" minLength={5} required placeholder="Serviços executados, condições observadas, produtos usados, fotos e recomendações ao cliente…" /><Field label="Nome de quem confirmou *" name="customerName" className="span-2" required /><label className="work-order-confirm span-2"><input name="confirmed" type="checkbox" required /><span>Confirmo que o cliente validou a execução e as leituras registradas.</span></label><DialogFooter className="span-2"><Button type="button" variant="outline" onClick={onClose}>Voltar</Button><Button type="submit">Salvar relatório e concluir</Button></DialogFooter></form></DialogContent></Dialog>;
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

function Customers({ customers, query, onQueryChange, onSelect, onDelete }: { customers: Customer[]; query: string; onQueryChange: (value: string) => void; onSelect: (record: Customer) => void; onDelete?: DeleteRecord }) {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const digits = documentDigits(needle);
  const visible = customers.filter((customer) => JSON.stringify(customer).toLocaleLowerCase("pt-BR").includes(needle) || (digits.length >= 3 && documentDigits(unpackNotes(customer.notes).details.clientDocument ?? "").includes(digits)));
  return <div className="module-stack"><div className="customer-search"><div><strong>Localizar cliente</strong><small>Pesquise pelo nome, CPF ou CNPJ cadastrado.</small></div><div className="customer-lookup-input"><Search /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Digite o nome, CPF ou CNPJ" aria-label="Buscar clientes por nome, CPF ou CNPJ" /><Button type="button" variant="ghost" size="sm" onClick={() => onQueryChange("")} disabled={!query}>Limpar</Button></div></div><div className="customer-grid">{visible.map((customer) => <article className="customer-card" key={customer.id}><button className="customer-primary" onClick={() => onSelect(customer)}><div className="customer-head"><span>{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><StatusBadge value={customer.status} labels={{ ativo: "Ativo", prospect: "Prospect" }} /></div><h2>{customer.name}</h2><p><MapPin />{customer.address}</p><div className="pool-profile"><Droplets /><span><strong>{customer.poolType}</strong><small>{customer.poolVolume ? `${customer.poolVolume.toLocaleString("pt-BR")} litros` : "Volume não informado"}</small></span></div></button><footer><span><Wrench />{customer.plan}</span><div className="record-actions"><Button variant="ghost" size="icon-sm" onClick={() => onSelect(customer)} aria-label="Abrir cliente"><ChevronRight /></Button>{onDelete && <DeleteButton label={`o cliente ${customer.name}`} onDelete={() => onDelete("customers", customer)} />}</div></footer></article>)}{!visible.length && <Empty>{customers.length ? "Nenhum cliente corresponde à busca." : "Nenhum cliente encontrado."}</Empty>}</div></div>;
}

function Inventory({ items, lowStockAlert, onSelect, onAdjust, onDelete }: { items: InventoryItem[]; lowStockAlert: number; onSelect: (record: InventoryItem) => void; onAdjust: (record: InventoryItem, delta: number) => Promise<boolean>; onDelete?: DeleteRecord }) {
  const [barcode, setBarcode] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("remove");
  const value = items.reduce((sum, item) => sum + item.costCents * item.quantity, 0);
  const low = items.filter((item) => item.quantity <= Math.max(item.minimumQuantity, lowStockAlert)).length;
  async function submitBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = barcode.trim().toLocaleLowerCase("pt-BR");
    if (!code) return;
    const item = items.find((entry) => entry.sku.trim().toLocaleLowerCase("pt-BR") === code);
    if (!item) {
      toast.error("Código não encontrado. Cadastre o SKU/código de barras no produto.");
      return;
    }
    setBarcode("");
    if (!await onAdjust(item, mode === "add" ? 1 : -1)) setBarcode(code);
  }
  return <div className="module-stack"><div className="compact-metrics"><Metric icon={Boxes} label="Itens cadastrados" value={String(items.length)} helper="produtos e peças" tone="cyan" /><Metric icon={AlertTriangle} label="Estoque baixo" value={String(low)} helper={`limite geral: ${lowStockAlert}`} tone="orange" /><Metric icon={CircleDollarSign} label="Valor em estoque" value={money(value)} helper="custo aproximado" tone="blue" /></div><section className="surface barcode-surface"><div className="panel-heading"><div><small>CÓDIGO DE BARRAS</small><h2>Entrada e saída rápida</h2></div><ScanLine /></div><form className="barcode-form" onSubmit={submitBarcode}><div className="barcode-mode" role="tablist" aria-label="Tipo de movimentação"><button type="button" className={mode === "remove" ? "active" : ""} onClick={() => setMode("remove")}>Remover 1</button><button type="button" className={mode === "add" ? "active" : ""} onClick={() => setMode("add")}>Adicionar 1</button></div><Input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Escaneie ou digite o SKU/código de barras" aria-label="Código de barras ou SKU do produto" autoComplete="off" /><Button type="submit"><ScanLine />Registrar</Button></form><p>Exemplo: cadastre o SKU da central de LED. Ao escanear, o sistema adiciona ou remove 1 unidade automaticamente.</p></section><section className="surface table-surface"><div className="panel-heading"><div><small>INVENTÁRIO</small><h2>Produtos e equipamentos</h2></div><Badge variant="secondary">Atualização rápida</Badge></div><Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>SKU / código</TableHead><TableHead>Saldo</TableHead><TableHead>Mínimo</TableHead><TableHead>Custo unitário</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => { const alertAt = Math.max(item.minimumQuantity, lowStockAlert); const warning = item.quantity <= alertAt; return <TableRow key={item.id}><TableCell><button className="table-link" onClick={() => onSelect(item)}><strong>{item.name}</strong><small>{warning ? `Reposição necessária: alerta em ${alertAt} ${item.unit}` : "Estoque regular"}</small></button></TableCell><TableCell>{item.sku || "Sem código"}</TableCell><TableCell><span className={`stock-amount ${warning ? "low" : ""}`}>{item.quantity} {item.unit}</span></TableCell><TableCell>{item.minimumQuantity} {item.unit}</TableCell><TableCell>{money(item.costCents)}</TableCell><TableCell><div className="stepper"><Button variant="outline" size="icon-sm" onClick={() => void onAdjust(item, -1)} aria-label="Retirar uma unidade"><X /></Button><Button variant="outline" size="icon-sm" onClick={() => void onAdjust(item, 1)} aria-label="Adicionar uma unidade"><Plus /></Button>{onDelete && <DeleteButton label={`o item ${item.name}`} onDelete={() => onDelete("inventory", item)} />}</div></TableCell></TableRow>; })}</TableBody></Table>{!items.length && <Empty>Nenhum item encontrado.</Empty>}</section></div>;
}

// Legacy compact finance table retained for fallback layouts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function CreateDialog({ organizationId, entity, employees, customers, settings, initialQuoteSelection, initialTransactionType, onExistingCustomer, onOpenChange, onSubmit }: { organizationId: string; entity: CreateEntity | null; employees: Employee[]; customers: Customer[]; settings: CompanySettings; initialQuoteSelection: PoolQuoteSelection | null; initialTransactionType: "receita" | "despesa"; onExistingCustomer: (customer: Customer) => void; onOpenChange: (open: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [customerLookup, setCustomerLookup] = useState("");
  const [quoteCatalogReady, setQuoteCatalogReady] = useState(false);
  const titles: Record<CreateEntity, [string, string]> = {
    leads: ["Novo lead", "Registre o contato e a próxima ação comercial."],
    quotes: ["Novo orçamento", "Monte uma proposta rápida, profissional e pronta para enviar."],
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
  return <Dialog open onOpenChange={onOpenChange}><DialogContent movable={entity === "quotes"} className={entity === "quotes" ? "pool-quote-dialog" : "sm:max-w-2xl"}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form className="record-form" onSubmit={onSubmit}>{entity === "leads" && <>
    <Field label="Nome do contato *" name="name" required /><Field label="Telefone *" name="phone" required /><Field label="Origem" name="source" placeholder="Instagram, indicação, site…" /><Field label="Interesse *" name="interest" required className="span-2" /><Field label="Valor estimado (R$)" name="estimatedValue" inputMode="decimal" /><Field label="Próxima ação" name="nextAction" /><Field label="Etapa" name="status" type="select" options={leadStages.map((item) => [item.id, item.label])} defaultValue="novo" /></>}
    {entity === "quotes" && <PoolQuoteBuilderFields organizationId={organizationId} onReady={setQuoteCatalogReady} initialSelection={initialQuoteSelection} settings={settings} />}
    {entity === "appointments" && <><Field label="Compromisso *" name="title" required /><Field label="Cliente *" name="clientName" required /><Field label="Data e hora *" name="startAt" type="datetime-local" required /><Field label="Técnico responsável" name="technician" type="select" options={technicianOptions} /><Field label="Tipo" name="kind" type="select" options={[["Manutenção", "Manutenção"], ["Visita técnica", "Visita técnica"], ["Instalação", "Instalação"], ["Diagnóstico", "Diagnóstico"], ["Garantia", "Garantia"]]} /><Field label="Frequência" name="frequency" type="select" options={[["avulsa","Avulsa"],["semanal","Semanal"],["quinzenal","Quinzenal"],["mensal","Mensal"]]} /><Field label="Tempo estimado" name="duration" placeholder="Ex.: 1h30" /><Field label="Ordem na rota" name="routeOrder" type="number" min="1" /><Field label="Endereço" name="address" className="span-2" /><Field label="Observações" name="notes" type="textarea" className="span-2" /></>}
    {entity === "workOrders" && <><Field label="Cliente *" name="clientName" required /><Field label="Serviço *" name="service" required className="span-2" /><Field label="Data e hora" name="scheduledAt" type="datetime-local" /><Field label="Técnico" name="technician" type="select" options={technicianOptions} /><Field label="pH" name="ph" inputMode="decimal" /><Field label="Cloro livre (ppm)" name="chlorine" inputMode="decimal" /><Field label="Alcalinidade (ppm)" name="alkalinity" inputMode="decimal" /><Field label="Dureza cálcica" name="calciumHardness" /><Field label="Estabilizante" name="stabilizer" /><Field label="Aspecto da água" name="waterAppearance" type="select" options={[["cristalina","Cristalina"],["verde","Verde"],["turva","Turva"],["oleosa","Oleosa"]]} /><Field label="Produtos aplicados" name="productsUsed" className="span-2" /><Field label="Custo de produtos (R$)" name="productCost" inputMode="decimal" /><Field label="Mão de obra (R$)" name="laborCost" inputMode="decimal" /><Field label="Deslocamento (R$)" name="travelCost" inputMode="decimal" /><Field label="Valor cobrado (R$)" name="amount" inputMode="decimal" /><Field label="Checklist executado" name="checklist" type="textarea" className="span-2" placeholder="Escovar bordas; aspirar fundo; limpar pré-filtro; medir pH e cloro; aplicar produto; foto final; confirmação do cliente" /><Field label="Relatório técnico" name="notes" type="textarea" className="span-2" /></>}
    {entity === "customers" && <><CustomerDuplicateLookup value={customerLookup} customers={customers} onChange={setCustomerLookup} onSelect={onExistingCustomer} /><Field label={settings.requireCustomerDocument ? "CPF/CNPJ *" : "CPF/CNPJ"} name="clientDocument" required={settings.requireCustomerDocument} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { event.currentTarget.value = formatTaxDocument(event.currentTarget.value); }} placeholder="000.000.000-00 ou 00.000.000/0000-00" inputMode="numeric" maxLength={18} /><Field label="Nome *" name="name" required /><Field label="Telefone *" name="phone" required /><Field label="E-mail" name="email" type="email" /><Field label="Endereço" name="address" className="span-2" /><Field label="Tipo da piscina" name="poolType" placeholder="Vinil, fibra, alvenaria…" /><Field label="Formato" name="poolShape" type="select" options={[["retangular","Retangular"],["redonda","Redonda"],["oval","Oval"],["irregular","Irregular"]]} /><Field label="Comprimento (m)" name="poolLength" inputMode="decimal" /><Field label="Largura/diâmetro (m)" name="poolWidth" inputMode="decimal" /><Field label="Profundidade média (m)" name="poolDepth" inputMode="decimal" /><Field label="Volume informado (litros)" name="poolVolume" inputMode="numeric" placeholder="Opcional: calculado pelas medidas" /><Field label="Tipo de filtro" name="filterType" /><Field label="Bomba instalada" name="pump" /><Field label="Frequência de manutenção" name="frequency" type="select" options={[["semanal","Semanal"],["quinzenal","Quinzenal"],["mensal","Mensal"],["sob demanda","Sob demanda"]]} /><Field label="Plano" name="plan" type="select" options={[["Básico","Básico"],["Premium","Premium"],["Condomínio","Condomínio"],["Emergência","Emergência"]]} /><Field label="Dia de cobrança" name="billingDay" type="number" min="1" max="31" /><Field label="Responsável / síndico" name="responsible" /><Field label="Histórico de problemas" name="problemHistory" type="textarea" className="span-2" /><Field label="Observações técnicas" name="notes" type="textarea" className="span-2" /></>}
    {entity === "inventory" && <><Field label="Produto ou peça *" name="name" required /><Field label="SKU / código de barras" name="sku" placeholder="Escaneie ou digite o código do produto" /><Field label="Unidade" name="unit" placeholder="unidade, balde, litro…" /><Field label="Quantidade inicial" name="quantity" inputMode="decimal" /><Field label="Estoque mínimo" name="minimumQuantity" inputMode="decimal" /><Field label="Custo unitário (R$)" name="cost" inputMode="decimal" /></>}
    {entity === "transactions" && <><Field label="Descrição *" name="description" required className="span-2" /><Field label="Tipo" name="type" type="select" options={[["receita", "Receita / a receber"], ["despesa", "Despesa / a pagar"]]} defaultValue={initialTransactionType} /><Field label="Categoria" name="category" /><Field label="Valor (R$) *" name="amount" inputMode="decimal" required /><Field label="Vencimento" name="dueDate" type="date" /><Field label="Status" name="status" type="select" options={Object.entries(transactionLabels)} defaultValue="pendente" /></>}
    {entity === "employees" && <><Field label="Nome *" name="name" required /><Field label="Função *" name="role" required placeholder="Técnico, instalador, comercial…" /><Field label="Telefone" name="phone" /><Field label="Cor de identificação" name="color" type="select" options={[["aqua", "Turquesa"], ["blue", "Azul"], ["violet", "Violeta"], ["orange", "Laranja"]]} /></>}
    {entity === "warranties" && <><Field label="Cliente *" name="clientName" required /><Field label="Referência de origem" name="originReference" placeholder="Orçamento, OS ou nota fiscal" /><Field label="Item ou serviço coberto *" name="item" required className="span-2" /><Field label="Data da compra/entrega" name="purchaseDate" type="date" /><Field label="Validade da garantia *" name="expiresAt" type="date" required /><Field label="Condições e observações" name="notes" type="textarea" className="span-2" /></>}
    {entity === "contracts" && <><Field label="Cliente *" name="clientName" required /><Field label="CPF/CNPJ" name="clientDocument" /><Field label="Endereço do cliente" name="clientAddress" className="span-2" /><Field label="Objeto do contrato *" name="service" type="textarea" required className="span-2" /><Field label="Início *" name="startDate" type="date" required /><Field label="Término *" name="endDate" type="date" required /><Field label="Frequência" name="frequency" type="select" options={[["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"], ["trimestral", "Trimestral"], ["sob demanda", "Sob demanda"]]} defaultValue="mensal" /><Field label="Mensalidade (R$)" name="monthly" inputMode="decimal" /><Field label="Dia de pagamento" name="paymentDay" type="number" min="1" max="31" /><Field label="Cláusulas e condições" name="terms" type="textarea" className="span-2" placeholder="Descreva obrigações, materiais incluídos, reajuste e rescisão." /></>}
    <DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={entity === "quotes" && !quoteCatalogReady}>Salvar registro</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PoolQuoteBuilderFields({ organizationId, onReady, initialSelection, settings }: { organizationId: string; onReady: (ready: boolean) => void; initialSelection: PoolQuoteSelection | null; settings: CompanySettings }) {
  type Line = { category: string; name: string; unit: string; quantity: number; unitPrice: number; markup: number; total: number; dimensions: Record<string, string> };
  const defaultValidUntil = useMemo(() => {
    const next = new Date();
    next.setDate(next.getDate() + Math.max(1, settings.defaultQuoteValidityDays || 7));
    return next.toISOString().slice(0, 10);
  }, [settings.defaultQuoteValidityDays]);
  const [client, setClient] = useState("");
  const [config, setConfig] = useState<PoolQuoteConfig>(defaultPoolQuoteConfig);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [configReload, setConfigReload] = useState(0);
  const [category, setCategory] = useState(initialSelection?.category ?? defaultPoolQuoteConfig.catalog[0]?.category ?? "");
  const [selectedName, setSelectedName] = useState(initialSelection?.name ?? defaultPoolQuoteConfig.catalog[0]?.items[0]?.name ?? "");
  const [dimensions, setDimensions] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [labor, setLabor] = useState("");
  const [travel, setTravel] = useState("");
  const [discount, setDiscount] = useState("");
  const [urgency, setUrgency] = useState<keyof PoolQuoteConfig["urgency"]>("normal");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [installments, setInstallments] = useState("1");
  const [cardRate, setCardRate] = useState("3.99");
  useEffect(() => {
    let disposed = false;
    fetch("/api/quote-config", { headers: { "x-organization-id": organizationId }, cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as { config?: PoolQuoteConfig; error?: string };
        if (!response.ok || !isPoolQuoteConfig(payload.config)) throw new Error(payload.error || "Não foi possível carregar o catálogo.");
        if (disposed) return;
        const next = payload.config;
        const initialCategory = next.catalog.find(entry => entry.category === initialSelection?.category) ?? next.catalog[0];
        const initialItem = initialCategory?.items.find(entry => entry.name === initialSelection?.name) ?? initialCategory?.items[0];
        setConfig(next); setCategory(initialCategory?.category ?? ""); setSelectedName(initialItem?.name ?? ""); setConfigError(""); onReady(true);
      })
      .catch(error => { if (!disposed) { setConfigError(error instanceof Error ? error.message : "Não foi possível carregar o catálogo."); onReady(false); } })
      .finally(() => { if (!disposed) setConfigLoading(false); });
    return () => { disposed = true; };
  }, [organizationId, onReady, initialSelection, configReload]);
  const activeCategory = config.catalog.find((entry) => entry.category === category) ?? config.catalog[0];
  const item = activeCategory?.items.find((entry) => entry.name === selectedName) ?? activeCategory?.items[0];
  const quantity = item ? poolQuoteQuantity(item, dimensions) : 0;
  const itemTotal = Math.round(quantity * (item?.price ?? 0) * (1 + (item?.markup ?? 0) / 100) * 100);
  const itemsTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const materialsCents = itemsTotal;
  const laborCents = quoteTravelCents(labor);
  const travelCents = quoteTravelCents(travel);
  const subtotal = materialsCents + laborCents + travelCents;
  const surcharge = Math.round(subtotal * (config.urgency[urgency] / 100));
  const discountCents = quoteTravelCents(discount);
  const baseTotal = Math.max(0, subtotal + surcharge - discountCents);
  const installmentCount = Math.max(1, Math.min(24, Math.round(Number(installments) || 1)));
  const creditRate = Math.max(0, Math.min(50, Number(String(cardRate).replace(",", ".")) || 0));
  const cardPayment = quoteCardPayment(baseTotal, paymentMethod === "credit" ? creditRate : 0);
  const cardFeeCents = cardPayment.feeCents;
  const total = cardPayment.totalCents;
  const installmentCents = Math.ceil(total / installmentCount);
  function addLine() {
    if (!item || quantity <= 0) return;
    setLines((current) => [...current, { category, name: item.name, unit: item.unit, quantity, unitPrice: item.price, markup: item.markup, total: itemTotal, dimensions: { ...dimensions } }]);
    setDimensions({});
  }
  if (configLoading) return <p className="span-2" role="status">Carregando catálogo da empresa…</p>;
  if (configError) return <div className="span-2"><p role="alert">{configError}</p><Button type="button" onClick={() => { setConfigLoading(true); setConfigReload(value => value + 1); }}>Tentar novamente</Button></div>;
  return <>
    <Field label="Cliente *" name="clientName" required value={client} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setClient(event.target.value)} />
    <section className="pool-catalog-picker span-2" aria-label="Catálogo de piscinas">
      <div className="pool-builder-heading"><div><strong>{config.title}</strong><small>Catálogo individual da empresa: fibra, alvenaria, equipamentos, medidas e valores próprios.</small></div><span>{config.catalog.length} categorias</span></div>
      <div className="pool-category-chips">{config.catalog.map((entry) => <button type="button" key={entry.category} className={category === entry.category ? "active" : ""} onClick={() => { setCategory(entry.category); setSelectedName(entry.items[0]?.name ?? ""); setDimensions({}); }}>{entry.category}</button>)}</div>
      <div className="pool-service-cards">{(activeCategory?.items ?? []).map((entry) => <button type="button" key={entry.name} className={selectedName === entry.name ? "active" : ""} onClick={() => { setSelectedName(entry.name); setDimensions({}); }}><strong>{entry.name}</strong><span>{money(Math.round(entry.price * (1 + entry.markup / 100) * 100))} / {entry.unit}</span><small>Margem {entry.markup}%</small></button>)}</div>
      {item && <div className="pool-item-config"><div className="pool-builder-heading"><div><strong>2. Configure o projeto</strong><small>Informe as medidas para calcular o valor automaticamente.</small></div><span>{item.unit}</span></div>
        <div className="pool-measure-fields">{item.fields.map((field) => <Field key={field.key} label={field.unit ? `${field.label} (${field.unit})` : field.label} name={`pool_${field.key}`} type={field.type === "number" ? "number" : "text"} step={field.type === "number" ? "0.01" : undefined} value={dimensions[field.key] ?? ""} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDimensions((current) => ({ ...current, [field.key]: event.target.value }))} />)}{!["m²", "m2", "m³", "m3", "m", "metro", "metros"].includes(item.unit.trim().toLowerCase()) && !item.fields.some(field => poolQuoteFieldRole(field) === "quantity") && <Field label={`Quantidade (${item.unit})`} name="pool_quantity" type="number" min="1" step="1" value={dimensions.quantity ?? "1"} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDimensions((current) => ({ ...current, quantity: event.target.value }))} />}</div>
        <div className="pool-price-preview"><div><small>Área / quantidade</small><strong>{quantity.toLocaleString("pt-BR")} {item.unit}</strong></div><div><small>Preço estimado do item</small><strong>{money(itemTotal)}</strong></div><Button type="button" onClick={addLine} disabled={quantity <= 0}><Plus /> Adicionar ao orçamento</Button></div>
      </div>}
    </section>
    <section className="pool-quote-lines span-2"><div className="pool-builder-heading"><div><strong>Itens do orçamento</strong><small>{lines.length ? `${lines.length} item(ns) adicionado(s)` : "Adicione um ou mais projetos ao orçamento."}</small></div><b>{money(itemsTotal)}</b></div>
      {lines.map((line, index) => <article className="pool-quote-line" key={index}><div><strong>{line.name}</strong><small>{line.category} · {line.quantity.toLocaleString("pt-BR")} {line.unit} · margem {line.markup}%</small>{Object.keys(line.dimensions).length > 0 && <small>{Object.entries(line.dimensions).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ")}</small>}</div><strong>{money(line.total)}</strong><button type="button" aria-label={`Remover ${line.name}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Remover</button></article>)}
      <input type="hidden" name="poolItems" value={JSON.stringify(lines)} />
      <input type="hidden" name="service" value={lines.map((line) => line.name).join(", ")} />
      <input type="hidden" name="materials" value={(materialsCents / 100).toFixed(2)} />
      <input type="hidden" name="products" value={JSON.stringify(lines)} />
    </section>
    <Field label="Mão de obra (R$)" name="labor" inputMode="decimal" value={labor} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setLabor(event.target.value)} />
    <Field label="Deslocamento (R$)" name="travel" inputMode="decimal" value={travel} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTravel(event.target.value)} />
    <Field label="Urgência" name="urgency" type="select" value={urgency} options={Object.entries(config.urgency).map(([key, rate]) => [key, `${key === "normal" ? "Normal" : key === "urgente" ? "Urgente" : "Emergência"} (+${rate}%)`])} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setUrgency(event.target.value as keyof PoolQuoteConfig["urgency"])} />
    <Field label="Desconto (R$)" name="discount" inputMode="decimal" value={discount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDiscount(event.target.value)} />
    <Field label="Forma de pagamento" name="paymentMethod" type="select" value={paymentMethod} options={[["pix", "Pix / dinheiro"], ["credit", "Cartão de crédito"], ["boleto", "Boleto"]]} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPaymentMethod(event.target.value)} />
    <Field label="Parcelas no crédito" name="installments" type="number" min="1" max="24" step="1" value={installments} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setInstallments(event.target.value)} />
    <Field label="Juros do cartão (%)" name="cardRate" type="number" min="0" max="50" step="0.01" value={cardRate} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCardRate(event.target.value)} />
    <div className="quote-breakdown span-2"><span>Itens<b>{money(materialsCents)}</b></span><span>Mão de obra<b>{money(laborCents)}</b></span><span>Deslocamento<b>{money(travelCents)}</b></span><span>{urgency === "normal" ? "Normal" : urgency === "urgente" ? "Urgente" : "Emergência"} (+{config.urgency[urgency]}%)<b>+ {money(surcharge)}</b></span><span>Desconto<b>− {money(discountCents)}</b></span><span>Subtotal<b>{money(baseTotal)}</b></span>{paymentMethod === "credit" && <span>Juros cartão ({creditRate.toLocaleString("pt-BR")}%)<b>+ {money(cardFeeCents)}</b></span>}<strong>Total estimado<em>{money(total)}</em></strong>{paymentMethod === "credit" && <small>{installmentCount}x de {money(installmentCents)} no cartão</small>}</div>
    <input type="hidden" name="cardFee" value={(cardFeeCents / 100).toFixed(2)} />
    <input type="hidden" name="poolItemsRequired" value={lines.length} />
    <Field label="Validade" name="validUntil" type="date" defaultValue={defaultValidUntil} /><Field label="Condição de pagamento" name="paymentTerms" defaultValue={settings.defaultPaymentTerms} /><Field label="Observações" name="notes" type="textarea" className="span-2" defaultValue={settings.quoteTerms} />
  </>;
}

function Field({ label, name, type = "text", options, className = "", ...props }: { label: string; name: string; type?: string; options?: string[][]; className?: string; [key: string]: unknown }) {
  return <div className={`form-field ${className}`}><Label htmlFor={name}>{label}</Label>{type === "textarea" ? <Textarea id={name} name={name} {...props} /> : type === "select" ? <NativeSelect id={name} name={name} {...props}>{options?.map(([value, text]) => <NativeSelectOption value={value} key={value}>{text}</NativeSelectOption>)}</NativeSelect> : <Input id={name} name={name} type={type} {...props} />}</div>;
}

function CustomerDuplicateLookup({ value, customers, onChange, onSelect }: { value: string; customers: Customer[]; onChange: (value: string) => void; onSelect: (customer: Customer) => void }) {
  const digits = documentDigits(value);
  const matches = digits.length >= 3 ? customers.filter((customer) => documentDigits(unpackNotes(customer.notes).details.clientDocument ?? "").includes(digits)).slice(0, 4) : [];
  return <div className="customer-lookup form-field span-2"><Label htmlFor="customerLookup">Conferir cliente por CPF/CNPJ</Label><div className="customer-lookup-input"><Search /><Input id="customerLookup" value={value} onChange={(event) => onChange(formatTaxDocument(event.target.value))} placeholder="Digite o documento para procurar nos seus clientes" inputMode="numeric" maxLength={18} /></div><small>Busca apenas nos cadastros da empresa atual.</small>{digits.length >= 3 && <div className="customer-lookup-results" role="status">{matches.length ? <><strong>Cliente já cadastrado</strong>{matches.map((customer) => <button type="button" key={customer.id} onClick={() => onSelect(customer)}><span>{customer.name}</span><small>Abrir cadastro</small><ChevronRight /></button>)}</> : <span>Nenhum cadastro encontrado. Você pode continuar.</span>}</div>}</div>;
}

function DetailSheet({ selected, organizationId, organizationName, onClose, onDelete }: { selected: Selected; organizationId: string; organizationName: string; onClose: () => void; onDelete?: DeleteRecord }) {
  if (!selected) return null;
  const record = selected.record;
  let title = "Detalhes";
  let subtitle = "Registro operacional";
  let content: ReactNode = null;

  if (selected.entity === "leads") {
    const lead = record as Lead; title = lead.name; subtitle = lead.interest; content = <><DetailGrid items={[["Telefone", lead.phone], ["Origem", lead.source], ["Valor potencial", money(lead.estimatedValueCents)], ["Etapa", leadStages.find((item) => item.id === lead.status)?.label ?? lead.status]]} /><DetailBlock label="Próxima ação">{lead.nextAction || "Não definida"}</DetailBlock></>;
  } else if (selected.entity === "quotes") {
    const quote = record as Quote;
    const quoteNotes = unpackNotes(quote.notes);
    const travelCents = quoteTravelCents(quoteNotes.details.travel);
    const urgency = quoteUrgency(quoteNotes.details.urgency);
    const savedUrgencyRate = Number(quoteNotes.details.urgencyRate);
    const urgencyLabel = Number.isFinite(savedUrgencyRate) ? `${urgency.urgency === "emergencia" ? "Emergência" : urgency.urgency === "urgente" ? "Urgente" : "Normal"} (+${savedUrgencyRate}%)` : urgency.label;
    const urgencySurchargeCents = Number.isFinite(savedUrgencyRate) ? Math.round((quote.materialsCents + quote.laborCents + travelCents) * savedUrgencyRate / 100) : quoteUrgencySurcharge(quote.materialsCents + quote.laborCents + travelCents, urgency.urgency);
    const cardFeeCents = Number(quoteNotes.details.cardFee ?? 0);
    const installments = Math.max(1, Math.round(Number(quoteNotes.details.installments ?? 1)));
    const cardRate = Number(quoteNotes.details.cardRate ?? 0);
    const paymentMethod = String(quoteNotes.details.paymentMethod ?? "pix");
    const paymentLabel = paymentMethod === "credit" ? `Cartão de crédito${installments > 1 ? ` em ${installments}x` : ""}${cardRate ? ` · juros ${cardRate}%` : ""}` : paymentMethod === "boleto" ? "Boleto" : "Pix / dinheiro";
    title = quote.quoteNumber; subtitle = quote.clientName; content = <><DetailBlock label="Serviço">{quote.service}</DetailBlock><div className="quote-breakdown"><span>Itens<b>{money(quote.materialsCents)}</b></span><span>Mão de obra<b>{money(quote.laborCents)}</b></span><span>Deslocamento<b>{money(travelCents)}</b></span><span>{urgencyLabel}<b>+ {money(urgencySurchargeCents)}</b></span><span>Desconto<b>− {money(quote.discountCents)}</b></span>{cardFeeCents > 0 && <span>Juros cartão<b>+ {money(cardFeeCents)}</b></span>}<strong>Total<em>{money(quote.totalCents)}</em></strong>{cardFeeCents > 0 && <small>{installments}x de {money(Math.ceil(quote.totalCents / installments))}</small>}</div><DetailGrid items={[["Itens do orçamento", quoteProductsSummary(quoteNotes.details.poolItems || quoteNotes.details.products)], ["Pagamento", quoteNotes.details.paymentTerms || paymentLabel || "Não informado"], ["Forma", paymentLabel], ["Status", quoteLabels[quote.status]], ["Validade", shortDate(quote.validUntil)]]} />{quoteNotes.text && <DetailBlock label="Observações">{quoteNotes.text}</DetailBlock>}</>;
  } else if (selected.entity === "appointments") {
    const item = record as Appointment; title = item.title; subtitle = item.clientName; content = <><DetailGrid items={[["Data e hora", fullDate(item.startAt)], ["Técnico", item.technician], ["Tipo", item.kind], ["Status", appointmentLabels[item.status]]]} /><DetailBlock label="Endereço">{item.address || "Não informado"}</DetailBlock><StructuredNotes value={item.notes} /></>;
  } else if (selected.entity === "workOrders") {
    const order = record as WorkOrder; const completion = workOrderCompletion(order.notes); title = order.osNumber; subtitle = `${order.clientName} · ${order.service}`; content = <><DetailGrid items={[["Agendamento", fullDate(order.scheduledAt)], ["Técnico", order.technician], ["Status", orderLabels[order.status]], ["Valor", money(order.amountCents)]]} /><div className="reading-detail"><span><small>pH</small><b>{order.ph ?? "—"}</b></span><span><small>Cloro</small><b>{order.chlorine !== null ? `${order.chlorine} ppm` : "—"}</b></span><span><small>Alcalinidade</small><b>{order.alkalinity !== null ? `${order.alkalinity} ppm` : "—"}</b></span></div><DetailBlock label="Produtos utilizados">{order.productsUsed || "Ainda não registrados."}</DetailBlock><StructuredNotes value={order.notes} />{completion && <><DetailBlock label="Relatório de execução">{completion.summary || "—"}</DetailBlock><DetailGrid items={[["Confirmação do cliente", completion.customerName || "—"], ["Concluído em", completion.confirmedAt ? fullDate(completion.confirmedAt) : "—"]]} /></>}<div className="detail-actions"><Button variant="outline" onClick={() => toast.promise(generateWorkOrderPdf(order, organizationName), { loading: "Gerando relatório…", success: "Relatório de serviço gerado.", error: "Não foi possível gerar o relatório." })}><FileDown />Gerar relatório em PDF</Button><Button variant="outline" onClick={() => shareText(`Olá! Serviço ${order.osNumber} concluído para ${order.clientName}.\n\nServiço: ${order.service}\nProdutos utilizados: ${order.productsUsed || "não informado"}\npH: ${order.ph ?? "—"} · Cloro: ${order.chlorine ?? "—"} ppm · Alcalinidade: ${order.alkalinity ?? "—"}\n\n${completion?.summary ? `Relatório: ${completion.summary}` : "Relatório técnico disponível no Fama System."}`)}><MessageCircle />Enviar pós-visita</Button></div></>;
  } else if (selected.entity === "customers") {
    const customer = record as Customer; title = customer.name; subtitle = customer.plan; content = <><DetailGrid items={[["Telefone", customer.phone], ["E-mail", customer.email || "Não informado"], ["Tipo da piscina", customer.poolType || "Não informado"], ["Volume", customer.poolVolume ? `${customer.poolVolume.toLocaleString("pt-BR")} litros` : "Não informado"]]} /><DetailBlock label="Endereço">{customer.address || "Não informado"}</DetailBlock><StructuredNotes value={customer.notes} /></>;
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

  return <Sheet open onOpenChange={(open) => !open && onClose()}><SheetContent className="detail-sheet sm:max-w-xl"><SheetHeader><Badge variant="secondary">Registro</Badge><SheetTitle>{title}</SheetTitle><SheetDescription>{subtitle}</SheetDescription></SheetHeader><div className="detail-content">{content}<RecordAttachments organizationId={organizationId} entity={selected.entity} recordId={selected.record.id} canDelete={Boolean(onDelete)} />{onDelete && <div className="detail-delete"><DeleteButton compact={false} label={title} onDelete={() => onDelete(selected.entity, selected.record)} /></div>}</div></SheetContent></Sheet>;
}

function DetailGrid({ items }: { items: string[][] }) {
  return <dl className="detail-grid">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>;
}

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return <section className="detail-block"><small>{label}</small><p>{children}</p></section>;
}
