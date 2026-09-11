"use client";

import { useEffect } from "react";

function normalizePermissionLabel(label: HTMLLabelElement) {
  const textNodes = Array.from(label.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE,
  );
  for (const node of textNodes) {
    if ((node.textContent ?? "").trim().toLowerCase() === "members") {
      node.textContent = " Usuários e empresas";
    }
  }
}

function hardenRoleSelect(select: HTMLSelectElement) {
  const ownerOption = Array.from(select.options).find(
    (option) => option.value === "owner",
  );

  // O proprietário real chega do backend com o select desabilitado.
  // Para qualquer outro vínculo, "Proprietário" não pode ser escolhido
  // localmente, evitando que o painel force acesso total antes de salvar.
  if (!select.disabled && ownerOption) {
    ownerOption.remove();
  }
}

function applyFixes() {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
  for (const select of selects) {
    const hasAdmin = Array.from(select.options).some((option) => option.value === "admin");
    const hasMember = Array.from(select.options).some((option) => option.value === "member");
    const hasTechnician = Array.from(select.options).some((option) => option.value === "technician");
    if (hasAdmin && hasMember && hasTechnician) hardenRoleSelect(select);
  }

  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  for (const label of labels) normalizePermissionLabel(label);
}

export function ControlPermissionUiGuard() {
  useEffect(() => {
    applyFixes();
    const observer = new MutationObserver(applyFixes);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
