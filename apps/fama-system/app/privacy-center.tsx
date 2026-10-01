"use client";

/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileLock2, KeyRound, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Organization } from "@/app/data-model";

type PrivacyRequest = { id: string; requestType: string; status: string; details: string; resolution: string; createdAt: string; completedAt: string | null };
type RecoveryRecord = { id: string; entityType: string; recordId: string; deletedAt: string; expiresAt: string };
type MfaStatus = { available: boolean; aal: "aal1" | "aal2" | null; factors: Array<{ id: string; type: string; status: string; name: string }> };
type Enrollment = { factorId: string; challengeId: string; qrCode: string; secret: string; uri: string };

const typeLabels: Record<string, string> = { access: "Acesso", correction: "Correção", export: "Exportação", deletion: "Eliminação", revocation: "Revogação/oposição" };
const statusLabels: Record<string, string> = { open: "Aberta", in_progress: "Em atendimento", completed: "Concluída", rejected: "Não atendida" };
const entityLabels: Record<string, string> = { leads: "Lead", quotes: "Orçamento", appointments: "Agendamento", workOrders: "Ordem de serviço", customers: "Cliente", inventory: "Item de estoque", transactions: "Lançamento", employees: "Profissional", warranties: "Garantia", contracts: "Contrato", attachments: "Arquivo" };

function displayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export function PrivacyCenter({ organization }: { organization: Organization }) {
  const headers = useMemo(() => ({ "x-organization-id": organization.id }), [organization.id]);
  const canManage = organization.role === "owner" || organization.role === "admin";
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [recovery, setRecovery] = useState<RecoveryRecord[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const calls: Promise<Response>[] = [fetch("/api/privacy", { headers }), fetch("/api/auth/mfa")];
      if (canManage) calls.push(fetch("/api/recovery", { headers }));
      const responses = await Promise.all(calls);
      const privacyPayload = await responses[0].json() as { requests?: PrivacyRequest[]; error?: string };
      const mfaPayload = await responses[1].json() as MfaStatus & { error?: string };
      if (!responses[0].ok) throw new Error(privacyPayload.error ?? "Não foi possível carregar as solicitações.");
      if (!responses[1].ok) throw new Error(mfaPayload.error ?? "Não foi possível carregar a segurança da conta.");
      setRequests(privacyPayload.requests ?? []);
      setMfa(mfaPayload);
      if (canManage && responses[2]) {
        const recoveryPayload = await responses[2].json() as { records?: RecoveryRecord[]; error?: string };
        if (!responses[2].ok) throw new Error(recoveryPayload.error ?? "Não foi possível carregar a lixeira.");
        setRecovery(recoveryPayload.records ?? []);
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível carregar a área de privacidade.");
    } finally {
      setLoading(false);
    }
  }, [headers, canManage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/privacy", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      const payload = await response.json() as { request?: PrivacyRequest; error?: string };
      if (!response.ok || !payload.request) throw new Error(payload.error ?? "Não foi possível enviar a solicitação.");
      setRequests((current) => [payload.request!, ...current]);
      form.reset();
      toast.success("Solicitação registrada.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  async function startEnrollment() {
    setBusy(true);
    try {
      const enrollResponse = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enroll" }) });
      const enrolled = await enrollResponse.json() as { factorId?: string; qrCode?: string; secret?: string; uri?: string; error?: string };
      if (!enrollResponse.ok || !enrolled.factorId) throw new Error(enrolled.error ?? "Não foi possível iniciar a configuração.");
      const challengeResponse = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "challenge", factorId: enrolled.factorId }) });
      const challenge = await challengeResponse.json() as { challengeId?: string; error?: string };
      if (!challengeResponse.ok || !challenge.challengeId) throw new Error(challenge.error ?? "Não foi possível criar o desafio.");
      setEnrollment({ factorId: enrolled.factorId, challengeId: challenge.challengeId, qrCode: enrolled.qrCode ?? "", secret: enrolled.secret ?? "", uri: enrolled.uri ?? "" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível configurar a verificação.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    try {
      const response = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId: enrollment.factorId, challengeId: enrollment.challengeId, code }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Código inválido.");
      setEnrollment(null);
      toast.success("Verificação em duas etapas ativada.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível validar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(record: RecoveryRecord) {
    setBusy(true);
    try {
      const response = await fetch(`/api/recovery/${record.id}`, { method: "POST", headers });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível restaurar.");
      setRecovery((current) => current.filter((item) => item.id !== record.id));
      toast.success("Registro restaurado. Recarregue o módulo para vê-lo.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível restaurar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="module-stack"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const verifiedFactor = mfa?.factors.find((factor) => factor.status === "verified");
  return <div className="privacy-grid">
    <section className="surface privacy-security-card">
      <div className="panel-heading"><div><small>PROTEÇÃO DA CONTA</small><h2>Segurança e cópia dos dados</h2></div><Badge variant="secondary">{mfa?.aal === "aal2" ? "Proteção reforçada" : "Proteção padrão"}</Badge></div>
      <div className="privacy-actions">
        <article><span><KeyRound /></span><div><strong>Verificação em duas etapas</strong><p>{!mfa?.available ? "Entre com sua Conta Fama para configurar." : verifiedFactor ? "Ativa nesta conta." : "Use um aplicativo autenticador para reforçar o acesso."}</p></div>{mfa?.available && !verifiedFactor && <Button size="sm" onClick={() => void startEnrollment()} disabled={busy}>Ativar</Button>}</article>
        {canManage && <article><span><Download /></span><div><strong>Backup da empresa</strong><p>Baixe uma cópia legível dos registros e da lista de arquivos.</p></div><Button size="sm" variant="outline" asChild><a href={`/api/account/export?organization_id=${encodeURIComponent(organization.id)}`} target="_blank">Exportar</a></Button></article>}
        <article><span><FileLock2 /></span><div><strong>Documentos legais</strong><p>Consulte as regras de uso e privacidade vigentes.</p></div><div className="privacy-legal-links"><a href="/termos" target="_blank">Termos</a><a href="/privacidade" target="_blank">Privacidade</a></div></article>
      </div>
      <div className="security-checks" aria-label="Controles de segurança ativos">
        <div><ShieldCheck /><span><strong>Isolamento por empresa</strong><small>Dados filtrados pelo ambiente ativo</small></span><Badge variant="outline">Ativo</Badge></div>
        <div><KeyRound /><span><strong>Proteção de chaves</strong><small>Credenciais financeiras não retornam ao navegador</small></span><Badge variant="outline">Ativo</Badge></div>
        <div><FileLock2 /><span><strong>Recuperação controlada</strong><small>Exclusões operacionais ficam disponíveis por 30 dias</small></span><Badge variant="outline">Ativo</Badge></div>
      </div>
      {enrollment && <form className="mfa-enrollment" onSubmit={verifyEnrollment}><div><strong>Escaneie no aplicativo autenticador</strong><p>Depois digite o código de 6 dígitos para concluir.</p></div>{enrollment.qrCode.startsWith("data:image/") && <img src={enrollment.qrCode} alt="QR Code para configurar o autenticador" />}<code>{enrollment.secret}</code>{enrollment.uri && <a href={enrollment.uri}>Abrir no autenticador</a>}<div className="mfa-code"><Input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} required placeholder="000000" /><Button type="submit" disabled={busy}>Confirmar</Button></div></form>}
    </section>

    <section className="surface privacy-request-card">
      <div className="panel-heading"><div><small>LGPD</small><h2>Solicitar atendimento de privacidade</h2></div><ShieldCheck /></div>
      <form className="record-form" onSubmit={createRequest}><div className="form-field span-2"><Label htmlFor="account-privacy-type">Tipo de pedido</Label><NativeSelect id="account-privacy-type" name="requestType" defaultValue="access"><NativeSelectOption value="access">Acessar meus dados</NativeSelectOption><NativeSelectOption value="correction">Corrigir meus dados</NativeSelectOption><NativeSelectOption value="export">Exportar meus dados</NativeSelectOption><NativeSelectOption value="deletion">Eliminar meus dados</NativeSelectOption><NativeSelectOption value="revocation">Revogar consentimento ou me opor</NativeSelectOption></NativeSelect></div><div className="form-field span-2"><Label htmlFor="account-privacy-details">Detalhes</Label><Textarea id="account-privacy-details" name="details" minLength={10} maxLength={3000} required /></div><Button className="span-2" type="submit" disabled={busy}>Enviar solicitação</Button></form>
      <div className="privacy-request-list">{requests.map((item) => <article key={item.id}><div><strong>{typeLabels[item.requestType] ?? item.requestType}</strong><p>{item.details}</p>{item.resolution && <small>Resposta: {item.resolution}</small>}</div><span><Badge variant="outline">{statusLabels[item.status] ?? item.status}</Badge><time>{displayDate(item.createdAt)}</time></span></article>)}{!requests.length && <p className="control-empty">Nenhuma solicitação registrada.</p>}</div>
    </section>

    {canManage && <section className="surface privacy-recovery-card">
      <div className="panel-heading"><div><small>RECUPERAÇÃO POR 30 DIAS</small><h2>Lixeira de registros</h2></div><Trash2 /></div>
      <p className="members-intro">Itens operacionais excluídos ficam protegidos e podem ser restaurados até a data indicada.</p>
      <div className="recovery-list">{recovery.map((record) => <article key={record.id}><span><strong>{entityLabels[record.entityType] ?? record.entityType}</strong><small>Excluído em {displayDate(record.deletedAt)} · disponível até {displayDate(record.expiresAt)}</small></span><Button variant="outline" size="sm" onClick={() => void restore(record)} disabled={busy}><RotateCcw />Restaurar</Button></article>)}{!recovery.length && <p className="control-empty">A lixeira está vazia.</p>}</div>
    </section>}
  </div>;
}
