"use client";

import { useEffect } from "react";

const labels: Record<string, string> = {
  "Visão geral": "dashboard",
  CRM: "crm",
  "Orçamentos": "quotes",
  Agenda: "agenda",
  "Ordens de serviço": "orders",
  Garantias: "warranties",
  "Clientes e piscinas": "customers",
  Contratos: "contracts",
  Estoque: "inventory",
  Financeiro: "finance",
  Equipe: "team",
};

function moduleButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".main-sidebar button"))
    .map((button) => ({
      button,
      label: String(button.textContent ?? "").trim(),
    }))
    .filter((item) => labels[item.label]);
}

function hideButton(button: HTMLButtonElement, hidden: boolean) {
  const container = button.closest("li") ?? button;
  if (container instanceof HTMLElement) container.hidden = hidden;
}

export function ModuleAccessGuard() {
  useEffect(() => {
    let permissions = new Set<string>();
    let activeOrganizationId = "";
    let observer: MutationObserver | null = null;
    let disposed = false;

    function applyPermissions() {
      const items = moduleButtons();
      if (!items.length) return;

      for (const item of items) {
        hideButton(item.button, !permissions.has(labels[item.label]));
      }

      const active = items.find((item) => item.button.getAttribute("data-active") === "true" || item.button.getAttribute("aria-current") === "page");
      if (active && !permissions.has(labels[active.label])) {
        const firstAllowed = items.find((item) => permissions.has(labels[item.label]));
        firstAllowed?.button.click();
      } else if (!active && !permissions.has("dashboard")) {
        const dashboard = items.find((item) => item.label === "Visão geral");
        const firstAllowed = items.find((item) => permissions.has(labels[item.label]));
        if (dashboard && dashboard.button.offsetParent !== null && !permissions.has("dashboard")) firstAllowed?.button.click();
      }
    }

    async function loadPermissions(organizationId: string) {
      if (!organizationId || disposed) return;
      activeOrganizationId = organizationId;
      try {
        const response = await fetch("/api/access", {
          headers: { "x-organization-id": organizationId },
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.assign("/api/auth/logout");
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar as permissões.");
        if (activeOrganizationId !== organizationId || disposed) return;
        permissions = new Set(Array.isArray(payload.permissions) ? payload.permissions.map(String) : []);
        applyPermissions();
      } catch (error) {
        console.error("module_access_guard_failed", error);
        permissions = new Set();
        applyPermissions();
      }
    }

    function bindSwitcher() {
      const select = document.querySelector<HTMLSelectElement>(".company-switcher");
      if (!select) return false;
      const onChange = () => {
        const value = select.value;
        if (!value || value === "__new__") return;
        window.setTimeout(() => void loadPermissions(value), 0);
      };
      select.addEventListener("change", onChange);
      void loadPermissions(select.value);
      return () => select.removeEventListener("change", onChange);
    }

    let unbind: (() => void) | false = false;
    const tryBind = () => {
      if (unbind) return;
      const result = bindSwitcher();
      if (result) unbind = result;
    };

    tryBind();
    observer = new MutationObserver(() => {
      tryBind();
      if (permissions.size || activeOrganizationId) applyPermissions();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (unbind) unbind();
    };
  }, []);

  return null;
}
