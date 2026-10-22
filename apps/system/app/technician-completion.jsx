"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RecordAttachments } from "./record-attachments";
import { serviceChecklist } from "@/lib/work-order-report";
import { serviceNotes } from "@/lib/service-profit";
function Signature({ onChange }) {
    const ref = useRef(null);
    const drawing = useRef(false);
    function point(event) { const canvas = ref.current; const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height]; }
    function start(event) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; const ctx = ref.current.getContext("2d"); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#16243b"; ctx.beginPath(); const [x, y] = point(event); ctx.moveTo(x, y); }
    function move(event) { if (!drawing.current)
        return; const ctx = ref.current.getContext("2d"); const [x, y] = point(event); ctx.lineTo(x, y); ctx.stroke(); onChange(ref.current.toDataURL("image/png")); }
    return <div className="service-signature"><canvas ref={ref} width={600} height={160} aria-label="Área para assinatura do cliente" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }}/><Button type="button" size="sm" variant="outline" onClick={() => { ref.current.getContext("2d").clearRect(0, 0, 600, 160); onChange(""); }}>Limpar assinatura</Button></div>;
}
export function TechnicianCompletion({ order, organizationId, canManageCosts, onClose, onSubmit }) {
    const [signature, setSignature] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const notes = serviceNotes(order.notes);
    async function submit(event) { event.preventDefault(); if (busy)
        return; if (!signature) {
        setError("Peça ao cliente para assinar a área abaixo.");
        return;
    } setError(""); setBusy(true); try {
        await onSubmit(event);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível concluir o atendimento.");
    }
    finally {
        setBusy(false);
    } }
    return <Dialog open onOpenChange={open => { if (!open && !busy)
        onClose(); }}><DialogContent className="technician-completion-dialog"><DialogHeader><DialogTitle>Finalizar atendimento</DialogTitle><DialogDescription>{order.osNumber + " · " + order.clientName}</DialogDescription></DialogHeader>
    <div className="service-photo-grid"><RecordAttachments organizationId={organizationId} entity="workOrders" recordId={order.id} canDelete={false} photoStage="antes"/><RecordAttachments organizationId={organizationId} entity="workOrders" recordId={order.id} canDelete={false} photoStage="depois"/></div>
    <form onSubmit={submit} className="record-form"><fieldset className="span-2 service-checklist"><legend>Checklist executado</legend>{serviceChecklist.map(item => <label key={item.name}><input type="checkbox" name={item.name}/><span>{item.label}</span></label>)}</fieldset>
      <label>pH<Input name="ph" type="number" step="0.1" min="0" max="14" defaultValue={order.ph ?? ""}/></label><label>Cloro livre (ppm)<Input name="chlorine" type="number" step="0.1" min="0" max="100" defaultValue={order.chlorine ?? ""}/></label><label>Alcalinidade (ppm)<Input name="alkalinity" type="number" step="0.1" min="0" max="2000" defaultValue={order.alkalinity ?? ""}/></label>
      <label className="span-2">Produtos e quantidades utilizados<Input name="productsUsed" maxLength={4000} defaultValue={order.productsUsed} placeholder="Ex.: cloro 200 g; algicida 100 ml"/></label>
      {canManageCosts && <>{["productCost", "laborCost", "travelCost"].map((key, index) => <label key={key}>{["Produtos", "Mão de obra", "Deslocamento"][index]} (R$)<Input name={key} inputMode="decimal" defaultValue={String(notes.details[key] ?? "")} placeholder="0,00"/></label>)}</>}
      <label className="span-2">Relatório do atendimento<textarea name="summary" minLength={5} maxLength={4000} required placeholder="Descreva os serviços executados e as recomendações."/></label>
      <label className="span-2">Nome do cliente ou responsável<Input name="customerName" maxLength={160} defaultValue={order.clientName} required/></label>
      <div className="span-2"><strong>Assinatura do cliente</strong><p>O cliente confirma neste aparelho a execução descrita.</p><Signature onChange={setSignature}/><input type="hidden" name="signature" value={signature}/></div>
      <label className="span-2 work-order-confirm"><input name="confirmed" type="checkbox" required/><span>O cliente revisou e confirmou o relatório do atendimento.</span></label>
      {error && <p className="span-2" role="alert">{error}</p>}<div className="span-2 service-completion-actions"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Voltar</Button><Button disabled={busy}>{busy ? "Salvando atendimento…" : "Salvar e concluir"}</Button></div>
    </form></DialogContent></Dialog>;
}
