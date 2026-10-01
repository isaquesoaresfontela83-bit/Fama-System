"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, Pencil, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { defaultFeaturePermissions, effectiveFeaturePermissions, featurePermissions, type FeaturePermission } from "@/lib/permissions";

type Company = { id: string; name: string; plan?: string; planExpiresAt?: string; billingProvider?: string; billingEnabled?: boolean; blockOnExpiry?: boolean; billingCycle?: string };
type Member = { id: string; displayName: string; email: string; role: string; status: string; permissions: FeaturePermission[] };
export type CompanyAccountAction = { mode: "create" | "access" | "users"; company?: Company };

const templates: { id: string; label: string; role: string; permissions: FeaturePermission[] }[] = [
  { id: "commercial", label: "Comercial", role: "member", permissions: ["dashboard", "crm", "quotes", "agenda", "customers"] },
  { id: "technician", label: "Técnico de campo", role: "technician", permissions: ["dashboard", "agenda", "mobile", "orders", "warranties", "customers"] },
  { id: "finance", label: "Financeiro", role: "member", permissions: ["dashboard", "customers", "contracts", "finance"] },
  { id: "admin", label: "Administrador", role: "admin", permissions: defaultFeaturePermissions() },
];
const roleLabel = (role: string) => role === "owner" ? "Proprietário" : role === "admin" ? "Administrador" : role === "technician" ? "Técnico" : "Colaborador";
const statusLabel = (status: string) => status === "active" ? "Ativo" : status === "inactive" ? "Desativado" : "Convite pendente";
function localDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value)) || value.startsWith("9999-")) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function CompanyAccountsDialog({ action, onClose, onSaved }: { action: CompanyAccountAction; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(action.company?.name ?? "");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState(action.company?.plan ?? "profissional");
  const [billingEnabled, setBillingEnabled] = useState(Boolean(action.company) && action.company?.billingEnabled !== false && action.company?.billingProvider !== "courtesy");
  const [blockOnExpiry, setBlockOnExpiry] = useState(Boolean(action.company) && action.company?.blockOnExpiry !== false);
  const [billingCycle, setBillingCycle] = useState(action.company?.billingCycle ?? "monthly");
  const [deadline, setDeadline] = useState(localDate(action.company?.planExpiresAt));
  const [role, setRole] = useState("member");
  const [status, setStatus] = useState("active");
  const [template, setTemplate] = useState("commercial");
  const [permissions, setPermissions] = useState<FeaturePermission[]>(templates[0].permissions);
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<Member | null>(null);
  const [search, setSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(action.mode === "users");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const path = action.company ? `/api/admin/organizations/${action.company.id}/members` : "";
  const owner = editing?.role === "owner";

  useEffect(() => {
    if (action.mode !== "users" || !path) return;
    let current = true;
    void fetch(path, { cache: "no-store" }).then(async response => {
      const result = await response.json() as { members?: Member[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os usuários.");
      if (current) setMembers(result.members ?? []);
    }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários."); }).finally(() => { if (current) setLoadingMembers(false); });
    return () => { current = false; };
  }, [action.mode, path]);

  function resetUser() {
    setEditing(null); setDisplayName(""); setEmail(""); setPassword(""); setShowPassword(false);
    setRole("member"); setStatus("active"); setTemplate("commercial"); setPermissions(templates[0].permissions); setError("");
  }
  function editUser(member: Member) {
    setEditing(member); setDisplayName(member.displayName); setEmail(member.email); setPassword(""); setShowPassword(false);
    setRole(member.role); setStatus(member.status); setTemplate("custom");
    setPermissions(member.role === "owner" ? defaultFeaturePermissions() : effectiveFeaturePermissions(member.permissions)); setError("");
    requestAnimationFrame(() => { form.current?.scrollIntoView({ behavior: "smooth", block: "start" }); form.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }); });
  }
  function applyTemplate(value: string) {
    setTemplate(value);
    const selected = templates.find(item => item.id === value);
    if (selected) { setRole(selected.role); setPermissions([...selected.permissions]); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const url = action.mode === "create" ? "/api/admin/organizations" : action.mode === "access" ? `/api/admin/organizations/${action.company?.id}` : editing ? `/api/admin/members/${editing.id}` : path;
      const body = action.mode === "access"
        ? { name, plan, billingEnabled, blockOnExpiry: billingEnabled && blockOnExpiry, billingCycle, planExpiresAt: billingEnabled && deadline ? new Date(`${deadline}T23:59:59-03:00`).toISOString() : "" }
        : action.mode === "create" ? { name, displayName, email, password, plan }
        : { displayName, email, ...(password ? { password } : {}), role, status, permissions };
      const response = await fetch(url, { method: action.mode === "access" || editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { verified?: boolean; error?: string; member?: Member; account?: { email: string } };
      if (!response.ok || !result.verified) throw new Error(result.error ?? "O servidor não confirmou a alteração.");
      setPassword("");
      if (action.mode === "users" && result.member) {
        setMembers(current => editing ? current.map(item => item.id === editing.id ? result.member! : item) : [...current, result.member!]);
        toast.success(editing ? "Dados e acesso do usuário atualizados." : "Usuário cadastrado e vinculado à empresa."); resetUser();
      } else if (action.mode === "create") {
        setCreated({ name, email: result.account?.email ?? email }); toast.success("Empresa criada com acesso gratuito, sem vencimento.");
      } else { toast.success(billingEnabled ? "Configuração da mensalidade salva." : "Empresa isenta de mensalidade, sem vencimento."); }
      await onSaved();
      if (action.mode === "access") onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  const title = action.mode === "create" ? "Nova empresa" : action.mode === "access" ? "Empresa e mensalidade" : "Usuários da empresa";
  const matching = members.filter(member => `${member.displayName} ${member.email} ${roleLabel(member.role)}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="company-accounts-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{action.mode === "create" ? "Crie a empresa e a conta do responsável. O acesso começa gratuito e sem vencimento." : action.company?.name}</DialogDescription></DialogHeader>
      {created ? <div className="company-account-success"><CheckCircle2 className="company-success-icon" /><h3>Empresa pronta para testar</h3><p><strong>{created.name}</strong><br />{created.email}</p><p>Acesso gratuito por tempo indeterminado. O responsável entra no Fama System com o nome da empresa, o e-mail e a senha que você definiu.</p><p>Para cadastrar a equipe, abra <strong>Usuários</strong> na linha da empresa. A mensalidade só será habilitada quando você ativar essa opção.</p><div className="control-row-actions"><Button asChild variant="outline"><a href="https://famasystem.online/entrar" target="_blank" rel="noreferrer">Abrir Fama System</a></Button><Button onClick={onClose}>Concluir</Button></div></div> : <>
        {action.mode === "users" && <section className="company-member-list">
          <div className="company-member-heading"><h3><UsersRound size={18} /> Pessoas cadastradas <small>({members.length})</small></h3><Button variant="outline" size="sm" disabled={saving} onClick={resetUser}><Plus /> Novo usuário</Button></div>
          <label className="company-member-search"><span>Buscar por nome, e-mail ou função</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar usuário…" /></label>
          {loadingMembers ? <p>Carregando usuários…</p> : matching.length ? matching.map(member => <article key={member.id} data-editing={editing?.id === member.id}>
            <div><strong>{member.displayName || member.email}</strong><small>{member.email}</small><small>{roleLabel(member.role)} · {statusLabel(member.status)} · {member.role === "owner" ? "Todos os módulos" : `${effectiveFeaturePermissions(member.permissions).length} módulos`}</small></div>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => editUser(member)}><Pencil size={14} /> Editar</Button>
          </article>) : <p>{members.length ? "Nenhum usuário corresponde à busca." : "Nenhum usuário cadastrado."}</p>}
        </section>}
        <form ref={form} onSubmit={event => void submit(event)} className="company-account-form">
          <fieldset disabled={saving} className="company-account-form-fields">
            {action.mode !== "users" && <label className="pool-admin-label"><span>Nome da empresa</span><input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} autoComplete="organization" /><small>Este nome será usado para entrar no Fama System.</small></label>}
            {action.mode !== "access" && <>
              <h3>{action.mode === "create" ? "Conta do responsável" : editing ? `Editar ${editing.displayName || editing.email}` : "Cadastrar usuário"}</h3>
              <div className="company-account-fields"><label className="pool-admin-label"><span>{action.mode === "create" ? "Nome do responsável (opcional)" : "Nome da pessoa"}</span><input required={action.mode === "users"} minLength={2} maxLength={100} value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="off" /></label><label className="pool-admin-label"><span>E-mail de acesso</span><input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" /></label></div>
              <label className="pool-admin-label"><span>{editing ? "Nova senha (opcional)" : "Senha de acesso"}</span><div className="company-account-password"><input type={showPassword ? "text" : "password"} required={!editing} minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /><Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(current => !current)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div><small>{editing ? "Deixe em branco para manter a senha atual." : "Defina uma senha com pelo menos 8 caracteres."}</small></label>
            </>}
            {action.mode !== "users" && <label className="pool-admin-label"><span>Plano de recursos</span><select value={plan} onChange={event => setPlan(event.target.value)}><option value="inicial">Inicial</option><option value="intermediario">Intermediário</option><option value="profissional">Profissional</option></select><small>Escolher um plano não ativa a cobrança.</small></label>}
            {action.mode === "create" && <div className="company-account-free"><ShieldCheck /><div><strong>Gratuita, sem vencimento</strong><p>Mensalidade e bloqueio automático começam desativados. Você controla essas opções depois de criar a empresa.</p></div></div>}
            {action.mode === "access" && <>
              <div className="company-billing-option"><div><label htmlFor="company-billing">Habilitar mensalidade</label><p>{billingEnabled ? "A empresa poderá pagar a assinatura no Fama System." : "Acesso gratuito por tempo indeterminado, sem checkout de mensalidade."}</p></div><Switch id="company-billing" checked={billingEnabled} onCheckedChange={value => { setBillingEnabled(value); if (!value) setBlockOnExpiry(false); }} /></div>
              <div className="company-billing-option"><div><label htmlFor="company-expiry-block">Bloquear por vencimento ou pendência</label><p>{billingEnabled ? "Quando ativo, o Fama System exige regularização do plano para operar." : "Ative a mensalidade para configurar o bloqueio automático."}</p></div><Switch id="company-expiry-block" disabled={!billingEnabled} checked={billingEnabled && blockOnExpiry} onCheckedChange={setBlockOnExpiry} /></div>
              {billingEnabled ? <><div className="company-account-fields"><label className="pool-admin-label"><span>Ciclo da assinatura</span><select value={billingCycle} onChange={event => setBillingCycle(event.target.value)}><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></select></label><label className="pool-admin-label"><span>Vencimento do acesso</span><input type="date" required value={deadline} onChange={event => setDeadline(event.target.value)} /><small>Válido até o fim do dia, no horário de Brasília.</small></label></div><p className="company-account-note">Ao habilitar a mensalidade de uma empresa gratuita, o plano ficará aguardando pagamento. {blockOnExpiry ? "O acesso será bloqueado até a regularização." : "O acesso continua liberado enquanto o bloqueio automático estiver desativado."} O pagamento é feito no Fama System.</p></> : <p className="company-account-note">A empresa permanece isenta mesmo que um vencimento antigo tenha passado. O botão Bloquear na lista permite suspender o acesso manualmente. Desativar aqui não cancela cobranças já emitidas pelo provedor.</p>}
            </>}
            {action.mode === "users" && <>
              {!owner && <label className="pool-admin-label"><span>Modelo de acesso</span><select value={template} onChange={event => applyTemplate(event.target.value)}>{templates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}<option value="custom">Personalizado</option></select><small>Escolha um modelo e ajuste os módulos abaixo.</small></label>}
              <div className="company-account-fields"><label className="pool-admin-label"><span>Função na empresa</span><select disabled={owner} value={role} onChange={event => { setRole(event.target.value); setTemplate("custom"); }}>{owner && <option value="owner">Proprietário</option>}<option value="member">Colaborador</option><option value="admin">Administrador da empresa</option><option value="technician">Técnico</option></select></label><label className="pool-admin-label"><span>Situação do acesso</span><select disabled={owner || !editing} value={status} onChange={event => setStatus(event.target.value)}><option value="active">Ativo</option><option value="inactive">Desativado</option>{editing?.status === "invited" && <option value="invited">Convite pendente</option>}</select></label></div>
              {owner && <p className="company-account-note">O proprietário mantém todos os módulos e não pode ser rebaixado ou desativado. Você pode atualizar os dados de sua conta.</p>}
              <fieldset className="company-account-modules"><legend>Módulos permitidos · {permissions.length} de {featurePermissions.length}</legend>{featurePermissions.map(permission => <label key={permission.id} title={permission.description}><Checkbox disabled={owner} checked={permissions.includes(permission.id)} onCheckedChange={checked => { setTemplate("custom"); setPermissions(current => checked ? [...new Set([...current, permission.id])] : current.filter(item => item !== permission.id)); }} /><span>{permission.label}</span></label>)}</fieldset>
              {!owner && <div className="control-row-actions"><Button type="button" variant="ghost" size="sm" onClick={() => { setPermissions(defaultFeaturePermissions()); setTemplate("custom"); }}>Selecionar todos</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setPermissions([]); setTemplate("custom"); }}>Limpar seleção</Button></div>}
            </>}
          </fieldset>
          {error && <p role="alert" className="company-account-error">{error}</p>}
          <DialogFooter>{editing && <Button type="button" variant="outline" disabled={saving} onClick={resetUser}>Cancelar edição</Button>}<Button type="button" variant="outline" disabled={saving} onClick={onClose}>Fechar</Button><Button type="submit" disabled={saving || loadingMembers}>{saving ? "Salvando…" : action.mode === "create" ? "Criar empresa gratuita" : action.mode === "access" ? "Salvar configuração" : editing ? "Salvar usuário" : <><Plus /> Cadastrar usuário</>}</Button></DialogFooter>
        </form>
      </>}
    </DialogContent>
  </Dialog>;
}
