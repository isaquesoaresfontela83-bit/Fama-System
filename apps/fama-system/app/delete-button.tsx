"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteButton({ label, onDelete, compact = true }: { label: string; onDelete: () => Promise<void>; compact?: boolean }) {
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    try {
      await onDelete();
    } finally {
      setPending(false);
    }
  }

  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size={compact ? "icon-sm" : "sm"} className="delete-trigger" aria-label={`Excluir ${label}`}>
        <Trash2 />{!compact && "Excluir"}
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
        <AlertDialogDescription>Você está prestes a excluir {label}. Esta ação não pode ser desfeita.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void confirmDelete()}>{pending ? "Excluindo…" : "Excluir definitivamente"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
