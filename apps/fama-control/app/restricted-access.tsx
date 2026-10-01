"use client";

import { LockKeyhole, LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RestrictedAccess({ signOutPath }: { signOutPath: string }) {
  return <main className="control-locked">
    <div className="control-locked-card">
      <span className="control-locked-icon"><LockKeyhole /></span>
      <p className="control-kicker">Fama Control</p>
      <h1>Acesso exclusivo do proprietário</h1>
      <p>Este painel é separado do Fama System e não fica disponível para usuários de empresas. Entre com a conta proprietária autorizada.</p>
      <div className="control-locked-note"><ShieldAlert /><span>O acesso é validado no servidor antes de qualquer dado ser carregado.</span></div>
      <Button variant="outline" asChild><a href={signOutPath} target="_top"><LogOut /> Sair</a></Button>
    </div>
  </main>;
}
