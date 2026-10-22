import { env } from "cloudflare:workers";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";
import { selectRows } from "@/lib/supabase";
export async function GET() {
    try {
        await requirePlatformAdmin();
        const [backups, connected, remote] = await Promise.allSettled([
            selectRows("fama_full_backup_runs", {}, { order: "created_at.desc", limit: 10 }),
            selectRows("organizations", {}, { select: "id", limit: 1 }),
            (env.FAMA_SYSTEM?.fetch ? env.FAMA_SYSTEM.fetch.bind(env.FAMA_SYSTEM) : fetch)("https://famasystem.online/api/internal/operation-health", { headers: { Authorization: "Bearer " + String(env.FAMA_BACKUP_SERVICE_TOKEN ?? "") }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8000) }).then(async (response) => { if (!response.ok)
                throw new Error("System indisponível."); return response.json(); }),
        ]);
        const checks = [{ id: "database", label: "Banco de dados", state: connected.status === "fulfilled" ? "ok" : "error", detail: connected.status === "fulfilled" ? "Consulta autenticada concluída." : "Não foi possível consultar o banco.", lastAt: new Date().toISOString() }];
        if (backups.status === "fulfilled") {
            const latest = backups.value[0], lastGood = backups.value.find(row => row.status === "complete" && row.manifest?.verification?.valid === true);
            const date = lastGood?.completed_at ? String(lastGood.completed_at) : null;
            const age = date ? Date.now() - Date.parse(date) : NaN;
            const fresh = Number.isFinite(age) && age >= 0 && age < 48 * 3600000;
            checks.push({ id: "backup", label: "Backup completo", state: latest?.status === "failed" ? "error" : fresh ? "ok" : "warning", detail: latest?.status === "failed" ? "A execução mais recente falhou. Consulte os registros do backup." : fresh ? "Última execução completa e verificada dentro de 48 horas." : "Não há backup completo recente comprovado.", lastAt: date });
        }
        else
            checks.push({ id: "backup", label: "Backup completo", state: "unknown", detail: "A consulta de backups não respondeu.", lastAt: null });
        let events = [];
        if (remote.status === "fulfilled") {
            const data = remote.value;
            events = data.events ?? [];
            const paid = (data.payments?.checkouts ?? []).reduce((total, row) => total + (["paid", "activated"].includes(row.status) ? Number(row.count) : 0), 0);
            const recentError = (category) => events.find(event => event.category === category)?.outcome === "error";
            const last = (category) => String(events.find(event => event.category === category)?.occurredAt ?? "") || null;
            checks.push({ id: "system", label: "Operação do Fama System", state: "ok", detail: "Diagnóstico autenticado recebido do System.", lastAt: data.checkedAt });
            checks.push({ id: "payments", label: "Pagamentos e eventos", state: recentError("payments") ? "error" : !data.payments?.configured ? "warning" : paid ? "ok" : "warning", detail: recentError("payments") ? "A última operação registrada falhou. Confira o código no histórico." : !data.payments?.configured ? "Integração de cobrança não configurada." : paid ? "Há confirmação registrada de contratação paga." : "Integração configurada; contratação paga ainda sem comprovação registrada.", lastAt: last("payments") ?? data.payments?.webhook?.lastAt ?? null });
            checks.push({ id: "email", label: "E-mails de autenticação", state: recentError("email") ? "error" : "unknown", detail: recentError("email") ? "Falha registrada na solicitação de recuperação." : last("email") ? "Solicitação aceita pelo serviço; recebimento na caixa ainda não comprovado." : "Entrega de e-mail ainda não comprovada.", lastAt: last("email") });
            const issued = (data.fiscal?.invoices ?? []).some((row) => row.status === "emitida" && Number(row.count) > 0);
            checks.push({ id: "fiscal", label: "Emissão fiscal", state: recentError("fiscal") ? "error" : issued ? "ok" : "warning", detail: recentError("fiscal") ? "A última operação fiscal registrada falhou." : issued ? "Há nota com emissão registrada." : "Emissão efetiva ainda sem comprovação registrada.", lastAt: last("fiscal") });
        }
        else
            checks.push({ id: "system", label: "Operação do Fama System", state: "error", detail: "O diagnóstico do System não respondeu. Verifique a comunicação entre os sistemas.", lastAt: null });
        return Response.json({ checks, events, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return tenantError(error, "Não foi possível conferir a saúde da plataforma.");
    }
}
