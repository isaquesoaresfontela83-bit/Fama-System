"use client";
import { ControlCommercial } from "./control-commercial";
import { ControlHealth } from "./control-health";
import { ControlSupport } from "./control-support";
import { PlanPolicyEditor } from "./plan-policy-editor";
import { ControlMfaPanel } from "./control-mfa-panel";
/* eslint-disable @next/next/no-img-element */
import { lazy, memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FAMA_VERSION } from "@/lib/fama-release";
import { Link2, Activity, Search, Crown, Sparkles, Settings2, ArrowLeft, Bell, Building2, CheckCircle2, CircleDollarSign, CreditCard, Database, ExternalLink, FileText, KeyRound, LayoutDashboard, Blocks, LogOut, Menu, Plus, RefreshCw, ShieldCheck, TrendingUp, Trash2, UsersRound, UserCog, MessageCircle, } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ControlOverview } from "./control-overview";
import { Toaster } from "@/components/ui/sonner";
import { featurePermissions } from "@/lib/permissions";
import { defaultPoolQuoteConfig } from "@/lib/pool-quote-catalog";
import { defaultPlanCatalog } from "@/lib/plan-catalog";
import { useFamaAiSettings } from "@/hooks/use-fama-ai-settings";
import { useClientMutation } from "@/hooks/use-client-mutation";
import { useWorkspaceNavigation } from "@/hooks/use-workspace-navigation";
import { ClientRequestError, isTransientRequestError } from "@/lib/client-request";
import { controlResources, readControlWorkspace } from "@/lib/control-load";
import { FamaLocalAiProvider } from "@/hooks/use-fama-local-ai";
import { WorkspaceView } from "./workspace-view";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
const loadControlIntegrations = () => import("./control-integrations");
const ControlIntegrations = lazy(() => loadControlIntegrations().then(module => ({ default: module.ControlIntegrations })));
const loadFamaAiPanel = () => import("./fama-ai-panel");
const loadFamaAiSettingsPanel = () => import("./fama-ai-settings-panel");
const loadCompanyAccountsDialog = () => import("./company-accounts-dialog");
const loadFamaBlocksPanel = () => import("./fama-blocks-panel");
const FamaBlocksPanel = lazy(() => loadFamaBlocksPanel().then(module => ({ default: module.FamaBlocksPanel })));
const FamaAiPanel = lazy(() => loadFamaAiPanel().then(module => ({ default: module.FamaAiPanel })));
const FamaAiSettingsPanel = lazy(() => loadFamaAiSettingsPanel().then(module => ({ default: module.FamaAiSettingsPanel })));
const CompanyAccountsDialog = lazy(() => loadCompanyAccountsDialog().then(module => ({ default: module.CompanyAccountsDialog })));
const AccessValidationPanel = lazy(() => import("./access-validation-panel").then(module => ({ default: module.AccessValidationPanel })));
function date(value) {
    if (!value)
        return "—";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}
function money(cents) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function planStatusLabel(status, provider, billingEnabled = true) {
    if (!billingEnabled || provider === "courtesy")
        return "Isenta de mensalidade";
    if (status === "active")
        return "Pago";
    if (status === "pending_payment")
        return "Aguardando Pix";
    if (status === "payment_attention")
        return "Atenção";
    if (status === "expired")
        return "Vencido";
    if (status === "cancelled")
        return "Cancelado";
    return "Teste";
}
function dueSoon(value) {
    if (!value)
        return false;
    const due = new Date(value).getTime();
    if (Number.isNaN(due))
        return false;
    return due >= Date.now() && due <= Date.now() + 7 * 24 * 60 * 60 * 1000;
}
function ticketStatusLabel(status) {
    if (status === "em_analise")
        return "Em análise";
    if (status === "resolvido")
        return "Resolvido";
    return "Aberto";
}
function Brand() {
    return <div className="control-brand"><span className="control-brand-mark"><img src="/fama-piscinas-mark.png" alt=""/></span><div><strong>FAMA</strong><small>CONTROL</small></div></div>;
}
function StateBadge({ ok, children }) {
    return <Badge className={`control-state ${ok ? "control-state-ok" : "control-state-warn"}`}>{ok ? <CheckCircle2 /> : <KeyRound />}{children}</Badge>;
}
const permissionPresets = [
    { label: "Proprietário", permissions: featurePermissions.map((item) => item.id) },
    { label: "Administrador", permissions: featurePermissions.map((item) => item.id) },
    { label: "Comercial", permissions: ["dashboard", "crm", "quotes", "customers"] },
    { label: "Técnico", permissions: ["dashboard", "mobile", "agenda", "orders", "customers", "warranties"] },
    { label: "Financeiro", permissions: ["dashboard", "quotes", "contracts", "finance"] },
    { label: "Suporte", permissions: ["dashboard", "crm", "customers", "warranties"] },
];
const permissionGroups = ["Operação", "Gestão"];
const controlNavigation = [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "companies", label: "Empresas e usuários", icon: Building2 },
    { id: "blocks", label: "Blocos do sistema", icon: Blocks },
    { id: "assistant", label: "Fama IA", icon: Sparkles },
    { id: "ai-settings", label: "Configurar IA", icon: Settings2 },
    { id: "sales", label: "Vendas", icon: TrendingUp },
    { id: "finance", label: "Financeiro", icon: CircleDollarSign },
    { id: "plans", label: "Planos", icon: CreditCard },
    { id: "support", label: "Suporte", icon: MessageCircle },
    { id: "health", label: "Central de saúde", icon: Bell },
    { id: "integrations", label: "Integrações", icon: Link2 },
    { id: "quotes", label: "Orçamento", icon: FileText },
    { id: "permissions", label: "Usuários", icon: UserCog },
    { id: "security", label: "Segurança", icon: ShieldCheck },
    { id: "audit", label: "Auditoria", icon: Activity },
    { id: "privacy", label: "Privacidade", icon: Database },
];
const controlViews = controlNavigation.map(item => item.id);
function preloadControlView(section) {
    const load = section === "integrations" ? loadControlIntegrations : section === "assistant" ? loadFamaAiPanel : section === "ai-settings" ? loadFamaAiSettingsPanel : section === "blocks" ? loadFamaBlocksPanel : section === "companies" ? loadCompanyAccountsDialog : null;
    if (load)
        void load().catch(() => undefined);
}
function PoolQuoteCatalogEditor({ systemUrl }) {
    const [config, setConfig] = useState(defaultPoolQuoteConfig);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let active = true;
        void fetch("/api/admin/quote-config").then((response) => response.json()).then((payload) => {
            if (active && payload.config)
                setConfig(payload.config);
        }).catch(() => toast.error("Não foi possível carregar o catálogo.")).finally(() => { if (active)
            setLoadingConfig(false); });
        return () => { active = false; };
    }, []);
    function changeCategory(index, patch) {
        setConfig((current) => ({ ...current, catalog: current.catalog.map((category, i) => i === index ? { ...category, ...patch } : category) }));
    }
    function changeItem(categoryIndex, itemIndex, patch) {
        setConfig((current) => ({ ...current, catalog: current.catalog.map((category, i) => i === categoryIndex ? { ...category, items: category.items.map((item, j) => j === itemIndex ? { ...item, ...patch } : item) } : category) }));
    }
    function changeField(categoryIndex, itemIndex, fieldIndex, patch) {
        setConfig((current) => ({ ...current, catalog: current.catalog.map((category, i) => i === categoryIndex ? { ...category, items: category.items.map((item, j) => j === itemIndex ? { ...item, fields: item.fields.map((field, k) => k === fieldIndex ? { ...field, ...patch } : field) } : item) } : category) }));
    }
    async function save() {
        setSaving(true);
        try {
            const response = await fetch("/api/admin/quote-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error || "Não foi possível salvar.");
            if (payload.config)
                setConfig(payload.config);
            toast.success("Orçamento de piscinas atualizado.");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
        }
        finally {
            setSaving(false);
        }
    }
    const slug = (value) => {
        const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        if (normalized.startsWith("comprimento"))
            return "length";
        if (normalized.startsWith("largura"))
            return "width";
        if (normalized.startsWith("profundidade"))
            return "depth";
        if (normalized.startsWith("area"))
            return "area";
        if (normalized.startsWith("quantidade"))
            return "quantity";
        return normalized;
    };
    return <section id="quotes" className="control-panel control-quote-panel pool-admin-panel">
    <div className="control-panel-heading"><div><p className="control-kicker">ORÇAMENTO INTELIGENTE</p><h2>Orçamento de piscinas</h2></div><StateBadge ok={true}>{loadingConfig ? "Carregando…" : "Pronto para editar"}</StateBadge></div>
    <p className="control-muted">Edite os serviços e preços que aparecem no Fama System. As mudanças só entram em vigor quando você salvar.</p>
    {loadingConfig ? <Skeleton className="pool-admin-loading"/> : <>
      <label className="pool-admin-label"><span>Nome do configurador</span><input value={config.title} onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}/></label>
      <div className="pool-urgency-editor"><strong>Acréscimo por urgência</strong>{["normal", "urgente", "emergencia"].map((key) => <label key={key}><span>{key === "normal" ? "Normal" : key === "urgente" ? "Urgente" : "Emergência"}</span><div><input type="number" min="0" max="500" value={config.urgency[key]} onChange={(event) => setConfig((current) => ({ ...current, urgency: { ...current.urgency, [key]: Number(event.target.value) } }))}/><b>%</b></div></label>)}</div>
      <div className="pool-admin-section-heading"><div><strong>Catálogo</strong><small>{config.catalog.length} categorias · os clientes verão estas opções no orçamento</small></div><Button type="button" variant="outline" size="sm" onClick={() => setConfig((current) => ({ ...current, catalog: [...current.catalog, { category: "Nova categoria", items: [] }] }))}><Plus /> Categoria</Button></div>
      <div className="pool-admin-categories">{config.catalog.map((category, ci) => <details className="pool-admin-category" key={ci} open={ci === 0}><summary><span>{category.category || "Nova categoria"}</span><small>{category.items.length} serviços</small></summary>
        <div className="pool-admin-category-body"><div className="pool-admin-category-title"><label className="pool-admin-label"><span>Nome da categoria</span><input value={category.category} onChange={(event) => changeCategory(ci, { category: event.target.value })}/></label><Button type="button" variant="ghost" size="sm" aria-label="Remover categoria" onClick={() => setConfig((current) => ({ ...current, catalog: current.catalog.filter((_, i) => i !== ci) }))}><Trash2 /> Remover</Button></div>
          {category.items.map((item, ii) => <article className="pool-admin-item" key={ii}><div className="pool-admin-item-head"><strong>{item.name || "Novo serviço"}</strong><Button type="button" variant="ghost" size="sm" aria-label="Remover serviço" onClick={() => changeCategory(ci, { items: category.items.filter((_, i) => i !== ii) })}><Trash2 /> Remover</Button></div>
            <div className="pool-admin-fields"><label className="pool-admin-label"><span>Serviço ou modelo</span><input value={item.name} onChange={(event) => changeItem(ci, ii, { name: event.target.value })}/></label><label className="pool-admin-label"><span>Unidade de cobrança</span><input value={item.unit} placeholder="m², m³, unidade" onChange={(event) => changeItem(ci, ii, { unit: event.target.value })}/></label><label className="pool-admin-label"><span>Preço por unidade (R$)</span><input type="number" min="0" step="0.01" value={item.price} onChange={(event) => changeItem(ci, ii, { price: Number(event.target.value) })}/></label><label className="pool-admin-label"><span>Margem (%)</span><input type="number" min="0" step="0.1" value={item.markup} onChange={(event) => changeItem(ci, ii, { markup: Number(event.target.value) })}/></label></div>
            <div className="pool-admin-subheading"><strong>Campos pedidos no orçamento</strong><Button type="button" variant="outline" size="sm" onClick={() => changeItem(ci, ii, { fields: [...item.fields, { key: "novo_campo", label: "Novo campo", type: "text" }] })}><Plus /> Campo</Button></div>
            {item.fields.map((field, fi) => <div className="pool-admin-field-row" key={fi}><label className="pool-admin-label"><span>Rótulo</span><input value={field.label} onChange={(event) => { const label = event.target.value; changeField(ci, ii, fi, { label, key: slug(label) || field.key }); }}/></label><label className="pool-admin-label"><span>Unidade</span><input value={field.unit ?? ""} placeholder="m, m², litros…" onChange={(event) => changeField(ci, ii, fi, { unit: event.target.value })}/></label><label className="pool-admin-label"><span>Tipo</span><select value={field.type ?? "text"} onChange={(event) => changeField(ci, ii, fi, { type: event.target.value })}><option value="text">Texto</option><option value="number">Número</option></select></label><Button type="button" variant="ghost" size="icon-sm" aria-label="Remover campo" onClick={() => changeItem(ci, ii, { fields: item.fields.filter((_, i) => i !== fi) })}><Trash2 /></Button></div>)}
          </article>)}
          <Button type="button" variant="outline" size="sm" onClick={() => changeCategory(ci, { items: [...category.items, { name: "Novo serviço", unit: "m²", price: 0, markup: 0, fields: [{ key: "area", label: "Área", type: "number", unit: "m²" }] }] })}><Plus /> Adicionar serviço</Button>
        </div></details>)}</div>
      <div className="pool-admin-footer"><span>O catálogo é compartilhado com o Fama System.</span><Button type="button" onClick={() => void save()} disabled={saving || loadingConfig}>{saving ? "Salvando…" : "Salvar alterações"}</Button></div>
    </>}
    <ControlMfaPanel /><div className="control-security-footer"><span>As propostas são criadas no Fama System.</span><div className="control-security-actions"><Button size="sm" variant="outline" asChild><a href={`${systemUrl}#quotes`} target="_blank" rel="noreferrer">Abrir orçamentos <ExternalLink /></a></Button></div></div>
  </section>;
}
const PersistentQuoteCatalogEditor = memo(PoolQuoteCatalogEditor);
export function ControlApp({ displayName, email, signOutPath, systemUrl }) {
    const navigation = useWorkspaceNavigation({ scope: `control:${email}`, initial: "overview", allowed: controlViews });
    const activeSection = navigation.current;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [quickSearch, setQuickSearch] = useState("");
    const [quoteEditorVisited, setQuoteEditorVisited] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [companyAccountAction, setCompanyAccountAction] = useState(null);
    const [companySearch, setCompanySearch] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [members, setMembers] = useState([]);
    const [tickets, setTickets] = useState([]);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        const refresh = async () => { if (document.visibilityState !== "visible")
            return; try {
            const response = await fetch("/api/admin/support", { cache: "no-store", signal: controller.signal });
            const payload = await response.json();
            if (active && response.ok)
                setTickets(payload.tickets ?? []);
        }
        catch { } };
        const timer = setInterval(() => void refresh(), 30000);
        return () => { active = false; controller.abort(); clearInterval(timer); };
    }, []);
    const [plans, setPlans] = useState(defaultPlanCatalog);
    const [security, setSecurity] = useState(null);
    const [audit, setAudit] = useState([]);
    const [privacyRequests, setPrivacyRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assistantDataLoaded, setAssistantDataLoaded] = useState(false);
    const ai = useFamaAiSettings();
    const write = useClientMutation(email);
    const [busy, setBusy] = useState(false);
    const [loadNotice, setLoadNotice] = useState("");
    const [availableReads, setAvailableReads] = useState({});
    const readsRef = useRef(availableReads);
    const loadPromise = useRef(null);
    const loadController = useRef(null);
    const mounted = useRef(true);
    const [editingMember, setEditingMember] = useState(null);
    const [editingPermissions, setEditingPermissions] = useState([]);
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [savingPlans, setSavingPlans] = useState(false);
    const [reEncrypting, setReEncrypting] = useState(false);
    const [validatingBackup, setValidatingBackup] = useState(false);
    useEffect(() => { if (activeSection === "quotes")
        setQuoteEditorVisited(true); }, [activeSection]);
    const deferredCompanySearch = useDeferredValue(companySearch);
    function load() {
        if (loadPromise.current)
            return loadPromise.current;
        const controller = new AbortController();
        loadController.current = controller;
        setBusy(true);
        const operation = (async () => {
            try {
                const result = await readControlWorkspace(controller.signal);
                if (!mounted.current || controller.signal.aborted)
                    return;
                const failed = controlResources.filter(key => result[key].status === "rejected");
                const denied = failed.some(key => { const item = result[key]; return item.status === "rejected" && item.reason instanceof ClientRequestError && [401, 403].includes(item.reason.status ?? 0); });
                if (denied) {
                    setOrganizations([]);
                    setMembers([]);
                    setAudit([]);
                    setPrivacyRequests([]);
                    setTickets([]);
                    setSecurity(null);
                    readsRef.current = {};
                    setAvailableReads({});
                    setAssistantDataLoaded(false);
                    setLoadNotice("Seu acesso precisa ser verificado novamente. Atualize a página para entrar.");
                    return;
                }
                const nextReads = { ...readsRef.current };
                const apply = (key, save, clear) => {
                    const item = result[key];
                    if (item.status === "fulfilled") {
                        save(item.value);
                        nextReads[key] = true;
                    }
                    else if (!isTransientRequestError(item.reason)) {
                        clear();
                        nextReads[key] = false;
                    }
                };
                apply("organizations", data => setOrganizations(data.organizations), () => setOrganizations([]));
                apply("members", data => setMembers(data.members), () => setMembers([]));
                apply("security", data => setSecurity(data), () => setSecurity(null));
                apply("audit", data => setAudit(data.audit), () => setAudit([]));
                apply("privacy", data => setPrivacyRequests(data.requests), () => setPrivacyRequests([]));
                apply("support", data => setTickets(data.tickets), () => setTickets([]));
                apply("plans", data => { const values = data.plans; if (values.length)
                    setPlans(values); }, () => { });
                readsRef.current = nextReads;
                setAvailableReads(nextReads);
                setAssistantDataLoaded(["organizations", "members", "audit", "privacy"].some(key => nextReads[key]));
                const names = { organizations: "empresas", members: "usuários", security: "segurança", audit: "auditoria", privacy: "privacidade", plans: "planos", support: "suporte" };
                setLoadNotice(failed.length ? `Não foi possível atualizar ${failed.map(key => names[key]).join(", ")}. Os módulos disponíveis continuam acessíveis. Use Atualizar para tentar novamente.` : "");
            }
            catch (cause) {
                if (mounted.current && !controller.signal.aborted)
                    setLoadNotice(cause instanceof Error ? cause.message : "Não foi possível carregar o painel. Tente novamente.");
            }
            finally {
                if (loadController.current === controller) {
                    loadController.current = null;
                    loadPromise.current = null;
                    if (mounted.current) {
                        setBusy(false);
                        setLoading(false);
                    }
                }
            }
        })();
        loadPromise.current = operation;
        return operation;
    }
    useEffect(() => {
        mounted.current = true;
        const timer = window.setTimeout(() => { void load(); }, 0);
        return () => { mounted.current = false; window.clearTimeout(timer); const current = loadController.current; loadController.current = null; loadPromise.current = null; current?.abort(); };
    }, []);
    async function toggle(organization) {
        const status = organization.status === "active" ? "suspended" : "active";
        const payload = await write(`/api/admin/organizations/${organization.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        if (!payload)
            return;
        setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status } : item));
        toast.success(status === "active" ? "Empresa reativada." : "Empresa suspensa.");
    }
    async function remove(organization) {
        if (!window.confirm(`Mover a empresa ${organization.name} para a lixeira? Os dados poderão ser restaurados pelo servidor.`))
            return;
        const payload = await write(`/api/admin/organizations/${organization.id}`, { method: "DELETE" });
        if (!payload)
            return;
        setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status: "deleted" } : item));
        toast.success("Empresa movida para a lixeira.");
    }
    async function restoreOrganization(organization) {
        const payload = await write(`/api/admin/organizations/${organization.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "active" }),
        });
        if (!payload)
            return;
        setOrganizations((current) => current.map((item) => item.id === organization.id ? { ...item, status: "active" } : item));
        toast.success("Empresa restaurada.");
    }
    async function updatePlanStatus(organization, planStatus) {
        const payload = await write(`/api/admin/organizations/${organization.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planStatus }),
        });
        if (!payload)
            return;
        setOrganizations((current) => current.map((item) => item.id === organization.id ? {
            ...item,
            planStatus,
            planExpiresAt: payload.planExpiresAt ?? item.planExpiresAt,
        } : item));
        toast.success(planStatus === "active" ? "Plano ativado no Fama Control." : "Plano marcado para atenção.");
    }
    async function updateTicket(ticket, status, adminNotes = ticket.adminNotes) {
        const payload = await write("/api/admin/support", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: ticket.id, status, adminNotes }),
        }, `support:${ticket.id}`);
        if (!payload)
            return;
        setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status, adminNotes } : item));
        toast.success("Chamado atualizado no Fama Control.");
    }
    function updatePlan(index, patch) {
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
            const payload = await response.json();
            if (!response.ok || !payload.plans)
                throw new Error(payload.error ?? "Não foi possível salvar os planos.");
            setPlans(payload.plans);
            toast.success("Valores dos planos salvos.");
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar os planos.");
        }
        finally {
            setSavingPlans(false);
        }
    }
    async function updatePrivacyRequest(request, status) {
        const resolution = ["completed", "rejected"].includes(status)
            ? (window.prompt("Informe a resposta registrada para o titular (opcional):", request.resolution || "") ?? request.resolution)
            : request.resolution;
        const payload = await write("/api/admin/privacy", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: request.id, status, resolution }),
        }, `privacy:${request.id}`);
        if (!payload)
            return;
        setPrivacyRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, resolution, completedAt: ["completed", "rejected"].includes(status) ? new Date().toISOString() : null } : item));
        toast.success("Solicitação de privacidade atualizada.");
    }
    function openPermissions(member) {
        setEditingMember(member);
        setEditingPermissions(member.permissions);
    }
    function togglePermission(permission, checked) {
        setEditingPermissions((current) => checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission));
    }
    function applyPermissionPreset(permissions) {
        setEditingPermissions([...permissions]);
    }
    async function savePermissions() {
        if (!editingMember)
            return;
        setSavingPermissions(true);
        try {
            const response = await fetch(`/api/admin/members/${editingMember.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permissions: editingPermissions }),
            });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Não foi possível salvar os acessos.");
            if (!payload.verified || !payload.permissions) {
                throw new Error("O servidor não confirmou a gravação dos acessos.");
            }
            const permissions = payload.permissions;
            setMembers((current) => current.map((item) => item.id === editingMember.id ? { ...item, permissions } : item));
            setEditingMember(null);
            toast.success("Acessos salvos e confirmados no banco.");
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar os acessos.");
        }
        finally {
            setSavingPermissions(false);
        }
    }
    async function reEncryptRecords() {
        if (!window.confirm("Proteger os campos sensíveis que ainda estiverem em texto? Essa operação pode levar alguns instantes."))
            return;
        setReEncrypting(true);
        try {
            const response = await fetch("/api/admin/security/re-encrypt", { method: "POST" });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error ?? "Não foi possível proteger os registros.");
            toast.success(`${payload.encrypted ?? 0} registro(s) protegido(s) de ${payload.processed ?? 0} analisado(s).`);
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível proteger os registros.");
        }
        finally {
            setReEncrypting(false);
        }
    }
    async function validateBackup(download = false) {
        setValidatingBackup(true);
        try {
            let runId = "";
            let completed = false;
            for (let step = 0; step < 500; step++) {
                const response = await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(runId ? { runId } : {}), cache: "no-store" });
                const payload = await response.json();
                if (!response.ok || payload.status === "failed")
                    throw new Error(payload.error ?? "O backup completo não foi concluído.");
                if (!payload.id)
                    throw new Error("O servidor não confirmou a identificação do backup.");
                runId = payload.id;
                if (payload.status === "complete" && payload.valid) {
                    completed = true;
                    toast.success(`Backup restaurado e conferido: ${payload.records ?? 0} registro(s) e ${payload.attachments ?? 0} arquivo(s), incluindo os dados dos dois sistemas.`);
                    if (download) {
                        const link = document.createElement("a");
                        link.href = `/api/admin/backup?runId=${encodeURIComponent(runId)}&download=1`;
                        link.download = "fama-platform-backup.json";
                        link.click();
                    }
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            if (!completed)
                throw new Error("O backup continua em processamento. Use Validar backup novamente para acompanhar.");
        }
        catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Não foi possível validar o backup.");
        }
        finally {
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
        return `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(deferredCompanySearch.toLocaleLowerCase("pt-BR"))
            && (companyFilter === "all" || (companyFilter === "free" && free) || (companyFilter === "billable" && !free) || (companyFilter === "suspended" && item.status === "suspended"));
    }), [organizations, deferredCompanySearch, companyFilter]);
    const trialPlans = useMemo(() => organizations.filter((item) => item.status === "active" && item.billingEnabled !== false && item.billingProvider !== "courtesy" && (!item.planStatus || item.planStatus === "trial")), [organizations]);
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
    function openSection(event, next) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        navigateSection(next);
    }
    function navigateSection(next) { navigation.navigate(next); setMobileMenuOpen(false); }
    const goBack = navigation.back;
    const assistantSources = ["overview", "companies", "users", "audit", "privacy"];
    const assistantData = useMemo(() => ({
        ...(availableReads.organizations ? { organizations } : {}),
        ...(availableReads.members ? { members: members.map(item => ({ id: item.id, display_name: item.displayName, role: item.role, status: item.status })) } : {}),
        ...(availableReads.audit ? { audit: audit.map(item => ({ id: String(item.id), event_type: item.eventType, occurred_at: item.occurredAt })) } : {}),
        ...(availableReads.privacy ? { privacy: privacyRequests.map(item => ({ id: item.id, request_type: item.requestType, status: item.status })) } : {}),
    }), [organizations, members, audit, privacyRequests, availableReads]);
    const menu = <nav className="control-nav" aria-label="Administração">{controlNavigation.map(item => <a key={item.id} className={`control-nav-item ${activeSection === item.id ? "active" : ""}`} aria-current={activeSection === item.id ? "page" : undefined} href={`#${item.id}`} onPointerEnter={() => preloadControlView(item.id)} onFocus={() => preloadControlView(item.id)} onClick={event => openSection(event, item.id)}><item.icon />{item.label}{item.id === "support" && tickets.some(ticket => ticket.status !== "resolvido") && <Badge variant="secondary">{tickets.filter(ticket => ticket.status !== "resolvido").length}</Badge>}</a>)}</nav>;
    const sectionTitle = controlNavigation.find(item => item.id === activeSection)?.label ?? "Visão geral";
    const requiredResource = { overview: "organizations", health: "organizations", sales: "organizations", companies: "organizations", finance: "organizations", permissions: "members", security: "security", audit: "audit", privacy: "privacy", support: "support", plans: "plans" };
    const unavailable = requiredResource[activeSection] && !availableReads[requiredResource[activeSection]];
    return <FamaLocalAiProvider key={email} prepareOnOpen={Boolean(ai.value?.settings.enabled)}><div className="control-shell">
    <aside className="control-sidebar">
      <Brand />
      {menu}
      <div className="premium-sidebar-card"><Crown /><strong>Gestão que<br />impulsiona negócios</strong><p>Mais controle.<br />Mais resultados.</p></div>
      <div className="control-account"><span>{displayName.slice(0, 2).toLocaleUpperCase("pt-BR")}</span><div><strong>{displayName}</strong><small>{email}</small></div></div>
    </aside>
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}><SheetContent side="left" className="control-mobile-menu"><SheetHeader className="sr-only"><SheetTitle>Menu do Fama Control</SheetTitle></SheetHeader><Brand />{menu}</SheetContent></Sheet>
    <main className="control-main">
      <div className="premium-utility-bar"><form className="premium-search" role="search" onSubmit={event => { event.preventDefault(); setCompanySearch(quickSearch); navigateSection("companies"); setQuickSearch(""); }}><Search aria-hidden="true"/><input aria-label="Buscar empresa" placeholder="Buscar empresas…" value={quickSearch} onChange={event => setQuickSearch(event.target.value)}/><button type="submit">Buscar</button></form><div className="premium-utility-actions"><Button variant="ghost" size="icon" aria-label="Abrir alertas" onClick={() => navigateSection("health")}><Bell />{platformAlerts.length > 0 && <span className="premium-notification-count">{platformAlerts.length}</span>}</Button><span className="premium-avatar">{displayName.slice(0, 2).toLocaleUpperCase("pt-BR")}</span><div className="premium-admin-label"><strong>{displayName}</strong><small>FAMA CONTROL</small></div><Button variant="ghost" size="icon" asChild aria-label="Sair"><a href={signOutPath} target="_top"><LogOut /></a></Button></div></div>
      <header className="control-topbar"><div className="control-heading"><Button className="control-menu-trigger" variant="outline" size="icon" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}><Menu /></Button>{navigation.canBack && <Button className="back-navigation" variant="outline" size="icon" onClick={goBack} aria-label="Voltar para a aba anterior"><ArrowLeft /></Button>}<div><h1>{sectionTitle}</h1>{activeSection === "overview" && <p className="premium-subtitle">Controle sua operação em tempo real</p>}</div></div><div className="control-actions"><Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}><RefreshCw className={busy ? "spin" : ""}/> Atualizar</Button></div></header>
      {loadNotice && <div className="control-panel" role="status"><p className="control-muted">{loadNotice}</p></div>}

      <WorkspaceView key={activeSection} viewKey={activeSection} label={sectionTitle} restoreScroll={navigation.restoreScroll}>
      {unavailable ? <section className="control-panel" role="status"><p className="control-muted">{busy ? "Carregando os registros deste módulo…" : "Não foi possível carregar este módulo. Você pode tentar novamente ou abrir outro módulo."}</p><Button variant="outline" disabled={busy} onClick={() => void load()}><RefreshCw /> Tentar novamente</Button></section> : <>
      {activeSection === "integrations" && <ControlIntegrations />}
      {(activeSection === "assistant" || activeSection === "ai-settings") && <section id={activeSection} className="control-panel control-ai-panel space-y-4">
        {ai.value ? activeSection === "ai-settings" ? <FamaAiSettingsPanel settings={ai.value.settings} revision={ai.value.revision} updatedAt={ai.value.updatedAt} onSave={ai.save} onReload={ai.refresh}/> : assistantDataLoaded ? <>
          <FamaAiPanel key={`${email}:${ai.value.revision}`} data={assistantData} settings={ai.value.settings} scopeLabel="Administração da plataforma" platform allowedSources={assistantSources} allowedSections={assistantSources} onAction={action => {
                        const destinations = { companies: "companies", users: "permissions", audit: "audit", privacy: "privacy" };
                        const next = destinations[action.section];
                        if (next && !action.create && ai.value?.settings.enabled && ai.value.settings.allowNavigation)
                            navigateSection(next);
                    }}/>
          <p className="control-muted">Para consultar agenda, orçamentos, contratos e financeiro de uma empresa, selecione a empresa no Fama System.</p><Button variant="outline" asChild><a href={systemUrl}>Abrir Fama System <ExternalLink /></a></Button>
        </> : <div className="space-y-3"><p className="control-muted">{loading ? "Carregando os registros da plataforma…" : "Não foi possível carregar os registros para a assistente."}</p><Button variant="outline" disabled={busy} onClick={() => void load()}>Carregar registros</Button></div> : <div className="space-y-3"><p className="control-muted">{ai.error || "Carregando a configuração da assistente…"}</p>{ai.error && <Button variant="outline" onClick={() => void ai.refresh().catch(() => undefined)}>Tentar novamente</Button>}</div>}
      </section>}
      {activeSection === "overview" && <ControlOverview companies={organizations} tickets={tickets} plans={plans} projection={monthlyProjection} loading={loading} membersAvailable={Boolean(availableReads.members)} supportAvailable={Boolean(availableReads.support)} plansAvailable={Boolean(availableReads.plans)} onNavigate={navigateSection}/>}

      {activeSection === "health" && <ControlHealth />}

      {activeSection === "sales" && <ControlCommercial />}



      {(activeSection === "companies") && <section id="companies" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">CONTROLE DE ACESSO</p><h2>Empresas e usuários</h2></div><Button onClick={() => setCompanyAccountAction({ mode: "create" })}><Plus /> Nova empresa</Button></div><p className="control-muted">Crie empresas gratuitas, gerencie a equipe e escolha quando habilitar a mensalidade. Os dados e as operações de cada empresa continuam separados.</p><div className="company-list-filters"><label><span>Buscar empresa</span><input type="search" placeholder="Nome da empresa…" value={companySearch} onChange={event => setCompanySearch(event.target.value)}/></label><label><span>Filtrar acesso</span><select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}><option value="all">Todas as empresas</option><option value="free">Isentas de mensalidade</option><option value="billable">Com mensalidade</option><option value="suspended">Bloqueadas</option></select></label><small>{filteredCompanies.length} empresa(s)</small></div>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full"/><Skeleton className="h-14 w-full"/><Skeleton className="h-14 w-full"/></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Usuários</TableHead><TableHead>Acesso</TableHead><TableHead>Prazo</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{filteredCompanies.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong><small className="control-muted block">{organization.slug}</small></TableCell><TableCell>{organization.memberCount}</TableCell><TableCell>{planStatusLabel(organization.planStatus, organization.billingProvider, organization.billingEnabled)}<small className="control-cell-note">{organization.billingEnabled === false ? "Gratuita por tempo indeterminado" : organization.blockOnExpiry === false ? "Bloqueio automático desativado" : "Bloqueio por vencimento ativo"}</small></TableCell><TableCell>{organization.billingEnabled === false || (organization.billingProvider === "courtesy" && organization.planExpiresAt?.startsWith("9999-")) ? "Sem vencimento" : organization.planExpiresAt ? date(organization.planExpiresAt) : "—"}</TableCell><TableCell><Badge className={`status ${organization.status === "active" ? "status-ativo" : organization.status === "deleted" ? "status-expirada" : "status-pendente"}`}>{organization.status === "active" ? "Ativa" : organization.status === "deleted" ? "Na lixeira" : "Bloqueada"}</Badge></TableCell><TableCell><div className="control-row-actions">{organization.status === "deleted" ? <Button variant="outline" size="sm" onClick={() => void restoreOrganization(organization)}>Restaurar</Button> : <><Button variant="outline" size="sm" onClick={() => setCompanyAccountAction({ mode: "users", company: organization })}><UsersRound /> Usuários</Button><Button variant="outline" size="sm" onClick={() => setCompanyAccountAction({ mode: "access", company: organization })}>Empresa e mensalidade</Button><Button variant="outline" size="sm" onClick={() => void toggle(organization)}>{organization.status === "active" ? "Bloquear" : "Reativar"}</Button><Button variant="ghost" size="sm" onClick={() => void remove(organization)}>Lixeira</Button></>}</div></TableCell></TableRow>)}</TableBody></Table>{!filteredCompanies.length && <p className="control-empty">{organizations.length ? "Nenhuma empresa corresponde aos filtros." : "Nenhuma empresa cadastrada ainda. Use Nova empresa para liberar o primeiro acesso."}</p>}</div>}<AccessValidationPanel onComplete={() => void load()}/></section>}

      {(activeSection === "finance") && <section id="finance" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">FINANCEIRO DA PLATAFORMA</p><h2>Planos, vencimentos e receita</h2></div><StateBadge ok={attentionPlans.length === 0}>{attentionPlans.length ? `${attentionPlans.length} precisa(m) de ação` : "Planos em dia"}</StateBadge></div><p className="control-muted">Esta aba acompanha o financeiro da plataforma Fama Control: planos ativos, previsão mensal, vencimentos e cobranças que precisam de atenção.</p><div className="control-grid control-finance-grid"><article className="control-metric"><span><CircleDollarSign /></span><div><small>MRR estimado</small><strong>{money(monthlyProjection)}</strong><p>receita mensal ativa</p></div></article><article className="control-metric"><span><CheckCircle2 /></span><div><small>Planos ativos</small><strong>{activePlans.length}</strong><p>acessos liberados</p></div></article><article className="control-metric"><span><Activity /></span><div><small>Atenção</small><strong>{attentionPlans.length}</strong><p>Pix, vencidos ou revisão</p></div></article><article className="control-metric"><span><KeyRound /></span><div><small>Vencem em 7 dias</small><strong>{expiringPlans.length}</strong><p>acompanhar renovação</p></div></article></div>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full"/><Skeleton className="h-14 w-full"/></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead><TableHead>Provedor</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{organizations.map((organization) => <TableRow key={organization.id}><TableCell><strong>{organization.name}</strong><small className="control-cell-note">{organization.slug}</small></TableCell><TableCell>{organization.plan || "inicial"}</TableCell><TableCell><Badge className={`status ${organization.planStatus === "active" ? "status-ativo" : organization.planStatus === "payment_attention" || organization.planStatus === "expired" ? "status-expirada" : "status-pendente"}`}>{planStatusLabel(organization.planStatus, organization.billingProvider, organization.billingEnabled)}</Badge></TableCell><TableCell>{organization.billingEnabled === false || (organization.billingProvider === "courtesy" && organization.planExpiresAt?.startsWith("9999-")) ? "Sem vencimento" : organization.planExpiresAt ? date(organization.planExpiresAt) : "Sem vencimento"}</TableCell><TableCell>{organization.billingEnabled === false || organization.billingProvider === "courtesy" ? "Gratuidade" : organization.billingProvider || "sem cobrança"}</TableCell><TableCell><div className="control-row-actions">{organization.billingEnabled === false || organization.billingProvider === "courtesy" ? <Button variant="outline" size="sm" onClick={() => setCompanyAccountAction({ mode: "access", company: organization })}>Empresa e mensalidade</Button> : <><Button variant="outline" size="sm" onClick={() => void updatePlanStatus(organization, "active")}>Ativar</Button><Button variant="ghost" size="sm" onClick={() => void updatePlanStatus(organization, "payment_attention")}>Atenção</Button></>}</div></TableCell></TableRow>)}</TableBody></Table>{!organizations.length && <p className="control-empty">Nenhuma empresa cadastrada ainda.</p>}</div>}</section>}

      {activeSection === "plans" && <PlanPolicyEditor companies={organizations} onSaved={setPlans}/>}

      {activeSection === "support" && <ControlSupport />}

      {activeSection === "blocks" && <WorkspaceView label="blocos"><FamaBlocksPanel companies={organizations} members={members} available={Boolean(availableReads.organizations && availableReads.members)}/></WorkspaceView>}

      {(activeSection === "permissions") && <section id="permissions" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">ACESSO POR MÓDULO</p><h2>Usuários e permissões</h2></div><StateBadge ok={true}>Controle individual</StateBadge></div><p className="control-muted">Escolha exatamente quais áreas cada pessoa pode abrir e operar. O perfil define o acesso inicial. As regras de Blocos do sistema também se aplicam, inclusive ao proprietário.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full"/><Skeleton className="h-14 w-full"/></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Empresa</TableHead><TableHead>Perfil</TableHead><TableHead>Situação</TableHead><TableHead>Módulos</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.id}><TableCell><strong>{member.displayName || "Convite pendente"}</strong><small className="control-cell-note">{member.email}</small></TableCell><TableCell>{member.organizationName}</TableCell><TableCell>{member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : member.role === "technician" ? "Técnico" : "Colaborador"}</TableCell><TableCell><Badge className={`status ${member.status === "active" ? "status-ativo" : "status-pendente"}`}>{member.status === "active" ? "Ativo" : member.status === "inactive" ? "Desativado" : "Convidado"}</Badge></TableCell><TableCell>{member.role === "owner" ? "Todos" : `${member.permissions.length} de ${featurePermissions.length}`}</TableCell><TableCell><Button variant="outline" size="sm" disabled={member.role === "owner"} onClick={() => openPermissions(member)}><UserCog />Configurar</Button></TableCell></TableRow>)}</TableBody></Table>{!members.length && <p className="control-empty">Nenhum usuário convidado ainda.</p>}</div>}</section>}

      {(activeSection === "security") && <section id="security" className="control-security"><div className="control-panel-heading"><div><p className="control-kicker">DEFESA EM CAMADAS</p><h2>Segurança do Fama System</h2></div><StateBadge ok={Boolean(security?.owner.configured)}>Proprietário verificado</StateBadge></div><div className="control-security-grid"><article><KeyRound /><div><strong>Identidade do proprietário</strong><p>{security?.owner.configured ? "Conta autorizada por allowlist no servidor." : "Configure o e-mail do proprietário no ambiente."}</p></div></article><article><ShieldCheck /><div><strong>Criptografia de dados</strong><p>{security?.encryption.configured ? `${security.encryption.algorithm} ativo para dados sensíveis.` : "Aguardando a chave FAMA_DATA_ENCRYPTION_KEY no servidor."}</p></div></article><article><Database /><div><strong>Supabase e Storage</strong><p>{security?.backend.supabaseConfigured ? "Conectado por chave secreta server-side." : "Chave secreta do Supabase ainda não configurada."}</p></div></article></div><div className="control-security-grid control-production-grid"><article><ShieldCheck /><div><strong>Limite de requisições</strong><p>{security?.production.rateLimiting ? "Ativo por IP, identidade e ação." : "Tabela de limites indisponível."}</p></div></article><article><Activity /><div><strong>Auditoria</strong><p>{security?.production.audit ? "Eventos de segurança registrados." : "Registro de auditoria indisponível."}</p></div></article><article><Database /><div><strong>Recuperação e backup</strong><p>{security?.production.recovery ? "Lixeira restaurável por 30 dias." : "Snapshots indisponíveis."}</p></div></article></div><div className="control-security-footer"><span>Última conferência: {security ? date(security.checkedAt) : "—"}</span><div className="control-security-actions"><Button variant="outline" size="sm" onClick={() => void reEncryptRecords()} disabled={reEncrypting || !security?.encryption.configured}>{reEncrypting ? "Protegendo…" : "Proteger registros existentes"}</Button><Button variant="outline" size="sm" onClick={() => void validateBackup()} disabled={validatingBackup}>{validatingBackup ? "Conferindo backup…" : "Validar backup"}</Button><Button variant="outline" size="sm" onClick={() => void validateBackup(true)} disabled={validatingBackup}>Gerar e baixar backup <Database /></Button><a href="/api/admin/backup?key=1" download>Guardar chave de recuperação <KeyRound /></a>{security?.backup?.id && security.backup.archive?.complete && <a href={`/api/admin/backup?runId=${encodeURIComponent(security.backup.id)}&source=archive`} download>Baixar cópia externa <Database /></a>}<a href={systemUrl} target="_blank" rel="noreferrer">Abrir Fama System <ExternalLink /></a></div></div></section>}

      {(activeSection === "audit") && <section id="audit" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">RASTREABILIDADE</p><h2>Auditoria de operações</h2></div><StateBadge ok={Boolean(security?.production.audit)}>Registro protegido</StateBadge></div><p className="control-muted">Os eventos são gravados no Supabase com organização, usuário, ação e horário. Dados sensíveis não são incluídos no log.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full"/><Skeleton className="h-14 w-full"/></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead><TableHead>Entidade</TableHead><TableHead>Organização</TableHead><TableHead>Registro</TableHead></TableRow></TableHeader><TableBody>{audit.map((event) => <TableRow key={String(event.id)}><TableCell>{date(event.occurredAt)}</TableCell><TableCell><strong>{event.eventType}</strong></TableCell><TableCell>{event.entityType}</TableCell><TableCell>{event.organizationId || "Plataforma"}</TableCell><TableCell>{event.recordId || "—"}</TableCell></TableRow>)}</TableBody></Table>{!audit.length && <p className="control-empty">Nenhum evento de auditoria registrado.</p>}</div>}</section>}

      {(activeSection === "privacy") && <section id="privacy" className="control-panel"><div className="control-panel-heading"><div><p className="control-kicker">LGPD</p><h2>Solicitações de privacidade</h2></div><StateBadge ok={true}>Titular no controle</StateBadge></div><p className="control-muted">Acompanhe pedidos de acesso, correção, exportação e exclusão. O contato é descriptografado apenas nesta área privada para atendimento.</p>{loading ? <div className="control-skeletons"><Skeleton className="h-14 w-full"/><Skeleton className="h-14 w-full"/></div> : <div className="control-table-wrap"><Table><TableHeader><TableRow><TableHead>Recebida</TableHead><TableHead>Contato</TableHead><TableHead>Tipo</TableHead><TableHead>Detalhes</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{privacyRequests.map((request) => <TableRow key={request.id}><TableCell>{date(request.createdAt)}</TableCell><TableCell>{request.contact || "—"}</TableCell><TableCell>{request.requestType}</TableCell><TableCell className="control-long-cell">{request.details || "—"}</TableCell><TableCell><Badge className={`status ${request.status === "completed" ? "status-ativo" : request.status === "rejected" ? "status-expirada" : "status-pendente"}`}>{request.status === "open" ? "Aberta" : request.status === "in_progress" ? "Em andamento" : request.status === "completed" ? "Concluída" : "Rejeitada"}</Badge></TableCell><TableCell><div className="control-row-actions">{request.status === "open" && <Button variant="outline" size="sm" onClick={() => void updatePrivacyRequest(request, "in_progress")}>Assumir</Button>}{request.status === "in_progress" && <><Button variant="outline" size="sm" onClick={() => void updatePrivacyRequest(request, "completed")}>Concluir</Button><Button variant="ghost" size="sm" onClick={() => void updatePrivacyRequest(request, "rejected")}>Rejeitar</Button></>}</div></TableCell></TableRow>)}</TableBody></Table>{!privacyRequests.length && <p className="control-empty">Nenhuma solicitação de privacidade pendente.</p>}</div>}</section>}
      </>}
      </WorkspaceView>
      {(activeSection === "quotes" || quoteEditorVisited) && <div hidden={activeSection !== "quotes"}><PersistentQuoteCatalogEditor systemUrl={systemUrl}/></div>}
      <footer className="control-app-footer"><span>Fama Control · v{FAMA_VERSION} · Versão final</span><a href="/manual" target="_blank" rel="noreferrer">Manual completo</a></footer>
    </main>
    {ai.value?.settings.enabled && activeSection !== "assistant" && <button type="button" className="premium-assistant-button" onClick={() => navigateSection("assistant")}><span><Sparkles /></span><div><strong>Assistente IA</strong><small>Como posso ajudar?</small></div></button>}
    <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}><DialogContent className="control-permissions-dialog"><DialogHeader><DialogTitle>Definir acesso por módulo</DialogTitle><DialogDescription>{editingMember ? `${editingMember.displayName || editingMember.email} · ${editingMember.organizationName}` : "Escolha as áreas permitidas."}</DialogDescription></DialogHeader><div className="control-permission-presets"><span>Começar por um modelo</span>{permissionPresets.map((preset) => <Button type="button" key={preset.label} variant="outline" size="sm" onClick={() => applyPermissionPreset(preset.permissions)}>{preset.label}</Button>)}</div><div className="control-permission-grid">{permissionGroups.map((group) => <section className="control-permission-group" key={group}><header><strong>{group}</strong><small>{group === "Operação" ? "Rotina de atendimento, vendas e execução." : "Cadastros, contratos, estoque, financeiro e equipe."}</small></header>{featurePermissions.filter((permission) => permission.group === group).map((permission) => <label className="control-permission-option" key={permission.id}><Checkbox checked={editingPermissions.includes(permission.id)} onCheckedChange={(checked) => togglePermission(permission.id, checked === true)}/><span><strong>{permission.label}</strong><small>{permission.description}</small></span></label>)}</section>)}</div><p className="control-permission-hint">Ao salvar, o Fama Control relê o registro no banco. O Fama System aplica a mudança automaticamente quando o usuário volta à janela e também bloqueia chamadas diretas no servidor.</p><DialogFooter><Button type="button" variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button><Button type="button" onClick={() => void savePermissions()} disabled={savingPermissions}>{savingPermissions ? "Salvando e conferindo…" : "Salvar acessos"}</Button></DialogFooter></DialogContent></Dialog>
    <WorkspaceView label="empresa">{companyAccountAction && <CompanyAccountsDialog key={`${companyAccountAction.mode}:${companyAccountAction.company?.id ?? "new"}`} action={companyAccountAction} onClose={() => setCompanyAccountAction(null)} onSaved={load}/>}</WorkspaceView>
    <Toaster richColors position="top-right"/>
  </div></FamaLocalAiProvider>;
}
