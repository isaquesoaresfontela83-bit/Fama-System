"use client";

import { FormEvent, useEffect, useState } from "react";
import { Download, FileImage, FileText, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteButton } from "./delete-button";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function RecordAttachments({
  organizationId,
  entity,
  recordId,
  canDelete,
}: {
  organizationId: string;
  entity: string;
  recordId: string;
  canDelete: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const headers = { "x-organization-id": organizationId };

  useEffect(() => {
    const params = new URLSearchParams({ entity, entityId: recordId });
    fetch(`/api/attachments?${params}`, { headers: { "x-organization-id": organizationId } })
      .then(async (response) => {
        const payload = await response.json() as { available?: boolean; attachments?: Attachment[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os arquivos.");
        setAvailable(Boolean(payload.available));
        setAttachments(payload.attachments ?? []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar os arquivos."))
      .finally(() => setLoading(false));
  }, [entity, organizationId, recordId]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return toast.error("Selecione um arquivo.");
    data.set("entity", entity);
    data.set("entityId", recordId);
    setUploading(true);
    try {
      const response = await fetch("/api/attachments", { method: "POST", headers, body: data });
      const payload = await response.json() as { attachment?: Attachment; error?: string };
      if (!response.ok || !payload.attachment) throw new Error(payload.error || "Não foi possível enviar o arquivo.");
      setAttachments((current) => [payload.attachment!, ...current]);
      form.reset();
      toast.success("Arquivo anexado com segurança.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachment: Attachment) {
    const response = await fetch(`/api/attachments/${attachment.id}?entity=${encodeURIComponent(entity)}`, { method: "DELETE", headers });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Não foi possível excluir o arquivo.");
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    toast.success("Arquivo excluído.");
  }

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!available) return null;

  return <section className="record-files">
    <header><div><Paperclip /><span><strong>Arquivos do registro</strong><small>{entity === "fiscalInvoices" ? "PDF até 10 MB · XML até 1 MB" : "PDFs e fotos, até 10 MB"}</small></span></div><b>{attachments.length}</b></header>
    <form onSubmit={upload}>
      <Input name="file" type="file" accept={entity === "fiscalInvoices" ? "application/pdf,.xml" : "application/pdf,image/jpeg,image/png,image/webp"} aria-label="Selecionar arquivo" required />
      <Button type="submit" size="sm" disabled={uploading}>{uploading ? "Enviando…" : <><Upload />Anexar</>}</Button>
    </form>
    {attachments.length ? <div className="record-file-list">{attachments.map((attachment) => <article key={attachment.id}>
      <span className="file-icon">{attachment.mimeType.startsWith("image/") ? <FileImage /> : <FileText />}</span>
      <div><strong>{attachment.fileName}</strong><small>{fileSize(attachment.sizeBytes)} · {new Date(attachment.createdAt).toLocaleDateString("pt-BR")}</small></div>
      <Button variant="ghost" size="icon-sm" asChild aria-label={`Baixar ${attachment.fileName}`}><a href={attachment.downloadUrl} target="_blank" rel="noreferrer"><Download /></a></Button>
      {canDelete && <DeleteButton label={`o arquivo ${attachment.fileName}`} onDelete={() => remove(attachment)} />}
    </article>)}</div> : <p className="record-files-empty">Nenhum arquivo anexado.</p>}
  </section>;
}
