"use client";
import { InternalChatIndicator } from './internal-chat-indicator';
import { GeneralManagement } from './general-management';
import { ViewCustomizer } from './view-customizer';
import { PlanningWorkspace } from './planning-workspace';
import { WazeLink } from './waze-navigation';
import { WorkspaceTools, CustomerTimeline } from './workspace-tools';
import { InternalHelp } from './internal-help';
import { AccountSwitcher } from './account-switcher';
import { useAccountSession } from '@/hooks/use-account-session';
import { ConsultationWorkspace } from './consultation-workspace';
import { DashboardBalance } from './dashboard-balance';
import { DashboardListCard } from './dashboard-list-card';
import { OperationsCenter } from "./operations-center";
import { WorkspaceMobileDock } from "./workspace-mobile-dock";
import { WorkspaceNavigationMenu } from "./workspace-navigation-menu";
import { InventoryCamera } from "./inventory-camera";
import { InventoryBarcodeField } from "./inventory-barcode-field";
/* eslint-disable @next/next/no-img-element */
import { lazy, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { recordEditFields } from "@/lib/record-edit-fields";
import { FAMA_VERSION } from "@/lib/fama-release";
import { IntegrationTelemetry } from './integration-telemetry';
import { AlertTriangle, ArrowLeft, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeDollarSign, Boxes, BriefcaseBusiness, BookOpenCheck, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardCheck, Clock3, Droplets, FileDown, FileSignature, FileText, Gauge, HandCoins, LayoutDashboard, LogOut, MapPin, Menu, Smartphone, WifiOff, RefreshCw, PackagePlus, Pencil, Play, Plus, QrCode, ScanLine, Search, Settings2, ShieldCheck, LockKeyhole, MessageCircle, Sparkles, TrendingUp, UsersRound, Wrench, X, } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/app/theme-toggle";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, } from "@/components/ui/sheet";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger, } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { emptyData, parseBootstrapData, } from "./data-model";
import { DeleteButton } from "./delete-button";
import { CustomerContactFields } from "./customer-contact-fields";
import { formatRegistrationDocument, taxDocumentCode } from "@/lib/registration-lookup";
import { documentUrl } from "@/lib/document-url";
import { TechnicianCompletion } from "./technician-completion";
import { SupportIndicator } from "./support-indicator";
import { PlanAnnouncement } from "./plan-announcement";
import { ServiceProfitPanel } from "./service-profit-panel";
import { checklistSummary, serviceChecklist, serviceProducts } from "@/lib/work-order-report";
import { quoteCardPayment, quoteTravelCents, quoteUrgency, quoteUrgencySurcharge } from "@/lib/quote-calculation";
import { defaultPoolQuoteConfig, isPoolQuoteConfig, poolQuoteConfigError, poolQuoteFieldRole, poolQuoteQuantity } from "@/lib/pool-quote-catalog";
import { entityPermissions, hasFeaturePermission } from "@/lib/permissions";
import { planIncludesFeature } from "@/lib/plan-features";
import { hasBlockAccess, famaBlocks } from "@/lib/fama-blocks";
import { isPlanAccessBlocked } from "@/lib/billing-access";
import { defaultCompanySettings } from "@/lib/company-settings";
import { useFamaAiSettings } from "@/hooks/use-fama-ai-settings";
import { useClientMutation } from "@/hooks/use-client-mutation";
import { ClientRequestError, requestJson } from "@/lib/client-request";
import { FamaLocalAiProvider } from "@/hooks/use-fama-local-ai";
import { FamaAiStartup } from "./fama-ai-startup";
import { sanitizeAssistantDraft } from "@/lib/fama-ai-drafts";
import { systemAssistantData, systemAssistantSources } from "@/lib/fama-ai-access";
import { useWorkspaceNavigation } from "@/hooks/use-workspace-navigation";
import { WorkspaceView } from "./workspace-view";
const loadMembersPanel = () => import("./members-panel");
const MembersPanel = lazy(() => loadMembersPanel().then(module => ({ default: module.MembersPanel })));
const loadPlatformCompanies = () => import("./platform-companies");
const PlatformCompanies = lazy(() => loadPlatformCompanies().then(module => ({ default: module.PlatformCompanies })));
const loadRecordAttachments = () => import("./record-attachments");
const RecordAttachments = lazy(() => loadRecordAttachments().then(module => ({ default: module.RecordAttachments })));
const loadManual = () => import("./manual");
const Manual = lazy(() => loadManual().then(module => ({ default: module.Manual })));
const loadPrivacyCenter = () => import("./privacy-center");
const PrivacyCenter = lazy(() => loadPrivacyCenter().then(module => ({ default: module.PrivacyCenter })));
const loadBillingCenter = () => import("./billing-center");
const BillingCenter = lazy(() => loadBillingCenter().then(module => ({ default: module.BillingCenter })));
const loadSupportCenter = () => import("./support-center");
const SupportCenter = lazy(() => loadSupportCenter().then(module => ({ default: module.SupportCenter })));
const loadCompanySettingsPanel = () => import("./company-settings-panel");
const CompanySettingsPanel = lazy(() => loadCompanySettingsPanel().then(module => ({ default: module.CompanySettingsPanel })));
const loadFamaAiPanel = () => import("./fama-ai-panel");
const FamaAiPanel = lazy(() => loadFamaAiPanel().then(module => ({ default: module.FamaAiPanel })));
const loadChatWorkspace = () => import("./chat-workspace");
const ChatWorkspace = lazy(() => loadChatWorkspace().then(module => ({ default: module.ChatWorkspace })));
const loadFinanceWorkspace = () => import("./finance-workspace");
const FinanceWorkspace = lazy(() => loadFinanceWorkspace().then(module => ({ default: module.FinanceWorkspace })));
const financeViews = ["visao", "contas", "cobrancas", "notas", "asaas", "bancos", "compras"];
const financeViewNames = { visao: "Resumo", contas: "Pagar e receber", cobrancas: "Cobranças", notas: "Notas fiscais", asaas: "Asaas/Pix", bancos: "Bancos e conciliação", compras: "Compras e fornecedores" };
const workspacePreloads = { assistant: loadFamaAiPanel, chat: loadChatWorkspace, finance: loadFinanceWorkspace, invoices: loadFinanceWorkspace, members: loadMembersPanel, platform: loadPlatformCompanies, manual: loadManual, privacy: loadPrivacyCenter, billing: loadBillingCenter, support: loadSupportCenter, settings: loadCompanySettingsPanel };
function preloadWorkspace(section) { void workspacePreloads[section]?.().catch(() => undefined); }
const navGroups = [
    {
        id: "primary",
        label: "Principal",
        items: [
            { id: "dashboard", label: "Início", icon: LayoutDashboard },
            { id: "agenda", label: "Agenda", icon: CalendarDays },
            { id: "customers", label: "Clientes", icon: UsersRound },
            { id: "quotes", label: "Orçamentos", icon: FileText },
            { id: "orders", label: "Serviços", icon: ClipboardCheck },
            { id: "finance", label: "Financeiro", icon: CircleDollarSign },
        ],
    },
    {
        id: "management",
        label: "Gestão",
        collapsible: true,
        icon: Gauge,
        items: [
            { id: "management", label: "Gestão geral", icon: Gauge },
            { id: "crm", label: "CRM de vendas", icon: TrendingUp },
            { id: "contracts", label: "Contratos", icon: FileSignature },
            { id: "warranties", label: "Garantias", icon: ShieldCheck },
            { id: "inventory", label: "Estoque", icon: Boxes },
            { id: "team", label: "Equipe", icon: BriefcaseBusiness },
            { id: "invoices", label: "Notas fiscais", icon: FileText },
        ],
    },
    {
        id: "tools",
        label: "Ferramentas",
        collapsible: true,
        icon: Wrench,
        items: [
            { id: "planning", label: "Planejamento e rotas", icon: MapPin },
            { id: "assistant", label: "Fama IA", icon: Sparkles },
            { id: "chat", label: "Chat da equipe", icon: MessageCircle },
            { id: "consultation", label: "Consulta CNPJ e CEP", icon: Search },
            { id: "mobile", label: "Modo técnico", icon: Smartphone },
        ],
    },
];
const sectionMeta = {
    planning: { eyebrow: "Clima, CEP e deslocamento", title: "Planejamento" },
    management: { eyebrow: "Indicadores e pipeline", title: "Gestão geral" },
    assistant: { eyebrow: "Assistente de gestão", title: "Fama IA" },
    chat: { eyebrow: "Comunicação da equipe", title: "Chat" },
    dashboard: { eyebrow: "Operação ao vivo", title: "Central operacional", entity: "quotes", action: "Novo orçamento" },
    crm: { eyebrow: "Relacionamento comercial", title: "CRM de vendas", entity: "leads", action: "Novo lead" },
    quotes: { eyebrow: "Propostas e aprovações", title: "Orçamentos", entity: "quotes", action: "Novo orçamento" },
    agenda: { eyebrow: "Rotas e compromissos", title: "Agenda", entity: "appointments", action: "Agendar visita" },
    orders: { eyebrow: "Execução em campo", title: "Ordens de serviço", entity: "workOrders", action: "Nova ordem" },
    warranties: { eyebrow: "Pós-venda e cobertura", title: "Garantias", entity: "warranties", action: "Nova garantia" },
    consultation: { eyebrow: "CNPJ, CEP e frete", title: "Consulta" },
    customers: { eyebrow: "Carteira e histórico", title: "Clientes e piscinas", entity: "customers", action: "Novo cliente" },
    contracts: { eyebrow: "Acordos recorrentes", title: "Contratos", entity: "contracts", action: "Novo contrato" },
    inventory: { eyebrow: "Produtos e equipamentos", title: "Estoque", entity: "inventory", action: "Novo item" },
    finance: { eyebrow: "Receitas e despesas", title: "Financeiro", entity: "transactions", action: "Novo lançamento" },
    invoices: { eyebrow: "Emissão e documentos", title: "Notas fiscais" },
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
function defaultSectionFor(organization) {
    if (canOpenSectionFor(organization, "dashboard", false))
        return "dashboard";
    const firstAllowed = navGroups.flatMap((group) => group.items)
        .find((item) => canOpenSectionFor(organization, item.id, false));
    return firstAllowed?.id ?? "manual";
}
function canOpenSectionFor(organization, section, isPlatformAdmin) {
    const feature = section === "planning" ? "agenda" : section === "management" ? "dashboard" : section === "consultation" ? "customers" : section;
    if (!["manual", "privacy", "support", "members", "billing", "settings", "platform"].includes(section) && !planIncludesFeature(organization.plan, feature, organization.planFeatures))
        return false;
    if (section === "planning")
        return hasFeaturePermission(organization.role, organization.permissions, "agenda", organization.moduleAccess);
    if (section === "management")
        return hasFeaturePermission(organization.role, organization.permissions, "dashboard", organization.moduleAccess);
    if (section === "consultation")
        return hasFeaturePermission(organization.role, organization.permissions, "customers", organization.moduleAccess);
    if (section === "assistant")
        return hasBlockAccess(organization.moduleAccess, "assistant");
    if (section === "manual" || section === "privacy")
        return true;
    if (section === "support")
        return true;
    if (section === "members")
        return organization.role === "owner" || organization.role === "admin";
    if (section === "billing")
        return organization.role === "owner" || organization.role === "admin";
    if (section === "settings")
        return organization.role === "owner" || organization.role === "admin";
    if (section === "mobile")
        return hasFeaturePermission(organization.role, organization.permissions, "mobile", organization.moduleAccess);
    if (section === "platform")
        return isPlatformAdmin;
    if (section === "invoices")
        return hasFeaturePermission(organization.role, organization.permissions, "finance", organization.moduleAccess);
    return hasFeaturePermission(organization.role, organization.permissions, section, organization.moduleAccess);
}
export function workspaceNavigationGroupsFor(organization, isPlatformAdmin = false) {
    return [...navGroups, { id: "account", label: "Configurações e ajuda", collapsible: true, icon: Settings2, items: [
        { id: "billing", label: "Planos e pagamentos", icon: BadgeDollarSign },
        { id: "settings", label: "Configurações da empresa", icon: Settings2 },
        { id: "members", label: "Usuários e empresas", icon: UsersRound },
        { id: "support", label: "Suporte", icon: MessageCircle },
        { id: "privacy", label: "Privacidade e segurança", icon: LockKeyhole },
        { id: "manual", label: "Manual de uso", icon: BookOpenCheck },
    ] }].map(group => ({ ...group, items: group.items.filter(item => canOpenSectionFor(organization, item.id, isPlatformAdmin)) })).filter(group => group.items.length);
}
function pruneDataForAccess(current, organization) {
    const allowed = (entity) => hasFeaturePermission(organization.role, organization.permissions, entityPermissions[entity], organization.moduleAccess);
    const next = {
        leads: allowed("leads") ? current.leads : current.leads.length ? [] : current.leads,
        quotes: allowed("quotes") ? current.quotes : current.quotes.length ? [] : current.quotes,
        appointments: allowed("appointments") ? current.appointments : current.appointments.length ? [] : current.appointments,
        workOrders: allowed("workOrders") ? current.workOrders : current.workOrders.length ? [] : current.workOrders,
        customers: allowed("customers") ? current.customers : current.customers.length ? [] : current.customers,
        inventory: allowed("inventory") ? current.inventory : current.inventory.length ? [] : current.inventory,
        transactions: allowed("transactions") ? current.transactions : current.transactions.length ? [] : current.transactions,
        employees: allowed("employees") ? current.employees : current.employees.length ? [] : current.employees,
        warranties: allowed("warranties") ? current.warranties : current.warranties.length ? [] : current.warranties,
        contracts: allowed("contracts") ? current.contracts : current.contracts.length ? [] : current.contracts,
    };
    return Object.keys(next).every(entity => next[entity] === current[entity]) ? current : next;
}
const leadStages = [
    { id: "novo", label: "Novo lead" },
    { id: "contato", label: "Primeiro contato" },
    { id: "visita", label: "Visita marcada" },
    { id: "proposta", label: "Orçamento enviado" },
    { id: "negociacao", label: "Negociação" },
    { id: "ganho", label: "Fechado" },
    { id: "perdido", label: "Perdido" },
];
const quoteLabels = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };
const appointmentLabels = { agendado: "Agendado", em_rota: "Em rota", concluido: "Executado", remarcado: "Remarcado", cancelado: "Cancelado" };
const orderLabels = { aberta: "Aberta", em_execucao: "Em execução", concluida: "Concluída" };
const transactionLabels = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" };
const warrantyLabels = { ativa: "Ativa", agendada: "Atendimento agendado", concluida: "Concluída", expirada: "Expirada" };
const contractLabels = { rascunho: "Rascunho", ativo: "Ativo", suspenso: "Suspenso", encerrado: "Encerrado" };
function money(cents) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}
function parsedDate(value) {
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value);
}
function shortDate(value) {
    if (!value)
        return "Sem data";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(parsedDate(value));
}
function fullDate(value) {
    if (!value)
        return "Sem data";
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(parsedDate(value));
}
function time(value) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(parsedDate(value));
}
function todayLabel() {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
}
function dayKey(value) {
    const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(new Date(value));
    const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
}
function daysFromToday(value) {
    if (!value)
        return Number.POSITIVE_INFINITY;
    const today = new Date(`${dayKey(new Date())}T12:00:00-03:00`).getTime();
    const target = parsedDate(value).getTime();
    return Math.ceil((target - today) / 86400000);
}
function isBillingBlocked(organization, now = Date.now()) {
    return isPlanAccessBlocked(organization.planStatus, organization.planExpiresAt, organization.billingEnabled, organization.blockOnExpiry, now);
}
function shareText(text) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
}
function unpackNotes(value) {
    try {
        const parsed = JSON.parse(value);
        return { text: parsed.text ?? "", details: parsed.details ?? {} };
    }
    catch {
        return { text: value || "", details: {} };
    }
}
function workOrderCompletion(value) {
    const encoded = unpackNotes(value).details.completionReport;
    if (!encoded)
        return null;
    try {
        return JSON.parse(encoded);
    }
    catch {
        return null;
    }
}
function quoteProductsSummary(value) {
    try {
        const items = JSON.parse(value);
        if (Array.isArray(items))
            return items.map((item) => `${item.name ?? "Item"} · ${Number(item.quantity ?? 0).toLocaleString("pt-BR")} ${item.unit ?? ""} · ${money(Number(item.totalCents ?? 0))}`).join("  |  ");
    }
    catch { /* Older quotes contain plain text. */ }
    return value || "Não informado";
}
const detailLabels = {
    executionStartedAt: "Início da execução", sourceQuoteNumber: "Orçamento de origem", frequency: "Frequência", duration: "Tempo estimado", routeOrder: "Ordem da rota", products: "Produtos previstos", travel: "Deslocamento", urgency: "Urgência", paymentTerms: "Pagamento",
    calciumHardness: "Dureza cálcica", stabilizer: "Estabilizante", waterAppearance: "Aspecto da água", productCost: "Custo de produtos", laborCost: "Custo da mão de obra", travelCost: "Custo de deslocamento", checklist: "Checklist executado",
    poolShape: "Formato", filterType: "Filtro", pump: "Bomba", problemHistory: "Histórico de problemas", billingDay: "Dia de cobrança", responsible: "Responsável", clientDocument: "CPF/CNPJ",
};
function StructuredNotes({ value }) {
    const notes = unpackNotes(value);
    return <><DetailGrid items={Object.entries(notes.details).filter(([key]) => !["completionReport", "sourceQuoteId", "convertedWorkOrderId", "executionStartedBy"].includes(key)).map(([key, item]) => [detailLabels[key] ?? key, key === "clientDocument" ? formatTaxDocument(item) : key === "executionStartedAt" ? fullDate(item) : item])}/>{notes.text && <DetailBlock label="Observações">{notes.text}</DetailBlock>}{workOrderCompletion(value)?.checklist && <DetailBlock label="Checklist executado">{checklistSummary(workOrderCompletion(value).checklist) || "Nenhum item marcado."}</DetailBlock>}{workOrderCompletion(value)?.signature && <DetailBlock label="Assinatura registrada"><img src={workOrderCompletion(value).signature} alt="Assinatura do cliente no atendimento" style={{ maxWidth: "100%", background: "white", borderRadius: 8 }}/></DetailBlock>}</>;
}
function initials(name) {
    return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toLocaleUpperCase("pt-BR") || "FP";
}
function formatTaxDocument(value) { return formatRegistrationDocument(value); }
function documentDigits(value) { return taxDocumentCode(value); }
function BrandMark() {
    return <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt=""/></span>;
}
function StatusBadge({ value, labels }) {
    return <Badge className={`status status-${value}`}>{labels[value] ?? value}</Badge>;
}
function Metric({ icon: Icon, label, value, helper, tone, style }) {
    return <article className="metric-card" data-tone={tone} style={style}><span className={`metric-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong><small>{helper}</small></div></article>;
}
function Empty({ children }) {
    return <div className="empty-state"><Droplets /><p>{children}</p></div>;
}
export function FamaSystemApp({ organizations, currentUser, signOutPath }) {
    useAccountSession(currentUser.id);
    const [activeOrganizationId, setActiveOrganizationId] = useState(organizations[0].id);
    const [data, setData] = useState(emptyData);
    const [loadedDataScope, setLoadedDataScope] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dataLoadError, setDataLoadError] = useState("");
    const [online, setOnline] = useState(true);
    const [syncingOffline, setSyncingOffline] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [moduleQueries, setModuleQueries] = useState({});
    const [createEntity, setCreateEntity] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [savingRecord, setSavingRecord] = useState(false);
    const [assistantDraft, setAssistantDraft] = useState(null);
    useEffect(() => { if (!createEntity) setEditingRecord(null); }, [createEntity]);
    const [financeEntryType, setFinanceEntryType] = useState("receita");
    const [initialQuoteSelection, setInitialQuoteSelection] = useState(null);
    const [selected, setSelected] = useState(null);
    const [closingOrder, setClosingOrder] = useState(null);
    const [accessOverrides, setAccessOverrides] = useState({});
    const [companySettings, setCompanySettings] = useState(defaultCompanySettings);
    const [billingClock, setBillingClock] = useState(() => Date.now());
    const stockQueue = useRef(Promise.resolve());
    const sourceOrganization = organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0];
    const activeOrganization = useMemo(() => (accessOverrides[sourceOrganization.id]
        ? { ...sourceOrganization, ...accessOverrides[sourceOrganization.id] }
        : sourceOrganization), [accessOverrides, sourceOrganization]);
    const accessKey = `${activeOrganization.plan}:${activeOrganization.role}:${activeOrganization.permissions.join(",")}:${activeOrganization.moduleAccess?.join(",") ?? "legacy"}` + ":" + (activeOrganization.planFeatures?.join(",") ?? "default");
    const dataScope = `${activeOrganization.id}:${accessKey}`;
    const write = useClientMutation(dataScope);
    useEffect(() => {
        let active = true;
        queueMicrotask(() => { if (active) {
            setAssistantDraft(null);
            setEditingRecord(null);
            setClosingOrder(null);
            setCreateEntity(null);
            setSelected(null);
            setInitialQuoteSelection(null);
        } });
        return () => { active = false; };
    }, [dataScope]);
    const canManageAccess = activeOrganization.role === "owner" || activeOrganization.role === "admin";
    const billingBlocked = isBillingBlocked(activeOrganization, billingClock);
    const canDelete = canManageAccess;
    const canAccess = (value) => hasFeaturePermission(activeOrganization.role, activeOrganization.permissions, value, activeOrganization.moduleAccess);
    const canOpenSection = (value) => canOpenSectionFor(activeOrganization, value, currentUser.isPlatformAdmin);
    const allowedSections = Object.keys(sectionMeta).filter(value => canOpenSection(value) && (!billingBlocked || ["billing", "support", "privacy", "manual"].includes(value)));
    const navigation = useWorkspaceNavigation({ scope: `system:${currentUser.id}:${dataScope}`, initial: billingBlocked ? canManageAccess ? "billing" : "support" : defaultSectionFor(activeOrganization), allowed: [...allowedSections, ...(allowedSections.includes("finance") ? financeViews.filter(tab => tab !== "notas" || canOpenSection("invoices")).map(tab => `finance/${tab}`) : [])] });
    const section = (navigation.current === "finance/notas" ? "invoices" : navigation.current.split("/")[0]);
    const lastFinance = section === "finance" ? navigation.current : navigation.history.findLast(view => view.startsWith("finance"));
    const previousFinanceTab = lastFinance?.split("/")[1];
    const financeTab = (previousFinanceTab && previousFinanceTab !== "notas" ? previousFinanceTab : "visao");
    useEffect(() => {
        if (navigation.current === "finance/notas")
            navigation.replace("invoices");
    }, [navigation.current, navigation.replace]);
    const queryKey = `${dataScope}:${section}`;
    const query = moduleQueries[queryKey] ?? "";
    const setQuery = (value) => setModuleQueries(current => ({ ...current, [queryKey]: value }));
    const deferredQuery = useDeferredValue(query);
    const ai = useFamaAiSettings();
    const assistantSources = useMemo(() => systemAssistantSources(activeOrganization.role, activeOrganization.permissions, activeOrganization.moduleAccess), [accessKey]);
    const assistantData = useMemo(() => loadedDataScope === dataScope ? systemAssistantData(data, activeOrganization.role, activeOrganization.permissions, activeOrganization.moduleAccess) : {}, [data, accessKey, loadedDataScope, dataScope]);
    const navigate = (value) => {
        if (billingBlocked && !["billing", "support", "privacy", "manual"].includes(value)) {
            toast.error("O teste grátis terminou. Regularize o pagamento para voltar aos módulos.");
            navigation.replace(canManageAccess ? "billing" : "support");
            return;
        }
        if (!canOpenSection(value)) {
            toast.error("Seu perfil não possui acesso a este módulo.");
            return;
        }
        navigation.navigate(value === "finance" ? `finance/${financeTab}` : value);
    };
    const navigateFinanceTab = (value) => { if (section === "finance")
        navigation.navigate(value === "notas" ? "invoices" : `finance/${value}`); };
    const navigateBack = navigation.back;
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
        queueMicrotask(() => {
            if (!disposed)
                setCompanySettings(defaultCompanySettings);
        });
        const controller = new AbortController();
        requestJson("/api/company-settings", { headers: { "x-organization-id": activeOrganization.id }, cache: "no-store", signal: controller.signal })
            .then((payload) => {
            if (!disposed && payload?.settings)
                setCompanySettings(payload.settings);
        })
            .catch(() => undefined);
        return () => { disposed = true; controller.abort(); };
    }, [activeOrganization.id]);
    useEffect(() => {
        let disposed = false;
        let pending = false;
        let controller = null;
        const refreshAccess = async () => {
            if (disposed || pending || document.hidden || navigator.onLine === false)
                return;
            pending = true;
            controller = new AbortController();
            try {
                const payload = await requestJson("/api/access", {
                    cache: "no-store",
                    headers: { "x-organization-id": sourceOrganization.id },
                    signal: controller.signal,
                }, 12_000);
                if (!payload.access || payload.access.organizationId !== sourceOrganization.id || disposed)
                    return;
                if (payload.access.moduleAccess !== undefined && (!Array.isArray(payload.access.moduleAccess) || payload.access.moduleAccess.some(id => !famaBlocks.some(block => block.id === id))))
                    throw new Error("A lista de blocos recebida é inválida.");
                const nextOrganization = {
                    ...sourceOrganization,
                    role: payload.access.role,
                    permissions: payload.access.permissions,
                    moduleAccess: payload.access.moduleAccess,
                    plan: payload.access.plan,
                    planFeatures: payload.access.planFeatures,
                    planStatus: payload.access.planStatus,
                    planExpiresAt: payload.access.planExpiresAt,
                    billingEnabled: payload.access.billingEnabled,
                    blockOnExpiry: payload.access.blockOnExpiry,
                };
                setAccessOverrides((current) => {
                    const previous = current[sourceOrganization.id] ?? sourceOrganization;
                    if (previous.role === nextOrganization.role
                        && previous.permissions.join(",") === nextOrganization.permissions.join(",")
                        && previous.moduleAccess?.join(",") === nextOrganization.moduleAccess?.join(",")
                        && previous.planFeatures?.join(",") === nextOrganization.planFeatures?.join(",")
                        && previous.plan === nextOrganization.plan && previous.planStatus === nextOrganization.planStatus
                        && previous.planExpiresAt === nextOrganization.planExpiresAt && previous.billingEnabled === nextOrganization.billingEnabled && previous.blockOnExpiry === nextOrganization.blockOnExpiry)
                        return current;
                    return {
                        ...current,
                        [sourceOrganization.id]: {
                            role: nextOrganization.role,
                            permissions: nextOrganization.permissions,
                            moduleAccess: nextOrganization.moduleAccess,
                            plan: nextOrganization.plan,
                            planFeatures: nextOrganization.planFeatures,
                            planStatus: nextOrganization.planStatus,
                            planExpiresAt: nextOrganization.planExpiresAt,
                            billingEnabled: nextOrganization.billingEnabled,
                            blockOnExpiry: nextOrganization.blockOnExpiry,
                        },
                    };
                });
                setBillingClock(Date.now());
                setData((current) => pruneDataForAccess(current, nextOrganization));
            }
            catch (cause) {
                if (!disposed && cause instanceof ClientRequestError && [401, 403].includes(cause.status ?? 0)) {
                    setData(emptyData);
                    setLoadedDataScope(null);
                    window.location.reload();
                }
                // The next foreground refresh retries without interrupting active work.
            }
            finally {
                pending = false;
            }
        };
        const onFocus = () => { void refreshAccess(); };
        void refreshAccess();
        const interval = window.setInterval(refreshAccess, 30_000);
        window.addEventListener("focus", onFocus);
        return () => {
            disposed = true;
            controller?.abort();
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
                setAssistantDraft(null);
            });
            return;
        }
        let disposed = false;
        const controller = new AbortController();
        const cacheKey = `fama-system:offline:${activeOrganization.id}:${currentUser.id}:${accessKey}`;
        if (loadedDataScope !== dataScope) {
            setLoading(true);
            setDataLoadError("");
        }
        requestJson("/api/bootstrap", { headers: { "x-organization-id": activeOrganization.id }, cache: "no-store", signal: controller.signal }, 30_000)
            .then(real => {
            if (disposed)
                return;
            const nextData = parseBootstrapData(real);
            try {
                window.localStorage.setItem(cacheKey, JSON.stringify(nextData));
            }
            catch { /* The live data remains available when storage is full. */ }
            setData(nextData);
            setLoadedDataScope(`${activeOrganization.id}:${accessKey}`);
            setDataLoadError("");
        })
            .catch((cause) => {
            if (disposed)
                return;
            if (cause instanceof ClientRequestError && [401, 403].includes(cause.status ?? 0)) {
                setData(emptyData);
                setLoadedDataScope(null);
                setDataLoadError("O acesso precisa ser verificado novamente. Atualize a página para entrar.");
                return;
            }
            try {
                const stored = window.localStorage.getItem(cacheKey);
                const cached = stored ? parseBootstrapData(JSON.parse(stored)) : null;
                if (cached) {
                    setData(pruneDataForAccess(cached, activeOrganization));
                    setLoadedDataScope(`${activeOrganization.id}:${accessKey}`);
                    setDataLoadError("Conexão interrompida. Exibindo a última atualização salva desta empresa.");
                }
                else {
                    setLoadedDataScope(null);
                    setDataLoadError("Não foi possível carregar os registros. Confira a conexão e tente novamente.");
                }
            }
            catch {
                setLoadedDataScope(null);
                setDataLoadError("Não foi possível carregar os registros. Confira a conexão e tente novamente.");
            }
        })
            .finally(() => { if (!disposed) {
            setLoading(false);
            setSyncingOffline(false);
        } });
        return () => { disposed = true; controller.abort(); };
    }, [activeOrganization, currentUser.id, accessKey, refreshNonce, billingBlocked, canManageAccess]);
    async function refreshOfflineData() {
        if (!online)
            return toast.info("Conecte-se à internet para sincronizar os dados.");
        setSyncingOffline(true);
        setLoading(true);
        setRefreshNonce((value) => value + 1);
    }
    const searchCache = new WeakMap();
    const filter = (items) => {
        const cached = searchCache.get(items);
        if (cached)
            return cached;
        const needle = deferredQuery.trim().toLocaleLowerCase("pt-BR");
        if (!needle)
            return items;
        const documentNeedle = documentDigits(needle);
        const result = items.filter((item) => {
            if (JSON.stringify(item).toLocaleLowerCase("pt-BR").includes(needle))
                return true;
            if (section !== "customers" || documentNeedle.length < 3)
                return false;
            const notes = item.notes;
            return typeof notes === "string" && documentDigits(unpackNotes(notes).details.clientDocument ?? "").includes(documentNeedle);
        });
        searchCache.set(items, result);
        return result;
    };
    const revenue = data.transactions.filter((item) => item.type === "receita" && item.status === "pago").reduce((sum, item) => sum + item.amountCents, 0);
    const receivable = data.transactions.filter((item) => item.type === "receita" && item.status !== "pago").reduce((sum, item) => sum + item.amountCents, 0);
    const payable = data.transactions.filter((item) => item.type === "despesa" && item.status !== "pago").reduce((sum, item) => sum + item.amountCents, 0);
    const salesPipeline = data.leads.filter((item) => !["ganho", "perdido"].includes(item.status)).reduce((sum, item) => sum + item.estimatedValueCents, 0);
    function putRecord(entity, record, mode) {
        setData((current) => {
            const collection = current[entity];
            const next = mode === "create"
                ? [record, ...collection]
                : collection.map((item) => item.id === record.id ? record : item);
            return { ...current, [entity]: next };
        });
        setSelected((current) => current?.entity === entity && current.record.id === record.id ? { entity, record } : current);
    }
    async function patchRecord(entity, record, changes) {
        const payload = await write(`/api/records/${record.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...tenantHeaders },
            body: JSON.stringify({ entity, ...changes, ...(entity === "workOrders" && changes.status === "em_execucao" ? { action: "start" } : {}) }),
        });
        if (!payload)
            return;
        if (!payload.record)
            return toast.error("O sistema não confirmou o registro atualizado. Atualize os registros.");
        putRecord(entity, payload.record, "update");
        toast.success("Registro atualizado.");
    }
    async function adjustStock(record, delta) {
        const organizationId = activeOrganization.id;
        const operation = stockQueue.current.then(async () => {
            try {
                const payload = await write(`/api/records/${record.id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json", "x-organization-id": organizationId },
                    body: JSON.stringify({ entity: "inventory", action: "adjustStock", delta }),
                });
                if (!payload)
                    return false;
                if (!payload.record)
                    throw new Error("Não foi possível confirmar o estoque. Atualize os registros.");
                putRecord("inventory", payload.record, "update");
                toast.success(`${delta > 0 ? "Entrada" : "Saída"} registrada: ${record.name}`);
                return true;
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o estoque.");
                return false;
            }
        });
        stockQueue.current = operation;
        return operation;
    }
    async function convertQuote(quote) {
        try {
            const payload = await write(`/api/quotes/${quote.id}/convert`, { method: "POST", headers: { "Content-Type": "application/json", ...tenantHeaders }, body: "{}" });
            if (!payload)
                return;
            if (!payload.workOrder)
                throw new Error("Não foi possível confirmar a ordem de serviço. Atualize os registros.");
            if (!data.workOrders.some((item) => item.id === payload.workOrder?.id))
                putRecord("workOrders", payload.workOrder, "create");
            toast.success("Ordem de serviço criada a partir do orçamento aprovado.");
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível criar a ordem de serviço.");
        }
    }
    async function completeWorkOrder(event) {
        event.preventDefault();
        if (!closingOrder)
            return;
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form).entries());
        const payload = await write(`/api/records/${closingOrder.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...tenantHeaders },
            body: JSON.stringify({ entity: "workOrders", action: "complete", completionReport: { signature: values.signature, ph: values.ph, chlorine: values.chlorine, alkalinity: values.alkalinity, productsUsed: values.productsUsed, productCost: values.productCost, laborCost: values.laborCost, travelCost: values.travelCost, summary: values.summary, customerName: values.customerName, confirmed: values.confirmed === "on", checklist: Object.fromEntries(serviceChecklist.flatMap(item => item.keys.map(key => [key, values[item.name] === "on"]))) } }),
        });
        if (!payload)
            return;
        if (!payload.record) {
            toast.error("Não foi possível confirmar a conclusão. Atualize os registros.");
            return;
        }
        putRecord("workOrders", payload.record, "update");
        setClosingOrder(null);
        toast.success("Ordem concluída e relatório técnico registrado.");
    }
    async function rescheduleAppointment(record, suggested) {
        const current = `${dayKey(record.startAt)}T${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(parsedDate(record.startAt))}`;
        const next = suggested ?? window.prompt("Nova data e hora (AAAA-MM-DDTHH:MM)", current);
        if (!next || next === current)
            return;
        await patchRecord("appointments", record, { action: "reschedule", startAt: next });
    }
    function openEdit(entity, record) {
        if (!canAccess(entityPermissions[entity]) || billingBlocked) return;
        if (entity === "workOrders" && record.status === "concluida") {
            toast.info("O relatório assinado deste serviço já foi concluído.");
            return;
        }
        setSelected(null);
        setEditingRecord({ entity, record });
        setInitialQuoteSelection(null);
        setAssistantDraft({ entity, fields: recordEditFields(entity, record) });
        setCreateEntity(entity);
    }
    async function createRecord(event) {
        event.preventDefault();
        if (!createEntity)
            return;
        const body = Object.fromEntries(new FormData(event.currentTarget).entries());
        if (createEntity === "quotes" && (!editingRecord || initialQuoteHasItems(editingRecord.record))) {
            try {
                const items = JSON.parse(String(body.poolItems ?? "[]"));
                if (!items.length)
                    return toast.error("Adicione pelo menos um item ao orçamento.");
            }
            catch {
                return toast.error("Confira os itens adicionados ao orçamento.");
            }
        }
        if (savingRecord) return;
        setSavingRecord(true);
        const editing = editingRecord?.entity === createEntity ? editingRecord : null;
        const payload = await write(editing ? `/api/records/${editing.record.id}` : "/api/records", {
            method: editing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json", ...tenantHeaders },
            body: JSON.stringify({ entity: createEntity, ...body, ...(editing ? { action: "edit", expected: editing.record } : {}) }),
        });
        setSavingRecord(false);
        if (!payload) return;
        if (!payload.record) return toast.error("Não foi possível confirmar o registro. Atualize os registros.");
        putRecord(createEntity, payload.record, editing ? "update" : "create");
        setEditingRecord(null);
        setCreateEntity(null);
        setAssistantDraft(null);
        toast.success("Registro salvo com sucesso.");
    }
    async function scheduleWarranty(warranty, scheduledAt, technician) {
        const payload = await write(`/api/warranties/${warranty.id}/schedule`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...tenantHeaders },
            body: JSON.stringify({ scheduledAt, technician }),
        });
        if (!payload?.warranty || !payload.appointment)
            throw new Error("Não foi possível confirmar o agendamento. Atualize os registros.");
        putRecord("warranties", payload.warranty, "update");
        putRecord("appointments", payload.appointment, "create");
    }
    async function deleteRecord(entity, record) {
        const payload = await write(`/api/records/${record.id}?entity=${entity}`, { method: "DELETE", headers: tenantHeaders });
        if (!payload)
            throw new Error("Não foi possível confirmar a exclusão.");
        setData((current) => ({
            ...current,
            [entity]: current[entity].filter((item) => item.id !== record.id),
            appointments: payload.relatedAppointmentId
                ? current.appointments.filter((item) => item.id !== payload.relatedAppointmentId)
                : current.appointments,
        }));
        setSelected((current) => current?.record.id === record.id ? null : current);
        toast.success("Registro excluído.");
    }
    const title = sectionMeta[section];
    const ActiveModuleIcon = navGroups.flatMap(group => group.items).find(item => item.id === section)?.icon ?? LayoutDashboard;
    return <FamaLocalAiProvider key={dataScope} prepareOnOpen={Boolean(ai.value?.settings.enabled) && !billingBlocked && canOpenSection("assistant")}><SidebarProvider style={{ "--sidebar-width": "260px", "--sidebar-width-icon": "72px" }}>
    {!billingBlocked && <IntegrationTelemetry key={dataScope} organizationId={activeOrganization.id} />}
    <Sidebar collapsible="icon" className="main-sidebar">
      <SidebarHeader className="sidebar-brand"><BrandMark /><div><strong>Fama System</strong><small>Gestão para piscinas</small></div></SidebarHeader>
      <SidebarContent className="workspace-navigation-content">
        <WorkspaceNavigationMenu key={dataScope} section={section} onNavigate={navigate} onPreload={preloadWorkspace} groups={workspaceNavigationGroupsFor(activeOrganization, currentUser.isPlatformAdmin)}/>
      </SidebarContent>
      <SidebarFooter className="sidebar-accounts-footer"><AccountSwitcher sidebar currentUser={currentUser} companyName={activeOrganization.name} roleLabel={activeOrganization.role === "owner" ? "Proprietário" : activeOrganization.role === "admin" ? "Administrador" : activeOrganization.role === "technician" ? "Técnico" : "Colaborador"} signOutPath={signOutPath}/></SidebarFooter>
    </Sidebar>

    <SidebarInset className="application ops-application" data-workspace-section={section}>
      <header className="topbar"><div className="ops-mobile-brand"><BrandMark /><span>FAMA <small>SYSTEM</small></span></div>
        <div className="heading"><SidebarTrigger><Menu /></SidebarTrigger><Button className="back-navigation" variant="outline" size="sm" onClick={navigateBack} disabled={!navigation.canBack} aria-label="Voltar para a aba anterior"><ArrowLeft /><span>Voltar</span></Button><div><small>{title.eyebrow}</small><span className="workspace-breadcrumb">{title.title}</span>{section === "finance" && <span className="workspace-subpage">{financeViewNames[financeTab]}</span>}</div></div>
        <div className="top-actions"><NativeSelect className={`company-switcher ${organizations.length === 1 ? "single-company" : ""}`} value={activeOrganization.id} onChange={(event) => { setLoading(true); setData(emptyData); setLoadedDataScope(null); setSelected(null); setCreateEntity(null); setAssistantDraft(null); setActiveOrganizationId(event.target.value); }} aria-label="Empresa ativa">{organizations.map((organization) => <NativeSelectOption key={organization.id} value={organization.id}>{organization.name}</NativeSelectOption>)}</NativeSelect>{["crm", "quotes", "agenda", "orders", "warranties", "contracts", "inventory", "finance", "team"].includes(section) && !billingBlocked && <div className="global-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar neste módulo" aria-label="Buscar neste módulo"/></div>}{!billingBlocked && <WorkspaceTools organizationId={activeOrganization.id} key={`${currentUser.id}:${activeOrganization.id}`} scope={`${currentUser.id}:${activeOrganization.id}`} data={data} lowStock={companySettings.lowStockAlert} allowed={Object.keys(sectionMeta).filter(target => canOpenSection(target))} onSelect={item => setSelected({ entity: item.entity, record: item.record })}/>}{!billingBlocked && canOpenSection("chat") && <InternalChatIndicator key={`${currentUser.id}:${dataScope}`} organizationId={activeOrganization.id} onOpen={() => navigate("chat")}/>}<SupportIndicator key={dataScope + ":support"} organizationId={activeOrganization.id} scope={currentUser.id + ":" + activeOrganization.id} open={section === "support"} onOpen={() => navigate("support")}/><AccountSwitcher currentUser={currentUser}/><ThemeToggle /><Button variant="outline" size="icon" asChild aria-label="Sair"><a href={signOutPath} target="_top"><LogOut /></a></Button></div>
      </header>

      <main className="workspace">
        <PlanAnnouncement key={dataScope} organizationId={activeOrganization.id} scope={currentUser.id + ":" + activeOrganization.id}/>
        <section className="workspace-intro" aria-label="Cabeçalho do módulo"><span className="workspace-module-symbol" aria-hidden="true"><ActiveModuleIcon /></span><div className="workspace-intro-copy"><span className="workspace-kicker">{activeOrganization.name}</span><h1>{title.title}</h1><p>{{ management: 'Indicadores coloridos e gráficos personalizados para acompanhar sua empresa.', dashboard: canOpenSection('finance') ? 'Mapa da operação, financeiro, agenda e prioridades no mesmo painel.' : 'Mapa da operação, agenda e prioridades no mesmo painel.', customers: 'Relacionamentos, contatos e piscinas em um cadastro completo.', crm: 'Acompanhe cada oportunidade até o fechamento.', quotes: 'Prepare propostas e acompanhe suas aprovações.', planning: 'Mapa, clima, CEP, deslocamento e semana com IA em um só lugar.', agenda: 'Organize visitas, equipes e atendimentos.', orders: 'Controle a execução e o histórico de cada serviço.', finance: 'Acompanhe saldos, movimentações e cobranças.', invoices: 'Emissão e acompanhamento das notas fiscais.', inventory: 'Controle produtos, quantidades e reposições.', contracts: 'Organize contratos e planos de atendimento.', warranties: 'Acompanhe prazos e atendimentos em garantia.', settings: 'Personalize a operação da sua empresa.', members: 'Gerencie sua equipe e suas permissões.', team: 'Sua equipe e a distribuição dos atendimentos.', consultation: 'Consulte CNPJ e CEP sem criar cadastros.', chat: 'Comunicação interna entre administração, técnicos e equipe.', assistant: 'Assistência integrada à sua operação.', billing: 'Seu plano, pagamentos e acesso à plataforma.', support: 'Acompanhe suas solicitações de suporte.', privacy: 'Controle seus dados e as opções de segurança.', manual: 'Orientações para usar cada recurso.', mobile: 'Atendimentos e serviços na palma da mão.' }[section] || 'Gerencie sua operação com clareza.'}</p></div><div className="workspace-intro-actions">{title.entity && !billingBlocked && <Button onClick={() => setCreateEntity(title.entity)}><Plus />{title.action}</Button>}</div></section>
        {dataLoadError && <div className="empty-state" role="status"><p>{dataLoadError}</p><Button variant="outline" disabled={loading || syncingOffline} onClick={() => void refreshOfflineData()}>Tentar carregar novamente</Button></div>}
        {!billingBlocked && section === "assistant" && canOpenSection("assistant") && <FamaAiStartup data={assistantData} settings={ai.value?.settings ?? null} allowedSources={assistantSources} scopeLabel={activeOrganization.name} loading={loading || loadedDataScope !== dataScope} error={(!ai.value ? ai.error : loadedDataScope !== dataScope ? dataLoadError : undefined) || undefined} onNavigate={source => navigate(source === "overview" ? "dashboard" : source)}/>}
        {!billingBlocked && (loading || loadedDataScope !== dataScope) && ["dashboard", "planning", "crm", "quotes", "agenda", "orders", "warranties", "customers", "contracts", "inventory", "finance", "invoices", "team", "mobile"].includes(section) ? loading ? <div className="loading"><i /><p>Preparando sua operação…</p></div> : <div className="empty-state"><p>Os registros desta empresa ainda não estão disponíveis. Tente carregar novamente.</p></div> : <WorkspaceView key={`${dataScope}:${section}`} viewKey={navigation.current} label={title.title} restoreScroll={navigation.restoreScroll}>
          {billingBlocked && section !== "billing" && section !== "support" && section !== "privacy" && section !== "manual" && <BillingBlocked canManageAccess={canManageAccess} onBilling={() => navigate("billing")}/>}
          {!billingBlocked && section === "assistant" && canOpenSection("assistant") && <>
            {loadedDataScope !== dataScope ? <div className="empty-state"><p>{loading ? "Carregando os registros da empresa selecionada…" : "A assistente precisa dos registros da empresa selecionada."}</p><Button variant="outline" disabled={loading} onClick={() => setRefreshNonce(value => value + 1)}>Carregar registros</Button></div> : ai.value ?
                    <FamaAiPanel conversationScope={`${currentUser.id}:${dataScope}`} key={`${currentUser.id}:${dataScope}:${ai.value.revision}`} data={assistantData} settings={ai.value.settings} scopeLabel={activeOrganization.name} organizationId={activeOrganization.id} allowedSources={assistantSources} allowedSections={Object.keys(sectionMeta).filter(target => canOpenSection(target))} onAction={action => {
                            if (!Object.hasOwn(sectionMeta, action.section) || !canOpenSection(action.section))
                                return toast.error("Seu perfil não possui acesso a este módulo.");
                            if (billingBlocked || !ai.value?.settings.enabled)
                                return;
                            if (action.create) {
                                if (!ai.value.settings.allowCreate || !canAccess(entityPermissions[action.create]))
                                    return;
                                const draft = action.draft ? sanitizeAssistantDraft(action.draft) : null;
                                if (action.draft && (!draft || draft.entity !== action.create))
                                    return;
                                setAssistantDraft(draft);
                                if (action.create === "quotes")
                                    setInitialQuoteSelection(null);
                                if (action.create === "transactions")
                                    setFinanceEntryType(draft?.fields.type === "despesa" ? "despesa" : "receita");
                                setCreateEntity(action.create);
                            }
                            else if (ai.value.settings.allowNavigation && action.record) {
                                const entity = action.record.entity;
                                if (!Object.hasOwn(entityPermissions, entity) || !canAccess(entityPermissions[entity]))
                                    return;
                                const record = data[entity].find(item => item.id === action.record.id);
                                if (!record)
                                    return toast.error("O registro precisa ser atualizado antes de abrir.");
                                setSelected({ entity, record });
                            }
                            else if (ai.value.settings.allowNavigation)
                                navigate(action.section);
                        }}/> : <div className="empty-state"><p>{ai.error || "Carregando a configuração da assistente…"}</p>{ai.error && <Button variant="outline" onClick={() => void ai.refresh().catch(() => undefined)}>Tentar novamente</Button>}</div>}
          </>}
          {!billingBlocked && section === "dashboard" && canOpenSection("dashboard") && <Dashboard key={`${currentUser.id}:${dataScope}`} scope={`${currentUser.id}:${activeOrganization.id}`} organizationId={activeOrganization.id} plan={activeOrganization.plan} planFeatures={activeOrganization.planFeatures} onUpgrade={canManageAccess ? () => navigate("billing") : undefined} allowed={Object.keys(sectionMeta).filter(target => canOpenSection(target))} data={data} settings={companySettings} revenue={revenue} receivable={receivable} payable={payable} salesPipeline={salesPipeline} onSelect={setSelected} onNavigate={navigate} onFinanceTab={tab => { if (canOpenSection("finance"))
            navigation.navigate(`finance/${tab}`); }} onConfigureFreight={canOpenSection("settings") ? () => navigate("settings") : undefined}/>}
          {!billingBlocked && section === "management" && canOpenSection("management") && <GeneralManagement key={dataScope} scope={`${currentUser.id}:${activeOrganization.id}`} data={data} lowStockAlert={companySettings.lowStockAlert} allowed={['crm', 'quotes', 'agenda', 'orders', 'finance', 'customers', 'inventory'].filter(target => canOpenSection(target))} onNavigate={target => navigate(target)}/>}
          {!billingBlocked && section === "chat" && canOpenSection("chat") && <ChatWorkspace key={`${currentUser.id}:${dataScope}`} organizationId={activeOrganization.id} canManage={canManageAccess}/>}
          {!billingBlocked && section === "crm" && canOpenSection("crm") && <Crm onEdit={record => openEdit("leads", record)} leads={filter(data.leads)} onSelect={(record) => setSelected({ entity: "leads", record })} onMove={(record, status) => patchRecord("leads", record, { status })} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "quotes" && canOpenSection("quotes") && <Quotes onEdit={record => openEdit("quotes", record)} key={activeOrganization.id} organizationId={activeOrganization.id} quotes={filter(data.quotes)} organizationName={activeOrganization.name} canManageCatalog={canManageAccess} onCreateProject={(selection) => { setInitialQuoteSelection(selection); setCreateEntity("quotes"); }} onCreate={() => { setInitialQuoteSelection(null); setCreateEntity("quotes"); }} onSelect={(record) => setSelected({ entity: "quotes", record })} onStatus={(record, status) => patchRecord("quotes", record, { status })} onConvert={convertQuote} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "planning" && canOpenSection("planning") && <PlanningWorkspace key={dataScope} organizationId={activeOrganization.id} appointments={data.appointments} employees={data.employees} plan={activeOrganization.plan} planFeatures={activeOrganization.planFeatures} canConsult={canOpenSection("consultation")} canConfigure={canOpenSection("settings")} onConfigure={canOpenSection("settings") ? () => navigate("settings") : undefined} onUpgrade={canManageAccess ? () => navigate("billing") : undefined} onOpen={record => setSelected({ entity: "appointments", record })} onAgenda={() => navigate("agenda")}/>}
          {!billingBlocked && section === "agenda" && canOpenSection("agenda") && <Agenda onEdit={record => openEdit("appointments", record)} onPlanning={() => navigate("planning")} organizationId={activeOrganization.id} appointments={filter(data.appointments)} employees={data.employees} onSelect={(record) => setSelected({ entity: "appointments", record })} onStatus={(record, status) => patchRecord("appointments", record, { status })} onReschedule={rescheduleAppointment} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "orders" && canOpenSection("orders") && <Orders onEdit={record => openEdit("workOrders", record)} orders={filter(data.workOrders)} onSelect={(record) => setSelected({ entity: "workOrders", record })} onStatus={(record, status) => status === "concluida" ? setClosingOrder(record) : void patchRecord("workOrders", record, { status })} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "warranties" && canOpenSection("warranties") && <Warranties onEdit={record => openEdit("warranties", record)} warranties={filter(data.warranties)} employees={data.employees} onSelect={(record) => setSelected({ entity: "warranties", record })} onStatus={(record, status) => patchRecord("warranties", record, { status })} onSchedule={scheduleWarranty} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "consultation" && canOpenSection("consultation") && <ConsultationWorkspace mode={canOpenSection("planning") ? "lookup" : "all"} key={dataScope} organizationId={activeOrganization.id} plan={activeOrganization.plan} planFeatures={activeOrganization.planFeatures} onUpgrade={canManageAccess ? () => navigate("billing") : undefined} onConfigure={canOpenSection("settings") ? () => navigate("settings") : undefined}/>}
          {!billingBlocked && section === "customers" && canOpenSection("customers") && <Customers onEdit={record => openEdit("customers", record)} customers={data.customers} query={query} onQueryChange={setQuery} onSelect={(record) => setSelected({ entity: "customers", record })} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "contracts" && canOpenSection("contracts") && <Contracts onEdit={record => openEdit("contracts", record)} contracts={filter(data.contracts)} organizationId={activeOrganization.id} onSelect={(record) => setSelected({ entity: "contracts", record })} onStatus={(record, status) => patchRecord("contracts", record, { status })} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "inventory" && canOpenSection("inventory") && <Inventory onEdit={record => openEdit("inventory", record)} items={filter(data.inventory)} lowStockAlert={companySettings.lowStockAlert} onSelect={(record) => setSelected({ entity: "inventory", record })} onAdjust={adjustStock} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "finance" && canOpenSection("finance") && canOpenSection("orders") && <ServiceProfitPanel key={dataScope} orders={filter(data.workOrders)} organizationId={activeOrganization.id} onSaved={record => putRecord("workOrders", record, "update")}/>}
          {!billingBlocked && (section === "finance" || section === "invoices") && canOpenSection(section) && <FinanceWorkspace onEdit={record => openEdit("transactions", record)} key={`${dataScope}:${section}`} invoicesEnabled={planIncludesFeature(activeOrganization.plan, "invoices", activeOrganization.planFeatures)} fiscalOnly={section === "invoices"} onFiscalSettings={canManageAccess ? () => navigate("settings") : undefined} onAssistant={canOpenSection("assistant") ? () => navigate("assistant") : undefined} organizationId={activeOrganization.id} transactions={filter(data.transactions)} quotes={filter(data.quotes)} tab={section === "invoices" ? "notas" : financeTab} onTabChange={navigateFinanceTab} onStatus={(record, status) => patchRecord("transactions", record, { status })} onSelect={(record) => setSelected({ entity: "transactions", record })} onOpenEntry={(type) => { setFinanceEntryType(type); setCreateEntity("transactions"); }} onReconciled={(transactionId, created) => setData((current) => ({ ...current, transactions: current.transactions.some((item) => item.id === transactionId) ? current.transactions.map((item) => item.id === transactionId ? { ...item, status: "pago" } : item) : created ? [created, ...current.transactions] : current.transactions }))} onPurchasePayable={(record) => setData((current) => ({ ...current, transactions: [record, ...current.transactions] }))}/>}
          {!billingBlocked && section === "team" && canOpenSection("team") && <Team onEdit={record => openEdit("employees", record)} appointments={data.appointments} employees={filter(data.employees)} onSelect={(record) => setSelected({ entity: "employees", record })} onDelete={canDelete ? deleteRecord : undefined}/>}
          {!billingBlocked && section === "mobile" && canOpenSection("mobile") && <TechnicianMobile onOpenOrder={record => setSelected({ entity: "workOrders", record })} onCompleteOrder={record => setClosingOrder(record)} appointments={data.appointments} orders={data.workOrders} onAppointmentStatus={(record, status) => patchRecord("appointments", record, { status })} onOrderStatus={(record, status) => status === "concluida" ? setClosingOrder(record) : void patchRecord("workOrders", record, { status })}/>}
          {section === "manual" && <Manual />}
          {section === "privacy" && <PrivacyCenter organization={activeOrganization}/>}
          {section === "support" && <SupportCenter organization={activeOrganization}/>}
          {section === "billing" && canManageAccess && <BillingCenter organization={activeOrganization} currentUser={currentUser}/>}
          {section === "settings" && canManageAccess && <CompanySettingsPanel organization={activeOrganization}/>}
          {!billingBlocked && section === "members" && canManageAccess && <MembersPanel organization={activeOrganization}/>}
          {!billingBlocked && section === "platform" && currentUser.isPlatformAdmin && <PlatformCompanies />}
        </WorkspaceView>}
        {!online && <div className="offline-banner"><WifiOff /><span>Sem conexão. O sistema está mostrando a última atualização salva.</span><Button size="sm" variant="outline" onClick={() => void refreshOfflineData()} disabled={syncingOffline}><RefreshCw />Tentar sincronizar</Button></div>}
      </main>
      <footer className="app-footer">
        <span>Fama System · v{FAMA_VERSION} · Versão final</span>
        <a href="/manual" target="_blank" rel="noreferrer">Manual completo</a>
      </footer>
      {!billingBlocked && <WorkspaceMobileDock section={section} allowed={Object.keys(sectionMeta).filter(target => canOpenSection(target))} onNavigate={navigate} onCreate={entity => setCreateEntity(entity)}/>}
    </SidebarInset>

    <WorkspaceView label="formulário">
    <CreateDialog editingRecord={editingRecord} savingRecord={savingRecord} canManageCosts={canOpenSection("finance")} organizationId={activeOrganization.id} key={`${dataScope}:${createEntity ?? "none"}:${editingRecord?.record.id ?? "new"}:${financeEntryType}:${JSON.stringify(assistantDraft)}`} initialDraft={assistantDraft?.entity === createEntity ? assistantDraft : undefined} entity={createEntity} employees={data.employees} customers={data.customers} settings={companySettings} initialQuoteSelection={initialQuoteSelection} initialTransactionType={financeEntryType} onExistingCustomer={(customer) => { setCreateEntity(null); setAssistantDraft(null); setSelected({ entity: "customers", record: customer }); }} onOpenChange={(open) => { if (!open) {
        setCreateEntity(null);
        setEditingRecord(null);
        setAssistantDraft(null);
        setInitialQuoteSelection(null);
    } }} onSubmit={createRecord}/>
    <>{closingOrder && <TechnicianCompletion key={closingOrder.id} order={closingOrder} organizationId={activeOrganization.id} canManageCosts={canOpenSection("finance")} onClose={() => setClosingOrder(null)} onSubmit={completeWorkOrder}/>}</>
    <DetailSheet onEdit={openEdit} onExecute={(record, status) => status === "concluida" ? (setSelected(null), setClosingOrder(record)) : void patchRecord("workOrders", record, { status })} data={data} allowed={Object.keys(sectionMeta).filter(target => canOpenSection(target))} onSelect={item => setSelected({ entity: item.entity, record: item.record })} selected={selected} organizationId={activeOrganization.id} organizationName={activeOrganization.name} onClose={() => setSelected(null)} onDelete={canDelete ? deleteRecord : undefined}/>
    </WorkspaceView>
    <InternalHelp key={dataScope} section={section} canNavigate={target => Object.hasOwn(sectionMeta, target) && canOpenSection(target)} onNavigate={target => navigate(target)}/>
    <Toaster richColors position="top-right"/>
  </SidebarProvider></FamaLocalAiProvider>;
}
function BillingBlocked({ canManageAccess, onBilling }) {
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
function Dashboard(props) {
    const [expanded, setExpanded] = useState(false);
    return <><OperationsCenter organizationId={props.organizationId} data={props.data} allowed={props.allowed} lowStock={props.settings.lowStockAlert} onNavigate={props.onNavigate} onSelect={props.onSelect}/><details className="ops-details" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>Indicadores detalhados<ChevronRight /></summary>{expanded && <DashboardDetails {...props}/>}</details></>;
}
function DashboardDetails({ scope, organizationId, plan, planFeatures, allowed, data, settings, revenue, receivable, payable, salesPipeline, onSelect, onNavigate, onFinanceTab, onConfigureFreight, onUpgrade }) {
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
    const [financialPeriod, setFinancialPeriod] = useState('month');
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), financialPeriod === 'year' ? 0 : now.getMonth(), financialPeriod === 'week' ? now.getDate() - 6 : 1);
    const periods = financialPeriod === 'year' ? 12 : financialPeriod === 'week' ? 7 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const amounts = Array.from({ length: periods }, () => ({ income: 0, expense: 0 }));
    for (const transaction of data.transactions) {
        const date = new Date(transaction.dueDate);
        if (transaction.status !== 'pago' || date < periodStart || date > now)
            continue;
        const index = financialPeriod === 'year' ? date.getMonth() : financialPeriod === 'week' ? Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - periodStart.getTime()) / 86400000) : date.getDate() - 1;
        if (amounts[index])
            amounts[index][transaction.type === 'receita' ? 'income' : 'expense'] += transaction.amountCents;
    }
    let income = 0, expense = 0;
    const cumulative = amounts.map(item => ({ income: income += item.income, expense: expense += item.expense }));
    const chartMax = Math.max(income, expense, 100);
    const chartPoints = (key) => cumulative.map((item, index) => `${30 + index / (periods - 1) * 640},${190 - item[key] / chartMax * 160}`).join(' ');
    const recentQuotes = [...data.quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
    const ledgerBalance = data.transactions.filter(item => item.status === 'pago').reduce((sum, item) => sum + (item.type === 'receita' ? item.amountCents : -item.amountCents), 0);
    const expiringContracts = data.contracts.filter(item => item.status === 'ativo' && daysFromToday(item.endDate) >= 0 && daysFromToday(item.endDate) <= 30).sort((a, b) => a.endDate.localeCompare(b.endDate));
    const pendingFor = (type) => data.transactions.filter(item => item.type === type && item.status !== 'pago').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return <>
    {allowed.includes('finance') && <DashboardBalance organizationId={organizationId} ledgerBalanceCents={ledgerBalance} receivable={receivable} payable={payable} onFinanceTab={onFinanceTab}/>}
    <ViewCustomizer scope={scope + ":dashboard"} defaultOrder={["4", "8", "3", "10", "2", "11", "12", "13", "9", "14", "15", "16", "0", "7", "5", "1", "6"]} labels={["Resumo diário", "Planejamento em campo", "Fluxo financeiro", "Orçamentos recentes", "Agenda de hoje", "Saúde da água", "Indicadores financeiros", "Atenção necessária", "Funil comercial", "Consulta", "Ordens de serviço", "Contas a receber", "Contas a pagar", "Estoque crítico", "Contratos vencendo", "Equipe ativa", "Clientes"]} enabled={[false, allowed.includes("agenda") || allowed.includes("orders"), allowed.includes("finance"), allowed.includes("quotes"), allowed.includes("agenda"), allowed.includes("orders"), allowed.includes("finance"), true, allowed.includes("crm"), allowed.includes("consultation"), allowed.includes("orders"), allowed.includes("finance"), allowed.includes("finance"), allowed.includes("inventory"), allowed.includes("contracts"), allowed.includes("team"), allowed.includes("customers")]} className="dashboard-grid dashboard-dense">
    <section className={`surface ai-daily-brief ${priorityScore >= 5 ? "danger" : priorityScore > 0 ? "warning" : "ok"}`}>
      <div className="panel-heading"><div><small>IA OPERACIONAL</small><h2>Resumo diário</h2></div><Sparkles /></div>
      <p>{dailySummary.join(" · ")}.</p>
      <div className="daily-priority"><span><AlertTriangle /></span><div><small>Prioridade de hoje</small><strong>{topPriority}</strong></div></div>
      <div className="daily-actions"><Button size="sm" onClick={shareDailySummary}><MessageCircle />Enviar resumo</Button><Button size="sm" variant="outline" onClick={() => onNavigate(overdueTransactions.length ? "finance" : staleLeads.length ? "crm" : today.length ? "agenda" : "dashboard")}>Resolver agora<ArrowRight /></Button></div>
    </section>
    <section className="surface planning-agenda-link"><div><strong>Planejamento em campo</strong><span>Mapa, clima, CEP e deslocamento reunidos em uma aba.</span></div><Button variant="outline" onClick={() => onNavigate(allowed.includes("planning") ? "planning" : "orders")}><MapPin />Abrir planejamento</Button></section>
    <section className="surface refined-financial">
      <div className="panel-heading"><div><small>LANÇAMENTOS PAGOS · POR VENCIMENTO</small><h2>Fluxo financeiro</h2></div><div className="refined-periods" role="group" aria-label="Período financeiro">{[['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']].map(([period, label]) => <Button key={period} size="sm" variant={financialPeriod === period ? 'default' : 'ghost'} aria-pressed={financialPeriod === period} onClick={() => setFinancialPeriod(period)}>{label}</Button>)}</div></div>
      <svg className="refined-chart" viewBox="0 0 700 230" role="img" aria-label={`Receitas acumuladas ${money(income)} e despesas acumuladas ${money(expense)} no período, por data de vencimento`}>
        {[30, 70, 110, 150, 190].map(y => <line key={y} x1="30" x2="670" y1={y} y2={y} stroke="currentColor" opacity=".12"/>)}
        <polygon points={`30,190 ${chartPoints('income')} 670,190`} fill="var(--primary)" opacity=".08"/>
        <polyline points={chartPoints('income')} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round"/>
        <polyline points={chartPoints('expense')} fill="none" stroke="#91a8c8" strokeWidth="2" strokeDasharray="5 4"/>
        <text x="30" y="219" fill="currentColor" fontSize="12">{shortDate(periodStart.toISOString())}</text><text x="670" y="219" textAnchor="end" fill="currentColor" fontSize="12">{financialPeriod === 'year' ? 'Dezembro' : financialPeriod === 'week' ? shortDate(now.toISOString()) : 'Fim do mês'}</text>
      </svg>
      <div className="refined-chart-totals"><span><i />Receitas<strong>{money(income)}</strong></span><span><i />Despesas<strong>{money(expense)}</strong></span><Button size="sm" variant="ghost" onClick={() => onNavigate('finance')}>Ver financeiro<ArrowRight /></Button></div>
      {!income && !expense && <p className="refined-caption">Nenhum lançamento pago no período selecionado.</p>}
    </section>
    <section className="surface refined-quotes"><div className="panel-heading"><h2>Orçamentos recentes</h2><Button variant="ghost" size="sm" onClick={() => onNavigate('quotes')}>Ver todos<ArrowRight /></Button></div><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{recentQuotes.map(quote => <TableRow key={quote.id}><TableCell><button className="table-link" onClick={() => onSelect({ entity: 'quotes', record: quote })}><strong>{quote.clientName}</strong><small>{quote.quoteNumber}</small></button></TableCell><TableCell>{quote.service}</TableCell><TableCell>{money(quote.totalCents)}</TableCell><TableCell><Badge variant="secondary">{quoteLabels[quote.status]}</Badge></TableCell></TableRow>)}</TableBody></Table>{!recentQuotes.length && <Empty>Nenhum orçamento cadastrado.</Empty>}</section>
    <section className="day-card">
      <div className="day-intro"><div><small>OPERAÇÃO DE HOJE</small><h2>Agenda de hoje</h2><p>{today.length} compromissos programados · {openOrders} ordens abertas</p></div><CalendarDays className="refined-agenda-icon"/></div>
      <div className="timeline">
        {today.map((item) => <button key={item.id} onClick={() => onSelect({ entity: "appointments", record: item })}><time>{time(item.startAt)}</time><i className={`timeline-dot status-${item.status}`}/><div><strong>{item.title}</strong><span>{item.clientName} · {item.address}</span></div><Badge variant="secondary">{item.technician}</Badge><ChevronRight /></button>)}
        {!today.length && <Empty>Nenhum compromisso para hoje.</Empty>}
      </div>
      <Button variant="ghost" className="full-link" onClick={() => onNavigate("agenda")}>Abrir agenda completa<ArrowRight /></Button>
    </section>

    <section className="water-card">
      <div className="panel-heading light"><div><small>ÚLTIMA ANÁLISE</small><h2>Saúde da água</h2></div><Droplets /></div>
      {latestWater ? <>
        <p className="water-client">{latestWater.clientName}<span>{shortDate(latestWater.scheduledAt)}</span></p>
        <div className="water-gauges">
          <WaterGauge label="pH" display={String(latestWater.ph ?? "—")} percent={latestWater.ph ? Math.min(100, latestWater.ph / 8.2 * 100) : 0}/>
          <WaterGauge label="Cloro" display={`${latestWater.chlorine ?? "—"} ppm`} percent={latestWater.chlorine ? Math.min(100, latestWater.chlorine / 3 * 100) : 0}/>
          <WaterGauge label="Alcalin." display={`${latestWater.alkalinity ?? "—"}`} percent={latestWater.alkalinity ? Math.min(100, latestWater.alkalinity / 120 * 100) : 0}/>
        </div>
        <div className="water-ok"><Check />Parâmetros registrados na ordem {latestWater.osNumber}</div>
      </> : <Empty>Nenhuma medição registrada.</Empty>}
    </section>

    <section className="dashboard-metrics"><ViewCustomizer scope={scope + ":metrics"} labels={["Receita recebida", "A receber", "A pagar", "Resultado previsto"]} className="dashboard-metrics-inner">
      <Metric icon={BadgeDollarSign} label="Receita recebida" value={money(revenue)} helper="lançamentos pagos" tone="cyan"/>
      <Metric icon={HandCoins} label="A receber" value={money(receivable)} helper="pendente ou atrasado" tone="blue"/>
      <Metric icon={ArrowDownLeft} label="A pagar" value={money(payable)} helper="despesas em aberto" tone="orange"/>
      <Metric icon={TrendingUp} label="Resultado previsto" value={money(revenue + receivable - payable)} helper={`${approvedQuotes} orçamento aprovado · pipeline ${money(salesPipeline)}`} tone="violet"/>
    </ViewCustomizer></section>

    <section className="surface quick-panel">
      <div className="panel-heading"><div><small>PRÓXIMOS PASSOS</small><h2>Atenção necessária</h2></div>{allowed.includes("finance") && <Button variant="ghost" size="sm" onClick={() => onNavigate("finance")}>Ver financeiro<ArrowUpRight /></Button>}</div>
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
    <ConsultationWorkspace mode={allowed.includes("planning") ? "lookup" : "all"} organizationId={organizationId} plan={plan} planFeatures={planFeatures} compact onOpen={() => onNavigate('consultation')} onConfigure={onConfigureFreight} onUpgrade={onUpgrade}/>
    <DashboardListCard title="Ordens de serviço" icon={Wrench} summary={`${openOrders} abertas`} onOpen={() => onNavigate('orders')} empty="Nenhuma ordem aberta." rows={data.workOrders.filter(item => item.status !== 'concluida').map(item => ({ id: item.id, label: item.clientName, detail: item.service, value: orderLabels[item.status], onSelect: () => onSelect({ entity: 'workOrders', record: item }) }))}/>
    <DashboardListCard title="Contas a receber" icon={HandCoins} summary={money(receivable)} onOpen={() => onFinanceTab('contas')} empty="Nenhuma receita pendente." rows={pendingFor('receita').map(item => ({ id: item.id, label: item.description, detail: shortDate(item.dueDate), value: money(item.amountCents), warning: item.status === 'atrasado', onSelect: () => onSelect({ entity: 'transactions', record: item }) }))}/>
    <DashboardListCard title="Contas a pagar" icon={ArrowDownLeft} summary={money(payable)} onOpen={() => onFinanceTab('contas')} empty="Nenhuma despesa pendente." rows={pendingFor('despesa').map(item => ({ id: item.id, label: item.description, detail: shortDate(item.dueDate), value: money(item.amountCents), warning: item.status === 'atrasado', onSelect: () => onSelect({ entity: 'transactions', record: item }) }))}/>
    <DashboardListCard title="Estoque crítico" icon={Boxes} onOpen={() => onNavigate('inventory')} empty="Estoque sem alertas." rows={lowInventory.map(item => ({ id: item.id, label: item.name, detail: item.sku, value: `${item.quantity} ${item.unit}`, warning: true, onSelect: () => onSelect({ entity: 'inventory', record: item }) }))}/>
    <DashboardListCard title="Contratos vencendo" icon={FileSignature} onOpen={() => onNavigate('contracts')} empty="Nenhum contrato vence nos próximos 30 dias." rows={expiringContracts.map(item => ({ id: item.id, label: item.clientName, detail: item.service, value: shortDate(item.endDate), warning: daysFromToday(item.endDate) <= 7, onSelect: () => onSelect({ entity: 'contracts', record: item }) }))}/>
    <DashboardListCard title="Equipe ativa" icon={UsersRound} onOpen={() => onNavigate('team')} empty="Nenhum integrante ativo." rows={data.employees.filter(item => item.active).map(item => ({ id: item.id, label: item.name, value: item.role, onSelect: () => onSelect({ entity: 'employees', record: item }) }))}/>
    <DashboardListCard title="Clientes" icon={UsersRound} summary={`${data.customers.length} cadastrados`} onOpen={() => onNavigate('customers')} empty="Nenhum cliente cadastrado." rows={data.customers.map(item => ({ id: item.id, label: item.name, detail: item.plan, value: item.status, onSelect: () => onSelect({ entity: 'customers', record: item }) }))}/>
  </ViewCustomizer></>;
}
function WaterGauge({ label, display, percent }) {
    return <div className="gauge"><span style={{ "--gauge": `${percent * 3.6}deg` }}><i /></span><strong>{display}</strong><small>{label}</small></div>;
}
function Crm({ leads, onSelect, onEdit, onMove, onDelete }) {
    return <div className="crm-board">{leadStages.map((stage, index) => {
            const cards = leads.filter((lead) => lead.status === stage.id);
            const total = cards.reduce((sum, lead) => sum + lead.estimatedValueCents, 0);
            const next = leadStages[index + 1]?.id;
            return <section className="crm-lane" key={stage.id}>
      <header><div><i className={`lead-dot lead-${stage.id}`}/><h2>{stage.label}</h2><Badge variant="secondary">{cards.length}</Badge></div><small>{money(total)}</small></header>
      <div>{cards.map((lead) => <article className="lead-card" key={lead.id}>
        <button className="lead-main" onClick={() => onSelect(lead)}><div className="lead-source"><Badge variant="outline">{lead.source || "Origem não informada"}</Badge>{!["ganho", "perdido"].includes(lead.status) && daysFromToday(lead.createdAt) <= -3 && <Badge variant="destructive">Parado</Badge>}</div><h3>{lead.name}</h3><p>{lead.interest}</p><strong>{money(lead.estimatedValueCents)}</strong><span><Clock3 />{lead.nextAction || "Próxima ação não definida"}</span></button>
        <div className="record-actions">{next && <Button variant="ghost" size="sm" onClick={() => onMove(lead, next)}>Avançar<ChevronRight /></Button>}{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(lead)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o lead de ${lead.name}`} onDelete={() => onDelete("leads", lead)}/>}</div>
      </article>)}{!cards.length && <Empty>Sem negócios nesta etapa.</Empty>}</div>
    </section>;
        })}</div>;
}
function Quotes({ organizationId, quotes, organizationName, canManageCatalog, onCreateProject, onCreate, onSelect, onEdit, onStatus, onConvert, onDelete }) {
    const [view, setView] = useState("projects");
    const [catalog, setCatalog] = useState(defaultPoolQuoteConfig);
    const [activeCategory, setActiveCategory] = useState(defaultPoolQuoteConfig.catalog[0]?.category ?? "");
    const [search, setSearch] = useState("");
    const [catalogEditorOpen, setCatalogEditorOpen] = useState(false);
    const [catalogForm, setCatalogForm] = useState(catalog);
    const [savingCatalog, setSavingCatalog] = useState(false);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [catalogError, setCatalogError] = useState("");
    const [catalogReload, setCatalogReload] = useState(0);
    useEffect(() => {
        let disposed = false;
        fetch("/api/quote-config", { headers: { "x-organization-id": organizationId }, cache: "no-store" })
            .then(async (response) => {
            const payload = await response.json();
            if (!response.ok || !isPoolQuoteConfig(payload.config))
                throw new Error(payload.error || "Não foi possível carregar o catálogo.");
            if (!disposed) {
                setCatalog(payload.config);
                setActiveCategory(payload.config.catalog[0]?.category ?? "");
                setCatalogError("");
            }
        })
            .catch(error => { if (!disposed)
            setCatalogError(error instanceof Error ? error.message : "Não foi possível carregar o catálogo."); })
            .finally(() => { if (!disposed)
            setCatalogLoading(false); });
        return () => { disposed = true; };
    }, [organizationId, catalogReload]);
    const category = catalog.catalog.find((item) => item.category === activeCategory) ?? catalog.catalog[0];
    const projects = (category?.items ?? []).filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
    function openCatalogEditor() {
        setCatalogForm(structuredClone(catalog));
        setCatalogEditorOpen(true);
    }
    function syncCatalogForm(updater) {
        setCatalogForm((current) => {
            const next = updater(current);
            return next;
        });
    }
    function updateCategory(categoryIndex, value) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, index) => index === categoryIndex ? { ...group, category: value } : group) }));
    }
    function updateItem(categoryIndex, itemIndex, patch) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, ...patch } : item) } : group) }));
    }
    function updateField(categoryIndex, itemIndex, fieldIndex, patch) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, fields: item.fields.map((field, nextFieldIndex) => nextFieldIndex === fieldIndex ? { ...field, ...patch } : field) } : item) } : group) }));
    }
    function addCategory() {
        syncCatalogForm((current) => ({ ...current, catalog: [...current.catalog, { category: "Nova categoria", items: [{ name: "Novo item", unit: "unidade", price: 0, markup: 20, fields: [{ key: "medida", label: "Medida", type: "number", unit: "" }] }] }] }));
    }
    function removeCategory(categoryIndex) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.filter((_, index) => index !== categoryIndex) }));
    }
    function addItem(categoryIndex) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, index) => index === categoryIndex ? { ...group, items: [...group.items, { name: "Novo item", unit: "unidade", price: 0, markup: 20, fields: [{ key: "medida", label: "Medida", type: "number", unit: "" }] }] } : group) }));
    }
    function removeItem(categoryIndex, itemIndex) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, index) => index === categoryIndex ? { ...group, items: group.items.filter((_, nextIndex) => nextIndex !== itemIndex) } : group) }));
    }
    function addField(categoryIndex, itemIndex) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, fields: [...item.fields, { key: `campo_${crypto.randomUUID()}`, label: "Novo campo", type: "text", unit: "" }] } : item) } : group) }));
    }
    function removeField(categoryIndex, itemIndex, fieldIndex) {
        syncCatalogForm((current) => ({ ...current, catalog: current.catalog.map((group, groupIndex) => groupIndex === categoryIndex ? { ...group, items: group.items.map((item, index) => index === itemIndex ? { ...item, fields: item.fields.filter((_, nextIndex) => nextIndex !== fieldIndex) } : item) } : group) }));
    }
    async function saveCatalog(event) {
        event.preventDefault();
        setSavingCatalog(true);
        try {
            const parsed = catalogForm;
            if (!isPoolQuoteConfig(parsed))
                throw new Error(poolQuoteConfigError(parsed) || "Confira os dados do catálogo.");
            const response = await fetch("/api/quote-config", { method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": organizationId }, body: JSON.stringify({ config: parsed }) });
            const payload = await response.json();
            if (!response.ok || !payload.config)
                throw new Error(payload.error ?? "Não foi possível salvar o catálogo.");
            setCatalog(payload.config);
            setActiveCategory(payload.config.catalog[0]?.category ?? "");
            setCatalogEditorOpen(false);
            toast.success("Orçamento automático atualizado para esta empresa.");
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar o catálogo.");
        }
        finally {
            setSavingCatalog(false);
        }
    }
    if (catalogLoading)
        return <div className="loading"><i /><p>Carregando catálogo da empresa…</p></div>;
    if (catalogError)
        return <section className="surface settings-section"><p role="alert">{catalogError}</p><Button onClick={() => { setCatalogLoading(true); setCatalogReload(value => value + 1); }}>Tentar novamente</Button></section>;
    return <div className="module-stack pool-projects-view">
    <div className="pool-projects-title"><div><small>ORÇAMENTOS</small><h2>Configurador inteligente</h2><p>Medidas, preços, margens e projeto de piscina gerados automaticamente.</p></div><div className="panel-actions">{canManageCatalog && <Button variant="outline" onClick={openCatalogEditor}>Editar orçamento automático</Button>}<Button onClick={onCreate}><Plus /> Novo orçamento</Button></div></div>
    <div className="pool-project-tabs" role="tablist"><button type="button" role="tab" aria-selected={view === "projects"} className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>Projetos</button><button type="button" role="tab" aria-selected={view === "saved"} className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}>Orçamentos salvos <span>{quotes.length}</span></button></div>
    {view === "projects" ? <section className="pool-project-catalog"><div className="pool-project-catalog-head"><div><strong>Escolha um projeto ou serviço</strong><small>Administrador edita o catálogo, preços, margens e medidas direto aqui na Fama System.</small></div><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projetos no catálogo" aria-label="Buscar projetos no catálogo"/></div><div className="pool-category-chips">{catalog.catalog.map((item) => <button type="button" key={item.category} className={activeCategory === item.category ? "active" : ""} onClick={() => setActiveCategory(item.category)}>{item.category}</button>)}</div><div className="pool-project-cards">{projects.map((item) => <article className="pool-project-card" key={item.name}><div><small>{category?.category}</small><h3>{item.name}</h3><p>{item.fields.map((field) => field.label).join(" · ") || "Serviço sem campos adicionais"}</p></div><footer><strong>{money(Math.round(item.price * (1 + item.markup / 100) * 100))} <small>/ {item.unit}</small></strong><Button variant="outline" size="sm" onClick={() => onCreateProject({ category: category?.category ?? "", name: item.name })}>Configurar projeto <ChevronRight /></Button></footer></article>)}</div>{!projects.length && <Empty>Nenhum serviço corresponde à busca.</Empty>}</section> : <SavedQuotes onEdit={onEdit} quotes={quotes} organizationId={organizationId} onSelect={onSelect} onStatus={onStatus} onConvert={onConvert} onDelete={onDelete}/>}
    <Dialog open={catalogEditorOpen} onOpenChange={setCatalogEditorOpen}><DialogContent className="catalog-editor-dialog"><DialogHeader><DialogTitle>Editar orçamento automático</DialogTitle><DialogDescription>Edite tudo por campos normais. Cada empresa mantém seu próprio catálogo.</DialogDescription></DialogHeader><form className="catalog-editor-form" onSubmit={saveCatalog}><div className="catalog-normal-editor"><div className="catalog-editor-toolbar"><div className="form-field"><Label htmlFor="catalog-title">Título</Label><Input id="catalog-title" value={catalogForm.title} onChange={(event) => syncCatalogForm((current) => ({ ...current, title: event.target.value }))}/></div><Button type="button" variant="outline" onClick={addCategory}><Plus />Categoria</Button></div><section className="catalog-urgency-editor"><strong>Urgência</strong><div><Label>Normal (%)<Input type="number" value={catalogForm.urgency.normal} onChange={(event) => syncCatalogForm((current) => ({ ...current, urgency: { ...current.urgency, normal: Number(event.target.value) } }))}/></Label><Label>Urgente (%)<Input type="number" value={catalogForm.urgency.urgente} onChange={(event) => syncCatalogForm((current) => ({ ...current, urgency: { ...current.urgency, urgente: Number(event.target.value) } }))}/></Label><Label>Emergência (%)<Input type="number" value={catalogForm.urgency.emergencia} onChange={(event) => syncCatalogForm((current) => ({ ...current, urgency: { ...current.urgency, emergencia: Number(event.target.value) } }))}/></Label></div></section>{catalogForm.catalog.map((group, categoryIndex) => <section className="catalog-editor-category" key={categoryIndex}><header><div className="form-field"><Label>Categoria</Label><Input value={group.category} onChange={(event) => updateCategory(categoryIndex, event.target.value)}/></div><div className="record-actions"><Button type="button" variant="outline" size="sm" onClick={() => addItem(categoryIndex)}><Plus />Item</Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCategory(categoryIndex)} aria-label="Remover categoria"><X /></Button></div></header><div className="catalog-editor-items">{group.items.map((item, itemIndex) => <article className="catalog-edit-item" key={itemIndex}><div className="catalog-edit-item-head"><strong>Item {itemIndex + 1}</strong><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(categoryIndex, itemIndex)} aria-label="Remover item"><X /></Button></div><div className="catalog-item-grid"><Label>Nome<Input value={item.name} onChange={(event) => updateItem(categoryIndex, itemIndex, { name: event.target.value })}/></Label><Label>Unidade<Input value={item.unit} onChange={(event) => updateItem(categoryIndex, itemIndex, { unit: event.target.value })}/></Label><Label>Preço base (R$)<Input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(categoryIndex, itemIndex, { price: Number(event.target.value) })}/></Label><Label>Margem (%)<Input type="number" min="0" step="1" value={item.markup} onChange={(event) => updateItem(categoryIndex, itemIndex, { markup: Number(event.target.value) })}/></Label></div><div className="catalog-fields-editor"><div><strong>Campos de medida</strong><Button type="button" variant="outline" size="sm" onClick={() => addField(categoryIndex, itemIndex)}><Plus />Campo</Button></div>{item.fields.map((field, fieldIndex) => <div className="catalog-field-row" key={fieldIndex}><Label>Nome<Input value={field.label} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { label: event.target.value })}/></Label><Label>Usar no cálculo<NativeSelect value={poolQuoteFieldRole(field)} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { role: event.target.value, ...(event.target.value !== "info" ? { type: "number" } : {}) })}><NativeSelectOption value="info">Informação adicional</NativeSelectOption><NativeSelectOption value="length">Comprimento</NativeSelectOption><NativeSelectOption value="width">Largura</NativeSelectOption><NativeSelectOption value="depth">Profundidade</NativeSelectOption><NativeSelectOption value="area">Área informada</NativeSelectOption><NativeSelectOption value="volume">Volume informado</NativeSelectOption><NativeSelectOption value="quantity">Quantidade</NativeSelectOption></NativeSelect></Label><Label>Tipo<NativeSelect value={field.type ?? "text"} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { type: event.target.value })}><NativeSelectOption value="text">Texto</NativeSelectOption><NativeSelectOption value="number">Número</NativeSelectOption></NativeSelect></Label><Label>Unidade<Input value={field.unit ?? ""} onChange={(event) => updateField(categoryIndex, itemIndex, fieldIndex, { unit: event.target.value })}/></Label><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(categoryIndex, itemIndex, fieldIndex)} aria-label="Remover campo"><X /></Button></div>)}</div></article>)}</div></section>)}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setCatalogEditorOpen(false)}>Cancelar</Button><Button type="submit" disabled={savingCatalog}>{savingCatalog ? "Salvando…" : "Salvar orçamento automático"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
function SavedQuotes({ quotes, organizationId, onSelect, onEdit, onStatus, onConvert, onDelete }) {
    const pending = quotes.filter((item) => item.status === "enviado").reduce((sum, item) => sum + item.totalCents, 0);
    const approved = quotes.filter((item) => item.status === "aprovado").reduce((sum, item) => sum + item.totalCents, 0);
    const share = async (quote) => {
        try {
            const response = await fetch(`/api/quotes/${quote.id}/approval-link`, { method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": organizationId } });
            const payload = await response.json();
            if (!response.ok || !payload.approvalToken)
                throw new Error(payload.error ?? "Não foi possível preparar o link.");
            const link = `${window.location.origin}/proposta/${encodeURIComponent(quote.id)}?token=${encodeURIComponent(payload.approvalToken)}`;
            const text = `Orçamento ${quote.quoteNumber} · ${quote.clientName}\n${quote.service}\nTotal: ${money(quote.totalCents)}\nAprove ou recuse a proposta: ${link}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
            if (payload.status && payload.status !== quote.status)
                onStatus(quote, payload.status);
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível preparar o link.");
        }
    };
    return <div className="module-stack"><div className="compact-metrics"><Metric icon={FileText} label="Orçamentos" value={String(quotes.length)} helper="na visão atual" tone="cyan"/><Metric icon={Clock3} label="Aguardando resposta" value={money(pending)} helper="propostas enviadas" tone="orange"/><Metric icon={Check} label="Aprovados" value={money(approved)} helper="prontos para execução" tone="blue"/></div><section className="surface table-surface"><div className="panel-heading"><div><small>PROPOSTAS</small><h2>Controle de orçamentos</h2></div><Badge variant="secondary">{quotes.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Número / cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Validade</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{quotes.map((quote) => <TableRow key={quote.id}><TableCell><button className="table-link" onClick={() => onSelect(quote)}><strong>{quote.quoteNumber}</strong><small>{quote.clientName}</small></button></TableCell><TableCell className="max-cell">{quote.service}</TableCell><TableCell>{shortDate(quote.validUntil)}</TableCell><TableCell><strong>{money(quote.totalCents)}</strong></TableCell><TableCell><NativeSelect value={quote.status} onChange={(event) => onStatus(quote, event.target.value)} aria-label={`Status de ${quote.quoteNumber}`}>{Object.entries(quoteLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" asChild><a href={documentUrl("quotes", quote.id, organizationId)} download><FileDown />PDF</a></Button><Button variant="outline" size="sm" onClick={() => void share(quote)}>WhatsApp</Button>{quote.status === "aprovado" && <Button variant="outline" size="sm" onClick={() => onConvert(quote)}>Criar OS</Button>}<Button variant="ghost" size="icon-sm" onClick={() => onSelect(quote)} aria-label="Abrir orçamento"><ChevronRight /></Button>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(quote)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o orçamento ${quote.quoteNumber}`} onDelete={() => onDelete("quotes", quote)}/>}</div></TableCell></TableRow>)}</TableBody></Table>{!quotes.length && <Empty>Cadastre o primeiro orçamento para gerar propostas em PDF.</Empty>}</section></div>;
}
function Agenda({ onPlanning, organizationId, appointments, employees, onSelect, onEdit, onStatus, onReschedule, onDelete }) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [technician, setTechnician] = useState("todos");
    const [sendingDaily, setSendingDaily] = useState(false);
    const [dailyDrafts, setDailyDrafts] = useState([]);
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
    function moveAppointment(event, day) {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain");
        const appointment = appointments.find((item) => item.id === id);
        if (!appointment)
            return;
        const clock = appointment.startAt.slice(11, 16) || "09:00";
        void onReschedule(appointment, `${day}T${clock}`);
    }
    function shareTechnicianSchedule(name) {
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
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error || "Não foi possível enviar a agenda pelo WhatsApp.");
            if (payload.manualShare && payload.drafts?.length) {
                setDailyDrafts(payload.drafts);
                return;
            }
            if (!payload.sent?.length) {
                toast.info(payload.skipped?.some((item) => item.reason.includes("Telefone")) ? "Confira os telefones dos técnicos no cadastro da equipe." : "Nenhum atendimento para enviar hoje para a equipe selecionada.");
                return;
            }
            toast.success(`Agenda enviada para ${payload.sent?.length ?? 0} técnico(s). ${payload.skipped?.length ? `${payload.skipped.length} ignorado(s).` : ""}`);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao enviar a agenda.");
        }
        finally {
            setSendingDaily(false);
        }
    }
    return <div className="agenda-with-planner"><Dialog open={dailyDrafts.length > 0} onOpenChange={(open) => { if (!open) setDailyDrafts([]); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Compartilhar agenda de hoje</DialogTitle><DialogDescription>O envio automático requer uma conexão oficial do WhatsApp. Você pode compartilhar manualmente: escolha o destinatário no WhatsApp e confirme o envio.</DialogDescription></DialogHeader>{dailyDrafts.map((draft) => <div key={draft.technician}><strong>{draft.technician}</strong><p className="whitespace-pre-wrap">{draft.text}</p><Button type="button" onClick={() => shareText(draft.text)}>Abrir WhatsApp para compartilhar</Button></div>)}</DialogContent></Dialog><div className="planning-agenda-link"><div><strong>Planeje antes de agendar</strong><span>Clima, mapa, deslocamento, Google Calendar e sugestões de horários.</span></div><Button variant="outline" onClick={onPlanning}><MapPin />Abrir planejamento</Button></div><div className="agenda-layout"><section className="agenda-board-wrap">
    <div className="agenda-toolbar"><NativeSelect aria-label="Filtrar agenda por técnico" value={technician} onChange={(event) => setTechnician(event.target.value)}><NativeSelectOption value="todos">Todos os técnicos</NativeSelectOption>{employees.filter((employee) => employee.active).map((employee) => <NativeSelectOption value={employee.name} key={employee.id}>{employee.name}</NativeSelectOption>)}</NativeSelect><Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)}>Semana anterior</Button><strong>{caption}</strong><Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)}>Próxima semana</Button><Button type="button" variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button><Button type="button" size="sm" onClick={() => void sendDailyWhatsApp()} disabled={sendingDaily}>{sendingDaily ? "Enviando..." : "Enviar agenda de hoje"}</Button></div>
    <div className="agenda-board">{days.map((day) => {
            const items = visibleAppointments.filter((item) => dayKey(item.startAt) === day).sort((a, b) => a.startAt.localeCompare(b.startAt));
            return <div className="agenda-day" key={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveAppointment(event, day)}><header><div><strong>{new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" })}</strong><span>{shortDate(day)}</span></div><Badge variant="secondary">{items.length}</Badge></header><div>{items.map((item) => <article className={`agenda-event event-${item.kind.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}`} key={item.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }} title="Arraste para outro dia para reagendar"><button onClick={() => onSelect(item)}><time>{time(item.startAt)}</time><div><h3>{item.title}</h3><p>{item.clientName}</p><span><MapPin />{item.address}</span></div></button><footer><Badge variant="outline">{item.technician || "Sem técnico"}</Badge><div className="record-actions"><WazeLink compact destination={item.address}/><Button variant="ghost" size="icon-sm" onClick={() => void onReschedule(item)} aria-label="Reagendar visita"><CalendarClock /></Button><NativeSelect value={item.status} onChange={(event) => onStatus(item, event.target.value)} aria-label={`Status de ${item.title}`}>{Object.entries(appointmentLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o agendamento ${item.title}`} onDelete={() => onDelete("appointments", item)}/>}</div></footer></article>)}</div>{!items.length && <p className="agenda-drop-hint">Solte aqui para reagendar</p>}</div>;
        })}</div>
  </section><aside className="surface route-panel"><div className="panel-heading"><div><small>ROTA DA SEMANA</small><h2>Equipe em campo</h2></div><MapPin /></div>{employees.filter((employee) => employee.active).map((employee) => { const todayCount = visibleAppointments.filter((item) => item.technician === employee.name && days.includes(dayKey(item.startAt))).length; return <div className="route-tech" key={employee.id}><span className={`avatar ${employee.color}`}>{initials(employee.name)}</span><div><strong>{employee.name}</strong><small>{todayCount} atendimento{todayCount === 1 ? "" : "s"} nesta semana</small></div><Button type="button" variant="ghost" size="sm" onClick={() => shareTechnicianSchedule(employee.name)}>WhatsApp</Button><b>{todayCount}</b></div>; })}{!employees.filter((employee) => employee.active).length && <Empty>Cadastre a equipe para distribuir as rotas.</Empty>}<Separator /><div className="route-note"><Sparkles /><p><strong>Arraste para reagendar</strong>Distribua os compromissos por dia. No celular, use o botão de calendário em cada visita.</p></div></aside></div></div>;
}
function TechnicianMobile({ appointments, orders, onAppointmentStatus, onOrderStatus, onOpenOrder, onCompleteOrder }) {
    const today = dayKey(new Date());
    const todayAppointments = appointments.filter((item) => dayKey(item.startAt) === today).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const activeOrders = orders.filter((item) => item.status !== "concluida").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return <div className="technician-mobile module-stack">
    <section className="surface technician-mobile-hero"><div><small>APP DO TÉCNICO</small><h2>Seu dia em campo</h2><p>Agenda, rota, checklist e conclusão em uma tela feita para o celular.</p></div><Smartphone /></section>
    <div className="technician-mobile-metrics"><Metric icon={CalendarDays} label="Visitas hoje" value={String(todayAppointments.length)} helper="na sua agenda" tone="cyan"/><Metric icon={ClipboardCheck} label="OS abertas" value={String(activeOrders.length)} helper="para concluir" tone="blue"/></div>
    <section className="surface technician-mobile-list"><div className="panel-heading"><div><small>PRÓXIMAS VISITAS</small><h2>Rota de hoje</h2></div><Badge variant="secondary">{todayAppointments.length} itens</Badge></div>{todayAppointments.map((item) => <article className="technician-mobile-item" key={item.id}><div className="technician-mobile-time"><strong>{time(item.startAt)}</strong><span>{appointmentLabels[item.status]}</span></div><div><h3>{item.title}</h3><p>{item.clientName}</p><small><MapPin />{item.address || "Endereço não informado"}</small><WazeLink destination={item.address}/></div><NativeSelect value={item.status} onChange={(event) => onAppointmentStatus(item, event.target.value)} aria-label={`Status de ${item.title}`}>{Object.entries(appointmentLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></article>)}{!todayAppointments.length && <Empty>Nenhuma visita prevista para hoje.</Empty>}</section>
    <section className="surface technician-mobile-list"><div className="panel-heading"><div><small>EXECUÇÃO</small><h2>Ordens abertas</h2></div><Badge variant="secondary">{activeOrders.length} itens</Badge></div>{activeOrders.map((item) => <article className="technician-mobile-item" key={item.id}><div className="technician-mobile-time"><strong>{item.osNumber}</strong><span>{orderLabels[item.status]}</span></div><div><h3>{item.service}</h3><p>{item.clientName}</p><small>{item.ph === null ? "Medições pendentes" : `pH ${item.ph} · Cloro ${item.chlorine}`}</small></div><Button variant="outline" size="sm" onClick={() => onOpenOrder(item)}>Ficha do serviço</Button><Button size="sm" onClick={() => onCompleteOrder(item)}>Finalizar atendimento</Button><NativeSelect value={item.status} onChange={(event) => onOrderStatus(item, event.target.value)} aria-label={`Status de ${item.osNumber}`}>{Object.entries(orderLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></article>)}{!activeOrders.length && <Empty>Nenhuma ordem aberta.</Empty>}</section>
  </div>;
}
function Orders({ orders, onSelect, onEdit, onStatus, onDelete }) {
    return <section className="surface table-surface"><div className="panel-heading"><div><small>EXECUÇÃO</small><h2>Ordens de serviço</h2></div><div className="legend"><i className="open"/>{orders.filter((item) => item.status !== "concluida").length} em andamento</div></div><Table><TableHeader><TableRow><TableHead>OS / cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Data e técnico</TableHead><TableHead>Leitura da água</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id}><TableCell><button className="table-link" onClick={() => onSelect(order)}><strong>{order.osNumber}</strong><small>{order.clientName}</small></button></TableCell><TableCell className="max-cell">{order.service}</TableCell><TableCell><span className="cell-stack"><strong>{shortDate(order.scheduledAt)}</strong><small>{order.technician}</small></span></TableCell><TableCell>{order.ph !== null ? <span className="water-reading"><Droplets />pH {order.ph} · Cl {order.chlorine}</span> : <span className="muted">A medir</span>}</TableCell><TableCell><strong>{money(order.amountCents)}</strong></TableCell><TableCell><NativeSelect value={order.status} disabled={order.status === "concluida"} onChange={(event) => onStatus(order, event.target.value)} aria-label={`Status de ${order.osNumber}`}>{Object.entries(orderLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="record-actions">{order.status === "aberta" && <Button type="button" size="sm" onClick={() => onStatus(order, "em_execucao")}><Play />Iniciar serviço</Button>}{order.status === "em_execucao" && <Button type="button" size="sm" onClick={() => onStatus(order, "concluida")}><CheckCircle2 />Finalizar serviço</Button>}<Button variant="ghost" size="icon-sm" onClick={() => onSelect(order)} aria-label="Abrir ordem"><ChevronRight /></Button>{onEdit && order.status !== "concluida" && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(order)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`a ordem ${order.osNumber}`} onDelete={() => onDelete("workOrders", order)}/>}</div></TableCell></TableRow>)}</TableBody></Table>{!orders.length && <Empty>Nenhuma ordem de serviço encontrada.</Empty>}</section>;
}
function Warranties({ warranties, employees, onSelect, onEdit, onStatus, onSchedule, onDelete }) {
    const [scheduling, setScheduling] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [now] = useState(() => Date.now());
    const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
    const expiring = warranties.filter((item) => { const expiry = new Date(`${item.expiresAt}T12:00:00`).getTime(); return expiry >= now && expiry <= inThirtyDays && item.status !== "concluida"; }).length;
    const scheduled = warranties.filter((item) => item.status === "agendada").length;
    async function submitSchedule(event) {
        event.preventDefault();
        if (!scheduling)
            return;
        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
        setSubmitting(true);
        try {
            await onSchedule(scheduling, String(values.scheduledAt ?? ""), String(values.technician ?? ""));
            setScheduling(null);
            toast.success("Garantia agendada e adicionada à agenda.");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível agendar a garantia.");
        }
        finally {
            setSubmitting(false);
        }
    }
    return <><div className="module-stack"><div className="compact-metrics"><Metric icon={ShieldCheck} label="Garantias" value={String(warranties.length)} helper="registros cadastrados" tone="cyan"/><Metric icon={Clock3} label="Vencem em 30 dias" value={String(expiring)} helper="acompanhe os prazos" tone="orange"/><Metric icon={CalendarDays} label="Atendimentos marcados" value={String(scheduled)} helper="integrados à agenda" tone="blue"/></div><section className="surface table-surface"><div className="panel-heading"><div><small>PÓS-VENDA</small><h2>Controle de garantias</h2></div><Badge variant="secondary">{warranties.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Garantia / cliente</TableHead><TableHead>Cobertura</TableHead><TableHead>Validade</TableHead><TableHead>Agendamento</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{warranties.map((warranty) => <TableRow key={warranty.id}><TableCell><button className="table-link" onClick={() => onSelect(warranty)}><strong>{warranty.warrantyNumber}</strong><small>{warranty.clientName}</small></button></TableCell><TableCell className="max-cell">{warranty.item}</TableCell><TableCell>{shortDate(warranty.expiresAt)}</TableCell><TableCell><span className="cell-stack"><strong>{warranty.scheduledAt ? fullDate(warranty.scheduledAt) : "Não agendado"}</strong><small>{warranty.technician || "Sem responsável"}</small></span></TableCell><TableCell><NativeSelect value={warranty.status} onChange={(event) => onStatus(warranty, event.target.value)} aria-label={`Status de ${warranty.warrantyNumber}`}>{Object.entries(warrantyLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" onClick={() => setScheduling(warranty)}><CalendarDays />Agendar</Button><Button variant="ghost" size="icon-sm" onClick={() => onSelect(warranty)} aria-label="Abrir garantia"><ChevronRight /></Button>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(warranty)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`a garantia ${warranty.warrantyNumber}`} onDelete={() => onDelete("warranties", warranty)}/>}</div></TableCell></TableRow>)}</TableBody></Table>{!warranties.length && <Empty>Cadastre a primeira garantia para acompanhar cobertura e atendimento.</Empty>}</section></div><Dialog open={Boolean(scheduling)} onOpenChange={(open) => !open && setScheduling(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Agendar atendimento de garantia</DialogTitle><DialogDescription>{scheduling ? `${scheduling.warrantyNumber} · ${scheduling.clientName}` : "Defina a data e o responsável."}</DialogDescription></DialogHeader><form className="record-form" onSubmit={submitSchedule}><Field label="Data e hora *" name="scheduledAt" type="datetime-local" required className="span-2"/><Field label="Técnico" name="technician" type="select" options={[["", "Não atribuído"], ...employees.filter((employee) => employee.active).map((employee) => [employee.name, employee.name])]} className="span-2"/><DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => setScheduling(null)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Agendando…" : "Confirmar agendamento"}</Button></DialogFooter></form></DialogContent></Dialog></>;
}
function Contracts({ contracts, organizationId, onSelect, onEdit, onStatus, onDelete }) {
    const [now] = useState(() => Date.now());
    const active = contracts.filter((item) => item.status === "ativo");
    const monthly = active.reduce((sum, item) => sum + item.monthlyCents, 0);
    const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
    const expiring = active.filter((item) => { const expiry = new Date(`${item.endDate}T12:00:00`).getTime(); return expiry >= now && expiry <= inThirtyDays; }).length;
    return <div className="module-stack"><div className="compact-metrics"><Metric icon={FileSignature} label="Contratos ativos" value={String(active.length)} helper="clientes recorrentes" tone="cyan"/><Metric icon={CircleDollarSign} label="Receita mensal" value={money(monthly)} helper="contratos ativos" tone="blue"/><Metric icon={Clock3} label="Vencem em 30 dias" value={String(expiring)} helper="planeje as renovações" tone="orange"/></div><section className="surface table-surface"><div className="panel-heading"><div><small>ACORDOS COMERCIAIS</small><h2>Contratos de clientes</h2></div><Badge variant="secondary">{contracts.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Contrato / cliente</TableHead><TableHead>Objeto</TableHead><TableHead>Vigência</TableHead><TableHead>Mensalidade</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{contracts.map((contract) => <TableRow key={contract.id}><TableCell><button className="table-link" onClick={() => onSelect(contract)}><strong>{contract.contractNumber}</strong><small>{contract.clientName}</small></button></TableCell><TableCell className="max-cell">{contract.service}</TableCell><TableCell><span className="cell-stack"><strong>{shortDate(contract.startDate)} — {shortDate(contract.endDate)}</strong><small>{contract.frequency || "Frequência não informada"}</small></span></TableCell><TableCell><strong>{money(contract.monthlyCents)}</strong></TableCell><TableCell><NativeSelect value={contract.status} onChange={(event) => onStatus(contract, event.target.value)} aria-label={`Status de ${contract.contractNumber}`}>{Object.entries(contractLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="quote-actions"><Button variant="outline" size="sm" asChild><a href={documentUrl("contracts", contract.id, organizationId)} download><FileDown />PDF</a></Button><Button variant="ghost" size="icon-sm" onClick={() => onSelect(contract)} aria-label="Abrir contrato"><ChevronRight /></Button>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(contract)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o contrato ${contract.contractNumber}`} onDelete={() => onDelete("contracts", contract)}/>}</div></TableCell></TableRow>)}</TableBody></Table>{!contracts.length && <Empty>Cadastre o primeiro contrato para gerar o documento em PDF.</Empty>}</section></div>;
}
function Customers({ customers, query, onQueryChange, onSelect, onEdit, onDelete }) {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const digits = documentDigits(needle);
    const visible = customers.filter((customer) => JSON.stringify(customer).toLocaleLowerCase("pt-BR").includes(needle) || (digits.length >= 3 && documentDigits(unpackNotes(customer.notes).details.clientDocument ?? "").includes(digits)));
    return <div className="module-stack"><div className="customer-search"><div><strong>Localizar cliente</strong><small>Pesquise pelo nome, CPF ou CNPJ cadastrado.</small></div><div className="customer-lookup-input"><Search /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Digite o nome, CPF ou CNPJ" aria-label="Buscar clientes por nome, CPF ou CNPJ"/><Button type="button" variant="ghost" size="sm" onClick={() => onQueryChange("")} disabled={!query}>Limpar</Button></div></div><div className="customer-grid">{visible.map((customer) => <article className="customer-card" key={customer.id}><button className="customer-primary" onClick={() => onSelect(customer)}><div className="customer-head"><span>{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><StatusBadge value={customer.status} labels={{ ativo: "Ativo", prospect: "Prospect" }}/></div><h2>{customer.name}</h2><p><MapPin />{customer.address}</p><div className="pool-profile"><Droplets /><span><strong>{customer.poolType}</strong><small>{customer.poolVolume ? `${customer.poolVolume.toLocaleString("pt-BR")} litros` : "Volume não informado"}</small></span></div></button><footer><span><Wrench />{customer.plan}</span><div className="record-actions"><Button variant="ghost" size="icon-sm" onClick={() => onSelect(customer)} aria-label="Abrir cliente"><ChevronRight /></Button>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(customer)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o cliente ${customer.name}`} onDelete={() => onDelete("customers", customer)}/>}</div></footer></article>)}{!visible.length && <Empty>{customers.length ? "Nenhum cliente corresponde à busca." : "Nenhum cliente encontrado."}</Empty>}</div></div>;
}
function Inventory({ items, lowStockAlert, onSelect, onEdit, onAdjust, onDelete }) {
    const [barcode, setBarcode] = useState("");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scannedCode, setScannedCode] = useState("");
    const [moving, setMoving] = useState(false);
    const movementLock = useRef(false);
    const acceptScan = useMemo(() => (code) => { setCameraOpen(false); setScannedCode(code); }, []);
    const [mode, setMode] = useState("remove");
    const value = items.reduce((sum, item) => sum + item.costCents * item.quantity, 0);
    const low = items.filter((item) => item.quantity <= Math.max(item.minimumQuantity, lowStockAlert)).length;
    async function registerCode(raw) {
        if (movementLock.current)
            return;
        const code = raw.trim().toLocaleLowerCase("pt-BR");
        if (!code)
            return;
        const matches = items.filter((entry) => entry.sku.trim().toLocaleLowerCase("pt-BR") === code);
        if (matches.length !== 1) {
            setBarcode(raw);
            toast.error(matches.length ? "Há produtos com o mesmo código. Corrija os cadastros antes de movimentar." : "Código não encontrado. Cadastre o SKU/código de barras no produto.");
            return;
        }
        movementLock.current = true;
        setMoving(true);
        try {
            if (await onAdjust(matches[0], mode === "add" ? 1 : -1))
                setBarcode("");
            else
                setBarcode(raw);
        }
        finally {
            movementLock.current = false;
            setMoving(false);
        }
    }
    useEffect(() => {
        if (!scannedCode)
            return;
        setScannedCode("");
        void registerCode(scannedCode);
    }, [scannedCode]);
    async function submitBarcode(event) {
        event.preventDefault();
        await registerCode(barcode);
    }
    return <div className="module-stack stock-workspace">
    <section className="stock-overview">
      <div className="stock-overview-title"><span className="stock-eyebrow"><span /> FAMA · INVENTÁRIO</span><h2>Estoque sob controle.</h2><p>Produtos, peças e equipamentos em um só lugar.</p></div>
      <div className="stock-overview-metrics"><div><Boxes /><span>Itens cadastrados<strong>{items.length}</strong></span></div><div className={low ? "stock-attention" : ""}><AlertTriangle /><span>Precisam de reposição<strong>{low}</strong></span></div><div><CircleDollarSign /><span>Valor em estoque<strong>{money(value)}</strong></span></div></div>
    </section>
    <section className={`stock-movement ${mode === "add" ? "is-entry" : "is-exit"}`}>
      <div className="stock-movement-intro"><span className="stock-section-icon"><ScanLine /></span><div><span className="stock-eyebrow">MOVIMENTAÇÃO RÁPIDA</span><h2>Escaneou. Registrou.</h2><p>Escolha a operação e leia o código do produto.</p></div><span className="stock-unit-badge">1 unidade por leitura</span></div>
      <div className="stock-movement-body"><div className="stock-direction" role="group" aria-label="Tipo de movimentação">
        <button type="button" aria-pressed={mode === "add"} className={mode === "add" ? "selected" : ""} disabled={moving || cameraOpen} onClick={() => setMode("add")}><span><ArrowDownLeft /></span><div><strong>Entrada</strong><small>Adicionar 1 unidade</small></div><i aria-hidden="true"/></button>
        <button type="button" aria-pressed={mode === "remove"} className={mode === "remove" ? "selected" : ""} disabled={moving || cameraOpen} onClick={() => setMode("remove")}><span><ArrowUpRight /></span><div><strong>Saída</strong><small>Remover 1 unidade</small></div><i aria-hidden="true"/></button>
      </div><div className="stock-capture"><Button className="stock-scan-button" type="button" disabled={moving || cameraOpen} onClick={() => setCameraOpen(true)}><ScanLine /><span>Abrir leitor<small>Câmera ou foto do código</small></span><ArrowRight /></Button>
      <form className="stock-manual-form" onSubmit={submitBarcode}><label htmlFor="stock-barcode">Ou informe o código</label><div><Input id="stock-barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="SKU ou código de barras" aria-label="Código de barras ou SKU do produto" autoComplete="off"/><Button type="submit" variant="outline" disabled={moving || cameraOpen}>{moving ? "Registrando…" : "Registrar"}<ArrowRight /></Button></div></form></div></div>
      {cameraOpen && <div className="stock-reader-slot"><InventoryCamera onRead={acceptScan} onClose={() => setCameraOpen(false)}/></div>}
      <div className="stock-movement-note"><CheckCircle2 /><span>{mode === "add" ? "Entrada selecionada: cada leitura adiciona uma unidade ao saldo." : "Saída selecionada: cada leitura retira uma unidade do saldo."}</span></div>
    </section>
    <section className="surface table-surface stock-product-list"><div className="panel-heading"><div><span className="stock-eyebrow">CATÁLOGO DA EMPRESA</span><h2>Produtos e equipamentos</h2></div><span className="stock-count">{items.length} {items.length === 1 ? "item" : "itens"}</span></div>
    <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Identificação</TableHead><TableHead>Disponível</TableHead><TableHead>Mínimo</TableHead><TableHead>Custo unitário</TableHead><TableHead>Ajustar saldo</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => {
            const alertAt = Math.max(item.minimumQuantity, lowStockAlert);
            const warning = item.quantity <= alertAt;
            return <TableRow key={item.id}><TableCell className="stock-product-name"><button onClick={() => onSelect(item)}><span className={`stock-product-symbol ${warning ? "warning" : ""}`}><Boxes /></span><span><strong>{item.name}</strong><small className={warning ? "stock-low-label" : ""}>{warning ? "Reposição necessária" : "Estoque regular"}</small></span><ChevronRight /></button></TableCell><TableCell data-label="Código"><code className="stock-sku">{item.sku || "Sem código"}</code></TableCell><TableCell data-label="Disponível"><span className={`stock-amount ${warning ? "low" : ""}`}>{item.quantity} <small>{item.unit}</small></span></TableCell><TableCell data-label="Mínimo">{item.minimumQuantity} {item.unit}</TableCell><TableCell data-label="Custo unitário">{money(item.costCents)}</TableCell><TableCell className="stock-product-actions"><div className="stepper"><Button variant="outline" size="icon-sm" onClick={() => void onAdjust(item, -1)} aria-label="Retirar uma unidade"><span aria-hidden="true">−</span></Button><Button variant="outline" size="icon-sm" onClick={() => void onAdjust(item, 1)} aria-label="Adicionar uma unidade"><Plus /></Button>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o item ${item.name}`} onDelete={() => onDelete("inventory", item)}/>}</div></TableCell></TableRow>;
        })}</TableBody></Table>{!items.length && <div className="stock-empty"><span><Boxes /></span><h3>Seu estoque começa aqui</h3><p>Use “Novo item” para cadastrar o primeiro produto e escanear sua etiqueta.</p></div>}</section>
  </div>;
}
// Legacy compact finance table retained for fallback layouts.
// eslint-disable-next-line no-unused-vars
function Finance({ transactions, revenue, receivable, onSelect, onStatus, onDelete }) {
    const expense = transactions.filter((item) => item.type === "despesa").reduce((sum, item) => sum + item.amountCents, 0);
    const projected = revenue + receivable - expense;
    const max = Math.max(...transactions.map((item) => item.amountCents), 1);
    return <div className="finance-grid"><section className="cash-card"><div><small>SALDO PROJETADO</small><h2>{money(projected)}</h2><p>Recebidos + a receber − despesas</p></div><div className="cash-split"><span><ArrowUpRight />Entradas<b>{money(revenue + receivable)}</b></span><span><ArrowDownLeft />Despesas<b>{money(expense)}</b></span></div></section><section className="surface movement-chart"><div className="panel-heading"><div><small>MOVIMENTAÇÃO</small><h2>Valores por lançamento</h2></div></div><div className="bar-chart">{transactions.slice(0, 6).reverse().map((item) => <div key={item.id}><span className={item.type} style={{ height: `${Math.max(15, item.amountCents / max * 100)}%` }}/><small>{shortDate(item.dueDate)}</small></div>)}</div></section><section className="surface table-surface finance-table"><div className="panel-heading"><div><small>LANÇAMENTOS</small><h2>Contas a pagar e receber</h2></div><Badge variant="secondary">{transactions.length} registros</Badge></div><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{transactions.map((item) => <TableRow key={item.id}><TableCell><button className="table-link" onClick={() => onSelect(item)}><strong>{item.description}</strong></button></TableCell><TableCell>{item.category}</TableCell><TableCell>{shortDate(item.dueDate)}</TableCell><TableCell><Badge variant="outline" className={`type-${item.type}`}>{item.type === "receita" ? "Entrada" : "Saída"}</Badge></TableCell><TableCell><strong className={`money-${item.type}`}>{item.type === "despesa" ? "−" : "+"}{money(item.amountCents)}</strong></TableCell><TableCell><NativeSelect value={item.status} onChange={(event) => onStatus(item, event.target.value)} aria-label="Status financeiro">{Object.entries(transactionLabels).map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell>{onDelete && <DeleteButton label={`o lançamento ${item.description}`} onDelete={() => onDelete("transactions", item)}/>}</TableCell></TableRow>)}</TableBody></Table>{!transactions.length && <Empty>Nenhum lançamento encontrado.</Empty>}</section></div>;
}
function Team({ appointments, employees, onSelect, onEdit, onDelete }) {
    const maintenance = appointments.filter((item) => item.kind === "Manutenção").length;
    const installations = appointments.filter((item) => item.kind === "Instalação").length;
    const visits = appointments.filter((item) => item.kind === "Visita técnica").length;
    return <div className="team-grid"><section className="surface team-roster"><div className="panel-heading"><div><small>EQUIPE TÉCNICA</small><h2>Carga de trabalho</h2></div><Badge variant="secondary">{employees.length} profissionais</Badge></div>{employees.map((employee) => { const assigned = appointments.filter((item) => item.technician === employee.name).length; const load = Math.min(100, assigned * 20); return <article key={employee.id}><button className="team-profile" onClick={() => onSelect(employee)}><span className={`avatar large ${employee.color}`}>{initials(employee.name)}</span><div><h3>{employee.name}</h3><p>{employee.role}</p><span>{assigned} serviços atribuídos</span></div></button><div className="capacity"><small>Carga atribuída</small><strong>{load}%</strong><Progress value={load}/></div>{onEdit && <Button type="button" variant="outline" size="sm" onClick={() => onEdit(employee)}><Pencil />Editar</Button>}{onDelete && <DeleteButton label={`o profissional ${employee.name}`} onDelete={() => onDelete("employees", employee)}/>}</article>; })}{!employees.length && <Empty>Cadastre o primeiro profissional da equipe.</Empty>}</section><section className="surface team-summary"><div className="panel-heading"><div><small>OPERAÇÃO CADASTRADA</small><h2>Distribuição</h2></div></div><div className="radial-summary"><span><b>{appointments.length}</b><small>atendimentos</small></span></div><dl><div><dt>Manutenções</dt><dd>{maintenance}</dd></div><div><dt>Instalações</dt><dd>{installations}</dd></div><div><dt>Visitas técnicas</dt><dd>{visits}</dd></div></dl><div className="team-tip"><Sparkles /><p><strong>Visão operacional</strong>A carga é calculada a partir dos agendamentos realmente atribuídos.</p></div></section></div>;
}
function initialQuoteHasItems(record) {
    try { const notes = unpackNotes(record.notes); const lines = JSON.parse(notes.details.poolItems || "[]"); return Array.isArray(lines) && lines.length > 0; }
    catch { return false; }
}
function CreateDialog({ organizationId, entity, editingRecord, savingRecord, canManageCosts, employees, customers, settings, initialQuoteSelection, initialTransactionType, initialDraft, onExistingCustomer, onOpenChange, onSubmit }) {
    const [customerLookup, setCustomerLookup] = useState("");
    const [quoteCatalogReady, setQuoteCatalogReady] = useState(false);
    const titles = {
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
    if (!entity)
        return null;
    const [createTitle, description] = titles[entity];
    const title = editingRecord ? `Editar ${ { leads: "lead", quotes: "orçamento", appointments: "agendamento", workOrders: "serviço", customers: "cliente e piscina", inventory: "item de estoque", transactions: "lançamento", employees: "membro da equipe", warranties: "garantia", contracts: "contrato" }[entity]}` : createTitle;
    const technicianNames = [...new Set([...employees.filter(employee => employee.active).map(employee => employee.name), ...(initialDraft?.fields?.technician ? [initialDraft.fields.technician] : [])])];
    const technicianOptions = [["", "Não atribuído"], ...technicianNames.map(name => [name, name])];
    return <Dialog open onOpenChange={open => { if (!savingRecord) onOpenChange(open); }}><DialogContent movable={entity === "quotes"} className={entity === "quotes" ? "pool-quote-dialog" : entity === "inventory" ? "sm:max-w-2xl inventory-create-dialog" : "sm:max-w-2xl"}><DialogHeader><DialogTitle>{entity === "inventory" && <span className="stock-dialog-mark"><Boxes /></span>}{title}</DialogTitle><DialogDescription>{editingRecord && entity === "quotes" ? "Confira os itens e valores. Os totais serão recalculados pelo catálogo e pelas taxas atuais ao salvar." : description}</DialogDescription></DialogHeader><form className="record-form" onSubmit={onSubmit}>{entity === "leads" && <>
    <Field seed={initialDraft?.fields} label="Nome do contato *" name="name" required/><Field seed={initialDraft?.fields} label="Telefone *" name="phone" required/><Field seed={initialDraft?.fields} label="Origem" name="source" placeholder="Instagram, indicação, site…"/><Field seed={initialDraft?.fields} label="Interesse *" name="interest" required className="span-2"/><Field seed={initialDraft?.fields} label="Valor estimado (R$)" name="estimatedValue" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Próxima ação" name="nextAction"/><Field seed={initialDraft?.fields} label="Etapa" name="status" type="select" options={leadStages.map((item) => [item.id, item.label])} defaultValue="novo"/></>}
    {entity === "quotes" && editingRecord && !initialQuoteHasItems(editingRecord.record) && <><Field seed={initialDraft?.fields} label="Cliente *" name="clientName" required/><Field seed={initialDraft?.fields} label="Serviço *" name="service" required/><Field seed={initialDraft?.fields} label="Materiais (R$)" name="materials" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Mão de obra (R$)" name="labor" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Deslocamento (R$)" name="travel" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Desconto (R$)" name="discount" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Urgência" name="urgency" type="select" options={[["normal", "Normal"], ["urgente", "Urgente"], ["emergencia", "Emergência"]]}/><Field seed={initialDraft?.fields} label="Forma de pagamento" name="paymentMethod" type="select" options={[["pix", "Pix / dinheiro"], ["credit", "Cartão de crédito"], ["boleto", "Boleto"]]}/><Field seed={initialDraft?.fields} label="Parcelas" name="installments" type="number" min="1" max="24"/><Field seed={initialDraft?.fields} label="Juros do cartão (%)" name="cardRate" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Validade" name="validUntil" type="date"/><Field seed={initialDraft?.fields} label="Condição de pagamento" name="paymentTerms"/><Field seed={initialDraft?.fields} label="Observações" name="notes" type="textarea" className="span-2"/></>}
    {entity === "quotes" && (!editingRecord || initialQuoteHasItems(editingRecord.record)) && <PoolQuoteBuilderFields organizationId={organizationId} onReady={setQuoteCatalogReady} initialSelection={initialQuoteSelection} settings={settings} initialDraft={initialDraft?.fields}/>}
    {entity === "appointments" && <><Field seed={initialDraft?.fields} label="Compromisso *" name="title" required/><Field seed={initialDraft?.fields} label="Cliente *" name="clientName" required/><Field seed={initialDraft?.fields} label="Data e hora *" name="startAt" type="datetime-local" required/><Field seed={initialDraft?.fields} label="Técnico responsável" name="technician" type="select" options={technicianOptions}/><Field seed={initialDraft?.fields} label="Tipo" name="kind" type="select" options={[["Manutenção", "Manutenção"], ["Execução de serviço", "Execução de serviço"], ["Visita técnica", "Visita técnica"], ["Instalação", "Instalação"], ["Diagnóstico", "Diagnóstico"], ["Garantia", "Garantia"]]}/><Field seed={initialDraft?.fields} label="Frequência" name="frequency" type="select" options={[["avulsa", "Avulsa"], ["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"]]}/><Field seed={initialDraft?.fields} label="Tempo estimado" name="duration" placeholder="Ex.: 1h30"/><Field seed={initialDraft?.fields} label="Ordem na rota" name="routeOrder" type="number" min="1"/><Field seed={initialDraft?.fields} label="Endereço" name="address" className="span-2"/><Field seed={initialDraft?.fields} label="Observações" name="notes" type="textarea" className="span-2"/></>}
    {entity === "workOrders" && <><Field seed={initialDraft?.fields} label="Cliente *" name="clientName" required/><Field seed={initialDraft?.fields} label="Serviço *" name="service" required className="span-2"/><Field seed={initialDraft?.fields} label="Data e hora" name="scheduledAt" type="datetime-local"/><Field seed={initialDraft?.fields} label="Técnico" name="technician" type="select" options={technicianOptions}/><Field seed={initialDraft?.fields} label="pH" name="ph" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Cloro livre (ppm)" name="chlorine" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Alcalinidade (ppm)" name="alkalinity" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Dureza cálcica" name="calciumHardness"/><Field seed={initialDraft?.fields} label="Estabilizante" name="stabilizer"/><Field seed={initialDraft?.fields} label="Aspecto da água" name="waterAppearance" type="select" options={[["cristalina", "Cristalina"], ["verde", "Verde"], ["turva", "Turva"], ["oleosa", "Oleosa"]]}/><Field seed={initialDraft?.fields} label="Produtos aplicados" name="productsUsed" className="span-2"/><Field seed={initialDraft?.fields} label="Custo de produtos (R$)" name="productCost" inputMode="decimal" readOnly={Boolean(editingRecord) && !canManageCosts}/><Field seed={initialDraft?.fields} label="Mão de obra (R$)" name="laborCost" inputMode="decimal" readOnly={Boolean(editingRecord) && !canManageCosts}/><Field seed={initialDraft?.fields} label="Deslocamento (R$)" name="travelCost" inputMode="decimal" readOnly={Boolean(editingRecord) && !canManageCosts}/><Field seed={initialDraft?.fields} label="Valor cobrado (R$)" name="amount" inputMode="decimal" readOnly={Boolean(editingRecord) && !canManageCosts}/><Field seed={initialDraft?.fields} label="Checklist executado" name="checklist" type="textarea" className="span-2" placeholder="Escovar bordas; aspirar fundo; limpar pré-filtro; medir pH e cloro; aplicar produto; foto final; confirmação do cliente"/><Field seed={initialDraft?.fields} label="Relatório técnico" name="notes" type="textarea" className="span-2"/></>}
    {entity === "customers" && <><CustomerDuplicateLookup value={customerLookup} customers={customers} onChange={setCustomerLookup} onSelect={onExistingCustomer}/><CustomerContactFields organizationId={organizationId} requireDocument={settings.requireCustomerDocument} initialValues={initialDraft?.fields}/><Field seed={initialDraft?.fields} label="Tipo da piscina" name="poolType" placeholder="Vinil, fibra, alvenaria…"/><Field seed={initialDraft?.fields} label="Formato" name="poolShape" type="select" options={[["retangular", "Retangular"], ["redonda", "Redonda"], ["oval", "Oval"], ["irregular", "Irregular"]]}/><Field seed={initialDraft?.fields} label="Comprimento (m)" name="poolLength" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Largura/diâmetro (m)" name="poolWidth" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Profundidade média (m)" name="poolDepth" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Volume informado (litros)" name="poolVolume" inputMode="numeric" placeholder="Opcional: calculado pelas medidas"/><Field seed={initialDraft?.fields} label="Tipo de filtro" name="filterType"/><Field seed={initialDraft?.fields} label="Bomba instalada" name="pump"/><Field seed={initialDraft?.fields} label="Frequência de manutenção" name="frequency" type="select" options={[["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"], ["sob demanda", "Sob demanda"]]}/><Field seed={initialDraft?.fields} label="Plano" name="plan" type="select" options={[["Básico", "Básico"], ["Premium", "Premium"], ["Condomínio", "Condomínio"], ["Emergência", "Emergência"]]}/><Field seed={initialDraft?.fields} label="Dia de cobrança" name="billingDay" type="number" min="1" max="31"/><Field seed={initialDraft?.fields} label="Responsável / síndico" name="responsible"/><Field seed={initialDraft?.fields} label="Histórico de problemas" name="problemHistory" type="textarea" className="span-2"/><Field seed={initialDraft?.fields} label="Observações técnicas" name="notes" type="textarea" className="span-2"/></>}
    {entity === "inventory" && <>
      <section className="stock-form-section span-2"><div className="stock-form-section-title"><span>01</span><div><h3>Identifique o produto</h3><p>O código conecta a etiqueta ao seu estoque.</p></div></div><Field seed={initialDraft?.fields} label="Nome do produto ou peça *" name="name" placeholder="Ex.: Cloro granulado 10 kg" required className="span-2"/><InventoryBarcodeField initialValue={initialDraft?.fields?.sku}/><Field seed={initialDraft?.fields} label="Unidade de medida" name="unit" placeholder="Ex.: unidade, balde, litro" className="span-2"/></section>
      <section className="stock-form-section span-2"><div className="stock-form-section-title"><span>02</span><div><h3>Defina o saldo inicial</h3><p>Quantidades e custo para começar a acompanhar.</p></div></div><Field seed={initialDraft?.fields} label={editingRecord ? "Quantidade atual" : "Quantidade inicial"} name="quantity" inputMode="decimal" placeholder="0"/><Field seed={initialDraft?.fields} label="Estoque mínimo" name="minimumQuantity" inputMode="decimal" placeholder="0"/><Field seed={initialDraft?.fields} label="Custo unitário (R$)" name="cost" inputMode="decimal" placeholder="0,00" className="span-2"/></section>
    </>}
    {entity === "transactions" && <><Field seed={initialDraft?.fields} label="Descrição *" name="description" required className="span-2"/><Field seed={initialDraft?.fields} label="Tipo" name="type" type="select" options={[["receita", "Receita / a receber"], ["despesa", "Despesa / a pagar"]]} defaultValue={initialTransactionType}/><Field seed={initialDraft?.fields} label="Categoria" name="category"/><Field seed={initialDraft?.fields} label="Valor (R$) *" name="amount" inputMode="decimal" required/><Field seed={initialDraft?.fields} label="Vencimento" name="dueDate" type="date"/><Field seed={initialDraft?.fields} label="Status" name="status" type="select" options={Object.entries(transactionLabels)} defaultValue="pendente"/></>}
    {entity === "employees" && <><Field seed={initialDraft?.fields} label="Nome *" name="name" required/><Field seed={initialDraft?.fields} label="Função *" name="role" required placeholder="Técnico, instalador, comercial…"/><Field seed={initialDraft?.fields} label="Telefone" name="phone"/><Field seed={initialDraft?.fields} label="Cor de identificação" name="color" type="select" options={[["aqua", "Turquesa"], ["blue", "Azul"], ["violet", "Violeta"], ["orange", "Laranja"]]}/></>}
    {entity === "employees" && editingRecord && <Field seed={initialDraft?.fields} label="Situação" name="active" type="select" options={[["true", "Ativo"], ["false", "Inativo"]]}/>}
    {entity === "warranties" && <><Field seed={initialDraft?.fields} label="Cliente *" name="clientName" required/><Field seed={initialDraft?.fields} label="Referência de origem" name="originReference" placeholder="Orçamento, OS ou nota fiscal"/><Field seed={initialDraft?.fields} label="Item ou serviço coberto *" name="item" required className="span-2"/><Field seed={initialDraft?.fields} label="Data da compra/entrega" name="purchaseDate" type="date"/><Field seed={initialDraft?.fields} label="Validade da garantia *" name="expiresAt" type="date" required/><Field seed={initialDraft?.fields} label="Condições e observações" name="notes" type="textarea" className="span-2"/></>}
    {entity === "contracts" && <><Field seed={initialDraft?.fields} label="Cliente *" name="clientName" required/><Field seed={initialDraft?.fields} label="CPF/CNPJ" name="clientDocument"/><Field seed={initialDraft?.fields} label="Endereço do cliente" name="clientAddress" className="span-2"/><Field seed={initialDraft?.fields} label="Objeto do contrato *" name="service" type="textarea" required className="span-2"/><Field seed={initialDraft?.fields} label="Início *" name="startDate" type="date" required/><Field seed={initialDraft?.fields} label="Término *" name="endDate" type="date" required/><Field seed={initialDraft?.fields} label="Frequência" name="frequency" type="select" options={[["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"], ["trimestral", "Trimestral"], ["sob demanda", "Sob demanda"]]} defaultValue="mensal"/><Field seed={initialDraft?.fields} label="Mensalidade (R$)" name="monthly" inputMode="decimal"/><Field seed={initialDraft?.fields} label="Dia de pagamento" name="paymentDay" type="number" min="1" max="31"/><Field seed={initialDraft?.fields} label="Cláusulas e condições" name="terms" type="textarea" className="span-2" placeholder="Descreva obrigações, materiais incluídos, reajuste e rescisão."/></>}
    <DialogFooter className="span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={savingRecord}>Cancelar</Button><Button type="submit" disabled={savingRecord || (entity === "quotes" && (!editingRecord || initialQuoteHasItems(editingRecord.record)) && !quoteCatalogReady)}>{savingRecord ? "Salvando…" : editingRecord ? "Salvar alterações" : "Salvar registro"}</Button></DialogFooter></form></DialogContent></Dialog>;
}
function PoolQuoteBuilderFields({ organizationId, onReady, initialSelection, settings, initialDraft }) {
    const defaultValidUntil = useMemo(() => {
        const next = new Date();
        next.setDate(next.getDate() + Math.max(1, settings.defaultQuoteValidityDays || 7));
        return next.toISOString().slice(0, 10);
    }, [settings.defaultQuoteValidityDays]);
    const [client, setClient] = useState(initialDraft?.clientName ?? "");
    const [config, setConfig] = useState(defaultPoolQuoteConfig);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState("");
    const [configReload, setConfigReload] = useState(0);
    const [category, setCategory] = useState(initialSelection?.category ?? defaultPoolQuoteConfig.catalog[0]?.category ?? "");
    const [selectedName, setSelectedName] = useState(initialSelection?.name ?? defaultPoolQuoteConfig.catalog[0]?.items[0]?.name ?? "");
    const [dimensions, setDimensions] = useState({});
    const [lines, setLines] = useState(() => {
        try { const saved = JSON.parse(initialDraft?.poolItems || "[]"); return Array.isArray(saved) ? saved.map(line => ({ ...line, total: line.totalCents ?? line.total ?? 0 })) : []; }
        catch { return []; }
    });
    const [labor, setLabor] = useState(initialDraft?.labor ?? "");
    const [travel, setTravel] = useState(initialDraft?.travel ?? "");
    const [discount, setDiscount] = useState(initialDraft?.discount ?? "");
    const [urgency, setUrgency] = useState(initialDraft?.urgency ?? "normal");
    const [paymentMethod, setPaymentMethod] = useState(initialDraft?.paymentMethod ?? "pix");
    const [installments, setInstallments] = useState(initialDraft?.installments ?? "1");
    const [cardRate, setCardRate] = useState(initialDraft?.cardRate ?? "3.99");
    useEffect(() => {
        let disposed = false;
        fetch("/api/quote-config", { headers: { "x-organization-id": organizationId }, cache: "no-store" })
            .then(async (response) => {
            const payload = await response.json();
            if (!response.ok || !isPoolQuoteConfig(payload.config))
                throw new Error(payload.error || "Não foi possível carregar o catálogo.");
            if (disposed)
                return;
            const next = payload.config;
            const initialCategory = next.catalog.find(entry => entry.category === initialSelection?.category) ?? next.catalog[0];
            const initialItem = initialCategory?.items.find(entry => entry.name === initialSelection?.name) ?? initialCategory?.items[0];
            setConfig(next);
            setCategory(initialCategory?.category ?? "");
            setSelectedName(initialItem?.name ?? "");
            setConfigError("");
            onReady(true);
        })
            .catch(error => { if (!disposed) {
            setConfigError(error instanceof Error ? error.message : "Não foi possível carregar o catálogo.");
            onReady(false);
        } })
            .finally(() => { if (!disposed)
            setConfigLoading(false); });
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
        if (!item || quantity <= 0)
            return;
        setLines((current) => [...current, { category, name: item.name, unit: item.unit, quantity, unitPrice: item.price, markup: item.markup, total: itemTotal, dimensions: { ...dimensions } }]);
        setDimensions({});
    }
    if (configLoading)
        return <p className="span-2" role="status">Carregando catálogo da empresa…</p>;
    if (configError)
        return <div className="span-2"><p role="alert">{configError}</p><Button type="button" onClick={() => { setConfigLoading(true); setConfigReload(value => value + 1); }}>Tentar novamente</Button></div>;
    return <>
    <Field label="Cliente *" name="clientName" required value={client} onChange={(event) => setClient(event.target.value)}/>
    <section className="pool-catalog-picker span-2" aria-label="Catálogo de piscinas">
      <div className="pool-builder-heading"><div><strong>{config.title}</strong><small>Catálogo individual da empresa: fibra, alvenaria, equipamentos, medidas e valores próprios.</small></div><span>{config.catalog.length} categorias</span></div>
      <div className="pool-category-chips">{config.catalog.map((entry) => <button type="button" key={entry.category} className={category === entry.category ? "active" : ""} onClick={() => { setCategory(entry.category); setSelectedName(entry.items[0]?.name ?? ""); setDimensions({}); }}>{entry.category}</button>)}</div>
      <div className="pool-service-cards">{(activeCategory?.items ?? []).map((entry) => <button type="button" key={entry.name} className={selectedName === entry.name ? "active" : ""} onClick={() => { setSelectedName(entry.name); setDimensions({}); }}><strong>{entry.name}</strong><span>{money(Math.round(entry.price * (1 + entry.markup / 100) * 100))} / {entry.unit}</span><small>Margem {entry.markup}%</small></button>)}</div>
      {item && <div className="pool-item-config"><div className="pool-builder-heading"><div><strong>2. Configure o projeto</strong><small>Informe as medidas para calcular o valor automaticamente.</small></div><span>{item.unit}</span></div>
        <div className="pool-measure-fields">{item.fields.map((field) => <Field key={field.key} label={field.unit ? `${field.label} (${field.unit})` : field.label} name={`pool_${field.key}`} type={field.type === "number" ? "number" : "text"} step={field.type === "number" ? "0.01" : undefined} value={dimensions[field.key] ?? ""} onChange={(event) => setDimensions((current) => ({ ...current, [field.key]: event.target.value }))}/>)}{!["m²", "m2", "m³", "m3", "m", "metro", "metros"].includes(item.unit.trim().toLowerCase()) && !item.fields.some(field => poolQuoteFieldRole(field) === "quantity") && <Field label={`Quantidade (${item.unit})`} name="pool_quantity" type="number" min="1" step="1" value={dimensions.quantity ?? "1"} onChange={(event) => setDimensions((current) => ({ ...current, quantity: event.target.value }))}/>}</div>
        <div className="pool-price-preview"><div><small>Área / quantidade</small><strong>{quantity.toLocaleString("pt-BR")} {item.unit}</strong></div><div><small>Preço estimado do item</small><strong>{money(itemTotal)}</strong></div><Button type="button" onClick={addLine} disabled={quantity <= 0}><Plus /> Adicionar ao orçamento</Button></div>
      </div>}
    </section>
    <section className="pool-quote-lines span-2"><div className="pool-builder-heading"><div><strong>Itens do orçamento</strong><small>{lines.length ? `${lines.length} item(ns) adicionado(s)` : "Adicione um ou mais projetos ao orçamento."}</small></div><b>{money(itemsTotal)}</b></div>
      {lines.map((line, index) => <article className="pool-quote-line" key={index}><div><strong>{line.name}</strong><small>{line.category} · {line.quantity.toLocaleString("pt-BR")} {line.unit} · margem {line.markup}%</small>{Object.keys(line.dimensions).length > 0 && <small>{Object.entries(line.dimensions).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ")}</small>}</div><strong>{money(line.total)}</strong><button type="button" aria-label={`Remover ${line.name}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Remover</button></article>)}
      <input type="hidden" name="poolItems" value={JSON.stringify(lines)}/>
      <input type="hidden" name="service" value={lines.map((line) => line.name).join(", ")}/>
      <input type="hidden" name="materials" value={(materialsCents / 100).toFixed(2)}/>
      <input type="hidden" name="products" value={JSON.stringify(lines)}/>
    </section>
    <Field label="Mão de obra (R$)" name="labor" inputMode="decimal" value={labor} onChange={(event) => setLabor(event.target.value)}/>
    <Field label="Deslocamento (R$)" name="travel" inputMode="decimal" value={travel} onChange={(event) => setTravel(event.target.value)}/>
    <Field label="Urgência" name="urgency" type="select" value={urgency} options={Object.entries(config.urgency).map(([key, rate]) => [key, `${key === "normal" ? "Normal" : key === "urgente" ? "Urgente" : "Emergência"} (+${rate}%)`])} onChange={(event) => setUrgency(event.target.value)}/>
    <Field label="Desconto (R$)" name="discount" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)}/>
    <Field label="Forma de pagamento" name="paymentMethod" type="select" value={paymentMethod} options={[["pix", "Pix / dinheiro"], ["credit", "Cartão de crédito"], ["boleto", "Boleto"]]} onChange={(event) => setPaymentMethod(event.target.value)}/>
    <Field label="Parcelas no crédito" name="installments" type="number" min="1" max="24" step="1" value={installments} onChange={(event) => setInstallments(event.target.value)}/>
    <Field label="Juros do cartão (%)" name="cardRate" type="number" min="0" max="50" step="0.01" value={cardRate} onChange={(event) => setCardRate(event.target.value)}/>
    <div className="quote-breakdown span-2"><span>Itens<b>{money(materialsCents)}</b></span><span>Mão de obra<b>{money(laborCents)}</b></span><span>Deslocamento<b>{money(travelCents)}</b></span><span>{urgency === "normal" ? "Normal" : urgency === "urgente" ? "Urgente" : "Emergência"} (+{config.urgency[urgency]}%)<b>+ {money(surcharge)}</b></span><span>Desconto<b>− {money(discountCents)}</b></span><span>Subtotal<b>{money(baseTotal)}</b></span>{paymentMethod === "credit" && <span>Juros cartão ({creditRate.toLocaleString("pt-BR")}%)<b>+ {money(cardFeeCents)}</b></span>}<strong>Total estimado<em>{money(total)}</em></strong>{paymentMethod === "credit" && <small>{installmentCount}x de {money(installmentCents)} no cartão</small>}</div>
    <input type="hidden" name="cardFee" value={(cardFeeCents / 100).toFixed(2)}/>
    <input type="hidden" name="poolItemsRequired" value={lines.length}/>
    <Field seed={initialDraft} label="Validade" name="validUntil" type="date" defaultValue={defaultValidUntil}/><Field seed={initialDraft} label="Condição de pagamento" name="paymentTerms" defaultValue={settings.defaultPaymentTerms}/><Field seed={initialDraft} label="Observações" name="notes" type="textarea" className="span-2" defaultValue={settings.quoteTerms}/>
  </>;
}
function Field({ label, name, type = "text", options, className = "", seed, ...props }) {
    if (seed?.[name] !== undefined && props.value === undefined)
        props.defaultValue = seed[name];
    return <div className={`form-field ${className}`}><Label htmlFor={name}>{label}</Label>{type === "textarea" ? <Textarea id={name} name={name} {...props}/> : type === "select" ? <NativeSelect id={name} name={name} {...props}>{options?.map(([value, text]) => <NativeSelectOption value={value} key={value}>{text}</NativeSelectOption>)}</NativeSelect> : <Input id={name} name={name} type={type} {...props}/>}</div>;
}
function CustomerDuplicateLookup({ value, customers, onChange, onSelect }) {
    const digits = documentDigits(value);
    const matches = digits.length >= 3 ? customers.filter((customer) => documentDigits(unpackNotes(customer.notes).details.clientDocument ?? "").includes(digits)).slice(0, 4) : [];
    return <div className="customer-lookup form-field span-2"><Label htmlFor="customerLookup">Conferir cliente por CPF/CNPJ</Label><div className="customer-lookup-input"><Search /><Input id="customerLookup" value={value} onChange={(event) => onChange(formatTaxDocument(event.target.value))} placeholder="Digite o documento para procurar nos seus clientes" autoCapitalize="characters" maxLength={18}/></div><small>Busca apenas nos cadastros da empresa atual.</small>{digits.length >= 3 && <div className="customer-lookup-results" role="status">{matches.length ? <><strong>Cliente já cadastrado</strong>{matches.map((customer) => <button type="button" key={customer.id} onClick={() => onSelect(customer)}><span>{customer.name}</span><small>Abrir cadastro</small><ChevronRight /></button>)}</> : <span>Nenhum cadastro encontrado. Você pode continuar.</span>}</div>}</div>;
}
function DetailSheet({ data, allowed, onSelect, onEdit, onExecute, selected, organizationId, organizationName, onClose, onDelete }) {
    if (!selected)
        return null;
    const record = selected.record;
    let title = "Detalhes";
    let subtitle = "Registro operacional";
    let content = null;
    if (selected.entity === "leads") {
        const lead = record;
        title = lead.name;
        subtitle = lead.interest;
        content = <><DetailGrid items={[["Telefone", lead.phone], ["Origem", lead.source], ["Valor potencial", money(lead.estimatedValueCents)], ["Etapa", leadStages.find((item) => item.id === lead.status)?.label ?? lead.status]]}/><DetailBlock label="Próxima ação">{lead.nextAction || "Não definida"}</DetailBlock></>;
    }
    else if (selected.entity === "quotes") {
        const quote = record;
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
        title = quote.quoteNumber;
        subtitle = quote.clientName;
        content = <><DetailBlock label="Serviço">{quote.service}</DetailBlock><div className="quote-breakdown"><span>Itens<b>{money(quote.materialsCents)}</b></span><span>Mão de obra<b>{money(quote.laborCents)}</b></span><span>Deslocamento<b>{money(travelCents)}</b></span><span>{urgencyLabel}<b>+ {money(urgencySurchargeCents)}</b></span><span>Desconto<b>− {money(quote.discountCents)}</b></span>{cardFeeCents > 0 && <span>Juros cartão<b>+ {money(cardFeeCents)}</b></span>}<strong>Total<em>{money(quote.totalCents)}</em></strong>{cardFeeCents > 0 && <small>{installments}x de {money(Math.ceil(quote.totalCents / installments))}</small>}</div><DetailGrid items={[["Itens do orçamento", quoteProductsSummary(quoteNotes.details.poolItems || quoteNotes.details.products)], ["Pagamento", quoteNotes.details.paymentTerms || paymentLabel || "Não informado"], ["Forma", paymentLabel], ["Status", quoteLabels[quote.status]], ["Validade", shortDate(quote.validUntil)]]}/>{quoteNotes.text && <DetailBlock label="Observações">{quoteNotes.text}</DetailBlock>}</>;
    }
    else if (selected.entity === "appointments") {
        const item = record;
        title = item.title;
        subtitle = item.clientName;
        content = <><DetailGrid items={[["Data e hora", fullDate(item.startAt)], ["Técnico", item.technician], ["Tipo", item.kind], ["Status", appointmentLabels[item.status]]]}/><DetailBlock label="Endereço">{item.address || "Não informado"}</DetailBlock><div className="detail-actions"><WazeLink destination={item.address}/></div><StructuredNotes value={item.notes}/></>;
    }
    else if (selected.entity === "workOrders") {
        const order = record;
        const completion = workOrderCompletion(order.notes);
        title = order.osNumber;
        subtitle = `${order.clientName} · ${order.service}`;
        content = <><DetailGrid items={[["Agendamento", fullDate(order.scheduledAt)], ["Técnico", order.technician], ["Status", orderLabels[order.status]], ["Valor", money(order.amountCents)]]}/><div className="reading-detail"><span><small>pH</small><b>{order.ph ?? "—"}</b></span><span><small>Cloro</small><b>{order.chlorine !== null ? `${order.chlorine} ppm` : "—"}</b></span><span><small>Alcalinidade</small><b>{order.alkalinity !== null ? `${order.alkalinity} ppm` : "—"}</b></span></div><DetailBlock label="Produtos utilizados">{serviceProducts(order.productsUsed) || "Ainda não registrados."}</DetailBlock><StructuredNotes value={order.notes}/>{completion && <><DetailBlock label="Relatório de execução">{completion.summary || "—"}</DetailBlock><DetailGrid items={[["Confirmação do cliente", completion.customerName || "—"], ["Concluído em", completion.confirmedAt ? fullDate(completion.confirmedAt) : "—"]]}/></>}<div className="detail-actions"><Button variant="outline" asChild><a href={documentUrl("workOrders", order.id, organizationId)} download><FileDown />Gerar relatório em PDF</a></Button><Button variant="outline" onClick={() => shareText(`Olá! Serviço ${order.osNumber} concluído para ${order.clientName}.\n\nServiço: ${order.service}\nProdutos utilizados: ${serviceProducts(order.productsUsed) || "não informado"}\npH: ${order.ph ?? "—"} · Cloro: ${order.chlorine ?? "—"} ppm · Alcalinidade: ${order.alkalinity ?? "—"}\n\n${completion?.summary ? `Relatório: ${completion.summary}` : "Relatório técnico disponível no Fama System."}`)}><MessageCircle />Enviar pós-visita</Button></div></>;
    }
    else if (selected.entity === "customers") {
        const customer = record;
        title = customer.name;
        subtitle = customer.plan;
        content = <><DetailGrid items={[["Telefone", customer.phone], ["E-mail", customer.email || "Não informado"], ["Tipo da piscina", customer.poolType || "Não informado"], ["Volume", customer.poolVolume ? `${customer.poolVolume.toLocaleString("pt-BR")} litros` : "Não informado"]]}/><DetailBlock label="Endereço">{customer.address || "Não informado"}</DetailBlock><div className="detail-actions"><WazeLink destination={customer.address}/></div><StructuredNotes value={customer.notes}/><CustomerTimeline data={data} customer={customer} allowed={allowed} onSelect={onSelect}/></>;
    }
    else if (selected.entity === "inventory") {
        const item = record;
        title = item.name;
        subtitle = item.sku || "Item sem SKU";
        content = <><div className={`inventory-balance ${item.quantity <= item.minimumQuantity ? "low" : ""}`}><small>SALDO ATUAL</small><strong>{item.quantity} <span>{item.unit}</span></strong><p>Mínimo recomendado: {item.minimumQuantity} {item.unit}</p></div><DetailGrid items={[["Custo unitário", money(item.costCents)], ["Valor do saldo", money(item.costCents * item.quantity)]]}/></>;
    }
    else if (selected.entity === "transactions") {
        const item = record;
        title = item.description;
        subtitle = item.category;
        content = <><div className={`transaction-total ${item.type}`}><small>{item.type === "receita" ? "ENTRADA" : "SAÍDA"}</small><strong>{money(item.amountCents)}</strong></div><DetailGrid items={[["Vencimento", shortDate(item.dueDate)], ["Status", transactionLabels[item.status]], ["Categoria", item.category], ["Tipo", item.type === "receita" ? "Receita" : "Despesa"]]}/></>;
    }
    else if (selected.entity === "employees") {
        const employee = record;
        title = employee.name;
        subtitle = employee.role;
        content = <DetailGrid items={[["Telefone", employee.phone || "Não informado"], ["Situação", employee.active ? "Ativo" : "Inativo"], ["Cadastrado em", shortDate(employee.createdAt)]]}/>;
    }
    else if (selected.entity === "warranties") {
        const warranty = record;
        title = warranty.warrantyNumber;
        subtitle = warranty.clientName;
        content = <><DetailBlock label="Cobertura">{warranty.item}</DetailBlock><DetailGrid items={[["Status", warrantyLabels[warranty.status]], ["Origem", warranty.originReference || "Não informada"], ["Compra/entrega", shortDate(warranty.purchaseDate)], ["Validade", shortDate(warranty.expiresAt)], ["Atendimento", warranty.scheduledAt ? fullDate(warranty.scheduledAt) : "Não agendado"], ["Técnico", warranty.technician || "Não atribuído"]]}/><DetailBlock label="Condições e observações">{warranty.notes || "Sem observações."}</DetailBlock></>;
    }
    else if (selected.entity === "contracts") {
        const contract = record;
        title = contract.contractNumber;
        subtitle = contract.clientName;
        content = <><div className="transaction-total"><small>MENSALIDADE</small><strong>{money(contract.monthlyCents)}</strong></div><DetailBlock label="Objeto do contrato">{contract.service}</DetailBlock><DetailGrid items={[["CPF/CNPJ", contract.clientDocument || "Não informado"], ["Vigência", `${shortDate(contract.startDate)} — ${shortDate(contract.endDate)}`], ["Frequência", contract.frequency], ["Pagamento", contract.paymentDay ? `Dia ${contract.paymentDay}` : "Não informado"], ["Status", contractLabels[contract.status]]]}/><DetailBlock label="Endereço do cliente">{contract.clientAddress || "Não informado"}</DetailBlock><DetailBlock label="Cláusulas e condições">{contract.terms || "Sem cláusulas adicionais."}</DetailBlock><Button variant="outline" asChild><a href={documentUrl("contracts", contract.id, organizationId)} download><FileDown />Gerar contrato em PDF</a></Button></>;
    }
    return <Sheet open onOpenChange={(open) => !open && onClose()}><SheetContent className="detail-sheet sm:max-w-xl"><SheetHeader><Badge variant="secondary">Registro</Badge><SheetTitle>{title}</SheetTitle><SheetDescription>{subtitle}</SheetDescription></SheetHeader><div className="detail-content"><div className="detail-actions">{!(selected.entity === "workOrders" && record.status === "concluida") && <Button type="button" variant="outline" onClick={() => onEdit(selected.entity, record)}><Pencil />Editar registro</Button>}{selected.entity === "workOrders" && record.status !== "concluida" && <Button type="button" onClick={() => onExecute(record, record.status === "aberta" ? "em_execucao" : "concluida")}>{record.status === "aberta" ? <Play /> : <CheckCircle2 />}{record.status === "aberta" ? "Iniciar serviço" : "Finalizar serviço"}</Button>}</div>{content}<RecordAttachments organizationId={organizationId} entity={selected.entity} recordId={selected.record.id} canDelete={Boolean(onDelete)}/>{onDelete && <div className="detail-delete"><DeleteButton compact={false} label={title} onDelete={() => onDelete(selected.entity, selected.record)}/></div>}</div></SheetContent></Sheet>;
}
function DetailGrid({ items }) {
    return <dl className="detail-grid">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>;
}
function DetailBlock({ label, children }) {
    return <section className="detail-block"><small>{label}</small><p>{children}</p></section>;
}
