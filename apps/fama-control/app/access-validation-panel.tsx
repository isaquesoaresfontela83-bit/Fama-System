"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, FlaskConical, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ValidationRun } from "@/lib/access-validation";

export function AccessValidationPanel({ onComplete }: { onComplete: () => void }) {
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/admin/validation", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(payload => { if (payload?.run) setRun(payload.run); }).catch(() => undefined);
  }, []);

  async function step(stage: string, runId?: string) {
    const response = await fetch("/api/admin/validation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, runId }) });
    const payload = await response.json() as { run?: ValidationRun; error?: string };
    if (!response.ok || !payload.run) throw new Error(payload.error ?? "A validação não foi concluída.");
    setRun(payload.run);
    return payload.run;
  }

  async function validate() {
    setBusy(true); setError("");
    let current: ValidationRun | undefined;
    try {
      setProgress("Cadastrando e conferindo o acesso gratuito…");
      current = await step("start");
      if (current.failed) throw new Error(current.error);
      setProgress("Conferindo usuários, funções e isolamento…");
      current = await step("members", current.runId);
      if (current.failed) throw new Error(current.error);
      setProgress("Conferindo mensalidade e bloqueios…");
      current = await step("access", current.runId);
      if (current.failed) throw new Error(current.error);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A validação não foi concluída."); }
    finally {
      // A lost response can follow a committed creation. Recover the server's
      // cleanup handle rather than assuming that no resources were created.
      if (!current) {
        try {
          const recovery = await fetch("/api/admin/validation", { cache: "no-store" });
          const payload = await recovery.json() as { run?: ValidationRun };
          if (recovery.ok && payload.run && !payload.run.cleaned) current = payload.run;
        } catch { /* The next page load exposes the pending cleanup action. */ }
      }
      if (current) {
        setProgress("Removendo as contas e os dados temporários…");
        try {
          const cleaned = await step("cleanup", current.runId);
          if (!cleaned.cleaned) setError(cleaned.error ?? "A remoção dos dados de teste está pendente.");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "A remoção dos dados de teste está pendente."); }
      }
      setProgress(""); setBusy(false); onComplete();
    }
  }

  async function remove() {
    if (!run) return;
    setBusy(true); setError(""); setProgress("Removendo os dados temporários…");
    try {
      const cleaned = await step("cleanup", run.runId);
      if (!cleaned.cleaned) setError(cleaned.error ?? "A remoção está pendente.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A remoção está pendente."); }
    finally { setBusy(false); setProgress(""); onComplete(); }
  }

  return <div className="access-validation-panel" aria-live="polite">
    <div className="access-validation-heading"><div><p className="control-kicker">TESTE DESCARTÁVEL</p><h3>Validar empresas e acessos</h3><p>Confere o cadastro, o login, as funções, a isenção e o bloqueio com contas temporárias. Remove as contas e os registros de teste ao terminar.</p></div><Button variant="outline" onClick={() => void validate()} disabled={busy || Boolean(run && !run.cleaned)}>{busy ? <LoaderCircle className="access-validation-spinner" /> : <FlaskConical />}{busy ? "Validando…" : "Validar acesso gratuito"}</Button></div>
    {progress && <p className="access-validation-progress">{progress}</p>}
    {error && <p role="alert" className="access-validation-error">{error}</p>}
    {run && <><div className="access-validation-summary"><strong>{run.cleaned && !run.failed ? "Validação concluída" : run.cleaned ? "Validação com pendências" : "Remoção de dados temporários pendente"}</strong><span>{run.checks.filter(item => item.passed).length} conferência(s) confirmada(s) · {run.cleaned ? "Dados temporários removidos" : "Há dados temporários no banco"}</span></div><ul className="access-validation-checks">{run.checks.map((item, index) => <li key={`${item.id}-${index}`}>{item.passed ? <CheckCircle2 /> : <CircleAlert />}<span>{item.label}</span></li>)}</ul><p className="access-validation-note">O teste de mensalidade verifica as regras de acesso. Ele não gera cobranças nem confirma recebimentos de Pix.</p>{!run.cleaned && !busy && <Button variant="outline" onClick={() => void remove()}><Trash2 />Remover dados temporários</Button>}</>}
  </div>;
}
